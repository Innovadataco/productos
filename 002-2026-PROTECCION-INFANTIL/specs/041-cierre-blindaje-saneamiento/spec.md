# Feature Specification: Cierre de blindaje + saneamiento

**Feature Branch**: `[041-cierre-blindaje-saneamiento]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: Tras las correcciones de seguridad del spec 037 y el blindaje del spec 035, quedan dos puntos de saneamiento pendientes: (1) confirmar que los índices vectoriales HNSW de `EmbeddingReporte` y `EmbeddingDataset` están presentes en la base de datos y documentar el método correcto de despliegue de migraciones; (2) evitar que mensajes de error crudos de servicios externos queden persistidos en `Reporte.processingError`, reemplazándolos por un mensaje genérico acompañado de un código de error.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Confirmar índices HNSW y documentar despliegue de migraciones (Priority: P1)

El sistema usa embeddings para deduplicación de reportes y RAG en el dataset de entrenamiento. La migración `20260718094450` eliminó los índices `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx` y una migración posterior los recreó. Se debe confirmar que ambos índices existen y usan `USING hnsw`, documentar que `prisma migrate deploy` es el único método de despliegue y auditar que ningún script del repositorio invoque `prisma migrate dev` o `prisma migrate reset`.

**Why this priority**: Sin índices HNSW, las búsquedas por similitud caen en sequential scan, degradando el rendimiento y bloqueando el escalamiento. Sin un método de migración claro, existe riesgo de que alguien use `migrate dev` o `migrate reset` en producción y borre datos.

**Independent Test**: Ejecutar `npm run db:verify:hnsw` (que corre `scripts/verify-hnsw-indexes.ts`) y confirmar que ambos índices están presentes. Revisar `package.json` y `scripts/*` para confirmar que no hay llamadas a `migrate dev`/`reset`.

**Acceptance Scenarios**:

1. **Given** el script `scripts/verify-hnsw-indexes.ts`, **When** se ejecuta contra la base de datos, **Then** reporta `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx` como OK.
2. **Given** el script de verificación, **When** falta un índice, **Then** termina con código de salida 1 y mensaje de error claro.
3. **Given** `package.json`, **When** se revisa el script `db:migrate`, **Then** usa `prisma migrate deploy` (no `migrate dev` ni `migrate reset`).
4. **Given** los scripts del repositorio, **When** se buscan llamadas a `migrate dev` o `migrate reset`, **Then** no se encuentran en scripts de despliegue/operación.
5. **Given** `AGENTS.md` y la documentación de despliegue, **When** se describe el método de migración, **Then** se establece `prisma migrate deploy` como único método permitido.

### User Story 2 — No persistir error crudo en `Reporte.processingError` (Priority: P1)

Los endpoints `/api/reportes/procesar` y `/api/reportes/fallback` actualizan `Reporte.processingError` con el mensaje crudo del error (por ejemplo, "Ollama no disponible tras 3 reintentos"). Esto expone detalles de infraestructura y proveedores en el registro del reporte. Se debe reemplazar por un mensaje genérico y persistir el código de error en los metadatos de la transición.

**Why this priority**: Los mensajes de error crudos pueden filtrar información sensible de infraestructura, dificultar la depuración consistente y violar el principio de no exponer detalles internos a usuarios no autorizados.

**Independent Test**: Forzar un error en el procesamiento de un reporte, verificar que `processingError` contiene un mensaje genérico y que los metadatos de la transición contienen el código de error. No debe aparecer el mensaje original del proveedor en `processingError`.

**Acceptance Scenarios**:

1. **Given** un error en `/api/reportes/procesar`, **When** el reporte pasa a `REVISION_MANUAL`, **Then** `processingError` contiene "Error durante el procesamiento del reporte (código: ...)" y no el mensaje crudo del error.
2. **Given** un error en `/api/reportes/fallback`, **When** el reporte pasa a `REVISION_MANUAL`, **Then** `processingError` contiene un mensaje genérico con el código de error y no el mensaje recibido del worker.
3. **Given** una transición de procesamiento con error, **When** se consultan sus metadatos, **Then** contienen el `errorCode` (no el mensaje crudo).
4. **Given** los tests existentes, **When** se ejecutan, **Then** se actualizan para esperar el mensaje genérico y pasan.

---

## Edge Cases

- **US1**: Si el script de verificación no puede conectarse a la base de datos, debe fallar con código de salida 1 (no ocultar el error).
- **US1**: Si el índice existe pero no es HNSW (por ejemplo, GIN o btree), el script debe reportarlo como NO ES HNSW.
- **US2**: Si el error no tiene un código de error definido, se usa `ERROR_CODES.INTERNAL_ERROR` como fallback.
- **US2**: Si el reporte ya tiene `processingError` previo, el fallback es idempotente y no lo sobrescribe si ya está en `REVISION_MANUAL`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El script `scripts/verify-hnsw-indexes.ts` DEBE existir y verificar que `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx` existen y usan `USING hnsw`.
- **FR-002**: El script `scripts/verify-hnsw-indexes.ts` DEBE terminar con código de salida 1 si algún índice falta o no es HNSW.
- **FR-003**: El script `db:migrate` de `package.json` DEBE usar `prisma migrate deploy`.
- **FR-004**: Ningún script de despliegue/operación bajo `scripts/` DEBE invocar `prisma migrate dev`, `prisma migrate reset` o `prisma db push`.
- **FR-005**: `AGENTS.md` o la documentación de despliegue DEBE establecer `prisma migrate deploy` como el único método de despliegue de migraciones.
- **FR-006**: En `/api/reportes/procesar`, cuando un error no transitorio lleva a `REVISION_MANUAL`, `processingError` DEBE contener un mensaje genérico con el código de error; el mensaje crudo del error NO DEBE persistirse.
- **FR-007**: En `/api/reportes/fallback`, cuando se agotan reintentos, `processingError` DEBE contener un mensaje genérico con el código de error; el mensaje crudo recibido del worker NO DEBE persistirse.
- **FR-008**: En ambos endpoints, los metadatos de la transición DEBEN contener el `errorCode` (no el mensaje crudo).
- **FR-009**: No se requieren cambios en el modelo de datos de Prisma.

### Key Entities

- **Índice HNSW**: `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx` en PostgreSQL.
- **Script de verificación**: `scripts/verify-hnsw-indexes.ts`.
- **Reporte**: modelo `Reporte` con campo `processingError`.
- **Transición**: `TransicionReporte` con campo `metadatos`.
- **Endpoints**: `POST /api/reportes/procesar`, `POST /api/reportes/fallback`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run db:verify:hnsw` reporta ambos índices HNSW como OK.
- **SC-002**: `grep` en `scripts/*` no encuentra `migrate dev`, `migrate reset` ni `db push`.
- **SC-003**: `package.json` define `db:migrate` como `prisma migrate deploy`.
- **SC-004**: Tras un error en `/api/reportes/procesar`, `Reporte.processingError` contiene el mensaje genérico y no el mensaje crudo.
- **SC-005**: Tras un error en `/api/reportes/fallback`, `Reporte.processingError` contiene el mensaje genérico y no el mensaje crudo.
- **SC-006**: Los tests de `procesar` y `fallback` pasan con las expectativas actualizadas.
- **SC-007**: `npx tsc --noEmit`, `npm run lint` y `npm run test` pasan sin errores introducidos por este spec.

---

## Assumptions

- PostgreSQL ya tiene los índices HNSW creados (si no, el script fallará y se debe crear una migración aditiva).
- El campo `processingError` es un campo `String` en `Reporte` usado solo para trazabilidad interna.
- El worker supervisor que llama a `/api/reportes/fallback` puede enviar `errorCode` en el body; si no lo envía, el endpoint usa `ERROR_CODES.INTERNAL_ERROR`.
- Los mensajes de error genéricos no deben confundir al operador; el código de error en metadatos permite depuración.

---

## Implementación

### Objetivo alcanzado

Se confirmó que los índices HNSW están presentes y se saneó el almacenamiento de errores en `Reporte.processingError`. El despliegue de migraciones queda documentado como `prisma migrate deploy` únicamente.

### Decisiones de diseño

- Mantener `scripts/verify-hnsw-indexes.ts` como script de verificación post-migración. Si falla, el deploy debe abortarse.
- No cambiar `package.json` porque `db:migrate` ya usa `prisma migrate deploy`.
- Reemplazar `processingError: errMsg` por un mensaje genérico con el código de error en `procesar` y `fallback`.
- En `fallback`, aceptar `errorCode` en el body del worker; si no viene, usar `ERROR_CODES.INTERNAL_ERROR`.
- Mantener `verifyAuth` y rate limiting sin cambios.

### Componentes y archivos afectados

- `scripts/verify-hnsw-indexes.ts` (sin cambios, ya existía y funciona).
- `package.json` (sin cambios, `db:migrate` ya usa `prisma migrate deploy`).
- `src/app/api/reportes/procesar/route.ts` — `processingError` genérico.
- `src/app/api/reportes/fallback/route.ts` — `processingError` y metadatos genéricos.
- `src/app/api/reportes/fallback/route.test.ts` — expectativa actualizada.
- `AGENTS.md` — nota sobre `prisma migrate deploy` como único método (ya existía, se reafirma).

### Tests y validación

- `npm run db:verify:hnsw`: OK.
- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning heredado de `GestionPageClient.tsx`).
- `npm run test`: 79 archivos, 419 tests, todos pasan.
- `npm run test` específico para `procesar` y `fallback`: 20 tests pasan.
- `rm -rf .next && npm run build`: OK.
- `./scripts/dev-restart.sh`: OK, healthcheck OK, un solo worker.

### Migraciones

No requirió migraciones de Prisma.

### Deuda técnica

- Ninguna nueva. El script de verificación HNSW ya existía y los índices están presentes. La sanitización de `processingError` no requiere migración de datos.
