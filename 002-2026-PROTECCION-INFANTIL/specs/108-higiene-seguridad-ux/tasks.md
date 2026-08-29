# Tasks — SPEC-108: Higiene de seguridad y UX

> Cola 002-PI-025, B4. Diagnósticos cerrados por ZEUS, implementados tal cual. Todas completadas.

- [x] T001 I-33: enlace "Cambiar contraseña" en `NavHeader` (dropdown, todos los roles), `ColegioNav` y `AdminNav`.
- [x] T002 I-29: `scorePromedio` fuera de `/api/estadisticas-publicas` (respuesta + aggregate) y assert reemplazado por ausencia total en `route.test.ts`.
- [x] T003 O-1: `getScopeConfig` dentro del try en `src/lib/rate-limit.ts`; catch con `getScopeDefaults` sincrónico (429 + Retry-After, no 500).
- [x] T004 Test O-1: fallo en la LECTURA de parámetros → `seguimiento` fail-closed sin lanzar (`rate-limit.test.ts`).
- [x] T005 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build`.
- [x] T006 Artefactos de la spec + `specs/README.md` + commit + push (un commit por bloque).
