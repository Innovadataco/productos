# Tasks — SPEC-113: El colegio atrapado (I-35/I-35b) y menú por rol (I-36)

**Input**: plan.md, spec.md, research.md, data-model.md, quickstart.md de
`/specs/113-colegio-atrapado-menu-rol/` | **Branch**: `feature/001-scaffolding`

> Nota de flujo: `tasks.md` se genera en compuerta para cumplir el gate de la SPEC-107.
> `speckit-implement` NO se corre hasta la aprobación de ZEUS (compuerta §4).

## Fase 1: I-35 (🔴) — el endpoint que la pantalla llama

- [x] T001 [I-35] ROJO primero: test con SCHOOL_ADMIN + `debeCambiarPassword=true` → POST a `/api/auth/cambiar-password`; ejecutar contra el proxy actual y REGISTRAR el 403 (prueba de que el test detecta el bug).
- [x] T002 [I-35] `src/lib/proxy.ts`: agregar `/api/auth/cambiar-password` a `SESION_ROUTES` (y actualizar el comentario C-9: página Y endpoints).
- [x] T003 [I-35] `src/lib/proxy.test.ts`: `esRutaPermitidaSchoolAdmin("/api/auth/cambiar-password")` → true; el test de T001 en VERDE (200 y contraseña cambiada).

## Fase 2: I-35b — salir de la pantalla

- [x] T004 [I-35b] `src/lib/proxy.ts`: agregar `/api/auth/logout` a `SESION_ROUTES`; `proxy.test.ts` lo cubre.
- [x] T005 [I-35b] Logout robusto en `AuthContext`/header: navegar al inicio público aunque la llamada a la API falle (la salida no depende del resultado).

## Fase 3: I-36 (🟡) — menú por rol con la fuente del proxy

- [x] T006 [I-36] Exportar el criterio de rutas por rol desde `src/lib/proxy.ts` (helper reutilizable; el proxy lo sigue usando sin cambio de comportamiento).
- [x] T007 [I-36] `src/components/modules/NavHeader.tsx`: las entradas de área de padres solo si el helper las permite para el rol (SCHOOL_ADMIN no las ve).
- [x] T008 [I-36] Test de menú por rol en `NavHeader.test.tsx`: SCHOOL_ADMIN sin "Círculo de Confianza"/"Mis reportes"; PARENT con las suyas; anónimo sin cambios.

## Fase 4: Verificación de roles + cierre

- [x] T009 Documentar en el cierre la revisión de FR-005 (PARENT y roles internos sin bloqueo en los endpoints de sesión; si aparece algo, corregirlo).
- [x] T010 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` + CI GitHub success.
- [x] T011 `cierre.md` + `specs/README.md` + commits + push. **NO desplegar** (lote del CEO).

## Dependencias

- T001 → T002/T003 · T004 → T005 · T006 → T007 → T008 · T009–T011 al final.
