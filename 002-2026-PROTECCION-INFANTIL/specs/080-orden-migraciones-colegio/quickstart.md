# Quickstart — Spec 080: validación desde cero (I-04)

**Propósito**: verificar que la cadena de migraciones aplica limpia sobre una BD vacía y recuperar BD de desarrollo desalineadas por el rename de `add_departamento`.

## Prerrequisitos

- `npm install` ejecutado (Node.js >= 22).
- `.env` con `DATABASE_URL` apuntando a `localhost:5433` (ver `.env.example`).
- Docker con el contenedor de BD: `docker-compose up -d db` (con guion; el plugin v2 no está instalado).

## A. Validación desde cero (BD nueva o reset autorizado)

> ⚠️ `migrate reset` borra TODOS los datos. Autorizado solo en desarrollo (dataset vacío/regenerable). Nunca en producción.

```bash
docker-compose up -d db
npx prisma migrate reset --force     # aplica las 44 migraciones en orden + seed
npx prisma db seed                   # idempotente
npx prisma migrate status            # esperado: "Database schema is up to date!"
```

Criterio de éxito (SC-001/SC-002): `migrate reset` termina sin P3018 y `migrate status` reporta 44 migraciones aplicadas, cero pendientes y cero fallidas.

### Verificación del orden corregido

```bash
ls prisma/migrations/ | grep -E "departamento|add_colegio$"
# esperado (en este orden):
#   20260720210000_add_departamento
#   20260720214140_add_colegio
```

## B. Drift conocido (preexistente, NO es I-04)

```bash
npx prisma migrate dev --create-only --name drift_check
```

Resultado esperado: Prisma propone **una** migración con únicamente:

```sql
DROP INDEX "EmbeddingDataset_vector_idx";
DROP INDEX "EmbeddingReporte_vector_idx";
```

Es drift **preexistente**: esos índices HNSW se crean deliberadamente por SQL crudo en
`20260717002004_add_pgvector_hnsw_indexes` y `20260719095000_recrear_indices_hnsw_embeddings`,
y `schema.prisma` no puede expresar `USING hnsw (vector vector_cosine_ops)`.
**NO aplicar esa migración** (degradaría la búsqueda vectorial). Borrar la carpeta generada.
Cualquier drift adicional distinto de esos dos `DROP INDEX` sí es anómalo y debe reportarse.

## C. Recuperación de BD de desarrollo desalineada (US3)

Síntoma: `migrate status` reporta `20260721001700_add_departamento` como aplicada pero no
encontrada en disco, y `20260720210000_add_departamento` como no aplicada.

- **Opción A (recomendada, dataset vacío)**: `npx prisma migrate reset --force && npx prisma db seed`.
- **Opción B (conservar datos)**: respaldar datos → Opción A → restaurar. El rename invalida el
  registro en `_prisma_migrations` y no hay vía automática segura sin re-aplicar.

## D. Gate de calidad

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh   # deploy limpio + healthcheck en :5005
```
