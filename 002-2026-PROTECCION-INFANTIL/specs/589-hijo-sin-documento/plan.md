# SPEC-589 · Plan — Quitar el documento de la ficha del hijo (DROP de columnas)

Ver `spec.md` (decisión CEO, FR, alcance) y `tasks.md` (fases y tareas).

## Contexto y decisión

El CEO (Jelkin, 06-09-2026), en su recorrido de la app, ordenó quitar tipo y número de documento de la ficha «A quién protego»: fricciona el alta y no aporta al monitoreo (el cruce es por IDENTIFICADORES — Roblox, teléfono, correo —, no por documento). Decisión explícita: **ELIMINAR LAS COLUMNAS**, no solo ocultar el formulario.

## Enfoque técnico

- **Migración destructiva única y autorizada** (`spec589_hijo_sin_documento`): `DROP INDEX IF EXISTS` de la unicidad compuesta y el índice por documento + `DROP COLUMN` de `documentoTipo` y `documentoNumero` en `Hijo`, con comentario SQL que documenta la autorización del dueño del dato. Única excepción a la regla de migraciones aditivas; `prisma migrate reset` prohibido.
- **Schema Prisma**: modelo `Hijo` sin los campos ni `@@unique`/`@@index`; comentario de la decisión CEO junto al modelo.
- **Contratos estrechados, no ampliados**: Zod de POST/PATCH `/api/padre/hijos` deja de declarar los campos (schema estricto por omisión — un cliente viejo que los envíe los ve ignorados, nunca persistidos). Se elimina la validación F7 (`validarDocumentoMenor`) y el 409 de «documento ya está en tu lista»; un PATCH con solo campos de documento → 400 «Nada que corregir».
- **UI**: MisHijos (alta), HijoCard (edición/tarjeta) y CaminoHijosClient pierden los dos campos; cae la dedup del alta por documento en el DAL (`hijos.ts`).
- **Intactos por contrato**: documento de Usuario (padre), Estudiante, Profesor y Acudiente; tope de activos (parámetro), bitácora, notificaciones por identificador, expediente (usa nombre/anioNacimiento/sexo) y Paso 3 del camino.
- **Réplica BI**: la publicación a `bi_replica` usa lista de columnas EXPLÍCITA que ya excluía estas dos — el DROP no rompe la réplica.

## Riesgos y mitigaciones

- **Pérdida de datos**: autorizada por el dueño (datos de prueba del CEO). Documentado en la migración y en spec.md.
- **Sin clave natural de dedup**: dos fichas homónimas del mismo padre coexisten; comportamiento aceptado (el padre corrige/inactiva, el producto nunca decide por él). Si más adelante se quiere dedup, la clave sería (usuarioId, nombre normalizado, apellidos normalizado) — decisión de producto futura.
- **Clientes viejos**: Zod descarta silenciosamente los campos; nada se persiste ni revienta.
