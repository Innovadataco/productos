# Implementation Plan: SPEC-183 — Acceso lectura ZEUS a BD prod por Tailscale (002-PI-078)

**Branch**: `work/002-pi-078` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

---

## Summary

Crear un usuario Postgres de solo lectura (`zeus_readonly`) y exponer el puerto de la BD únicamente por Tailscale, sin tocar la red interna de Docker ni publicar nada a internet. Cero cambios en el schema de la app; solo infra, script y documentación.

---

## Diseño de conectividad

### Opción A (elegida por ZEUS): `tailscale serve` en el VPS

1. En el VPS, levantar un proxy TCP de Tailscale hacia el puerto local 5433:

   ```bash
   sudo tailscale serve --tcp=5433 tcp://localhost:5433
   ```

2. En `docker-compose.prod.yml`, publicar el contenedor `db` solo a localhost del VPS:

   ```yaml
   db:
     # ... existing config ...
     ports:
       - "127.0.0.1:5433:5432"
   ```

3. ZEUS se conecta con:

   ```text
   host = <tailscale-ip-o-hostname-del-vps>
   port = 5433
   user = zeus_readonly
   password = <DB_ZEUS_READONLY_PASSWORD>
   dbname = proteccion_infantil
   sslmode = require (o prefer según Tailscale)
   ```

Ventajas: el puerto no sale del loopback del VPS; Tailscale autentica y cifra el túnel; no hay firewall adicional que configurar.

### Opción B (alternativa): bind a IP Tailscale del VPS

Si `tailscale serve` no está disponible o el CEO prefiere no usarlo, se puede bindear el puerto Docker a la IP Tailscale del VPS:

```yaml
db:
  ports:
    - "${TAILSCALE_IP}:5433:5432"
```

Requiere que `TAILSCALE_IP` se defina en `.env.production` y que el firewall del VPS solo acepte conexiones a esa interfaz. Esta opción es más frágil y se documenta como fallback.

### Opción C (no viable): publicar a 0.0.0.0:5432

Rechazada por el candado de seguridad. Si ni A ni B son viables, se declara en el spec y se para.

---

## Cambios exactos

### 1. Script `scripts/crear-usuario-zeus-readonly.sh`

Nuevo script bash idempotente:

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-proteccion}"
DB_NAME="${DB_NAME:-proteccion_infantil}"
ZEUS_USER="zeus_readonly"
ZEUS_PASSWORD="${DB_ZEUS_READONLY_PASSWORD:-}"

if [ -z "$ZEUS_PASSWORD" ]; then
  echo "ERROR: DB_ZEUS_READONLY_PASSWORD no está definida" >&2
  exit 1
fi

psql "postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ZEUS_USER}') THEN
    CREATE ROLE ${ZEUS_USER} WITH LOGIN PASSWORD '${ZEUS_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  ELSE
    ALTER ROLE ${ZEUS_USER} WITH PASSWORD '${ZEUS_PASSWORD}';
  END IF;
END
\$\$;

REVOKE ALL ON SCHEMA public FROM ${ZEUS_USER};
GRANT USAGE ON SCHEMA public TO ${ZEUS_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ZEUS_USER};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ZEUS_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${ZEUS_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${ZEUS_USER};

-- Endurecimiento del schema public: quitar CREATE al pseudo-rol PUBLIC y
-- devolvérselo solo al rol de aplicación (proteccion).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CREATE ON SCHEMA public TO proteccion;

ALTER ROLE ${ZEUS_USER} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SQL

echo "[OK] Usuario ${ZEUS_USER} creado/actualizado con grants de solo lectura sobre public."
```

Nota: el script asume que `DB_PASSWORD` (del usuario admin `proteccion`) está disponible en el entorno. En producción se ejecuta dentro del contenedor o con `.env.production` cargado.

### 2. Cambio en `docker-compose.prod.yml`

Añadir bajo el servicio `db` (solo una de las opciones, por defecto A):

```yaml
  db:
    # ... existing config ...
    ports:
      # SPEC-183: acceso de solo lectura para ZEUS por Tailscale (localhost only).
      - "127.0.0.1:5433:5432"
```

### 3. Documentación de conexión

Añadir en `docs/operacion/acceso-zeus-bd.md` (o similar):

- Requisito: estar en la red Tailscale del VPS.
- Comando para levantar el serve: `sudo tailscale serve --tcp=5433 tcp://localhost:5433`.
- String de conexión (sin password):
  `postgres://zeus_readonly@<TAILSCALE_HOST>:5433/proteccion_infantil`.
- Cómo rotar password: cambiar `DB_ZEUS_READONLY_PASSWORD` en `.env.production` y reejecutar el script.
- Verificación mínima: `SELECT 1` funciona; `INSERT` falla.

### 4. Verificación de aislamiento

Nuevo script opcional `scripts/verificar-zeus-readonly.sh` (o test manual) que:

1. Conecta con `zeus_readonly`.
2. Ejecuta `SELECT 1` → debe funcionar.
3. Ejecuta `INSERT/UPDATE/DELETE` en una tabla de prueba → debe fallar.
4. Intenta `SELECT * FROM pg_shadow` → debe fallar.

### 5. Variables de entorno

Añadir en `.env.production.example` (sin valor):

```text
# SPEC-183: acceso de solo lectura de ZEUS a BD prod por Tailscale.
DB_ZEUS_READONLY_PASSWORD=
```

El valor real solo vive en `.env.production` en el VPS y en el gestor de secretos del CEO.

---

## Fuera de alcance

- No se crean usuarios de aplicación nuevos.
- No se modifica `src/lib/ai/**` ni la lógica de negocio.
- No se tocan permisos del usuario `proteccion` ni de roles existentes.
- No se expone el puerto 5432 directamente; solo 5433 por localhost/Tailscale.

## Verificación

- Gate local: `npx tsc --noEmit`, `npm run lint`, `npm run arch:check`, `npm run build`.
- CI del PR verde.
- En prod (post-deploy, valida CEO/ZEUS):
  1. Ejecutar `scripts/crear-usuario-zeus-readonly.sh`.
  2. Levantar `tailscale serve --tcp=5433 tcp://localhost:5433`.
  3. ZEUS conecta desde su máquina por Tailscale y ejecuta `SELECT 1`.
  4. Verificar que `INSERT/UPDATE/DELETE` y lectura de `pg_shadow` fallan.
