:# Tasks: SPEC-166 — Alertas nivel dios: bandeja de prioridad, filtros, lote, SLA

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `prioridad`, `vencimientoSla`, `asignadoAId` a `model AlertaColegio` en `prisma/schema.prisma`.
- [ ] Extender comentario/validación de `AlertaColegio.estado` a `nueva | vista | gestionada | escalada | cerrada`.
- [ ] Añadir índices `(colegioId, prioridad, vencimientoSla)` y `(colegioId, asignadoAId)`.
- [ ] Generar migración aditiva con backfill de prioridad/SLA para alertas existentes.
- [ ] Ejecutar `npx prisma migrate dev` y `npx prisma generate`.

## T002 — Cálculo de prioridad y SLA
- [ ] Crear `src/lib/colegio/alertas-prioridad.ts` con `calcularPrioridadYSLA(alerta, clasificacion, eventoMatch)`.
- [ ] Leer configuración de `ParametroSistema` con defaults seguros (alta=24h, media=48h, baja=72h).
- [ ] Crear `src/lib/colegio/alertas-prioridad.test.ts` con casos de categoría/confianza/match.

## T003 — Extender repositorio AlertaColegio
- [ ] Modificar `src/lib/dal/repositories/alerta-colegio.ts`:
  - `listarPorColegio` con filtros tipados (`estado`, `tipoSujeto`, `cursoId`, `categoria`, `gravedad`, `desde`, `hasta`) y orden fijo por prioridad + novedad + SLA.
  - `asignar(colegioId, id, asignadoAId)`.
  - `recalcularPrioridad(colegioId, id, prioridad, vencimientoSla)`.
- [ ] Actualizar/crear `src/lib/dal/repositories/alerta-colegio.test.ts` para filtros, orden, asignación y A/B.

## T004 — Extender servicio de alertas
- [ ] Modificar `src/lib/colegio/alertas.ts`:
  - `listarAlertasColegio` con DTO enriquecido (prioridad, SLA, asignado, match).
  - `escalarAlerta(id, colegioId, motivo, request)`.
  - `asignarAlerta(id, colegioId, asignadoAId, request)`.
  - `aplicarAccionEnLote(ids, colegioId, accion, payload, request)`.
- [ ] Integrar cálculo de prioridad en la creación de alertas (sin bloquear el worker).

## T005 — GET /api/colegio/alertas ampliado
- [ ] Actualizar `src/app/api/colegio/alertas/route.ts` para soportar filtros y paginación.
- [ ] Actualizar `src/lib/schemas/index.ts` con `alertaQuerySchema`.
- [ ] Actualizar `src/app/api/colegio/alertas/route.test.ts` con tests de filtros, orden y A/B.

## T006 — PATCH estado extendido
- [ ] Actualizar `src/app/api/colegio/alertas/[id]/estado/route.ts` para aceptar `escalada` y `cerrada`.
- [ ] Actualizar `src/lib/schemas/index.ts` con `alertaEstadoSchema` extendido.
- [ ] Actualizar `src/app/api/colegio/alertas/[id]/estado/route.test.ts`.

## T007 — Escalar alerta
- [ ] Crear `src/app/api/colegio/alertas/[id]/escalar/route.ts`.
- [ ] Crear `src/app/api/colegio/alertas/[id]/escalar/route.test.ts` (A/B, idempotencia por `reporteId`, audit).

## T008 — Asignar alerta
- [ ] Crear `src/app/api/colegio/alertas/[id]/asignar/route.ts`.
- [ ] Crear `src/app/api/colegio/alertas/[id]/asignar/route.test.ts` (A/B, usuario ajeno, audit).

## T009 — Acciones en lote
- [ ] Crear `src/app/api/colegio/alertas/batch/route.ts` con `POST`.
- [ ] Crear `src/lib/schemas/index.ts` con `alertaBatchSchema`.
- [ ] Crear `src/app/api/colegio/alertas/batch/route.test.ts` (selección mixta, cross-tenant, conteo).

## T010 — Rediseño de la UI de alertas
- [ ] Modificar `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx`:
  - Bandeja de prioridad ordenada.
  - Chips de estado y gravedad.
  - Filtros potentes.
  - Selección en lote.
  - Acciones inline.
  - Badge `EventoMatch`.
- [ ] Crear `src/app/dashboard/colegio/alertas/AlertaFiltros.tsx`.
- [ ] Crear `src/app/dashboard/colegio/alertas/AlertaFila.tsx`.
- [ ] Crear `src/app/dashboard/colegio/alertas/AlertaLoteToolbar.tsx`.
- [ ] Tests de componente donde aplique.

## T011 — Auditoría y arquitectura
- [ ] Añadir a `AccionAudit`: `COLEGIO_ALERTA_ESCALADA`, `COLEGIO_ALERTA_ASIGNADA`, `COLEGIO_ALERTA_LOTE_ESTADO`, `COLEGIO_ALERTA_LOTE_ESCALAR`, `COLEGIO_ALERTA_LOTE_ASIGNAR`.
- [ ] Asegurar que todas las mutaciones registran `AuditLog` con metadatos (sin textos de reportes).
- [ ] Regenerar artefactos de arquitectura y dejar `npm run arch:check` verde.

## T012 — Gate y cierre
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run arch:check`, `npm run test`, `npm run build` verdes.
- [ ] Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.
