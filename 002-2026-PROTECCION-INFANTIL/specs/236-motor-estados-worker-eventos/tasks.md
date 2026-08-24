# Tareas: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif

## Fase 1 — Preparación y dependencias

- **T001 [Bloqueante]**: Confirmar merge de PR #83 (Motor Notif) antes de integración final.
- **T002 [P]**: Revisar diff de SPEC-234 para alinear nombres de campos de `Expediente`, `EventoExpediente`, `InformeConsolidado`, `Aclaracion`.
- **T003 [P]**: Leer `docs/architecture/` si el cambio altera schema, proxy o navegación; regenerar si es necesario y dejar `npm run arch:check` verde.

## Fase 2 — Modelo y seed

- **T010 [P]**: Añadir/verificar enums `EstadoExpediente`, `ScoreGravedad`, `EstadoAprobacion`, `EstadoAclaracion` en `prisma/schema.prisma` (aditivo).
- **T011 [P]**: Añadir relaciones inversas en `Expediente` hacia `EventoExpediente`, `InformeConsolidado`, `Aclaracion` (aditivas).
- **T012 [P]**: Añadir índices aditivos en `Expediente`, `EventoExpediente`, `InformeConsolidado`, `Aclaracion`.
- **T013 [P]**: Generar migración aditiva `npx prisma migrate dev` (sin destructivas).
- **T014 [P]**: Añadir función `seedPadreExpedienteParams()` en `prisma/seed.ts` con upsert idempotente de:
  - `padre.expediente.consolidacion_min_reportes`
  - `padre.expediente.motor.tick_min`
  - `padre.expediente.auto_cierre_meses`
  - `padre.expediente.retencion_cerrados_meses`
- **T015 [P]**: Añadir función `seedMotorNotifExpedienteEvents()` en `prisma/seed.ts` con upsert idempotente de 11 eventos + templates `es`.
- **T016 [P]**: Test de seed idempotente: `prisma/seed.test.ts` o test en `tasks.md`.

## Fase 3 — Máquina de estados (TDD)

- **T020 [P]**: Crear `src/lib/expediente/types.ts` con tipos compartidos (si no existen en SPEC-234).
- **T021 [P]**: Crear `src/lib/expediente/estados/transiciones.ts` con mapa `EstadoActual → {destino, guard, nota}`.
  - Archivo: `src/lib/expediente/estados/transiciones.ts`
- **T022 [P]**: Crear tests `src/lib/expediente/estados/transiciones.test.ts` validando whitelist.
- **T023 [P]**: Crear `src/lib/expediente/estados/aplicar-transicion.ts` con TX, AuditLog, publicación de evento.
  - Archivo: `src/lib/expediente/estados/aplicar-transicion.ts`
- **T024 [P]**: Crear tests `src/lib/expediente/estados/aplicar-transicion.test.ts`:
  - Transiciones válidas ( todas las de §User Story 1).
  - Transiciones inválidas.
  - Guard `CERRADO → *` rechaza.
  - Cada guard falla cuando no se cumplen condiciones.
- **T025 [P]**: Crear `src/lib/expediente/estados/publicar-evento-expediente.ts` wrapper a Motor Notif.
  - Archivo: `src/lib/expediente/estados/publicar-evento-expediente.ts`

## Fase 4 — Endpoint interno

- **T030 [P]**: Crear `src/app/api/interno/expediente/[id]/transicionar/route.ts`.
  - Validación Zod.
  - Verificación rol ADMIN o service-account.
  - Delegación a `aplicarTransicion`.
- **T031 [P]**: Crear tests `src/app/api/interno/expediente/[id]/transicionar/route.test.ts`:
  - 200 ADMIN válido.
  - 403 PARENT.
  - 409 guard falla.
  - 404 expediente no existe.
  - service-account si aplica.

## Fase 5 — Worker

- **T040 [P]**: Crear `scripts/worker-expediente-motor.mjs` con advisory lock propio y `TZ=America/Bogota`.
- **T041 [P]**: Implementar loop de tick usando `padre.expediente.motor.tick_min`.
- **T042 [P]**: Implementar auto-cierre `ACTIVO → CERRADO` por inactividad con `date-fns-tz`.
- **T043 [P]**: Implementar recálculo de score 24h y publicación `expediente.gravedad.subio_a_rojo`.
- **T044 [P]**: Implementar vigilancia SLA 48h/12h y publicación `expediente.comite.sla_vencido`.
- **T045 [P]**: Implementar purga de retención (overwrite a `[retenido]`, AuditLog, no delete).
- **T046 [P]**: Crear tests `scripts/worker-expediente-motor.test.ts`:
  - Auto-cierre con clock 23:59/00:01.
  - SLA vencido Bogotá.
  - Subida AMARILLO→ROJO.
  - Purga sin borrar.
  - Advisory lock segunda instancia sale con código 2.

## Fase 6 — Infraestructura Docker

- **T050 [P]**: Añadir servicio `pi-expediente-motor` en `docker-compose.prod.yml` con `TZ=America/Bogota`.
- **T051 [P]**: Actualizar `scripts/dev-restart.sh` si es necesario para levantar/verificar el worker de expediente en desarrollo (sin romper regla de un solo worker de reportes).

## Fase 7 — Motor Notif (requiere PR #83)

- **T060 [P]**: Confirmar tablas `EventoNotificacion` y `NotificacionTemplate` de PR #83.
- **T061 [P]**: Definir 11 claves de evento en seed.
- **T062 [P]**: Definir templates Handlebars-like en español para cada evento.
- **T063 [P]**: Test de renderizado de templates con variables de ejemplo.
- **T064 [P]**: Integrar `publicar-evento-expediente.ts` con API de PR #83.

## Fase 8 — Validación y cierre

- **T070 [P]**: `npx tsc --noEmit`.
- **T071 [P]**: `npm run lint -- --no-cache`.
- **T072 [P]**: `npm run test`.
- **T073 [P]**: `npm run build`.
- **T074 [P]**: `./scripts/dev-restart.sh`.
- **T075 [P]**: Ejecutar quickstart.md manualmente.
- **T076 [P]**: Completar sección Implementación en `spec.md`.
- **T077 [P]**: Crear `specs/236-motor-estados-worker-eventos/cierre.md`.
- **T078 [P]**: Commit por User Story + commit de docs.
- **T079 [Bloqueante]**: Push solo tras merge de PR #83.

## Notas de orden

- T020-T024 dependen de T010-T013.
- T030-T031 dependen de T023.
- T040-T045 dependen de T023 y T014.
- T060-T064 dependen de T001 (PR #83).
- T070-T074 deben ejecutarse tras todas las tareas de código.
