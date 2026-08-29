# Checklist de requisitos: SPEC-223 — Digest semanal al CEO

## User Stories

- [ ] US-1: Job semanal genera `DigestSemanal` idempotente.
  - [ ] Schedule lunes 8am Bogotá derivado de `analisis.digest.dia_semana` / `hora_bogota`.
  - [ ] Ventana semana anterior `[desde, hasta)` en America/Bogota; periodo ISO `"YYYY-Wnn"`.
  - [ ] Unicidad `(periodo, destinatarioId)`; re-ejecución no-op si `ENVIADO`; reintento si `FALLIDO`.
  - [ ] `AuditLog` SYSTEM (`usuarioId = null`) por generación/envío/fallo.
- [ ] US-2: Contenido de 6 secciones (D-78).
  - [ ] Top 5 `Recomendacion` PENDIENTE por prioridad.
  - [ ] KPIs semana + deltas vs previa (recaudo, nuevas, canceladas, churn, score promedio).
  - [ ] Anomalías de la semana (vacío graceful si SPEC-225 no está).
  - [ ] Ganadores/perdedores top 3 / bottom 3 `ScoreCliente`.
  - [ ] Recomendaciones del sistema + enlace al panel dinero-vs-valor.
  - [ ] Cero PII: solo agregados de negocio.
- [ ] US-3: Envío por Motor Notif.
  - [ ] Evento `analisis.digest.semanal` + reglas EMAIL/IN_APP (`obligatoria = false`) + plantillas, seed idempotente.
  - [ ] Envío exclusivo por `motor.programar()`.
  - [ ] Opt-out respetado; sin reglas activas → `FALLIDO`.
  - [ ] Plantilla Markdown legible en texto plano (limitación del motor documentada).
- [ ] US-4: Destinatarios configurables.
  - [ ] Param `analisis.digest.destinatarios_emails`; fallback usuarios ADMIN activos.
  - [ ] Correos inválidos omitidos con warn; sin destinatarios → `FALLIDO` con motivo, sin excepción.
- [ ] US-5: Parámetros `analisis.digest.*`.
  - [ ] Seed idempotente; `enabled = false` omite el job.
  - [ ] Cron derivado de parámetros al arranque del worker.

## Functional Requirements

- [ ] FR-001: Schedule `analisis-digest-semanal` en `worker-reportes.mjs` con `tz: America/Bogota`.
- [ ] FR-002: `src/lib/analisis/digest-semanal.ts` con `ejecutarDigestSemanal` + función por destinatario.
- [ ] FR-003: Ventana Bogotá + periodo ISO con `date-fns-tz` (prohibido `Date` nativo para cortes).
- [ ] FR-004: Upsert `DigestSemanal` con estados `GENERADO | ENVIADO | FALLIDO`.
- [ ] FR-005/006/007: Secciones, definiciones de KPI y prohibición de PII.
- [ ] FR-008/009: Catálogo Motor Notif sembrado; envío solo por `motor.programar`.
- [ ] FR-010: Resolución de destinatarios (param / fallback ADMIN / inválidos / vacío).
- [ ] FR-011: `ANALISIS_DIGEST_GENERADO | _ENVIADO | _FALLIDO` aditivos en `AccionAudit`.
- [ ] FR-012/013: Parámetros sembrados; `enabled` apaga el job.
- [ ] FR-014/015: Fallo por destinatario aislado; 0 programadas → `FALLIDO`; opt-out → `ENVIADO` con metadatos.
- [ ] FR-016: Tests de ventana/fronteras, idempotencia, KPIs, destinatarios, opt-out, motor sin reglas, seed.
- [ ] FR-017: Sin endpoints nuevos (config vía `ParametroSistema`, D-72) → sin `contracts/`.

## Success Criteria

- [ ] SC-001: Digest generado y programado en la primera corrida del lunes 8am.
- [ ] SC-002: 0 duplicados en 2 corridas consecutivas.
- [ ] SC-003: Fronteras 23:59/00:01 y cambio de año ISO correctas en tests.
- [ ] SC-004: Default ADMIN activos / param de correos respetado.
- [ ] SC-005: Opt-out sin marcar fallido.
- [ ] SC-006: `AuditLog` SYSTEM sin textos de reportes.
- [ ] SC-007: Gate local verde (`tsc`, `lint`, `test:unit`, `build`).

## Candados y restricciones

- [ ] NO se modificó `src/lib/ai/**` ni rate-limit.
- [ ] NO se modificó el Motor Notif (`src/lib/notificaciones/**`, worker de notificaciones, `enviarEmailNotificacion`); solo seed de catálogo.
- [ ] Migraciones aditivas; cero `DROP` ni destructivas.
- [ ] `Timestamptz(6)` en campos nuevos; TZ Bogotá con `date-fns-tz`.
- [ ] El digest NO incluye textos de reportes, identificadores reportados ni datos de menores.
- [ ] NO se implementa UI nueva (D-72); config en pantalla de parámetros existente.
- [ ] NO se implementa HTML de email (limitación del motor; deuda documentada).
- [ ] NO se leen clasificaciones crudas ni se toca el motor de análisis de SPEC-220/221 (solo lectura de resultados).
- [ ] Terminología criolla; tono UI neutral sin voseo.

## Dependencias externas

- [ ] SPEC-220 (`ScoreCliente`, params `analisis.*`, `DigestSemanal` o plan B aditivo).
- [ ] SPEC-221 (`Recomendacion`).
- [ ] SPEC-225 (`Anomalia`) — opcional, degradación graceful.
- [ ] Motor Notif SPEC-201..204 en prod (PR #83) — ya cumplida.
- [ ] SPEC-222 (panel destino del `enlacePanel`) — el enlace puede existir antes que el panel; validar en integración.
