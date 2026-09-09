# SPEC-607 · Tareas

- [x] T001 · Reescribir `PADRE_NAV_ITEMS` (6 entradas, `children`) en `src/lib/nav-items.ts`.
- [x] T002 · `PadreSideNav.tsx`: grupos colapsables (nacen expandidos, chevron `aria-expanded`, grupo del activo en cielo) + íconos nuevos.
- [x] T003 · `PadreNavMovil.tsx`: aplanado de grupos (8 destinos, Reportar a un toque).
- [x] T004 · Reescribir `PadreSideNav.test.tsx` (items exactos, colapso/expansión, activos, retirados ausentes) y `PadreNavMovil.test.tsx` (aplanado); actualizar `mis-citas.candado.test.ts`.
- [x] T005 · `perfil/page.tsx`: 3 acordeones nativos (Información general + «Crear contraseña» condicional + historial, Notificaciones, Suscripción con la lógica y server actions de la pantalla vieja; abierto por defecto según cobertura).
- [x] T006 · `suscripcion/page.tsx` y `notificaciones/page.tsx`: redirects de servidor con ancla (`?bienvenida=1` conservado).
- [x] T007 · `guardias.ts`: exentas vigencia PARENT += `/dashboard/padre/perfil`, `/api/notificaciones` (anti-bucle).
- [x] T008 · Enlaces directos: `camino/listo/page.tsx` → perfil#notificaciones; `home-sugerencia.ts` → perfil#suscripcion (+ tests).
- [x] T009 · Tests de página: `perfil/page.test.tsx` (3 acordeones, ids, abierto según cobertura, «Crear contraseña», bienvenida), `suscripcion/page.test.tsx`, `notificaciones/page.test.tsx` (redirects con ancla).
- [x] T010 · Candado hijos sin documento: `FormularioAltaHijo.test.tsx` (sin campos de documento, alta solo nombre+apellidos, validación no exige) — FR-008.
- [x] T011 · Artefactos spec + `specs/README.md` (generado) + `.specify/feature.json`.
- [x] T012 · `npm run arch:check` VERDE (navegación cambia; las tablas generadas NO viajan en el PR — barrido post-merge, SPEC-487/D-109).
- [x] T013 · Gate: `tsc --noEmit`, `lint`, `test`, `build`.
