# Tasks: SPEC-175 — Hotfix I-57 (permiso padre del comité)

**Input**: `specs/175-hotfix-permisos-comite/{spec,plan}.md`
**Compuerta §4**: PENDIENTE de ZEUS (permisos = zona sensible).

- [ ] **T001** `prisma/seed-modulos-grants.ts:49`: `COMITE_CONVIVENCIA: ["colegios", "colegios_comite_bandeja"]`.
- [ ] **T002** Test permisos: `modulosPermitidosParaRol("COMITE_CONVIVENCIA")` incluye `colegios_comite_bandeja` con el grant corregido.
- [ ] **T003** Test candado en `src/lib/proxy.test.ts`: con `colegios` concedido, el comité sigue sin acceso a rutas del rector y sí a `/dashboard/colegio/comite/**`.
- [ ] **T004** Grep de verificación documentado en cierre: cero `assertModulo(…, "colegios")` a secas en `src/app/api/**` y cero `verificarAccesoPagina("colegios")` en páginas.
- [ ] **T005** Gate local completo + commit + PR. Entregar en el cierre el comando exacto de sync para prod (`node --env-file=.env.production --import tsx scripts/sync-modulos-grants.ts` o `docker exec` en el contenedor).
- [ ] **T006** `specs/README.md` fila 175 (las DOS tablas) + `cierre.md`.
