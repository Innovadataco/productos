# SPEC-424 · Plan

## Alcance aprobado (CEO 22:2x)
Puntos 1-3: aterrizaje + menú. Punto 4 (proxy hardening) → SPEC-426.

## Pasos
1. Worktree `.worktrees/pi-SPEC-424` desde `origin/main f57eb7033`.
2. Auditar `esDestinoPermitidoPorRol` + los 30 endpoints `/api/padre/**` (reportado al CEO — no hay fuga).
3. `home-para-rol.ts` — nuevo case `PROFESIONAL` → `/perfil-profesional/verificacion`. Comentario ancla para SPEC-425.
4. `nav-items.ts` — `PROFESIONAL_NAV_ITEMS` con Verificación + Mi ficha. No hereda de padre.
5. `NavHeader.tsx`:
   - `esEmpleado` incluye VERIFICADOR y PROFESIONAL.
   - `dashboardHref` case `PROFESIONAL`.
   - Bloques nuevos en dropdown y mobile con items del profesional.
6. `scripts/arch/lib/nav-fuentes.ts` — declarar guardas de rol de los dos hrefs nuevos en `GUARDAS_HEADER`.
7. Regenerar `docs/architecture/02-roles-capacidades.md`.
8. `spec.md`, `plan.md`, `tasks.md`, fila en `specs/README.md`.
9. Verificar: `test:unit` + `tsc` + `arch:check` + `tokens:check` + eslint.
10. Commit + push + PR.

## Coordinación con Dev 02 (idc-80)
- Landing hoy: `/perfil-profesional/verificacion` (existe).
- Cuando su SPEC-425 mergee: **una** línea a mover en `home-para-rol.ts` (+ opcionalmente agregar entrada al panel en `PROFESIONAL_NAV_ITEMS`). Comentario ancla en ambos archivos.
- SPEC-424 no espera a SPEC-425 — cierra el bug de Jelkin ya.

## Verificación
- 2317/2317 unit.
- 7 gates arch:check verdes. tokens piso 1079.
- Post-deploy: PROFESIONAL entra y ve solo lo suyo; el menú no le ofrece items del padre.

## Fuera de scope
- SPEC-426 (proxy hardening).
- SPEC-425 (panel L5 · Dev 02).
