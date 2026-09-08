# Tasks — SPEC-584 · Acceso cifrado y auditado a textos

## Fase 0 — Preparación
- [x] T001 · Migración aditiva `20260907120000_spec_584_acceso_cifrado_auditoria`
      (LecturaReporte + CodigoAccesoContenido + enum AccionAudit + FKs/índices) — `prisma/migrations/`
- [x] T002 · Modelos y relaciones inversas en `prisma/schema.prisma` (Reporte,
      EventoExpediente, Usuario) + `ERROR_CODES.GONE` — `src/lib/errors.ts`

## Fase 1 — Hilo del actor (ALS)
- [x] T010 · `conActor`/`actorActual`/`actorDesdeRequest` — `src/lib/auditoria-lectura/actor.ts`
- [x] T011 · Tests unitarios del ALS — `src/lib/auditoria-lectura/actor.test.ts`

## Fase 2 — Auditoría de lectura
- [x] T020 · Escritor de auditoría (fail-loud) + notificación al padre dueño —
      `src/lib/dal/services/auditoria-lectura.ts`
- [x] T021 · Frontera audita cada descifrado (singular + batch, resolución de
      dueño reporte/evento) — `src/lib/dal/services/descifrar-contenido.ts`
- [x] T022 · Envolver rutas lectoras con `conActor`: reportes-revision/[id],
      revelar-original, spam/pendientes, resolver-spam, validar-anonimizacion,
      correcciones, reportes/[id]/expediente, comite/consolidacion/[expedienteId]
- [x] T023 · Endpoint historial + repositorio — `src/app/api/admin/reportes/[id]/accesos-texto/route.ts`,
      `src/lib/dal/repositories/lectura-reporte.ts`
- [x] T024 · UI «Historial de accesos al texto» — `src/components/modules/reporte-detalle/HistorialAccesosTexto.tsx`
- [x] T025 · Seed reglas/plantillas `padre.reporte.texto_leido` — `prisma/seed.ts`
- [x] T026 · Tests integración auditoría (frontera + detalle admin + anónimo sin
      notificación + historial) — `src/lib/dal/services/descifrar-contenido.auditoria.test.ts`,
      `src/app/api/reportes/acceso/acceso.test.ts`

## Fase 3 — Acceso externo por código temporal
- [x] T030 · Generador/normalizador/hash de código — `src/lib/acceso-codigo.ts` + tests unitarios
- [x] T031 · Servicio ciclo de vida (solicitar/canjar/ver) + repositorio —
      `src/lib/dal/services/codigo-acceso.ts`, `src/lib/dal/repositories/codigo-acceso.ts`
- [x] T032 · Endpoints: `POST /api/reportes/[id]/solicitar-acceso`,
      `POST /api/reportes/acceso/canjar`, `GET /api/reportes/acceso/ver`
- [x] T033 · Rate limits `acceso_codigo` (3/h), `acceso_canje` (10/h), `acceso_lectura` (30/min) —
      `src/lib/rate-limit.ts`
- [x] T034 · Proxy: whitelist PROFESIONAL + canje compartido con padre — `src/lib/proxy.ts`
- [x] T035 · Seed reglas/plantillas `padre.reporte.acceso_codigo` y
      `padre.reporte.acceso_canjeado` — `prisma/seed.ts`
- [x] T036 · UI padre «Compartir con un profesional» — `src/components/modules/padre/CompartirTextoProfesional.tsx`
- [x] T037 · Pantalla «Canjear código» — `src/app/canjear-acceso/page.tsx`
- [x] T038 · Tests integración flujo completo (solicitar/canjar/ver, 404/409/410/400,
      carrera de canje, código anterior expirado) — `src/app/api/reportes/acceso/acceso.test.ts`

## Fase 4 — Spec-Kit y compuertas
- [x] T040 · `spec.md` + `plan.md` + `tasks.md` — `specs/584-acceso-cifrado-textos/`
- [x] T041 · Entrada en `specs/README.md`
- [x] T042 · Regenerar artefactos arch si hay drift (01-modelo-datos) y dejar `arch:check` verde
- [x] T043 · Compuertas: tsc, lint, test:unit, tests integración nuevos, build,
      arch:check, indices:check (todas verdes: tsc 0 err, lint 0 err,
      suite completa 3026 passed/1 skipped, build OK, arch:check VERDE,
      índices 5/5)
- [x] T044 · Commits locales (español, staging solo `002-2026-PROTECCION-INFANTIL/...`)
