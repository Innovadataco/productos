# Feature Specification: SPEC-183 — Acceso lectura ZEUS a BD prod por Tailscale (002-PI-078)

**Feature Branch**: `work/002-pi-078`

**Created**: 2026-08-19

**Status**: PLANEADO

**Input**: Instructivo 002-PI-078. Contexto: el CEO no quiere seguir copiando SQL en la terminal para que ZEUS diagnostique. Se requiere un acceso de solo lectura a la BD de producción sin dar SSH ni root.

**Restricción de seguridad innegociable**: la BD nunca queda expuesta a internet. Solo Tailscale. Si la infra actual del VPS/Docker no permite hacerlo de forma segura, ODIN debe declararlo en este spec+plan y NO forzar una solución insegura.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — ZEUS puede conectarse a prod en solo lectura (Priority: P1)

Como auditor (ZEUS) quiero consultar la BD de producción con un usuario dedicado de solo lectura, para diagnosticar incidencias sin depender de que el CEO copie SQL en la terminal.

**Why this priority**: acelera la auditoría y reduce el riesgo de errores de transcripción.

**Independent Test**: conectarse con el usuario `zeus_readonly` y ejecutar `SELECT` en una tabla de aplicación; verificar que devuelve filas.

**Acceptance Scenarios**:

1. **Given** el usuario `zeus_readonly` creado en Postgres, **When** se conecta con su password, **Then** puede ejecutar `SELECT` en todas las tablas del schema `public`.
2. **Given** una tabla futura creada en el schema `public`, **When** el usuario `zeus_readonly` se conecta, **Then** puede hacer `SELECT` sobre ella sin reconfiguración manual (default privileges).
3. **Given** una conexión desde fuera de Tailscale, **When** se intenta llegar al puerto de Postgres, **Then** la conexión es rechazada (nunca expuesto a internet).

---

### User Story 2 — El acceso de ZEUS no puede modificar nada (Priority: P1)

Como CEO quiero garantizar que el usuario de auditoría no pueda alterar datos, ejecutar DDL ni ver tablas del sistema, para que el acceso de diagnóstico no se convierta en riesgo operativo.

**Why this priority**: principio de mínimo privilegio; la BD contiene datos sensibles.

**Independent Test**: intentar `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP` y `TRUNCATE` con `zeus_readonly`; todos deben fallar con permiso denegado.

**Acceptance Scenarios**:

1. **Given** el usuario `zeus_readonly`, **When** intenta `INSERT INTO public.<tabla> ...`, **Then** Postgres responde con error de permisos.
2. **Given** el usuario `zeus_readonly`, **When** intenta `UPDATE`, `DELETE`, `TRUNCATE` o `DROP` sobre una tabla del schema `public`, **Then** la operación es denegada.
3. **Given** el usuario `zeus_readonly`, **When** consulta tablas del sistema (`pg_authid`, `pg_shadow`), **Then** no tiene permiso de lectura.
4. **Given** el usuario `zeus_readonly`, **When** intenta crear objetos (`CREATE TABLE`, `CREATE SCHEMA`), **Then** la operación es denegada.

---

### User Story 3 — El setup es reproducible e idempotente (Priority: P2)

Como responsable de infra quiero poder recrear o actualizar el usuario y sus grants con un script versionado, para que el acceso no dependa de comandos manuales olvidados.

**Why this priority**: operabilidad y auditabilidad del propio acceso de auditoría.

**Independent Test**: ejecutar `scripts/crear-usuario-zeus-readonly.sh` dos veces; la segunda no falla ni revoca permisos a otros roles.

**Acceptance Scenarios**:

1. **Given** el script `scripts/crear-usuario-zeus-readonly.sh`, **When** se ejecuta contra la BD, **Then** crea el usuario si no existe y aplica/actualiza los grants aditivamente.
2. **Given** el script ejecutado una segunda vez, **When** termina, **Then** no genera errores de "already exists" y no revoca grants de otros roles.
3. **Given** el script, **When** termina, **Then** imprime un resumen de grants aplicados y una línea de verificación recomendada.

---

### Edge Cases

- **Usuario ya existe con otros privilegios**: el script es aditivo; no revoca. Si ZEUS requiere que no tenga más privilegios, se documenta la validación manual.
- **Nuevas tablas en `public`**: se configuran default privileges para que futuras tablas hereden `SELECT` automáticamente.
- **Rotación de password**: cambiar `DB_ZEUS_READONLY_PASSWORD` en `.env.production` y reejecutar el script (ALTER USER) es suficiente.
- **Tailscale no disponible en el VPS**: si el VPS no tiene Tailscale o no se puede exponer un puerto por su interfaz, el spec declara la opción B (bind a IP Tailscale) como no viable y se detiene para decisión de ZEUS/CEO.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir un usuario Postgres `zeus_readonly` con password gestionada fuera del repo (variable `DB_ZEUS_READONLY_PASSWORD` en `.env.production`).
- **FR-002**: `zeus_readonly` DEBE tener `GRANT USAGE ON SCHEMA public` y `GRANT SELECT ON ALL TABLES IN SCHEMA public`.
- **FR-003**: `zeus_readonly` DEBE recibir `SELECT` por defecto en tablas futuras vía `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO zeus_readonly`.
- **FR-004**: `zeus_readonly` NO DEBE tener permisos de `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` ni capacidad de `CREATE` en el schema `public`.
- **FR-005**: `zeus_readonly` NO DEBE poder leer tablas del sistema (`pg_authid`, `pg_shadow`, etc.).
- **FR-006**: El puerto Postgres DEBE exponerse SOLO por Tailscale; NUNCA a `0.0.0.0` ni a una interfaz pública. Opción preferida: `tailscale serve --tcp=5433 tcp://localhost:5433` en el VPS, más mapeo Docker `127.0.0.1:5433:5432`.
- **FR-007**: DEBE existir `scripts/crear-usuario-zeus-readonly.sh` idempotente para crear el usuario y aplicar grants.
- **FR-008**: DEBE existir documentación clara del string de conexión (host = IP/hostname Tailscale del VPS, puerto, usuario, DB) sin incluir el password.
- **FR-009**: DEBE existir un test o script de verificación que confirme que `zeus_readonly` no puede escribir ni leer tablas del sistema.

### Key Entities

- **Usuario Postgres `zeus_readonly`**: rol de solo lectura sobre `public`.
- **Tailscale serve / bind**: mecanismo de exposición privada.
- **`.env.production`**: alberga `DB_ZEUS_READONLY_PASSWORD` (valor fuera del repo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ZEUS se conecta exitosamente a prod por Tailscale con `zeus_readonly` y ejecuta `SELECT` sin errores.
- **SC-002**: Un intento de `INSERT/UPDATE/DELETE/CREATE` con `zeus_readonly` falla con permiso denegado.
- **SC-003**: El puerto 5432 de Postgres no es alcanzable desde internet (verificación con `nmap` o similar desde fuera de Tailscale).
- **SC-004**: El script `crear-usuario-zeus-readonly.sh` es idempotente y documentado.
- **SC-005**: Gate local verde y CI del PR verde.

## Assumptions

- El VPS ya tiene Tailscale instalado y operativo (igual que para Ollama).
- La BD de PI vive en el contenedor `db` de Docker Compose, sin publicar puerto al host (configuración actual en `docker-compose.prod.yml`).
- El CEO/infra gestionará `DB_ZEUS_READONLY_PASSWORD` en `.env.production` y lo entregará a ZEUS por canal seguro.
- No se modifica la red interna de Docker ni los usuarios existentes (`proteccion`, etc.).
