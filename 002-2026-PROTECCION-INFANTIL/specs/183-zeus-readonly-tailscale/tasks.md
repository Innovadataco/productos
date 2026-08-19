# Tasks: SPEC-183 — Acceso lectura ZEUS a BD prod por Tailscale (002-PI-078)

**Input**: `specs/183-zeus-readonly-tailscale/{spec,plan}.md`
**Compuerta §4**: PENDIENTE de ZEUS.

- [ ] **T001** Crear `scripts/crear-usuario-zeus-readonly.sh` idempotente (crea usuario, aplica grants SELECT, default privileges, no revoca).
- [ ] **T002** Actualizar `docker-compose.prod.yml`: publicar `db` en `127.0.0.1:5433:5432` para consumo por Tailscale.
- [ ] **T003** Añadir `DB_ZEUS_READONLY_PASSWORD=` en `.env.production.example` (sin valor).
- [ ] **T004** Crear documentación de operación con string de conexión y comando `tailscale serve`.
- [ ] **T005** Crear script de verificación `scripts/verificar-zeus-readonly.sh` (SELECT OK, INSERT/UPDATE/DELETE/pg_shadow denegado).
- [ ] **T006** Gate local completo verde + commit + PR a `feature/001-scaffolding`.
- [ ] **T007** `specs/README.md` fila 183 (las DOS tablas) + `cierre.md` al cerrar.
