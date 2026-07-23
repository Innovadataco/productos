# Quickstart — Spec 019: Gestor de permisos de módulos por rol

**Propósito**: verificar la gestión de permisos por rol, la denegación por defecto, la jerarquía padre/hijo y el anti-lockout.

## Prerrequisitos

- App + worker corriendo (`./scripts/dev-restart.sh`), migraciones y seed aplicados (`npx prisma migrate deploy && npx prisma db seed`).
- Login ADMIN: `soporte@innovadataco.com` / `Admin123!Test`.

## A. UI de gestión

1. `/dashboard/admin/configuracion` → tab **"Permisos por rol"**.
2. Seleccionar rol (p. ej. OPERADOR) → árbol de módulos con toggles; críticos marcados.
3. Desactivar `reportes_revision`, guardar → "1 permiso(s) actualizados".
4. Login como OPERADOR → `GET /api/admin/reportes-revision` → **403**; `GET /api/admin/reportes/...` (bandeja) sigue OK.
5. Reactivar y guardar → el OPERADOR vuelve a tener acceso.

## B. API (equivalente)

```bash
curl -c /tmp/cj -X POST :5005/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"soporte@innovadataco.com","password":"Admin123!Test"}'

# matriz
curl -b /tmp/cj :5005/api/admin/permisos-modulos | python3 -m json.tool | head -30

# desactivar un módulo para OPERADOR
MODULO_ID=$(docker exec 002-2026-proteccion-infantil-db-1 psql -U proteccion -d proteccion_infantil -tA \
  -c "SELECT id FROM \"ModuloPermisible\" WHERE clave='reportes_revision';")
curl -b /tmp/cj -X PATCH :5005/api/admin/permisos-modulos -H 'Content-Type: application/json' \
  -d "{\"cambios\":[{\"rol\":\"OPERADOR\",\"moduloId\":\"$MODULO_ID\",\"activo\":false}]}"
# → {"actualizados":1}

# rol con typo → 400 claro, sin fila fantasma
curl -b /tmp/cj -X PATCH :5005/api/admin/permisos-modulos -H 'Content-Type: application/json' \
  -d "{\"cambios\":[{\"rol\":\"ADMN\",\"moduloId\":\"$MODULO_ID\",\"activo\":true}]}"
# → 400 "Roles desconocidos: ADMN..."

# anti-lockout: desactivar módulo crítico para ADMIN → 409
CRITICO_ID=$(docker exec 002-2026-proteccion-infantil-db-1 psql -U proteccion -d proteccion_infantil -tA \
  -c "SELECT id FROM \"ModuloPermisible\" WHERE clave='audit_logs';")
curl -b /tmp/cj -X PATCH :5005/api/admin/permisos-modulos -H 'Content-Type: application/json' \
  -d "{\"cambios\":[{\"rol\":\"ADMIN\",\"moduloId\":\"$CRITICO_ID\",\"activo\":false}]}"
# → 409 anti-lockout
```

## C. Jerarquía padre/hijo

1. Para `SCHOOL_ADMIN`: desactivar `colegios_auditoria` (hijo) dejando `colegios` (padre) activo → gestión del colegio sigue, `GET /api/colegio/auditoria` → 403.
2. Desactivar el padre `colegios` → gestión Y auditoría caen (AND jerárquico).

## D. Auditoría

```sql
SELECT accion, "valorNuevo" FROM "AuditLog" WHERE accion='PERMISOS_MODULO_ACTUALIZADOS' ORDER BY "creadoEn" DESC LIMIT 3;
```

## E. Rol futuro (absorción sin refactor)

```sql
-- insertar permisos para un rol nuevo (ejemplo): solo filas, sin tocar código
INSERT INTO "PermisoModulo" (id, rol, "moduloId", activo, "actualizadoEn")
SELECT 'pm_' || rol || '_' || "moduloId", 'FISCALIA', "moduloId", true, now()
FROM "PermisoModulo" WHERE rol='OPERADOR';
```
El rol `FISCALIA` aparece en el selector de la UI (los roles se derivan de los datos).

## F. Restaurar

Si desactivaste módulos durante la prueba, reactívalos desde la UI o re-ejecuta el seed (`npx prisma db seed` es idempotente y no pisa cambios manuales — revisa el estado final en la UI).
