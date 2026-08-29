# TASKS — SPEC-125 (bloque R6)

## Fase 1 — Mecanismo unificado

- [x] T001 Crear `src/lib/worker-auth.ts` (`verificarWorkerSecret`, única copia del chequeo)
- [x] T002 [P] Test unitario `src/lib/worker-auth.test.ts` (sin secreto → 403, erróneo → 403, correcto → ok)
- [x] T003 Esquemas nuevos en `src/lib/validators.ts` (login, verificar ×3, fallback, procesar, consulta, recuperar/validar)
- [x] T004 Commit mecanismo → `3b62ec5f`

## Fase 2 — Rutas públicas de auth

- [x] T005 Migrar `src/app/api/auth/login/route.ts` a `loginSchema` (mensajes intactos) + test 400/200
- [x] T006 Commit login → `0f9eb8ac`
- [x] T007 Migrar `auth/verificar/solicitar` a `verificarSolicitarSchema` + test
- [x] T008 [P] Migrar `auth/verificar/validar` a `verificarValidarSchema` + test nuevo
- [x] T009 [P] Migrar `auth/verificar/completar` a `verificarCompletarSchema` + test nuevo
- [x] T010 [P] Migrar `auth/recuperar/validar` (query token) a esquema + test
- [x] T011 Commit auth/verificar + recuperar → `f70ef7c4`

## Fase 3 — Worker

- [x] T012 Migrar `procesar/helpers/seguridad.ts` a helper + `procesarReporteSchema`; actualizar import en `procesar/route.ts`
- [x] T013 Migrar `reportes/fallback/route.ts` a helper + `fallbackReporteSchema` + test 400
- [x] T014 Commit worker → `dc503bdf`

## Fase 4 — Consulta pública tolerante

- [x] T015 Migrar POST de `consulta/route.ts` y `consulta/detalle/route.ts` a `consultaBodySchema` (`.catch`, nunca 400) + test
- [x] T016 Commit consulta → `46d20634`

## Fase 5 — Logger

- [x] T017 Codemod `console.error/warn` → `logger.*` en `src/app/api/**/route.ts` (30 archivos); corregidos 2 mensajes sin prefijo `[Módulo]`
- [x] T018 Commit logger → `8919f6f8`

## Fase 6 — Cierre

- [x] T019 Gate bajo candado: tsc + lint + tests tocados + build; suite completa (1215/1217; único fallo = entrada pendiente en specs/README.md, zona de ZEUS)
- [x] T020 `specs/125-validacion-unificada-api/cierre.md` + sección Implementación en spec.md + commit docs
