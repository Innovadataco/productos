# SPEC-426 · Tasks

## Hecho (este PR)

- [x] Auditoría de la superficie del PROFESIONAL (grep `verifyAuth("PROFESIONAL")` + directorios `/dashboard/profesional`, `/perfil-profesional`, `/api/profesional`).
- [x] Lista blanca `PROFESIONAL_ROUTES` en `src/lib/proxy.ts`.
- [x] Helper `isProfesionalRoute` + `esRutaPermitidaProfesional` (molde SPEC-319).
- [x] Branch en `proxyCore` — 403 (API) / redirect al panel (página).
- [x] Línea en `esDestinoPermitidoPorRol` — mismo criterio para menú y arch:check.
- [x] Test bidireccional en `src/lib/proxy.test.ts` (13 casos nuevos en 8 subdescribe).
- [x] `docs/architecture/02-roles-capacidades.md` regenerado.
- [x] `arch:check` VERDE en los 7 gates.
- [x] `tsc --noEmit` verde.
- [x] `proxy.test.ts` — 49 tests en verde.

## I-312 (Jelkin vivo 04-09) · PARENT redirect en áreas ajenas

- [x] `esDestinoPermitidoPorRol` — PARENT ahora retorna `false` para áreas exclusivas de otros roles (`isProfesionalRoute`, `isColegioRoute`, `isComiteConvivenciaRoute`), no solo para admin.
- [x] `proxyCore` — branch nuevo para PARENT: 307 a `/dashboard/padre` (páginas), 403 JSON (APIs). Antes caía al catch-all `NextResponse.next()` y el `verifyAuth("PROFESIONAL")` del layout daba 403 en pantalla.
- [x] `NavHeader.destinoLogo` — PROFESIONAL va a `/dashboard/profesional` (antes caía al default `/dashboard`, href muerto que la aserción B de `arch:check` cazó tras regenerar).
- [x] `scripts/arch/lib/nav-fuentes.ts` — `hrefsLogoPorRol("PROFESIONAL")` alineado con el JSX del header.
- [x] `proxy.test.ts` — bloque nuevo `SPEC-426 · I-312 · PARENT redirect en áreas ajenas` (5 predicado + 6 runtime) con contraprueba: PARENT en su área NO se rebota + PROFESIONAL sigue bloqueado en `/dashboard/padre` (simetría). **Verificado por mutación**: quitar el guard PARENT mata 4 tests.

## Seguimiento (fuera de este PR)

- [ ] Migrar VERIFICADOR al mismo molde si la superficie crece (hoy vive bajo `INTERNAL_ROLES`).
- [ ] Ratchet estático que enumere handlers `verifyAuth("PROFESIONAL")` y verifique que TODOS caen bajo un prefijo listado en `PROFESIONAL_ROUTES` (candado a la introducción de nuevas superficies sin actualizar la lista).
