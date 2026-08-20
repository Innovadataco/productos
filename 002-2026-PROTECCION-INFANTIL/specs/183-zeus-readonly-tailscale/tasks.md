# Tasks: SPEC-183 — Acceso lectura ZEUS a BD prod por Tailscale (002-PI-078)

**Input**: `specs/183-zeus-readonly-tailscale/{spec,plan}.md`
**Compuerta §4**: APROBADA por ZEUS.

- [x] **T001** Crear `scripts/crear-usuario-zeus-readonly.sh` idempotente (crea usuario, aplica grants SELECT, default privileges, revoca CREATE de PUBLIC, grant CREATE a proteccion).
- [x] **T002** Actualizar `docker-compose.prod.yml`: publicar `db` en `127.0.0.1:5433:5432` para consumo por Tailscale.
- [x] **T003** Añadir `DB_ZEUS_READONLY_PASSWORD=` en `.env.production.example` (sin valor).
- [x] **T004** Crear documentación de operación con string de conexión y comando `tailscale serve`.
- [x] **T005** Crear script de verificación `scripts/verificar-zeus-readonly.sh` (SELECT OK, INSERT/UPDATE/DELETE/TRUNCATE/CREATE/DROP denegados, pg_shadow/pg_authid denegados, tablas futuras legibles).
- [x] **T006** Tests de integración `src/lib/infra/zeus-readonly.test.ts` con aislamiento real.
- [ ] **T007** Gate local completo verde + push + PR a `feature/001-scaffolding`.
- [ ] **T008** `cierre.md` al cerrar.
