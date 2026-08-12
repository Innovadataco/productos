# Tasks: SPEC-169 — Onboarding + cobertura + notificaciones in-app

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `model OnboardingColegio` en `prisma/schema.prisma`.
- [ ] Añadir `model NotificacionInApp` con FKs a `Colegio` y `Usuario` e índices.
- [ ] Ampliar el enum `AccionAudit` con valores de onboarding y notificaciones in-app.
- [ ] Asegurar que `Curso`, `Estudiante`, `Estudiante.cursoId` y demás entidades existentes NO se modifican.
- [ ] Generar migración aditiva con backfill de `OnboardingColegio` para colegios existentes.
- [ ] Ejecutar `npx prisma migrate dev` y `npx prisma generate`.

## T002 — Seed y defaults de onboarding
- [ ] Integrar la creación de `OnboardingColegio` en el endpoint de alta de colegio (`src/app/api/admin/colegios/route.ts`).
- [ ] Al crear un colegio, el onboarding debe iniciar en estado `activo` y `pasoActual = "bienvenida"`.
- [ ] Test: al crear colegio se genera exactamente una fila de `OnboardingColegio`.

## T003 — Repositorio OnboardingColegio
- [ ] Crear `src/lib/dal/repositories/onboarding-colegio.ts` (obtenerPorColegio, omitir, reactivar, completar).
- [ ] Aislamiento por `colegioId` en todas las operaciones.
- [ ] Test `src/lib/dal/repositories/onboarding-colegio.test.ts`: A/B + transiciones de estado.

## T004 — Servicio y endpoint de onboarding
- [ ] Crear `src/lib/colegio/onboarding.ts` para calcular el estado de cada paso (cursos, estudiantes, profesores, acudientes, identificadores).
- [ ] Crear `GET /api/colegio/onboarding` que devuelva estado, pasoActual y pasos calculados.
- [ ] Crear `PATCH /api/colegio/onboarding` para omitir/reactivar/marcar-completado manual.
- [ ] Tests de API con A/B y validaciones de estado.

## T005 — Repositorio de cobertura
- [ ] Crear `src/lib/dal/repositories/cobertura.ts` para calcular:
  - total y con-identificador de estudiantes activos;
  - total y con-identificador de profesores activos (tras fase B);
  - total y con-identificador de acudientes activos (tras fase A).
- [ ] Manejar denominador 0 sin errores.
- [ ] Test `src/lib/dal/repositories/cobertura.test.ts`: varios escenarios de cobertura.

## T006 — Endpoint de cobertura
- [ ] Crear `GET /api/colegio/cobertura` que devuelva porcentajes y conteos por sujeto.
- [ ] Validar `colegioId` del usuario autenticado.
- [ ] Tests de API con A/B.

## T007 — Componente Anillos de Cobertura
- [ ] Crear `src/components/modules/colegio/AnillosCobertura.tsx`.
- [ ] Consumir `GET /api/colegio/cobertura` y mostrar tres anillos con color según %.
- [ ] Incluir CTA para completar cuando el % sea < 100.
- [ ] Integrar en `/dashboard/colegio/page.tsx`.
- [ ] Respetar `prefers-reduced-motion`.

## T008 — Repositorio NotificacionInApp
- [ ] Crear `src/lib/dal/repositories/notificacion-in-app.ts` con:
  - listar no archivadas paginadas;
  - marcar como leída;
  - marcar todas como leídas;
  - archivar;
  - contar no leídas;
  - crear notificación (usado por disparadores).
- [ ] Aislamiento por `colegioId`.
- [ ] Test `src/lib/dal/repositories/notificacion-in-app.test.ts`: CRUD + A/B + conteo.

## T009 — Endpoints de notificaciones in-app
- [ ] Crear `GET /api/colegio/notificaciones` (paginado).
- [ ] Crear `GET /api/colegio/notificaciones/resumen` (count no leídas).
- [ ] Crear `PATCH /api/colegio/notificaciones/[id]/leida`.
- [ ] Crear `PATCH /api/colegio/notificaciones/marcar-leidas`.
- [ ] Crear `DELETE /api/colegio/notificaciones/[id]` (archivar, soft delete).
- [ ] Tests de API con A/B y privacidad.

## T010 — Centro de notificaciones UI
- [ ] Crear `src/components/modules/colegio/CentroNotificaciones.tsx` (campana + dropdown + panel).
- [ ] Mostrar badge con conteo de `GET /api/colegio/notificaciones/resumen`.
- [ ] Permitir marcar como leída y archivar desde el dropdown/panel.
- [ ] Integrar en el layout/header del dashboard de colegio.

## T011 — Disparadores de notificaciones
- [ ] Extender el servicio que crea/actualiza `AlertaColegio` para insertar `NotificacionInApp` tipo `ALERTA_NUEVA` / `ALERTA_GESTIONADA` / `ALERTA_ESCALADA`.
- [ ] Crear helper `src/lib/colegio/notificaciones.ts` con plantillas de mensajes predefinidos (sin PII).
- [ ] Añadir notificación `SISTEMA` para eventos relevantes (vencimiento próximo, etc.).
- [ ] Tests de integración: crear alerta → existe notificación.

## T012 — Onboarding UI
- [ ] Crear `src/components/modules/colegio/OnboardingModal.tsx` con pasos calculados.
- [ ] Mostrar CTA a las acciones existentes (crear curso, carga masiva, alta de profesores, etc.).
- [ ] Crear página `/dashboard/colegio/onboarding` para reactivar el wizard.
- [ ] Integrar modal en `/dashboard/colegio/page.tsx` para mostrarse cuando `estado = "activo"`.

## T013 — Auditoría
- [ ] Añadir llamadas a `AuditLog` en endpoints de onboarding (`COLEGIO_ONBOARDING_OMITIDO`, `COLEGIO_ONBOARDING_REACTIVADO`, `COLEGIO_ONBOARDING_COMPLETADO`).
- [ ] Añadir `AuditLog` al marcar como leída/archivar notificaciones (`COLEGIO_NOTIFICACION_LEIDA`, `COLEGIO_NOTIFICACION_ARCHIVADA`).
- [ ] Auditar la creación de notificaciones como metadatos, sin texto del reporte.

## T014 — Tests de componentes y E2E
- [ ] Test de componente `AnillosCobertura`: renderiza porcentajes y CTA.
- [ ] Test de componente `CentroNotificaciones`: badge, marcar leída, archivar.
- [ ] Test de componente `OnboardingModal`: pasos, omitir, reactivar.
- [ ] Añadir tests E2E de Playwright para flujo completo de onboarding y notificaciones.

## T015 — Regeneración de arquitectura
- [ ] Ejecutar `npm run arch:generate` y `npm run arch:check`.
- [ ] Dejar `arch:check` en verde; ajustar oráculos si el cambio lo justifica.

## T016 — Gate y cierre
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run tokens:check`, `npm run arch:check`, `npm run test:coverage`, `npm run build` verdes.
- [ ] Actualizar `specs/169-onboarding-cobertura/spec.md` a `IMPLEMENTADO` y documentar evidencia.
- [ ] Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.
