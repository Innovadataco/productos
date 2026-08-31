# Tasks SPEC-331 · Vigencia cookie sesion_estado por rol

## Fase 1 — Implementación (hotfix, sin fases adicionales)

- [X] T001 Agregar `findVigenciaCliente` al batch paralelo en `sesion-estado-emitter.ts` para obtener `rol` sin tocar `findDebeCambiarPassword`
- [X] T002 Implementar resolver por rol en `buildSesionEstadoValue`: SCHOOL_ADMIN/COMITE_CONVIVENCIA → `verificarVigenciaCliente`; internos → ACTIVA; PARENT → suscripción
- [X] T003 Eliminar lógica duplicada en `vigencia/refresh/route.ts`, delegar en `buildSesionEstadoValue`
- [X] T004 Escribir tests unitarios por rol en `sesion-estado-emitter.test.ts` (12 casos)
- [X] T005 Registrar test en `vitest.unit.includes.ts`
- [X] T006 Agregar fila SPEC-331 en `specs/README.md` + crear `spec.md`, `plan.md`, `tasks.md`
- [X] T007 Correr verificaciones: tsc · lint · tokens:check · arch:check · locks:check · ratchets:check · test:unit VERDE
