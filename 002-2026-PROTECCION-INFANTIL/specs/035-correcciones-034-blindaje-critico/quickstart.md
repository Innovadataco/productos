# Quickstart — Spec 035: Correcciones del 034 + blindaje crítico

## Prerrequisitos

- Repo en rama `feature/001-scaffolding`.
- Base de datos levantada (Docker Postgres en puerto 5433) con extensión pgvector.
- Dependencias instaladas: `npm install`.
- `ADMIN_PASSWORD` definida en `.env`.

## User Story 1 — Bandeja del comité

1. Ejecutar deploy limpio antes de probar: `rm -rf .next && npm run build`.
2. Crear o usar un usuario `COMITE_VALIDACION`.
3. Iniciar sesión con ese usuario.
4. Verificar que el navegador redirige a `/dashboard/admin/comite` (no a `/` ni `/mis-reportes`).
5. Hacer clic en "Mi bandeja" del menú desplegable.
6. Verificar que la URL permanece en `/dashboard/admin/comite`.
7. Acceder manualmente a `/mis-reportes` y `/dashboard/circulo-confianza`; verificar redirección a `/dashboard/admin/comite`.
8. Repetir con `OPERADOR` (redirige a `/dashboard/admin`) y `PARENT` (acceso normal).

## User Story 2 — Persistencia del editor de grupos

1. Iniciar sesión como `ADMIN`.
2. Ir a `/dashboard/admin/configuracion`.
3. En "Grupos de categoría", renombrar un grupo.
4. Presionar "Guardar cambios".
5. Recargar la página.
6. Verificar que el nombre modificado persiste (no vuelve al fallback).
7. Ir a una vista de usuario final que use grupos de categoría (consulta pública, seguimiento) y verificar que se refleja el cambio.
8. Buscar en el codebase `data.parametro?.valor` y confirmar que no queda ninguno en consumidores de `GET /api/config/parametros/[clave]`.

## User Story 3 — Índices vectoriales hnsw

1. Ejecutar `npx prisma migrate deploy`.
2. Verificar en PostgreSQL:
   ```sql
   SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('EmbeddingReporte_vector_idx', 'EmbeddingDataset_vector_idx');
   ```
3. Verificar que `indexdef` contiene `USING hnsw`.
4. Ejecutar el script de verificación post-migración y confirmar que termina con código 0.
5. (Opcional) Ejecutar `EXPLAIN` sobre una consulta de similitud y confirmar que usa el índice hnsw.

## User Story 4 — Middleware perimetral

1. Iniciar la app en modo desarrollo: `npx next dev -p 5005` (o deploy limpio).
2. Sin iniciar sesión, acceder a `/dashboard/admin`.
3. Verificar redirección a `/login`.
4. Sin iniciar sesión, llamar `GET /api/admin/reportes-revision`.
5. Verificar respuesta 401.
6. Probar los 5 roles con sesión iniciada:
   - `ADMIN` y `SCHOOL_ADMIN`: acceden a `/dashboard/admin` sin redirección.
   - `OPERADOR`: accede a `/dashboard/admin` y es redirigido a `/dashboard/admin` si intenta `/mis-reportes`.
   - `COMITE_VALIDACION`: accede a `/dashboard/admin/comite` y es redirigido allí si intenta `/mis-reportes`.
   - `PARENT`: accede a `/mis-reportes`; si intenta `/dashboard/admin`, es redirigido a `/mis-reportes` o `/`.
7. Verificar que rutas públicas como `/consulta` permiten tráfico anónimo.

## User Story 5 — Datos idempotentes

1. Ejecutar `npx prisma db seed`.
2. Verificar que el admin existe y no se duplicó.
3. Verificar que los casos de evaluación SEMILLA y los ejemplos de spam no se duplicaron.
4. Ejecutar `npx prisma db seed` una segunda vez.
5. Verificar que no hay errores ni duplicados.
6. Eliminar temporalmente `ADMIN_PASSWORD` de `.env` y borrar el admin de la BD.
7. Ejecutar `npx prisma db seed`; debe fallar con mensaje claro.
8. Restaurar `ADMIN_PASSWORD`.
9. Revisar `scripts/dev-restart.sh` y otros scripts; verificar que no contienen `migrate dev`, `migrate reset` ni `db push`.

## User Story 6 — Worker de instancia única

1. Iniciar el worker: `npm run worker`.
2. En otra terminal, intentar iniciar otro worker: `npm run worker`.
3. Verificar que el segundo worker detecta el lock, imprime un mensaje y sale con código distinto de cero.
4. Detener el primer worker con SIGTERM.
5. Verificar que se libera el lock y se puede iniciar un nuevo worker.

## Validación automática

```bash
npm run lint
npx tsc --noEmit
npm run test
```

## Limpieza y reinicio

```bash
rm -rf .next
npm run build
./scripts/dev-restart.sh
```
