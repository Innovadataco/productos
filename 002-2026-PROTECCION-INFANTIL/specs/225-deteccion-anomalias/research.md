# Research: SPEC-225 — Detección de anomalías dinero-vs-valor

## 1. Contexto del problema

El brief `BRIEF-ANALISIS-DINERO-VS-VALOR.md` define el módulo Análisis como el "cerebro comercial" del CEO: no dashboards, sino detección proactiva. La §5.6 define el modelo `Anomalia` y la §8.3 (acción C, decisión D-78 del instructivo) fija los eventos críticos que exigen email inmediato: cancelación de un colegio grande, caída de recaudo >30% en una ciudad y >5 cancelaciones en 24h; todo lo demás espera al digest semanal. El instructivo 002-PI-126 fija el alcance: modelo + worker de reglas simples + alertas email, sin IA.

Sin esta spec, las desviaciones del negocio solo se descubrirían cuando el CEO abra el panel (SPEC-222) o el lunes en el digest (SPEC-223) — demasiado tarde para churn y recaudo.

## 2. Incógnitas resueltas contra el código real

### 2.1 ¿Existe ya un canal de "email inmediato al admin"?

Sí: Motor Notif (SPEC-201..204). La API pública es `programar(input)` en `src/lib/notificaciones/motor.ts:79` (`ProgramarInput` en líneas 17-28: `evento`, `sujetoTipo`, `sujetoId`, `destinatarios[{usuarioId|email, variables}]`). El motor resuelve el email desde `usuarioId` (`resolverEmail`, líneas 66-77), aplica reglas activas por evento (`NotificacionRegla`, `prisma/schema.prisma:2329`), plantillas Markdown (`NotificacionPlantilla`, `prisma/schema.prisma:2311`), quiet hours y encola el envío por pg-boss.

Patrón de uso real con fail-open: `src/app/api/admin/colegios/route.ts:208-224` (evento `colegio.creado`, `try/catch` que no bloquea la operación principal). Patrón de seed idempotente de reglas: `prisma/seed.ts:1918-1955` (`findFirst` por evento+rol+canal → update/create; `plantillaClave = evento.canal.toLowerCase()`).

**Decisión**: sembrar `analisis.anomalia.detectada` (rol ADMIN, EMAIL obligatoria + IN_APP) y llamar `programar` desde el detector. Cero cambios al motor.

### 2.2 ¿Qué patrón de worker seguir?

`scripts/monitor-probes.mjs` (SPEC-171) es el patrón exacto que necesita esta spec: proceso Node con cliente `pg` dedicado, `pg_try_advisory_lock` (`scripts/monitor-probes.mjs:45-60`), tick con relectura de `ParametroSistema` en cada ciclo, `--run-once` implícito en su diseño de ciclo, y arranque vía `dev-restart.sh` (`scripts/dev-restart.sh:29`). Locks ya en uso: `123456789` (worker-reportes, `scripts/worker-reportes.mjs:96`), `123456790` (monitor), `923456789` (simulador-abuso), `987654321` (worker-notificaciones, `scripts/worker-notificaciones.mjs:37`).

**Decisión**: `worker-anomalias.mjs` con lock nuevo (p. ej. `123456792`; verificar colisión con el lock del worker de expediente de SPEC-236 al implementar), tick `analisis.anomalias.tick_min` (default 60).

### 2.3 ¿De dónde salen los datos de cada regla?

- **Mora / cancelaciones / altas**: `Suscripcion` (`prisma/schema.prisma:723-757`): `estado` (enum `EstadoSuscripcion` ACTIVA/EN_GRACIA/SUSPENDIDA/CANCELADA, líneas 258-264), `fechaFin`, `canceladaEn`, `tipoTitular`, `colegioId`, `usuarioId`.
- **Puntualidad y recaudo**: `Pago` (`prisma/schema.prisma:759-792`): `estado` (`EstadoPago`), `fechaReporte`, `fechaAutorizacion`, `montoNetoUSD` (comparable multi-moneda, SPEC-214).
- **Ciudad**: `Colegio.ciudadId` (`prisma/schema.prisma:873-925`) para titulares colegio. Suscripciones de padres (`tipoTitular` PADRE, sin colegio) no tienen ciudad en v1 — se excluyen de las reglas geográficas y se documenta en `datosContexto`.
- **Uso activo**: `SesionLog` (`prisma/schema.prisma:640-662`): `usuarioId`, `tenantId`, `iniciadaEn`, índice `[tenantId, iniciadaEn DESC]` ya existente. La instrumentación existe en el schema (SPEC-INFRA-SESSION-LOG ya aterrizada).
- **"Colegio grande"**: conteo de filas `Reporte` por `tenantId` (`prisma/schema.prisma:1427`); la retención de datos nunca borra filas (patrón SPEC-236), así que el conteo histórico es estable. Nunca se lee `Reporte.texto`.

### 2.4 ¿Cómo se leen los umbrales?

`getParametroSistema` / `getParametroSistemaValor` en `src/lib/parametros.ts:27-39`, con `TipoParametro` INTEGER/FLOAT/BOOLEAN y `CategoriaParametro.SYSTEM` (`prisma/schema.prisma:29-44`). Patrón de seed de parámetros: `prisma/seed.ts:1957+` (upsert por `clave`).

### 2.5 ¿Dónde cuelga la API admin?

Rutas de admin bajo `src/app/api/admin/**` (AGENTS.md §Arquitectura), auth con `verifyAuth` (`src/lib/auth.ts`) + verificación de rol, paginación estándar `{ items, pagination }` (constitution §4.3), errores canónicos `AppError` (`src/lib/errors.ts`). El proxy (`src/lib/proxy.ts`) ya protege `/api/admin/*` para rol ADMIN; se verifica en implementación que la nueva ruta hereda la regla sin tocar el proxy (candado del instructivo: no tocar rate-limit ni proxy del reporte público — `/api/admin/analisis/**` no es ruta pública).

### 2.6 ¿Existe acción de audit adecuada para "resolver anomalía"?

El enum `AccionAudit` (`prisma/schema.prisma:46`) es amplio y específico por módulo. Añadir un valor a un enum de PostgreSQL es aditivo (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`, patrón usado en SPEC-236 data-model §5). **Decisión**: añadir `ANOMALIA_RESUELTA` de forma aditiva; si la convención del lote prefiere reutilizar una acción genérica, se ajusta en implementación sin cambiar el contrato del endpoint.

## 3. Opciones consideradas

### 3.1 ¿Anomalías como reglas editables de SPEC-221 o código cerrado?

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| Filas `ReglaRecomendacion` con SQL libre | Tunables sin deploy, un solo motor | SQL arbitrario en BD, validación frágil, mezcla recomendaciones con alertas críticas | No |
| Reglas en código, umbrales en `ParametroSistema` | Tipado, testeable, diff auditable | Cambiar una regla = deploy | **Sí** |

El brief distingue: las 7 reglas semilla de recomendación (SPEC-221) son configurables/editables; las anomalías de D-78 son un conjunto cerrado definido por el CEO. Los umbrales siguen siendo parametrizables, que era el candado real ("cero deploys para tunear").

### 3.2 ¿Deduplicación por constraint único o en código?

Un índice único parcial `(tipo, sujetoTipo, sujetoId) WHERE resueltaEn IS NULL` sería lo más fuerte, pero `sujetoTipo`/`sujetoId` nulos (anomalías globales) complican la unicidad (`NULL ≠ NULL` en Postgres) y Prisma no expresa índices parciales en schema. **Decisión**: deduplicación en código dentro de la transacción de inserción (`findFirst` + create); el volumen (6 reglas × tick horario) hace improbable la carrera, y el peor caso es una anomalía duplicada visible, no corrupción.

### 3.3 ¿Auto-resolución?

Cuando la condición desaparece (el cliente paga, el recaudo se recupera), la anomalía podría auto-cerrarse. **Decisión**: v1 solo resolución manual (FR-014). La auto-resolución escondería episodios que el CEO debe reconocer; queda como candidata v2.

### 3.4 ¿Qué severidad tiene cada tipo?

El brief solo fija ALTA para los 3 eventos D-78 + mora larga de cliente puntual ("alerta inmediata" §8.3 incluye "cliente históricamente puntual con mora inesperada"). **Decisión**: mora anómala escala MEDIA (≥15d) → ALTA (≥30d) según los dos umbrales del brief §5.7; crecimiento anómalo = BAJA (es buena noticia, va al digest); uso caído = MEDIA; los 3 eventos D-78 = ALTA siempre.

## 4. Cumplimiento y constitución

- **Sin IA / sin `src/lib/ai/**`**: detección 100% SQL (candado del instructivo y brief §2, análogo a D-67).
- **Sin PII en agregados (Ley 1581)**: `datosContexto` solo contiene conteos, porcentajes, umbrales e ids internos; las reglas nunca leen `Reporte.texto` ni datos de menores (FR-008).
- **Presunción de inocencia**: las anomalías describen métricas del negocio (suscripciones, pagos, sesiones), nunca conductas de personas; no cruzan con `IdentificadorReportado`.
- **Canales oficiales**: no aplica (módulo interno de admin, sin interfaz de reporte).
- **Migraciones aditivas**: solo CREATE/ADD; el enum nuevo se crea, no se altera ninguno existente salvo `ADD VALUE` en `AccionAudit`.

## 5. Dependencias del mega-lote

- **SPEC-220/221**: convención de namespace `analisis.*` y coexistencia en la misma rama; esta spec es independiente en datos (no usa `ScoreCliente` ni `Recomendacion`).
- **SPEC-222**: renderizará las anomalías en el tab "Dinero vs Valor"; esta spec entrega la API que esa vista consume.
- **SPEC-223**: el digest incluye las anomalías MEDIA/BAJA de la semana leyendo la tabla `Anomalia` (§11 del brief, sección "🚨 Anomalías detectadas (N)").
- **SPEC-210..218 (Pagos)**: modelos `Suscripcion`/`Pago` ya en schema.

## 6. Preguntas abiertas (para compuerta ZEUS)

1. ¿El valor default de `colegio_grande_min_reportes` = 50 es razonable, o ZEUS prefiere otro N inicial? (parametrizable, sin redeploy).
2. ¿La acción de audit nueva `ANOMALIA_RESUELTA` (ADD VALUE aditivo al enum) es aceptable, o se reutiliza una acción genérica existente?
3. ¿El lock id `123456792` está libre tras la llegada de los workers de SPEC-236 y SPEC-221? Verificar al implementar.
