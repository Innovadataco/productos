# Tasks — Spec 118: Clics muertos del colegio (D-37)

- [x] T001 [P] Test proxy ROJO: `src/lib/proxy.test.ts` — `/` pasa a `true` (decisión D-37) + casos nuevos: permite `/dashboard-publico`, `/seguimiento`, `/api/consulta`, `/api/estadisticas-publicas`, `/api/reportes/seguimiento/X`; sigue bloqueando `/dashboard/admin`, `/api/admin/*`, `/dashboard`, `/mis-reportes`, `/reportar`, `/api/reportes` (POST crear), `/x` arbitraria.
- [x] T002 [P] Test header ROJO: `src/components/modules/NavHeader.test.tsx` — D-37: botón "Dashboard" no se ofrece cuando su destino es la página actual (SCHOOL_ADMIN en `/dashboard/colegio`, PARENT en `/dashboard`, anónimo en `/dashboard-publico`) y sí fuera de ella.
- [x] T003 [P] Journeys ROJO: `aislamiento.test.ts` (matriz menú=proxy con las rutas públicas de lectura PERMITIDAS para SCHOOL_ADMIN, justificación D-37) y `sesion-roles.test.tsx` (por propiedad: en el home de cada rol ningún enlace visible apunta al pathname actual; el colegio alcanza `/` y `/dashboard-publico` por el proxy real).
- [x] T004 FR-1/FR-2: `src/lib/proxy.ts` — listas `PUBLICAS_LECTURA_SCHOOL_ADMIN` y `APIS_LECTURA_SCHOOL_ADMIN` + helper `matchesRoute`; `esRutaPermitidaSchoolAdmin` las incluye; comentarios actualizados.
- [x] T005 FR-3/FR-4: `src/components/modules/NavHeader.tsx` — helper `esEnlaceNavegable` (D-37) aplicado al botón "Dashboard" (desktop+móvil), menú de usuario y menú móvil; logo intacto (regla SPEC-114 + `/` ya viva).
- [x] T006 Verde bajo candado: tests tocados + `src/lib/e2e` entera.
- [x] T007 Gate bajo candado: `npx tsc --noEmit` + `npm run lint` + `npm run test` (suite entera) + `npm run build`.
- [x] T008 `cierre.md` + commits selectivos (specs / proxy / header+tests / journeys). **SIN push, SIN desplegar** (el coordinador de la cola empuja y despliega). Nota: `specs/README.md` NO se toca (regla de convivencia); `specs-discipline.test.ts` fallará por la carpeta 118 sin indexar hasta que el coordinador la indexe.
