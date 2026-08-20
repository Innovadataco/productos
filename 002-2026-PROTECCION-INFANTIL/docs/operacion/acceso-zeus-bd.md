# Acceso de ZEUS a la BD de producción (SPEC-183)

> Propósito: permitir diagnóstico de auditoría sin copiar SQL en la terminal ni dar SSH/root.
> Seguridad: **solo lectura**, **solo Tailscale**, **nunca internet**.

## Requisitos previos

- Estar en la red Tailscale del VPS.
- Tener instalado `psql` o cualquier cliente Postgres.
- Conocer el hostname o IP Tailscale del VPS (lo proporciona el CEO/infra).

## 1. Levantar el túnel Tailscale en el VPS

```bash
sudo tailscale serve --tcp=5433 tcp://localhost:5433
```

Esto publica el puerto 5433 del loopback del VPS por Tailscale. El contenedor `db` de Docker ya expone `127.0.0.1:5433:5432` vía `docker-compose.prod.yml`.

## 2. Crear o actualizar el usuario `zeus_readonly`

En el VPS, con `.env.production` cargado:

```bash
docker exec -it pi-app ./scripts/crear-usuario-zeus-readonly.sh
```

O desde el host (si tienes `DATABASE_URL` de admin cargado):

```bash
node --env-file=.env.production --import tsx scripts/crear-usuario-zeus-readonly.sh
```

El script es idempotente: creará el usuario si no existe o actualizará su password. Como endurecimiento adicional, el script revoca el privilegio `CREATE` del schema `public` al pseudo-rol `PUBLIC` y se lo devuelve solo al rol de aplicación `proteccion`, evitando que `zeus_readonly` cree objetos.

## 3. String de conexión para ZEUS

```text
host     = <hostname-o-ip-tailscale-del-vps>
port     = 5433
user     = zeus_readonly
password = <DB_ZEUS_READONLY_PASSWORD>
database = proteccion_infantil
sslmode  = prefer
```

Ejemplo con `psql`:

```bash
psql "postgres://zeus_readonly:<password>@<tailscale-host>:5433/proteccion_infantil"
```

## 4. Verificación de aislamiento

Desde el VPS:

```bash
docker exec -it pi-app ./scripts/verificar-zeus-readonly.sh
```

Debe reportar que `SELECT` en tablas de aplicación funciona y que `INSERT/UPDATE/DELETE/TRUNCATE/CREATE/DROP` y lectura de `pg_shadow`/`pg_authid` fallan.

## 5. Rotación de password

1. Actualizar `DB_ZEUS_READONLY_PASSWORD` en `.env.production`.
2. Reejecutar `crear-usuario-zeus-readonly.sh`.
3. Entregar el nuevo password a ZEUS por canal seguro.

## 6. Troubleshooting

- **No se puede conectar**: verificar que `tailscale serve` esté activo y que el cliente esté en la misma red Tailscale.
- **Contraseña incorrecta**: reejecutar el script de creación.
- **No ve tablas nuevas**: el script configura default privileges; si una tabla se creó antes de que el usuario existiera, correr el script de nuevo aplica `GRANT SELECT ON ALL TABLES`.
