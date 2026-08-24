# Research: SPEC-223 — Digest semanal al CEO

## 1. Contexto del problema

El módulo Análisis dinero-vs-valor (BRIEF-ANALISIS-DINERO-VS-VALOR, mesa ARQ_12) es el "cerebro comercial" del CEO: reglas SQL + heurísticas, **sin IA** (D-75, mismo criterio D-67 del Motor Notif). Su acción D (§8.4, decisión D-78) es el digest semanal: lunes 8am Bogotá, con top 5 decisiones, KPIs vs semana anterior, anomalías, ganadores/perdedores, recomendaciones del sistema y enlace al panel, enviado por Motor Notificaciones. Sin esta spec, el módulo exige que el CEO abra el panel — justo lo que la filosofía "no dashboards — decisiones" quiere evitar.

## 2. Incógnitas resueltas contra el código real

### 2.1 ¿Cómo se programa un job semanal en este repo?

Resuelto: schedules pg-boss registrados al arranque del worker con `{ tz: "America/Bogota" }`:

- `scripts/worker-reportes.mjs:571` — `boss.schedule("motor-deriva-semanal", "0 7 * * 1", {}, { tz: "America/Bogota" })` (lunes 07:00).
- `scripts/worker-reportes.mjs:550` — `colegio-resumen-semanal`, mismo molde.
- `scripts/worker-tasas.mjs:79` — cron derivado de parámetro (`DEFAULT_CRON = "0 6 * * *"`, línea 15), precedente para componer el cron desde `ParametroSistema`.

**Decisión**: schedule `analisis-digest-semanal` en `worker-reportes.mjs`, cron `0 {hora} * * {dia}` derivado de `analisis.digest.hora_bogota` / `analisis.digest.dia_semana`.

### 2.2 ¿Cómo se calcula "la semana anterior" en Bogotá?

Resuelto: `semanaAnteriorBogota()` en `src/lib/motor/deriva.ts:186-190` — `hasta = lunesSemanaBogota(ahora)`, `desde = hasta - 7 días`, ventana `[desde, hasta)`. `src/lib/fechas/formato-bogota.ts` existe como utilitario de formato. `date-fns` y `date-fns-tz` ya son dependencias (`package.json:38-39`), instaladas por SPEC-200 (D-69).

**Decisión**: helper propio en `src/lib/analisis/semana.ts` (mismo algoritmo) + periodo ISO con `getISOWeek`/`getISOWeekYear` sobre el zoned time. Se reutiliza el helper de SPEC-220 si ya existe al implementar (evitar duplicados, D-72).

### 2.3 ¿Cómo es un "resumen semanal" ya vivo en producción?

Resuelto: `src/lib/colegio/avisos-resumen.ts` (SPEC-149) — el molde más cercano: un módulo importable llamado desde el schedule, idempotente por clave única semanal, un fallo por destinatario no detiene a los demás, `AuditLog` con `ipAddress: "worker"` (líneas 95-108), y resumen en log (líneas 134-137). También `src/lib/motor/deriva-semanal.ts` — retorna resultado tipado, nunca lanza al worker, omite si `enabled=false` (líneas 23-27).

**Decisión**: `digest-semanal.ts` copia esta estructura (handler + función por destinatario + resultado agregado).

### 2.4 ¿Cómo se envía por Motor Notif y qué soporta?

Resuelto: `motor.programar()` (`src/lib/notificaciones/motor.ts:79-163`):

- Busca reglas activas por evento; **si no hay reglas retorna `{ programadas: 0 }` con warn** (líneas 80-84) → la spec debe tratarlo como FALLIDO.
- Resuelve email por `usuarioId` si no viene `email` directo (líneas 64-73) → soporta destinatarios por email sin usuario.
- Consulta preferencia de opt-out por `evento.canal` antes de encolar (líneas 100-108); sin `usuarioId` no hay opt-out (línea 100).
- Dedup: cancela programaciones futuras duplicadas por (evento, sujeto, destinatario, canal) (líneas 118-129).
- Aplica offset y quiet hours (líneas 131-132).
- Plantillas: Markdown con reemplazo literal de `{{tokens}}` (`src/lib/notificaciones/renderer.ts:8-26`) — **sin loops ni condicionales**: las listas del digest deben llegar pre-renderizadas como strings en las variables.
- **Limitación hallada**: `enviarEmailNotificacion` (`src/lib/email.ts:501-511`) envía a Resend solo `text:` — no hay canal HTML hoy. El "HTML con branding" del brief §11 no es alcanzable sin tocar el motor (prohibido). Se documenta como deuda; la plantilla se redacta en Markdown legible como texto plano.

Modelo del motor (`prisma/schema.prisma:2261-2372`): `Notificacion` (estados en español), `NotificacionPlantilla` (`clave`, `canal`, `asunto`, `cuerpoMarkdown`), `NotificacionRegla` (`evento`, `rol`, `offset`, `canal`, `plantillaClave`, `obligatoria`, `activa`), `NotificacionPreferencia` (opt-out por `eventoRegla = "evento.canal"`).

**Decisión**: evento `analisis.digest.semanal` + reglas EMAIL/IN_APP con `obligatoria = false` (opt-out permitido, D-70) + plantillas sembradas idempotente; listas pre-renderizadas en variables.

### 2.5 ¿Existe ya algo del módulo Análisis en la rama?

Resuelto: **no**. `prisma/schema.prisma` no contiene `ScoreCliente`, `ReglaRecomendacion`, `Recomendacion`, `Anomalia` ni `DigestSemanal` (verificado con grep sobre los 2372 lines del schema). `SesionLog` sí existe (línea 640, SPEC-206). Existe `src/lib/analytics/` (SPEC-218, analítica de pagos — módulo distinto). Los modelos §5.1–5.7 del brief corresponden a SPEC-220; `Recomendacion` a SPEC-221; `Anomalia` a SPEC-225.

**Decisión**: dependencias declaradas en spec.md; `DigestSemanal` con plan B aditivo (data-model.md §3); lecturas de `Anomalia` con degradación graceful.

### 2.6 Fuentes de KPIs (verificadas en schema)

- `Pago` (`prisma/schema.prisma:759-792`): `estado` enum `EstadoPago` (`PENDIENTE_AUTORIZACION | AUTORIZADO | RECHAZADO | REEMBOLSADO`, línea 281), `fechaAutorizacion`, `montoNetoUSD`, `montoLocalPagado`, `monedaLocal`. Recaudo = `AUTORIZADO` con `fechaAutorizacion` en ventana.
- `Suscripcion` (`prisma/schema.prisma:723-757`): `createdAt`, `canceladaEn`, `estado`, `tipoTitular`. Nuevas = `createdAt` en ventana; canceladas = `canceladaEn` en ventana.

### 2.7 Auditoría SYSTEM con `usuarioId = null`

Resuelto: `logAudit` (`src/lib/audit.ts:18-52`) acepta `usuarioId` omitido → persiste `null`; `ipAddress: "worker"` / `userAgent: "worker"` no se hashean (función `protegerIp`, líneas 13-17). Enum `AccionAudit` (`prisma/schema.prisma:46-243`) ya recibe valores aditivos por spec (patrón comentado, ej. `COLEGIO_AVISO_ENVIADO` de SPEC-149).

**Decisión**: `ANALISIS_DIGEST_GENERADO | _ENVIADO | _FALLIDO` aditivos; metadatos solo agregados.

### 2.8 Decisiones de gestión aplicables (repo Gestion-de-proyectos, `03-EJECUCION/05-DECISIONES.md`)

- **D-69**: TZ del sistema = America/Bogota; BD en UTC; aritmética con `date-fns-tz`; prohibido `Date` nativo para cortes de día.
- **D-70**: opt-out por evento+canal; `obligatoria=false` permite apagarlo; catálogo se agrega por SPEC (no big-bang) → esta spec siembra su evento.
- **D-72**: reutilizar módulos; config nueva → sección de `/dashboard/admin/configuracion` → no se crean endpoints ni pantallas nuevas.
- **D-75**: módulo Análisis sin IA, 100% reglas + heurísticas.
- **D-78**: digest lunes 8am Bogotá, contenido de 6 secciones, vía Motor Notif canal EMAIL, parametrizable día/hora. (El instructivo cita "D-76" para destinatarios configurables; D-76 trata del score de valor — la decisión del digest es D-78. Se interpreta como referencia cruzada con typo; la parametrización de destinatarios cubre la intención. A auditar por ZEUS.)

## 3. Opciones consideradas (resumen)

| Decisión | Elegida | Alternativa descartada | Por qué |
|---|---|---|---|
| Ubicación del schedule | `worker-reportes.mjs` | Worker nuevo `worker-analisis.mjs` | KISS; molde probado de 2 schedules semanales vivos |
| Generación/envío | Un solo job lunes 8am | Dos jobs (domingo genera, lunes envía) | Mismo contenido, mitad de superficie de fallo |
| Envío | `motor.programar` | Resend directo | Candado del instructivo + D-70/D-71 |
| Formato email | Markdown texto plano | HTML con branding | El motor hoy envía `text:` only (`email.ts:501-511`) |
| Destinatarios | Param emails, fallback ADMIN activos | Hardcode CEO | Brief §17.2 abierto; param lo resuelve sin deploy |

## 4. Referencias

- Instructivo `INSTRUCTIVO-002-PI-124-DIGEST-SEMANAL.MD` (alcance, candados).
- `05-ENTREGABLES/BRIEF-ANALISIS-DINERO-VS-VALOR.md` §8.4 (contenido), §11 (formato), §5.5 (modelo), §17.2 (pregunta abierta destinatarios).
- `03-EJECUCION/05-DECISIONES.md` D-69/D-70/D-71/D-72/D-75/D-78.
- Código: `scripts/worker-reportes.mjs:550,571` · `scripts/worker-tasas.mjs:79` · `src/lib/motor/deriva.ts:186` · `src/lib/motor/deriva-semanal.ts` · `src/lib/colegio/avisos-resumen.ts` · `src/lib/notificaciones/motor.ts:79` · `src/lib/notificaciones/renderer.ts:8` · `src/lib/email.ts:501` · `src/lib/audit.ts:18` · `prisma/schema.prisma:281,613,640,723,759,2261-2372`.

## 5. Preguntas abiertas (para la compuerta de ZEUS)

1. **Destinatarios default**: ¿todos los ADMIN activos (propuesto) o solo el CEO? El brief §17.2 lo dejó abierto al CEO; el parámetro `analisis.digest.destinatarios_emails` lo hace reversible sin deploy.
2. **HTML del digest**: el motor envía texto plano. ¿Se acepta Markdown plano en v1 y se radica el soporte HTML como mejora del Motor Notif, o se quiere HTML en esta spec (implicaría tocar el motor, contra candado)?
3. **Mención "D-76" en el instructivo** para destinatarios configurables: la decisión del digest es D-78 (D-76 es el score). Se asume typo; confirmar.
