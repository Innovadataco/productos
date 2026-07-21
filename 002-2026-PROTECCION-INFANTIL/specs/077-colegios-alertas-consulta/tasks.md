# Tasks: Colegios · Fase 4 — Alertas y Consulta anonimizada

## Phase 1 — Modelo y migración

- **T001** `prisma/schema.prisma`: agregar `AlertaColegio` y relaciones inversas.
- **T002** `prisma/migrations/20260721_add_alerta_colegio`: crear migración aditiva.
- **T003** Backup de BD antes de aplicar migración.
- **T004** `npx prisma migrate deploy` aplicar migración en dev.

## Phase 2 — Matching y lógica de alertas

- **T005** `src/lib/colegio/alertas.ts`: crear `notificarColegioSiCorresponde(reporteId)` con matching, filtro de colegios vigentes, upsert de alertas.
- **T006** `src/lib/colegio/alertas.ts`: helper `listarAlertasColegio(colegioId, estado?)` que NO exponga PII.
- **T007** `src/lib/colegio/alertas.ts`: helper `cambiarEstadoAlerta(alertaId, colegioId, estado)` con validación de propiedad.
- **T008** Tests unitarios de `alertas.ts` (matching, upsert, filtro PII).

## Phase 3 — Worker

- **T009** `scripts/worker-reportes.mjs`: llamar `notificarColegioSiCorresponde(reporteId)` tras `notificarCambioCirculoSiCorresponde`.
- **T010** Verificar que el worker no falla si el matching de colegio falla.

## Phase 4 — Endpoints

- **T011** `src/app/api/colegio/alertas/route.ts`: GET con `verifyAuth("SCHOOL_ADMIN")`, `verificarVigenciaColegio`, rate-limit, sin PII.
- **T012** `src/app/api/colegio/alertas/[id]/estado/route.ts`: PATCH estado con validación de propiedad.
- **T013** `src/lib/schemas/index.ts`: agregar `alertaEstadoSchema` y `alertaIdParamsSchema`.
- **T014** Agregar acciones `COLEGIO_ALERTA_CREADA`, `COLEGIO_ALERTA_ESTADO` a `AuditLog`.

## Phase 5 — Notificaciones (P2)

- **T015** `src/lib/email.ts`: función `enviarAlertaColegio(email, cantidad)` con mensaje genérico.
- **T016** Integrar envío de email en `notificarColegioSiCorresponde` con cooldown y parámetro `colegio.notificaciones.enabled`.
- **T017** Tests de notificaciones.

## Phase 6 — UI

- **T018** `src/app/dashboard/colegio/alertas/page.tsx`: listado de alertas con tema verde.
- **T019** Componente de alerta con botones para marcar vista/gestionada.
- **T020** Actualizar `ColegioNav` para incluir "Alertas".
- **T021** Estado vacío y mensajes de privacidad.

## Phase 7 — Tests de integración

- **T022** `src/app/api/colegio/alertas/route.test.ts`: listado, aislamiento, privacidad, reporte dado de baja, cambio de estado.
- **T023** Tests de worker integration: procesar reporte y verificar creación de alerta.
- **T024** Tests de duplicados: segundo reporte con mismo identificador no crea alerta duplicada.

## Phase 8 — Validación y cierre

- **T025** `npx tsc --noEmit`.
- **T026** `npm run lint`.
- **T027** `npx vitest run` (meta: ≥678 tests verdes).
- **T028** `npm run build`.
- **T029** `./scripts/dev-restart.sh` (deploy limpio, un worker, healthcheck).
- **T030** Probar quickstart.md.
- **T031** Actualizar `specs/077-colegios-alertas-consulta/spec.md` sección Implementación.
- **T032** Crear `specs/077-colegios-alertas-consulta/cierre.md` con evidencia.
- **T033** Commit por US + docs; push a `feature/001-scaffolding`.
- **T034** Marcar Status CERRADA en `spec.md`.
