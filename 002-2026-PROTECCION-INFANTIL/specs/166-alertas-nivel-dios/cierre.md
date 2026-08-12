# Cierre: SPEC-166 — Alertas nivel dios: bandeja de prioridad, filtros, lote y SLA

**Estado**: IMPLEMENTADO  
**Fecha de cierre**: 2026-08-12  
**Rama de trabajo**: `work/002-pi-062`  
**PR**: pendiente → `feature/001-scaffolding`  

---

## Resumen

Se transformó el listado de alertas del colegio en una bandeja operativa con prioridad determinista, SLA, filtros potentes, selección en lote y asignación/escalación. `AlertaColegio` ahora lleva `prioridad`, `vencimientoSla` y `asignadoAId`. El cálculo de prioridad considera categoría de la clasificación, confianza del modelo y detección de `EventoMatch`. La UI del rector refleja la bandeja ordenada por prioridad + novedad + vencimiento, con chips de estado, filtros, selección masiva y acciones inline.

---

## Cambios integrados

### Modelo de datos

- `prisma/schema.prisma`:
  - `AlertaColegio` añade `prioridad` (String, default `media`), `vencimientoSla` (DateTime), `asignadoAId` (String?, FK a `Usuario`).
  - Índices `(colegioId, prioridad, vencimientoSla)` y `(colegioId, asignadoAId)`.
  - Relación opción `asignadoA` hacia `Usuario`.
- `prisma/migrations/20260812190000_spec_166_alerta_prioridad_sla/migration.sql`: migración aditiva con ADD COLUMN, ADD FOREIGN KEY, CREATE INDEX y backfill de `prioridad`/`vencimientoSla` para alertas existentes.

### Backend

- `src/lib/colegio/alertas-prioridad.ts` (nuevo): `calcularPrioridadYSLA` con reglas deterministas y lectura de `ParametroSistema` para umbrales de SLA.
- `src/lib/colegio/alertas-prioridad.test.ts` (nuevo): casos de categoría/confianza/match y defaults.
- `src/lib/dal/repositories/alerta-colegio-bandeja.ts` (nuevo): `listarBandeja`, `asignar`, `escalar` y métodos auxiliares de bandeja, tenant-first.
- `src/lib/dal/repositories/alerta-colegio.ts`: `INCLUDE_LISTADO` añade `asignadoA`; `crear` recibe `prioridad`/`vencimientoSla` con defaults; mantiene agregaciones existentes.
- `src/lib/colegio/alertas.ts`:
  - `listarBandejaAlertasColegio` con DTO enriquecido (prioridad, SLA, asignado, match).
  - `asignarAlerta`, `escalarAlerta`, `aplicarAccionEnLote`.
  - Integración de `calcularPrioridadYSLA` en la creación de alertas.
- `src/lib/dal/repositories/reporte.ts`: `findEstadoParaNotificacion` incluye `clasificacion` y `creadoEn`.
- `src/lib/dal/repositories/usuario.ts`: `findAsignablesPorColegio` para poblar select de asignación.
- `src/lib/schemas/index.ts`: `alertaQuerySchema`, `alertaBatchSchema`, `asignarAlertaSchema`, `escalarAlertaSchema`.

### API

- `src/app/api/colegio/alertas/route.ts`: GET con filtros/paginación; POST para acciones en lote.
- `src/app/api/colegio/alertas/[id]/asignar/route.ts`: asigna/desasigna una alerta.
- `src/app/api/colegio/alertas/[id]/escalar/route.ts`: escala una alerta con motivo.
- `src/app/api/colegio/usuarios/route.ts`: lista usuarios asignables del colegio.

### Frontend

- `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx`: bandeja con prioridad, SLA, filtros, selección en lote, acciones inline y modal de asignación.

### Tests

- `src/lib/colegio/alertas-prioridad.test.ts`.
- `src/app/api/colegio/alertas/route.test.ts`: ajustado al nuevo DTO `{ items, total, page, pageSize }` y tests de filtros.
- `src/lib/e2e/journeys/colegio.test.ts` y `negativos-handler.test.ts`: adaptados al nuevo shape de respuesta y a campos requeridos `prioridad`/`vencimientoSla`.
- Tests auxiliares (`avisos.test.ts`, `avisos-resumen.test.ts`, `avisos-observacion.test.ts`, `patrones.test.ts`, agregaciones de resumen) actualizados a la firma de `crear` con prioridad/SLA.

### Auditoría y arquitectura

- Acciones de audit añadidas/usan `COLEGIO_ALERTA_ASIGNADA`, `COLEGIO_ALERTA_ESCALADA` y lote.
- `docs/architecture/01-modelo-datos.md` y `02-roles-capacidades.md` regenerados (`npm run arch:check` verde).

---

## Gate de calidad

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ (0 errores; warnings preexistentes) |
| `npm run test` | ✅ |
| `npm run tokens:check` | ✅ |
| `npm run arch:check` | ✅ |
| `npm run build` | ✅ |

---

## Notas

- No se tocó `src/lib/ai/**`.
- No se modificó `Curso` ni `Estudiante.cursoId`.
- La migración es aditiva: solo nullable + columnas/relaciones/índices nuevos en `AlertaColegio`.
- El matching y la lógica de notificación siguen siendo cross-tenant a propósito; cada colegio recibe su alerta.
