# Tasks — SPEC-589 · Quitar el documento de la ficha del hijo

## Fase 1 — Schema y migración (destructiva autorizada por el CEO)
- [x] T001 · Quitar `documentoTipo`/`documentoNumero` del modelo `Hijo` en
      `prisma/schema.prisma` (con comentario de la decisión CEO y la excepción a
      la regla aditiva) — `prisma/schema.prisma`
- [x] T002 · Migración `spec589_hijo_sin_documento`: `DROP INDEX IF EXISTS` de
      `Hijo_documentoTipo_documentoNumero_idx` y
      `Hijo_usuarioId_documentoTipo_documentoNumero_key` + `DROP COLUMN` de ambas
      columnas, con comentario que documenta la autorización del dueño del dato —
      `prisma/migrations/20260908000829_spec589_hijo_sin_documento/migration.sql`
      (aplicada con `prisma migrate deploy` contra la BD de test; `migrate dev`
      no corre en entorno no interactivo)
- [x] T003 · `prisma generate` — cliente sin los campos en `Hijo`

## Fase 2 — DAL y API
- [x] T010 · Inputs `RegistrarHijoInput`/`ActualizarHijoInput` sin documento;
      caen `DOCUMENTO_TIPOS`/`DocumentoTipo` del módulo (barrel actualizado) —
      `src/lib/dal/services/hijos/{tipos,index}.ts`
- [x] T011 · `registrarHijo`: sin dedup por documento (el alta siempre crea
      ficha nueva) · `actualizarHijo`: sin chequeo de choque de documento —
      `src/lib/dal/services/hijos/hijos.ts`
- [x] T012 · `createSchema`/`patchSchema` sin documento; se va la validación F7
      del POST — `src/app/api/padre/hijos/route.ts`,
      `src/app/api/padre/hijos/[id]/route.ts`
- [x] T013 · Eliminar `validarDocumentoMenor`/`NOMBRE_DOCUMENTO` del módulo de
      validadores (quedan las reglas de edad F8/F9) —
      `src/lib/padre/documento-menor.ts` + su test

## Fase 3 — UI
- [x] T020 · Formulario de alta sin "Tipo de documento"/"Número de documento";
      el POST no envía documento — `src/components/modules/padre/MisHijos.tsx`
- [x] T021 · Tipo `Hijo` y edición inline sin documento; la tarjeta solo muestra
      la edad — `src/components/modules/padre/HijoCard.tsx`
- [x] T022 · Comentario del Paso 3 del camino alineado —
      `src/app/camino/hijos/CaminoHijosClient.tsx`

## Fase 4 — Tests y compuertas
- [x] T030 · Tests del API hijos: seeds sin documento, se cubre el contrato
      SPEC-589 (campos muertos ignorados / 400 si no hay nada real) —
      `src/app/api/padre/hijos/route.test.ts`
- [x] T031 · Tests DAL: seeds sin documento; el test de dedup se reescribe como
      "dos homónimos coexisten" — `src/lib/dal/services/hijos/hijos.test.ts`
- [x] T032 · Seeds de menores sin documento — `src/lib/dal/services/hijos/notificaciones.test.ts`,
      `src/app/api/padre/hijos/identificadores/[id]/route.test.ts`,
      `src/lib/dal/services/bitacora-menor.test.ts`,
      `src/lib/dal/services/camino/estado.test.ts`
- [x] T033 · Tests de componentes sin documento (MisHijos, candado SPEC-565);
      test unitario de documento-menor ajustado —
      `src/components/modules/padre/MisHijos.test.tsx`,
      `hijo-card-edad-select.candado.test.tsx`, `src/lib/padre/documento-menor.test.ts`
- [x] T034 · Seeds E2E sin documento del hijo — `tests/e2e/camino-padre.spec.ts`,
      `mis-reportes-expediente.spec.ts`, `recorrido-presentacion-no-en-url.spec.ts`,
      `recorrido-ciclo-cita-padre.spec.ts`
- [x] T035 · Regenerar línea base `docs/architecture/01-modelo-datos.md`
      (`npx tsx scripts/arch/generar-modelo-datos.ts` vía arch:check)
- [x] T036 · Compuertas: `tsc --noEmit`, vitest de archivos tocados,
      `npm run arch:check`, ESLint de archivos tocados — VERDES

## Fase 5 — Artefactos y cierre
- [x] T040 · `spec.md` + `tasks.md` en `specs/589-hijo-sin-documento/`
- [x] T041 · Índice `specs/README.md` actualizado
