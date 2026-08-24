# Checklist de requisitos: SPEC-236

## User Stories

- [ ] US-1: El sistema gobierna transiciones de estado de un expediente.
  - [ ] ACTIVO → CONSOLIDANDO con guard de `numEventos`.
  - [ ] CONSOLIDANDO → PENDIENTE_COMITE con guard de informe consolidado.
  - [ ] PENDIENTE_COMITE → EN_APROBACION_PADRE con guard de aprobación.
  - [ ] EN_APROBACION_PADRE ↔ EN_ACLARACION con guards de aclaración.
  - [ ] EN_APROBACION_PADRE → CERRADO con guard de aceptación/cierre forzado.
  - [ ] CERRADO → * prohibido (hard guard).
  - [ ] CERRADO → ESCALADO permitido para padre en v1.
- [ ] US-2: Worker cierra por inactividad y vigila SLA.
  - [ ] Tick cada `padre.expediente.motor.tick_min`.
  - [ ] Auto-cierre `ACTIVO → CERRADO` por inactividad.
  - [ ] Recálculo de score 24h y evento `expediente.gravedad.subio_a_rojo`.
  - [ ] SLA 48h normal / 12h ROJO y evento `expediente.comite.sla_vencido`.
- [ ] US-3: Retención de expedientes cerrados.
  - [ ] Reemplaza textos por `[retenido]`.
  - [ ] No elimina filas.
  - [ ] Registra `AuditLog`.
- [ ] US-4: 11 eventos de Motor Notif.
  - [ ] Catálogo con 11 claves.
  - [ ] Templates en español Handlebars-like.
  - [ ] Seed idempotente.
- [ ] US-5: Endpoint interno de transición.
  - [ ] `POST /api/interno/expediente/[id]/transicionar`.
  - [ ] Rol ADMIN o service-account.
  - [ ] Delega a `aplicarTransicion`.

## Functional Requirements

- [ ] FR-001: Mapa de transiciones en `src/lib/expediente/estados/transiciones.ts`.
- [ ] FR-002: `aplicar-transicion.ts` con TX, AuditLog y publicación de evento.
- [ ] FR-003 a FR-011: Guards implementados y testeados.
- [ ] FR-012 a FR-016: Worker con advisory lock, TZ, tick, auto-cierre, gravedad, SLA, retención.
- [ ] FR-017: Servicio `pi-expediente-motor` en `docker-compose.prod.yml`.
- [ ] FR-018/019: 11 eventos/templates de Motor Notif.
- [ ] FR-020/021: Endpoint interno con Zod y proxy.
- [ ] FR-022: Seed idempotente de parámetros y eventos/templates.
- [ ] FR-023: Tests unitarios/integración.

## Success Criteria

- [ ] SC-001: `aplicarTransicion` < 200 ms y rechaza inválidas con código canónico.
- [ ] SC-002: Auto-cierre correcto en frontera 23:59/00:01 America/Bogota.
- [ ] SC-003: SLA vencido publicado una vez por ventana.
- [ ] SC-004: Subida a ROJO detectada en ciclo 24h.
- [ ] SC-005: Purga sin borrar filas.
- [ ] SC-006: 11 eventos/templates seed idempotente y renderizable.
- [ ] SC-007: Endpoint 200/403/409 según caso.
- [ ] SC-008: Gate local verde (`tsc`, `lint`, `test`, `build`, `dev-restart`).

## Candados y restricciones

- [ ] NO se modificó `src/lib/ai/**`.
- [ ] NO se modificó código de Motor Notif (solo catálogo + templates aditivos).
- [ ] NO se modificaron columnas de `Expediente`/`EventoExpediente`/`InformeConsolidado` (solo relaciones inversas aditivas).
- [ ] Migraciones aditivas, sin `DROP` ni destructivas.
- [ ] Timestamptz(6) en campos nuevos.
- [ ] DAL Q-3: acceso a datos por repositorios tipados.
- [ ] NO se implementó UI padre aceptar/aclarar (SPEC-232).
- [ ] NO se implementó flujo de aclaración (SPEC-238).
- [ ] NO se implementó escalación ROJO automática (SPEC-239).
- [ ] NO se implementó bandeja comité consolidación (SPEC-237).

## Dependencias externas

- [ ] PR #83 (Motor Notif) mergeado antes del push final.
- [ ] SPEC-234 modelo base disponible en la rama.
