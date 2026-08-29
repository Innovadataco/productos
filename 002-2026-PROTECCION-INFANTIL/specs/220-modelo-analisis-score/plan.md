# Plan de implementación: SPEC-220 — Modelo Análisis + score de valor de cliente

## 1. Resumen ejecutivo

Esta SPEC entrega la base del dominio Análisis dinero-vs-valor: 5 modelos aditivos, 2 enums, 13 parámetros `analisis.*`, el servicio de cálculo del score de valor, el worker diario de recálculo + purga de retención, y la primera visualización (card en la ficha de cliente, solo ADMIN). No implementa motor de reglas (SPEC-221), panel (SPEC-222), digest (SPEC-223), editor de reglas (SPEC-224), anomalías (SPEC-225), ejecución automática (SPEC-226) ni historial (SPEC-227) — pero crea las tablas que esas SPECs consumen.

Cuatro pilares:

1. **Modelo de datos** (`prisma/schema.prisma` + migración aditiva + seed).
2. **Servicio de score** (`src/lib/analisis/score.ts`): fórmula parametrizable + percentil de cohorte.
3. **Worker** (`scripts/worker-analisis-score.mjs` + servicio `pi-analisis-score`): recálculo diario y purga de retención, patrón `worker-tasas.mjs`.
4. **Vista** (`analisis-repository.ts` + card en la ficha de cliente existente).

## 2. Decisiones de arquitectura

### 2.1 Score como snapshot mensual con upsert idempotente

- **Ubicación**: `src/lib/analisis/score.ts` (servicio puro sobre Prisma) + `src/lib/dal/repositories/analisis-repository.ts` (lectura para UI).
- **Período**: string `"YYYY-MM"` calculado con día calendario `America/Bogota` (librería de fechas con TZ ya usada en el repo; si no hay helper compartido, se calcula con `Intl.DateTimeFormat` con `timeZone: "America/Bogota"` — sin dependencias nuevas).
- **Idempotencia**: `@@unique([suscripcionId, periodo])` + `prisma.scoreCliente.upsert`. El job puede correr N veces al día sin duplicar.
- **Snapshot de pesos**: los 4 pesos se leen de `ParametroSistema` al inicio de la corrida y se guardan en la fila. Esto hace auditable cada score histórico ("¿con qué pesos se calculó?") y desacopla el histórico de tunning posterior.
- **Percentil de cohorte**: segunda pasada tras los upserts — agrupa por `(tipoTitular, periodo)` y asigna percentil 0–100 por posición de `scoreTotal` (rank con empates resueltos por promedio de posiciones). Cohorte unitaria → `null`.
- **Alternativas consideradas**:
  | Opción | Pros | Contras | Decisión |
  |---|---|---|---|
  | Snapshot mensual con upsert | Histórico auditable, idempotente, consultas baratas | Requiere job periódico | Sí |
  | Cálculo on-the-fly en cada vista | Sin job | Cuentas pesadas en cada render, sin histórico, sin percentil | No |
  | Tabla de pesos versionada | Historial de pesos completo | Overkill: el snapshot por fila ya audita | No |

### 2.2 Mapeo de componentes por tipo de titular

El brief define los componentes (`REPORTES`, `CASOS`, `ALERTAS`, `SESIONES`) pero no su fuente exacta; el mapeo se fija contra el schema real:

| Componente | Titular COLEGIO (`colegioId`) | Titular PADRE (`usuarioId`) |
|---|---|---|
| Reportes | `Reporte.tenantId = Colegio.tenantId`, `eliminado = false`, `creadoEn` en período | `Reporte.usuarioId = Suscripcion.usuarioId`, `eliminado = false`, `creadoEn` en período |
| Casos | `SeguimientoCaso.colegioId`, `creadoEn` en período | `Expediente.padreUsuarioId`, `fechaApertura` en período |
| Alertas | `AlertaColegio.colegioId`, `creadoEn` en período | **0 en v1** ([NEEDS CLARIFICATION] en spec.md) |
| Sesiones | `SesionLog.tenantId = Colegio.tenantId`, `iniciadaEn` en período | `SesionLog.usuarioId`, `iniciadaEn` en período |

- **Divergencia documentada**: el brief §5.1 proponía `SesionLog.suscripcionId`; el modelo real de SPEC-206 (`prisma/schema.prisma:640`) no lo tiene. Se usa `usuarioId`/`tenantId` y NO se añade columna (cambio mínimo, cero migración sobre tabla en prod).
- Todo el cálculo usa `count` agregado: nunca se lee texto de reportes ni PII (constitución §1.2/§6.3).

### 2.3 Worker: pg-boss schedule + advisory lock (patrón `worker-tasas.mjs`)

- **Modelo**: proceso Node independiente `scripts/worker-analisis-score.mjs` que programa un job pg-boss (`boss.schedule("analisis-score-recalculo", cron, {}, { tz: "America/Bogota" })`) y lo atiende en el mismo proceso.
- **Cron**: derivado de `analisis.score.frecuencia_recalculo_horas` (default 24 → una corrida diaria en madrugada Bogotá, p. ej. `30 3 * * *`), igual que `getCron()` de `worker-tasas.mjs:64`.
- **Advisory lock**: id nuevo (los existentes son `123456789` worker-reportes y `123456790` worker-tasas; se usará `123456791`), con salida código 2 si está tomado.
- **Cada corrida ejecuta**: (1) `recalcularScoresPeriodo()` del mes actual; (2) `purgarSnapshotsAntiguos()` según `analisis.score.retencion_meses`.
- **Alternativas consideradas**: endpoint HTTP + cron externo (rechazado: el repo ya estandarizó workers pg-boss con schedule interno); tick con `setInterval` estilo SPEC-236 (rechazado: el recálculo es diario, pg-boss schedule es más simple y persistente).

### 2.4 Retención: DELETE del detalle + AuditLog

- Los snapshots de `ScoreCliente` son agregados sin PII (conteos por suscripción/mes). A diferencia de los textos sensibles de expedientes (SPEC-236, overwrite `[retenido]`), aquí la purga es `DELETE` de filas con `periodo` más antiguo que la ventana: no hay texto sensible que preservar y el brief §14 lo define como "purga detalle".
- La comparación se hace por string de período (`YYYY-MM` del mes actual Bogotá menos N meses), no por timestamps — evita errores de frontera horaria.
- Un `AuditLog` por corrida de purga con metadatos `{ filasEliminadas, periodoLimite }` (patrón `ipAddress: "worker"`, ya usado en `src/lib/colegio/avisos.ts:257`).
- El "agregado a resumen histórico" del brief §14 se simplifica en v1 (ver Assumptions del spec.md); si se requiere consolidado de largo plazo será SPEC posterior.

### 2.5 Vista: Server Component + repositorio, sin endpoints nuevos

- La ficha `src/app/dashboard/admin/pagos/cliente/[id]/page.tsx` ya es Server Component que llama directamente a `PagosRepository.obtenerFichaCliente` (línea 18). La card del score sigue el mismo patrón: la página llama a `AnalisisRepository.obtenerScoreCliente(id)` y renderiza.
- **No se crea endpoint API** ni se modifica `GET /api/admin/pagos/cliente/[id]` (mantener el contrato de Pagos intacto; el score es lectura de otro dominio). Por eso esta SPEC no tiene `contracts/`.
- **Alternativa considerada**: endpoint `GET /api/admin/analisis/score/[suscripcionId]` + componente cliente — rechazada por innecesaria en una página server-side (más superficie de API, más rate-limit, más tests, mismo resultado).
- **Puerta de acceso**: se reutiliza `verifyAuth("ADMIN")` + `assertModulo(admin, "pagos_admin")` ya existentes en la página. No se crea módulo nuevo en esta SPEC; el módulo/tab de análisis corresponde a SPEC-222.
- **UI**: card consistente con el sistema visual heredado (vidrio Apple, Instrument, radios 16/12/22, color `ambar` para admin), textos neutrales sin voseo, terminología del brief §3. Estado vacío neutral cuando no hay score calculado.

## 3. Flujos detallados

### 3.1 Recálculo del período

```text
recalcularScoresPeriodo(periodo?):
1. periodo = param o mes actual en America/Bogota ("YYYY-MM").
2. Leer pesos: analisis.score.peso_{reportes,casos,alertas,sesiones} (fallback defaults 3/5/2/1).
3. suscripciones = findMany({ estado: in [ACTIVA, EN_GRACIA], include: colegio }).
4. Por cada suscripción:
   a. Si tipoTitular = COLEGIO y tiene colegio:
      reportes = count Reporte { tenantId: colegio.tenantId, eliminado: false, creadoEn: rangoMes }
      casos    = count SeguimientoCaso { colegioId, creadoEn: rangoMes }
      alertas  = count AlertaColegio { colegioId, creadoEn: rangoMes }
      sesiones = count SesionLog { tenantId: colegio.tenantId, iniciadaEn: rangoMes }
   b. Si tipoTitular = PADRE y tiene usuarioId:
      reportes = count Reporte { usuarioId, eliminado: false, creadoEn: rangoMes }
      casos    = count Expediente { padreUsuarioId: usuarioId, fechaApertura: rangoMes }
      alertas  = 0
      sesiones = count SesionLog { usuarioId, iniciadaEn: rangoMes }
   c. scoreTotal = reportes*pR + casos*pC + alertas*pA + sesiones*pS
   d. upsert ScoreCliente por (suscripcionId, periodo) con componentes, pesos y scoreTotal.
5. Percentiles: por cada cohorte (tipoTitular) del período,
   ordenar por scoreTotal y asignar percentil 0-100; cohorte de 1 miembro → null.
6. Log: [ANALISIS-SCORE] Recalculo: N suscripciones — periodo=YYYY-MM
```

`rangoMes` = `[inicioMes, finMes)` en `America/Bogota` convertido a instantes UTC para la query.

### 3.2 Purga de retención

```text
purgarSnapshotsAntiguos():
1. retencionMeses = param analisis.score.retencion_meses (default 24).
2. periodoLimite = mes actual Bogotá - retencionMeses ("YYYY-MM").
3. eliminadas = deleteMany ScoreCliente { periodo < periodoLimite }  // comparación lexicográfica válida por formato
4. Si eliminadas.count > 0: AuditLog { accion: ANALISIS_SCORE_PURGA (nuevo valor de enum, aditivo),
   tipoRecurso: "ScoreCliente", metadatos: { filasEliminadas, periodoLimite }, ipAddress: "worker" }.
```

### 3.3 Seed

```text
prisma/seed.ts — nueva sección (upsert por clave, CategoriaParametro.SYSTEM):
  analisis.score.peso_reportes FLOAT 3
  analisis.score.peso_casos FLOAT 5
  analisis.score.peso_alertas FLOAT 2
  analisis.score.peso_sesiones FLOAT 1
  analisis.score.frecuencia_recalculo_horas INTEGER 24
  analisis.score.retencion_meses INTEGER 24
  analisis.recomendaciones.frecuencia_evaluacion_min INTEGER 60
  analisis.digest.dia_semana INTEGER 1
  analisis.digest.hora_bogota INTEGER 8
  analisis.anomalias.crecimiento_pct_umbral FLOAT 25
  analisis.anomalias.mora_dias_umbral_alta INTEGER 30
  analisis.anomalias.mora_dias_umbral_media INTEGER 15
```

Nota: los parámetros de sesiones (`analisis.sesiones.*`) ya los sembró SPEC-206; no se duplican aquí.

## 4. Estructura de archivos propuesta

```text
prisma/
  schema.prisma                        # +5 modelos, +2 enums, +1 valor enum AccionAudit, relaciones inversas
  migrations/<ts>_analisis_modelo_score/   # migración aditiva generada
  seed.ts                              # +13 parámetros analisis.*

src/lib/analisis/
  score.ts                             # recalcularScoresPeriodo + purgarSnapshotsAntiguos
  score.test.ts
  periodos.ts                          # helpers de período YYYY-MM en America/Bogota
  periodos.test.ts

src/lib/dal/repositories/
  analisis-repository.ts               # obtenerScoreCliente (período actual + histórico 12m)
  analisis-repository.test.ts

src/app/dashboard/admin/pagos/cliente/[id]/
  page.tsx                             # + card "Score de valor este mes" (Server Component)

src/components/modules/pagos/
  ScoreClienteCard.tsx                 # card de score (presentacional)
  ScoreClienteCard.test.tsx

scripts/
  worker-analisis-score.mjs            # advisory lock + pg-boss schedule + handler

docker-compose.prod.yml                # + servicio pi-analisis-score

specs/220-modelo-analisis-score/
  spec.md, plan.md, research.md, data-model.md, quickstart.md
  checklists/requirements.md
```

## 5. Interfaz pública

### 5.1 Servicio de score

```typescript
// src/lib/analisis/score.ts
export interface ResultadoRecalculo {
  periodo: string;
  suscripcionesProcesadas: number;
  duracionMs: number;
}

export async function recalcularScoresPeriodo(periodo?: string): Promise<ResultadoRecalculo>;
export async function purgarSnapshotsAntiguos(): Promise<{ filasEliminadas: number; periodoLimite: string }>;
```

### 5.2 Repositorio (lectura UI)

```typescript
// src/lib/dal/repositories/analisis-repository.ts
export interface ScoreClienteVista {
  periodo: string;
  scoreTotal: number;
  componentes: { reportes: number; casos: number; alertas: number; sesiones: number };
  pesos: { reportes: number; casos: number; alertas: number; sesiones: number };
  percentilEnCohorte: number | null;
  calculadoEn: Date;
}

export class AnalisisRepository {
  obtenerScoreCliente(suscripcionId: string): Promise<{
    actual: ScoreClienteVista | null;
    historico: ScoreClienteVista[]; // hasta 12 períodos, descendente
  }>;
}
```

### 5.3 Worker

```text
node --import tsx scripts/worker-analisis-score.mjs
# Cola pg-boss: analisis-score-recalculo · cron desde param (default diario 03:30 Bogotá)
# Advisory lock: 123456791 · exit 2 si ya hay instancia
# Handler: recalcularScoresPeriodo() + purgarSnapshotsAntiguos()
```

## 6. Fases de implementación

1. **Fase 1 — Modelo y migración**: enums + 5 modelos + relaciones inversas en `Suscripcion`/`Usuario`/`ReglaRecomendacion` + valor `AccionAudit`; `npx prisma migrate dev` (aditiva).
2. **Fase 2 — Seed**: 13 parámetros `analisis.*` con upsert idempotente.
3. **Fase 3 — Servicio de score**: `periodos.ts` + `score.ts` con tests de fórmula, mapeo por titular, idempotencia, percentil y purga.
4. **Fase 4 — Worker + Docker**: `worker-analisis-score.mjs` + servicio `pi-analisis-score`.
5. **Fase 5 — Vista**: `analisis-repository.ts` + `ScoreClienteCard.tsx` + integración en la ficha + tests de render.
6. **Fase 6 — Validación**: gate local completo + `./scripts/dev-restart.sh` + quickstart.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Conteos por suscripción escalan mal con muchos clientes | 4 `count` indexados por suscripción; batch secuencial; SC-002 fija 100 suscripciones < 60 s. Si crece, paginar en Fase posterior. |
| Sesiones de colegio con `tenantId = null` no cuentan | Documentado en Assumptions; corresponde a SPEC-206 poblar `tenantId` consistentemente. |
| Percentil con empates distorsiona ranking | Rank con promedio de posiciones en empates; cohorte unitaria → null. |
| Frontera de mes en UTC vs Bogotá | Rango del mes calculado en `America/Bogota` y convertido a instantes UTC; tests de frontera 23:59/00:01. |
| Purga borra de más si el param queda en valor absurdo (ej. 0) | Validar `retencionMeses >= 1` con fallback a 24 y log de advertencia. |
| Cambios de schema en SPEC-210 posteriores | Esta SPEC solo añade relación inversa a `Suscripcion`; no toca columnas. |
