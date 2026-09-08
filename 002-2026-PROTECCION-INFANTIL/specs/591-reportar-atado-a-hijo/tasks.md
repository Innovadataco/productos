# Tasks — SPEC-591 · Reportar atado a hijo/familiar

## Fase 1 — Schema y migración (aditiva)
- [x] T001 · `Reporte.hijoId String?` con comentario de la decisión CEO y el
      porqué de SetNull (evidencia) — `prisma/schema.prisma`
- [x] T002 · Relación `hijo Hijo? @relation(..., onDelete: SetNull)` en
      `Reporte` + inversa `Hijo.reportes Reporte[]` + `@@index([hijoId])` —
      `prisma/schema.prisma`
- [x] T003 · Migración `spec591_reporte_atado_a_hijo`: `ADD COLUMN hijoId` +
      FK `ON DELETE SET NULL` + `CREATE INDEX "Reporte_hijoId_idx"` —
      `prisma/migrations/20260908005736_spec591_reporte_atado_a_hijo/migration.sql`
      (aplicada con `prisma migrate deploy` contra la BD de test)
- [x] T004 · `prisma generate` — cliente con `Reporte.hijoId`

## Fase 2 — API
- [x] T010 · `hijoId` opcional en `crearReporteSchema` (la obligatoriedad la
      impone la ruta, que conoce la sesión) — `src/lib/validators.ts`
- [x] T011 · DAL `obtenerHijoDePadre(hijoId, usuarioId)`: siempre acotado por
      el padre (regla del módulo), `null` único para ajena/inexistente —
      `src/lib/dal/services/hijos/hijos.ts` + barrel
- [x] T012 · `resolverHijoDelReporte` en la ruta: anónimo con hijoId → 400;
      autenticado sin hijoId → 400; ajena/inexistente → 403 (sin distinguir);
      inactiva → 409. Se resuelve ANTES de los rate limits —
      `src/app/api/reportes/route.ts`
- [x] T013 · Pipeline: `hijoId` en `CrearReporteInput` y en el data del
      factory — `src/lib/dal/services/reporte-creation.ts`
- [x] T014 · Etiqueta «A quién va dirigido» en el mensaje de error de Zod —
      `src/app/api/reportes/route.ts`

## Fase 3 — UI
- [x] T020 · Paso «¿A quién va dirigido?»: lista de fichas ACTIVAS como
      opciones seleccionables, empty state con enlace a registrar y opción
      anónima — `src/components/modules/ReporteStepHijo.tsx` (nuevo)
- [x] T021 · Wizard: paso inicial SOLO en modo autenticado (pasos corridos,
      indicador de 4 puntos), sin selección no avanza, oferta de vinculación
      vuelve al paso de plataforma, `hijoId` en el POST y en el borrador —
      `src/components/modules/ReporteWizard.tsx`, `src/lib/reportar-handoff.ts`
- [x] T022 · `hijoNombre` en DTOs y mapeos (listado, detalle, cadenas) +
      `INCLUDE_CON_DETALLE` incluye `hijo` — `src/lib/dal/types/reporte.ts`,
      `src/lib/dal/services/reporte-query.ts`, `cadenas-padre.ts`,
      `src/lib/dal/repositories/reporte.ts`
- [x] T023 · «Mis reportes»: línea «dirigido a …» por evento —
      `src/components/modules/padre/MisReportesCadenas.tsx`
- [x] T024 · Detalle privado: línea «Dirigido a …» —
      `src/components/modules/MisReporteDetalle.tsx`

## Fase 4 — Tests y compuertas
- [x] T030 · 6 tests nuevos: 400 sin hijoId, 403 ajena, 409 inactiva, 201 con
      vínculo persistido, 400 anónimo con hijoId, 201 anónimo regresión —
      `src/app/api/reportes/route.test.ts`
- [x] T031 · Tests existentes ajustados (crean ficha y envían hijoId):
      atomicidad (SPEC-137), vinculación de cadena (SPEC-340), prioridad alta,
      duplicado con oferta, vigencia (SPEC-356) —
      `route-atomicidad.test.ts`, `route-expediente-vinculacion.test.ts`,
      `route.test.ts`
- [x] T032 · `hijoNombre` en cadenas (con vínculo y sin él) —
      `src/lib/dal/services/cadenas-padre.test.ts`
- [x] T033 · Regenerar línea base `docs/architecture/01-modelo-datos.md`
- [x] T034 · Compuertas: `tsc --noEmit`, vitest de archivos tocados,
      `npm run arch:check`, ESLint de archivos tocados — VERDES

## Fase 5 — Artefactos y cierre
- [x] T040 · `spec.md` + `tasks.md` en `specs/591-reportar-atado-a-hijo/`
- [x] T041 · Índice `specs/README.md` actualizado
