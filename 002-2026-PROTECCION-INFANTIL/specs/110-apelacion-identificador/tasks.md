# Tasks — SPEC-110: Apelación del identificador reportado

## Fase 1 — Modelo de datos

- [ ] T001 Schema Prisma: enum `EstadoApelacion`, modelos `Apelacion`,
  `DocumentoApelacion`, `AccesoDocumentoApelacion`, `AccionAudit` += 3 valores,
  `IdentificadorReportado.ocultoPorComiteEn`, relaciones en `Usuario`/`Plataforma`
  (`prisma/schema.prisma`).
- [ ] T002 Migración aditiva con índice único parcial de apelación abierta
  (`prisma/migrations/<ts>_apelacion_identificador/migration.sql`); aplicar a dev y test.
- [ ] T003 Seed de los 4 parámetros `apelacion.*` (`prisma/seed.ts`); reset de las 3
  tablas nuevas en `src/lib/test-utils.ts`.

## Fase 2 — Librerías de dominio

- [ ] T004 `src/lib/apelaciones.ts`: parámetros con fallback (15/10/30/5),
  `sumarDiasHabiles`, `diasHabilesTranscurridos`, `calcularPlazoRespuesta`,
  `generarNumeroApelacion`, `contarReportesAsociados`, `estaEnAvisoPrevio`.
- [ ] T005 `src/lib/apelacion-storage.ts`: cifrar/descifrar buffer AES-256-GCM
  (`[IV][TAG][ciphertext]`), guardar/leer/borrar `.enc` en `storage/apelaciones/`
  (override `APELACIONES_STORAGE_DIR`), sha256, validación de PDF (MIME + magic bytes).
- [ ] T006 Visibilidad: `ocultoPorComiteEn` en `src/lib/visibility.ts`; levantar marca en
  el upsert de reporte nuevo de `src/app/api/reportes/route.ts`. `.gitignore` += `storage/`.

## Fase 3 — APIs del apelante

- [ ] T007 `POST /api/apelaciones` (multipart: campos + PDF; validaciones Zod, PDF,
  tamaño con parámetro, duplicada abierta 409, cifrado + persistencia, AuditLog
  APELACION_CREADA) + `route.test.ts` (crear OK, 401 anónimo, 400 no-PDF, 413 tamaño,
  efecto del parámetro de tamaño, NO cambia visibilidad).
- [ ] T008 `GET /api/apelaciones/mias` (solo propias; N reportes; decisión + motivación;
  SIN datos de reportes) + test (sin fuga de contenido).

## Fase 4 — APIs del comité

- [ ] T009 `GET /api/admin/comite/apelaciones` (bandeja: filtro estado, marca próximo a
  vencer, paginación) y `GET /api/admin/comite/apelaciones/[id]` (detalle + metadatos del
  documento + reportes del identificador para selección de bajas).
- [ ] T010 `GET /api/admin/comite/apelaciones/[id]/documento` (solo COMITE_VALIDACION;
  descifra + streamea; AuditLog + AccesoDocumentoApelacion; 403 admin/operador/padre;
  410 purgado) + `route.test.ts`.
- [ ] T011 `POST .../[id]/tomar` (RECIBIDA→EN_REVISION, 409 si tomada) y
  `POST .../[id]/resolver` (decisión + motivación obligatoria; ACEPTADA:
  quitarVisibilidad vía dueña del flag y/o `reportesABajar` con `darDeBajaReporte`;
  AuditLog APELACION_RESUELTA) + `route.test.ts` (efecto real de visibilidad, baja,
  rechazo intacto, reporte ajeno 400, sin motivación 400).

## Fase 5 — Mantenimiento programado

- [ ] T012 `src/lib/apelacion-mantenimiento.ts` (`purgarDocumentosVencidos`,
  `procesarAvisosPlazo` con `enviarAvisoPlazoApelaciones` en `src/lib/email.ts`) +
  worker: cola `apelacion-mantenimiento` + `boss.schedule` diario 06:00 America/Bogota.
- [ ] T013 `src/lib/apelacion-mantenimiento.test.ts`: efecto de retención (30 vs 60),
  purga real del `.enc` + metadatos conservados + AuditLog; aviso a los N días hábiles
  (efecto del parámetro; email mockeado).

## Fase 6 — UI mínima

- [ ] T014 Área apelante: `/dashboard/apelaciones` + `ApelacionesClient.tsx` (formulario
  con upload, lista propia, canales oficiales, textos de qué esperar/qué NO verá) +
  entrada en `DashboardUsuarioClient.tsx`.
- [ ] T015 Bandeja comité: `/dashboard/admin/comite/apelaciones` +
  `ComiteApelacionesBandeja.tsx` (lista, tomar, detalle, descargar evidencia, resolver
  con motivación + efectos) + tab en `COMITE_NAV_TABS`.

## Fase 7 — Docs y cierre

- [ ] T016 Enmienda constitucional (texto exacto del brief) en
  `.specify/memory/constitution.md` — commit propio de docs.
- [ ] T017 `specs/README.md` (índice + contadores; lo exige `specs-discipline.test.ts`).
- [ ] T018 Gate: `npx tsc --noEmit` + `npm run lint` + tests tocados + `npm run build` +
  `npm run test` completo.
- [ ] T019 `cierre.md` + sección Implementación en `spec.md` (Status → IMPLEMENTADO) +
  commits + push. **SIN DESPLEGAR.**
