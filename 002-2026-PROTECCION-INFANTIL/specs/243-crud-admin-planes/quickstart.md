# Quickstart — SPEC-243 (002-PI-146)

## Prerrequisitos

- Node.js >= 22
- Postgres del contenedor `002-2026-proteccion-infantil-db-1` en puerto `5433`
- `.env` con `DATABASE_URL`, `JWT_SECRET`, etc.
- Rol `ADMIN` con acceso al módulo `pagos_admin`

## 1. Aplicar migración

```bash
npx prisma migrate deploy
```

## 2. Generar cliente Prisma

```bash
npx prisma generate
```

## 3. Sembrar catálogo y parámetros

```bash
export SEED_ADMIN_PASSWORD="<clave-de-admin-de-12-caracteres>"
npx prisma db seed
```

Verifica que existan:

- 8 planes (`prisma.plan.count()` → 8)
- 7 parámetros globales de pagos §6.3

Ejecutar el seed dos veces no debe duplicar registros ni pisar ediciones manuales.

## 4. Levantar la app

```bash
npm run dev
```

Navegar a `http://localhost:5005/dashboard/admin/pagos/planes` como `ADMIN`.

## 5. Probar flujo manual

### Catálogo de planes

1. Pestaña **Catálogo**.
2. Completar formulario:
   - Nombre: `Plan Padre 3 meses`
   - Precio COP: `39900`
   - Duración: `3 meses`
   - Rol destino: `Padre`
   - Descripción opcional.
3. Click en **Crear plan** → debe aparecer en la tabla.
4. Click en **Editar**, cambiar precio a `44900`, guardar.
5. Click en **Desactivar** → estado pasa a `Inactivo`.

### Configuración global

1. Pestaña **Configuración global**.
2. Cambiar `IVA %` a `16`.
3. Click en **Guardar configuración**.
4. Revisar `AuditLog` (`accion = PARAM_UPDATE`, `tipoRecurso = ParametroSistema`).

## 6. Verificar APIs con curl

```bash
# Listar planes
GET /api/admin/pagos/planes?tipoTitular=PADRE&page=1

# Crear plan
POST /api/admin/pagos/planes
Content-Type: application/json
{
  "nombre": "Plan COLEGIO Anual",
  "precioBaseCOP": 599000,
  "precioBaseUSD": 150,
  "duracion": "MES_12",
  "tipoTitular": "COLEGIO",
  "descripcion": "Plan anual para colegios"
}

# Editar plan
PATCH /api/admin/pagos/planes/{id}
{
  "precioBaseCOP": 549000
}

# Desactivar plan (toggle lógico)
DELETE /api/admin/pagos/planes/{id}

# Actualizar parámetros globales
PATCH /api/admin/pagos/parametros
{
  "pagos.iva.porcentaje": 16,
  "pagos.iva.aplica_a": "todos",
  "pagos.freemium.activo": true,
  "pagos.freemium.duracion_dias": 30,
  "pagos.recompensa.activa": true,
  "pagos.recompensa.meses_gratis": 1,
  "pagos.recompensa.max_por_año": 5
}
```

## 7. Tests

```bash
npm run test:integration -- src/app/api/admin/pagos/planes/route.test.ts src/app/api/admin/pagos/parametros/route.test.ts
```

## Notas

- El `DELETE` de plan es lógico (`activo = false`).
- Un plan con `Suscripcion` en estado `ACTIVA` rechaza la desactivación con `409`.
- El seed no sobreescribe planes ni parámetros editados manualmente.
