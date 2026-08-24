# Plan de implementación: SPEC-223 — Digest semanal al CEO

## 1. Resumen ejecutivo

Esta spec entrega la acción D del BRIEF-ANALISIS-DINERO-VS-VALOR (§8.4, decisión D-78): un resumen semanal proactivo al CEO. No implementa el motor de reglas (SPEC-221), el score (SPEC-220), el panel (SPEC-222) ni la detección de anomalías (SPEC-225): solo los LEE. Cuatro pilares:

1. **Job semanal**: schedule pg-boss `analisis-digest-semanal` en `scripts/worker-reportes.mjs`, molde `motor-deriva-semanal`.
2. **Módulo de negocio**: `src/lib/analisis/digest-semanal.ts` — ventana Bogotá, KPIs, secciones, persistencia idempotente de `DigestSemanal`.
3. **Integración Motor Notif**: evento `analisis.digest.semanal` + reglas EMAIL/IN_APP + plantillas, todo sembrado; envío exclusivo por `motor.programar()`.
4. **Configuración y auditoría**: parámetros `analisis.digest.*` en seed y `AuditLog` SYSTEM con acciones `ANALISIS_DIGEST_*` aditivas.

## 2. Decisiones de arquitectura

### 2.1 Dónde vive el schedule: `worker-reportes.mjs`, no worker nuevo

Los schedules semanales ya viven en `scripts/worker-reportes.mjs` (`colegio-resumen-semanal` línea 550, `motor-deriva-semanal` línea 571), ambos con `{ tz: "America/Bogota" }` y lógica en un módulo importable de `src/lib/**` que deja el worker delgado. Se sigue ese molde exacto.

- **Alternativa considerada**: worker propio `scripts/worker-analisis.mjs` con advisory lock. Descartada para esta spec: el digest corre 1 vez/semana y la lógica cabe en un handler; crear un proceso más para un job semanal viola KISS y AGENTS.md ("nunca dejar más de un worker" se refiere al de reportes, pero menos procesos = menos superficie). Si SPEC-221 crea un worker de análisis para la evaluación de reglas, el schedule puede migrarse allá en una refactorización posterior sin cambiar el módulo de negocio.
- **Cron derivado de parámetros**: al arrancar, el worker lee `analisis.digest.dia_semana` (1) y `analisis.digest.hora_bogota` (8) y compone el cron `0 {hora} * * {dia}` (molde `worker-tasas.mjs`, que deriva su cron de parámetro). El cambio de parámetro toma efecto al reiniciar el worker (documentado en quickstart).

### 2.2 Módulo de negocio: `src/lib/analisis/digest-semanal.ts`

Namespace nuevo `src/lib/analisis/` (el del brief, `analisis.*`). OJO: ya existe `src/lib/analytics/` (SPEC-218, analítica de pagos) — es un módulo distinto; no se mezclan. Molde copiado de `src/lib/motor/deriva-semanal.ts` (módulo importable, retorna resultado tipado, nunca lanza al worker) y de `src/lib/colegio/avisos-resumen.ts` (un fallo por destinatario no detiene a los demás; idempotencia por clave única).

API propuesta:

```typescript
export interface ResultadoDigestSemanal {
    ejecutada: boolean;             // false si enabled=false
    motivo?: string;
    periodo?: string;               // "2026-W34"
    generados?: number;
    enviados?: number;
    fallidos?: number;
    omitidos?: number;
}

export async function ejecutarDigestSemanal(ahora?: Date): Promise<ResultadoDigestSemanal>;
export async function generarDigestParaDestinatario(
    destinatario: DestinatarioDigest,  // { usuarioId?: string; email: string }
    ventana: VentanaSemanal,           // { desde, hasta, periodo }
): Promise<"enviado" | "omitido" | "fallido">;
```

### 2.3 Generación y envío en UN solo job (no "generar domingo, enviar lunes")

El brief §8.4 menciona "se genera el domingo noche, se envía lunes 8am", pero el instructivo radica "Job cron lunes 8am Bogotá · generación DigestSemanal · envío". Se implementa un solo job lunes 8am que genera y envía en la misma corrida.

- **Alternativa considerada**: dos schedules (domingo genera, lunes envía lo persistido). Descartada: dobla la superficie de fallo, exige reconciliar estados entre dos jobs y no aporta valor al CEO (el contenido del lunes 8am es idéntico al del domingo noche: la semana ya cerró). Si ZEUS quiere pre-generación, se añade como schedule extra llamando al mismo módulo.

### 2.4 Envío exclusivo por `motor.programar()` — y la limitación texto plano

Candado del instructivo: "Usa motor.programar (Motor Notif ya en prod)". Consecuencia directa verificada en código: `enviarEmailNotificacion` (`src/lib/email.ts:501-511`) envía solo `text:` a Resend — **el motor hoy no renderiza HTML**. Decisión: la plantilla EMAIL se redacta en Markdown legible como texto plano (encabezados, listas, tabla ASCII simple); el "HTML con branding PI" del brief §11 queda documentado como deuda/diferido hasta que el motor soporte canal HTML (cambio que pertenece al Motor Notif, no a esta spec — no se toca el motor).

- **Alternativa considerada**: enviar el HTML por Resend directo (`src/lib/email.ts`) fuera del motor. Descartada: viola el candado del instructivo, rompe opt-out/quiet-hours/reintentos del motor (D-70/D-71).

### 2.5 Contenido y fuentes de datos (todo lectura, cero IA — D-75)

| Sección | Fuente | Notas |
|---|---|---|
| Top 5 decisiones | `Recomendacion` PENDIENTE, `prioridad DESC, generadaEn DESC`, take 5 | SPEC-221 |
| KPIs semana + deltas | `Pago` (`AUTORIZADO`, `fechaAutorizacion` en ventana), `Suscripcion` (`createdAt`, `canceladaEn`), `ScoreCliente` | Definiciones exactas en `data-model.md` §4 |
| Anomalías | `Anomalia` con `detectadaEn` en ventana | Solo si SPEC-225 ya está; si no, sección vacía |
| Ganadores/perdedores | `ScoreCliente` del período, top 3 / bottom 3 por `scoreTotal` | Nombre visible = colegio o titular de la suscripción (cliente B2B, no PII de menores) |
| Recomendaciones del sistema | Reglas simples sobre KPIs (crecimiento/caída por ciudad > `analisis.anomalias.crecimiento_pct_umbral`) | Heurística fija en código, sin IA |
| Enlace panel | `NEXT_PUBLIC_APP_URL` + `/dashboard/admin/estadisticas/dinero-vs-valor` | SPEC-222 |

La semana operativa anterior se calcula con el patrón de `semanaAnteriorBogota` (`src/lib/motor/deriva.ts:186-190`): `hasta = lunes 00:00 Bogotá de la semana actual`, `desde = hasta - 7 días`. El `periodo` ISO (`"2026-W34"`) se deriva de `desde` en America/Bogota con `date-fns` (`getISOWeek`, `getISOWeekYear`) sobre el zoned time — nunca con `Date` nativo (D-69).

### 2.6 Idempotencia en dos capas

1. **Persistencia**: `@@unique([periodo, destinatarioId])` en `DigestSemanal`; upsert; si estado = `ENVIADO` → no-op.
2. **Envío**: el propio `motor.programar` cancela y reemplaza programaciones futuras duplicadas por (evento, sujeto, destinatario, canal) (`src/lib/notificaciones/motor.ts:118-129`).

### 2.7 Auditoría SYSTEM

`logAudit` (`src/lib/audit.ts:18`) ya soporta `usuarioId` omitido → `null`, e `ipAddress: "worker"`/`userAgent: "worker"` pasan sin hashear (molde `avisos-resumen.ts:95-108`). Se añaden al enum `AccionAudit` de forma aditiva: `ANALISIS_DIGEST_GENERADO`, `ANALISIS_DIGEST_ENVIADO`, `ANALISIS_DIGEST_FALLIDO`. Metadatos: solo agregados (periodo, conteos, motivo de fallo truncado a 500 chars). Nunca textos de reportes.

## 3. Flujo detallado del job

```text
Handler schedule `analisis-digest-semanal` (worker-reportes.mjs):
1. Llamar ejecutarDigestSemanal().
2. Leer parámetros analisis.digest.* — si enabled=false → log + return.
3. Calcular ventana semana anterior Bogotá + periodo ISO.
4. Resolver destinatarios:
   a. analisis.digest.destinatarios_emails (coma) → emails válidos; inválidos → warn.
   b. Si vacío → usuarios rol ADMIN activos (email + usuarioId).
   c. Si ninguno → AuditLog FALLIDO motivo=sin_destinatarios + return.
5. Calcular una vez el contenido base de la semana (top5, KPIs, anomalías, ganadores/perdedores, recomendaciones, enlacePanel).
6. Por cada destinatario (molde enviarResumenesSemanales):
   a. Upsert DigestSemanal (periodo, destinatarioId) — si ENVIADO → omitido.
   b. motor.programar({ evento: "analisis.digest.semanal", sujetoTipo: "DigestSemanal", sujetoId: digest.id, destinatarios: [{ usuarioId?, email, variables }] }).
   c. programadas > 0 → estado ENVIADO + enviadoEn + AuditLog ANALISIS_DIGEST_ENVIADO.
      programadas = 0 por falta de reglas → FALLIDO + AuditLog ANALISIS_DIGEST_FALLIDO.
      Todas omitidas por preferencia → ENVIADO con metadatos omitidas_por_preferencia.
   d. Excepción → FALLIDO (motivo ≤500 chars) + AuditLog; continuar con el siguiente.
7. Log resumen [Analisis/Digest] periodo: X enviados, Y fallidos, Z omitidos.
```

## 4. Estructura de archivos propuesta

```text
src/lib/analisis/
  digest-semanal.ts            # lógica del job (generación + envío)
  digest-semanal.test.ts       # tests unitarios/integración
  semana.ts                    # ventana Bogotá + periodo ISO (o reutilizar helper de SPEC-220 si ya existe)
  semana.test.ts

scripts/
  worker-reportes.mjs          # +schedule `analisis-digest-semanal` (molde motor-deriva-semanal)

prisma/
  schema.prisma                # +3 valores enum AccionAudit (aditivo); DigestSemanal solo si SPEC-220 no la creó
  seed.ts                      # +params analisis.digest.*, +evento/reglas/plantillas Motor Notif

specs/223-digest-semanal/
  spec.md, plan.md, research.md, data-model.md, quickstart.md, checklists/requirements.md
```

Sin `contracts/`: no hay endpoints nuevos (FR-017). La configuración se edita en la pantalla existente de parámetros (D-72).

## 5. Plantilla del digest (Markdown, canal EMAIL e IN_APP)

Asunto: `Resumen semanal PI · {{periodo}} · Top 5 decisiones para esta semana`

Cuerpo (estructura; el texto final se siembra en `NotificacionPlantilla`):

```text
# Tu resumen semanal · {{fechaInicio}} – {{fechaFin}}

## Top 5 decisiones para esta semana
{{top5Decisiones}}

## KPIs de la semana
{{tablaKpis}}

## Anomalías detectadas ({{numAnomalias}})
{{anomalias}}

## Ganadores y perdedores
{{ganadoresPerdedores}}

## Recomendaciones del sistema
{{recomendacionesSistema}}

Abrir panel completo: {{enlacePanel}}

Canales oficiales: Línea 141 ICBF · CAI Virtual · Te Protejo.
Puedes desactivar este resumen en tu perfil de notificaciones.
```

Las variables llegan pre-renderizadas como strings Markdown desde el módulo (el renderer del motor hace reemplazo literal de `{{tokens}}`, `src/lib/notificaciones/renderer.ts:8-26` — no soporta loops, por eso las listas se arman en el módulo).

## 6. Fases de implementación

1. **Fase 1 — Modelo y seed**: valores `AccionAudit` aditivos (+ migración `DigestSemanal` si SPEC-220 no la entregó); seed de parámetros, evento, reglas y plantillas (idempotente).
2. **Fase 2 — Semana y KPIs**: `semana.ts` (ventana + periodo ISO) y cálculo de secciones con DAL/repositorios; tests de frontera.
3. **Fase 3 — Módulo digest**: `digest-semanal.ts` (resolución de destinatarios, persistencia, envío por motor); tests de integración.
4. **Fase 4 — Schedule**: registro en `worker-reportes.mjs`.
5. **Fase 5 — Validación**: gate local completo + quickstart.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| SPEC-220/221 no mergeadas aún en la rama | Dependencia declarada; si `DigestSemanal` no existe, esta spec la migra aditivamente (§data-model). Top 5 vacío si no hay `Recomendacion`. |
| SPEC-225 (anomalías) en paralelo | Detección en runtime del modelo/sección vacía; cero acoplamiento de imports. |
| Digest duplicado por retry pg-boss | Unicidad `(periodo, destinatarioId)` + guard por estado `ENVIADO` + dedup propio del motor. |
| Corte de semana erróneo cerca de medianoche | `date-fns-tz` en todo; tests 23:59/00:01 y cambio de año ISO. |
| Email sin HTML (expectativa del brief §11) | Documentado como limitación del motor; Markdown legible; deuda explícita para ZEUS. |
| Parámetro de hora cambiado sin reinicio | Documentado: el cron se deriva al arranque del worker; `dev-restart.sh` lo aplica. |
