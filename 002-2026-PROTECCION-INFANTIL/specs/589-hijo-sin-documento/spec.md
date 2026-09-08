# SPEC-589 · Quitar el documento de la ficha del hijo (DROP de columnas, decisión CEO)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden CEO (Jelkin), 06-09-2026. Rama `work/pi-SPEC-589-591-ajustes-padre`.

## Impacto en arquitectura: no

Sin endpoints nuevos ni rutas nuevas: se ESTRECHAN contratos existentes (POST/PATCH `/api/padre/hijos`, DTO de la lista). Migración destructiva sobre `Hijo` (la única excepción a la regla de migraciones aditivas, autorizada por el dueño del dato).

## El problema

La ficha del menor ("A quién protejo") pedía tipo y número de documento obligatorios. El CEO, en su recorrido de la app, ordenó quitarlo: fricciona el alta y no aporta al mecanismo de monitoreo (el cruce es por IDENTIFICADORES — Roblox, teléfono, correo —, no por documento). Decisión explícita del CEO: **ELIMINAR LAS COLUMNAS de la base de datos**, no solo ocultarlas del formulario.

## Alcance

- **Modelo `Hijo`** (ficha del padre): se eliminan `documentoTipo` y `documentoNumero` (DROP COLUMN). Caen con ellos la unicidad `@@unique([usuarioId, documentoTipo, documentoNumero])` (SPEC-339) y el índice `@@index([documentoTipo, documentoNumero])`, y la dedup del alta por documento.
- **No confundir**: el documento del **PADRE** (`Usuario.documentoTipo/documentoNumero`, obligatorio en el Paso 2 del camino), el del **Estudiante** del módulo colegio y el de Profesor/Acudiente se conservan intactos.
- **API**: POST y PATCH `/api/padre/hijos` ya no aceptan ni validan documento (Zod lo descarta si llega — schema estricto por omisión de campos). Se va la validación F7 (`validarDocumentoMenor`) y el error 409 de "documento ya está en tu lista".
- **UI**: el formulario de alta (MisHijos) y la edición inline (HijoCard) pierden los campos "Tipo de documento" y "Número de documento"; la tarjeta ya no muestra el documento.
- **Seguridad para la réplica BI**: la tabla `Hijo` se publica a `bi_replica` con lista de columnas EXPLÍCITA (`id,anioNacimiento,sexo,creadoEn,actualizadoEn,estado`) que NO incluía estas columnas, y ambas estaban en la lista de exclusión de privacidad del BI — el DROP no rompe la réplica.

## Decisión de datos (destructiva, autorizada)

- Única excepción a la regla de migraciones aditivas/no destructivas, autorizada verbalmente por el dueño del dato (Jelkin, 06-09-2026): **todos los datos son de prueba del CEO y el borrado está autorizado por el dueño**.
- Migración `spec589_hijo_sin_documento`: `DROP INDEX IF EXISTS` de los dos índices + `ALTER TABLE "Hijo" DROP COLUMN` de ambas columnas, con comentario que documenta la autorización.
- `prisma migrate reset` NO se usa; nada se recrea.

## Comportamiento después del cambio

1. **Alta** (`POST /api/padre/hijos`): nombre + apellidos obligatorios (FR-019 intacto); edad/sexo/cuentas opcionales. Si un cliente viejo envía `documentoTipo/documentoNumero`, Zod los ignora (no se persisten).
2. **Edición** (`PATCH /api/padre/hijos/[id]`): corrige nombre, apellidos, año, sexo, estado. Un PATCH con SOLO campos de documento → 400 "Nada que corregir".
3. **Duplicados**: sin documento no hay clave natural de dedup. Dos fichas homónimas en la lista de un padre coexisten; el padre las corrige o inactiva (el producto nunca decide por él).
4. **Resto del flujo intacto**: tope de menores activos (parámetro), cupo al reactivar, bitácora del menor, notificaciones por identificador, expediente (usa nombre/anioNacimiento/sexo, no documento), Paso 3 del camino.

## Functional Requirements

- **FR-001**: El sistema DEBE eliminar las columnas `documentoTipo` y `documentoNumero` de la tabla `Hijo` (DROP COLUMN, migración destructiva documentada y autorizada por el dueño del dato).
- **FR-002**: El sistema NO DEBE pedir, mostrar, validar ni persistir el documento del menor en ninguna interfaz del módulo padre (alta, edición, tarjeta, API).
- **FR-003**: La API DEBE rechazar con 400 un PATCH cuyo único contenido sean campos ya inexistentes, y DEBE ignorar campos de documento que lleguen mezclados con campos válidos.
- **FR-004**: El sistema DEBE conservar intactos los documentos del padre (Usuario), estudiante (módulo colegio), profesor y acudiente.
- **FR-005**: El sistema DEBE seguir permitiendo homónimos en la lista de un padre (sin dedup por documento).

## Criterios de aceptación

- [x] Migración aplica DROP de ambas columnas + índices en BD de test; `prisma generate` regenera el cliente sin los campos en `Hijo`.
- [x] `tsc --noEmit` verde; ESLint verde en archivos tocados.
- [x] Tests ajustados en verde: API hijos (POST/PATCH), DAL hijos, notificaciones, bitácora, camino estado, documento-menor, MisHijos, HijoCard (candado SPEC-565).
- [x] Seeds E2E sin documento del hijo (camino-padre, mis-reportes-expediente, recorrido-presentacion, recorrido-ciclo-cita).
- [x] `npm run arch:check` verde (artefacto 01-modelo-datos regenerado).

## Implementación

- Migración: `prisma/migrations/20260908000829_spec589_hijo_sin_documento/migration.sql` (aplicada vía `prisma migrate deploy` contra la BD de test `proteccion_infantil_test` — el entorno no es interactivo para `migrate dev`).
- Schema: `prisma/schema.prisma` — modelo `Hijo` sin los campos, sin `@@unique`/`@@index` de documento; comentario de la decisión CEO.
- DAL: `src/lib/dal/services/hijos/{tipos,hijos,index}.ts` — inputs sin documento, sin dedup del alta, sin chequeo de choque en `actualizarHijo`; caen `DOCUMENTO_TIPOS`/`DocumentoTipo` del módulo.
- API: `src/app/api/padre/hijos/route.ts` y `[id]/route.ts` — schemas Zod sin documento; se va la validación F7.
- UI: `src/components/modules/padre/{MisHijos,HijoCard}.tsx`, `src/app/camino/hijos/CaminoHijosClient.tsx` — sin campos de documento en alta, edición ni tarjeta.
- Validadores: `src/lib/padre/documento-menor.ts` — se eliminan `validarDocumentoMenor`/`NOMBRE_DOCUMENTO` (quedan las reglas de edad F8/F9); su test se ajusta.
- Tests/seeds ajustados: `src/app/api/padre/hijos/route.test.ts`, `src/app/api/padre/hijos/identificadores/[id]/route.test.ts`, `src/lib/dal/services/hijos/hijos.test.ts`, `notificaciones.test.ts`, `src/lib/dal/services/bitacora-menor.test.ts`, `src/lib/dal/services/camino/estado.test.ts`, `src/lib/padre/documento-menor.test.ts`, `src/components/modules/padre/MisHijos.test.tsx`, `hijo-card-edad-select.candado.test.tsx`, `tests/e2e/{camino-padre,mis-reportes-expediente,recorrido-presentacion-no-en-url,recorrido-ciclo-cita-padre}.spec.ts`.
- Línea base: `docs/architecture/01-modelo-datos.md` regenerado.

## Deuda / notas

- La BD de desarrollo compartida (`proteccion_infantil`, puerto 5433) NO tiene tabla `_prisma_migrations` (se alimenta fuera de `migrate deploy`); la migración se aplicó en la BD de test. Al desplegar/mergear, el DROP debe aplicarse al entorno correspondiente por el flujo habitual de deploy.
- Sin documento, el alta no deduplica: dos altas seguidas del mismo menor crean dos fichas. Es comportamiento aceptado (el padre corrige/inactiva); si en el futuro se quiere dedup, la clave sería (usuarioId, nombre normalizado, apellidos normalizado), decisión de producto.
