# Quickstart: SPEC-189 — Vista de operador con métricas

## Cómo probar localmente

1. Asegurar BD limpia con seed:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

2. Crear un operador desde el panel admin (`/dashboard/admin/operadores/gestion`) o vía seed.

3. Asignar reportes al operador (mediante la asignación automática o manual).

4. Realizar acciones de cierre/escalamiento desde la bandeja de revisión o directamente en `AuditLog`.

5. Acceder a `/dashboard/admin/operadores/[id]` y verificar:
   - Métricas reflejen asignaciones, cierres y escalamientos.
   - Listado de casos pagine y filtre correctamente.

## URLs

- Panel de asignación: `/dashboard/admin/operadores/asignar`
- Ficha de operador: `/dashboard/admin/operadores/[id]`
- API métricas: `GET /api/admin/operadores/[id]/metricas`
- API casos: `GET /api/admin/operadores/[id]/casos?estado=&page=`

## Tests

```bash
npm run test:unit src/lib/dal/services/operador-metricas.test.ts
npm run test:integration src/app/api/admin/operadores/[id]/metricas/route.test.ts
npm run test:integration src/app/api/admin/operadores/[id]/casos/route.test.ts
```
