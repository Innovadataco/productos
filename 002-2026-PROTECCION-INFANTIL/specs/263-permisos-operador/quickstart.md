# Quickstart: SPEC-263 — Barrido de permisos post-deploy

## 1. Orden de ejecución

Después de `prisma migrate deploy` y de `sync-modulos-grants.ts`, correr:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec -T app node --import tsx scripts/revocar-grants-pagos-operador.ts
```

## 2. Qué hace el script

- Busca los grants `PermisoModulo { rol: "OPERADOR", modulo: "pagos_admin", activo: true }`.
- Los pone en `activo: false` (idempotente, no borra filas).
- Imprime `{ revocados: N, yaInactivos: M }` para confirmar el resultado.

## 3. Verificación post-revocación (SC-009)

```sql
SELECT rol, m.clave, p.activo
FROM "PermisoModulo" p
JOIN "ModuloPermisible" m ON p."moduloId" = m.id
WHERE m.clave = 'pagos_admin' AND rol = 'OPERADOR';
```

Resultado esperado: `activo = false` o cero filas.

## 4. Rollback

```sql
UPDATE "PermisoModulo" p
SET activo = true
FROM "ModuloPermisible" m
WHERE p."moduloId" = m.id AND m.clave = 'pagos_admin' AND p.rol = 'OPERADOR';
```
