# Implementation Plan: SPEC-181 — Filtros, búsqueda y orden en bandejas del admin

**Branch**: `work/002-pi-078` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

---

## Summary

Patrón único (el de `AdminReportesTable` + `reportesRevisionQuerySchema`) extendido a las 3 bandejas: bandeja principal gana `orden`; spam gana barra completa (q/estado/orden/paginación) y se alinea a la convención de respuesta; anti-abuso gana filtros + `Cargando` estándar.

---

## Estado actual (verificado en fuente)

- **Bandeja**: `reportesRevisionQuerySchema` (`validators.ts:112-125`) ya tiene estado/plataformaId/categoria/fechas/operadorId/padre/q/page/pageSize. Orden fijo en `reporte.ts:195` (`prioridadAlta desc, creadoEn desc`). UI completa con URL como fuente de verdad.
- **Spam**: parsing manual sin Zod (`spam/pendientes/route.ts:33-37`: page/limit/asignadoAMi); UI sin filtros ni paginación (`SpamRevisionPanel.tsx`); respuesta `paginacion`/`limit` (no convención).
- **Anti-abuso**: solo `page`; `PAGE_SIZE` fijo 50; skeleton ad-hoc `animate-pulse` (`AdminAntiAbusoSimulacion.tsx:56-68`); repo `IdentificadorReportadoRepository.listarParaSimulacion`.
- **Orden**: ningún endpoint lo tiene — patrón nuevo con mapa cerrado en repos (nunca interpolar entrada).

---

## Diseño

### Orden — mapa cerrado compartido

En `src/lib/dal/repositories/reporte.ts`: exportar `ORDENES_BANDEJA: Record<OrdenBandeja, Prisma.ReporteOrderByWithRelationInput[]>`:
- `prioridad` (default): `[{ prioridadAlta: "desc" }, { creadoEn: "desc" }]`
- `recientes`: `[{ creadoEn: "desc" }]`
- `antiguos`: `[{ creadoEn: "asc" }]`

Schema Zod compartido: `ordenBandejaSchema = z.enum(["prioridad", "recientes", "antiguos"]).optional().default("prioridad")` en `validators.ts`.

### Tarea A — Bandeja principal

- `reportesRevisionQuerySchema` += `orden` (el enum de arriba).
- `findBandejaRevision` acepta `orden` y usa el mapa.
- `AdminReportesTable`: Select "Ordenar por" (Prioridad / Más recientes / Más antiguos) en la barra existente; va a la URL como los demás.

### Tarea B — Spam

- `spamPendientesQuerySchema` (nuevo, `validators.ts`): `q` (min 3), `estado` (`POSIBLE_SPAM`|`REVISION_MANUAL`), `orden`, `page`, `pageSize` (default 25, máx 100), conserva `asignadoAMi`.
- Endpoint: `safeParse` + where dinámico + respuesta `{ reportes, pagination: { page, pageSize, total, totalPages } }` (ajustar el client a la convención).
- `findBandejaSpam`: filtro por `q` (identificador/numeroSeguimiento contains, como bandeja) + orden parametrizado.
- `SpamRevisionPanel`: barra con búsqueda + Select estado + Select orden + paginación (patrón AdminReportesTable; URL como fuente de verdad).

### Tarea C — Anti-abuso

- `antiAbusoSimulacionQuerySchema` (nuevo): `q` (identificador contains), `nivel` (enum de niveles de riesgo del dominio), `plataformaId`, `orden`, `page`, `pageSize` (default 25, máx 100).
- Repo `listarParaSimulacion`: acepta filtros + orden.
- UI: barra de filtros + cambiar skeleton ad-hoc por `<Cargando />` dentro del panel (patrón de spam/bandeja).

### Tests

- Integration por endpoint: 400 ante param inválido; q filtra; estado/nivel filtran; orden cambia el orden real; paginación convencional (spam).
- Unit: barra de spam y anti-abuso renderizan y disparan fetch con los params (fetch mockeado).

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Romper la convención vieja de spam (`paginacion`) | Solo el client propio la consume; se ajustan juntos en el mismo commit |
| Orden por interpolación SQL | Mapa cerrado de orderBy; imposible inyectar |
| Skeleton removal rompe percepción de carga | `Cargando` visible dentro del panel (mismo patrón que las otras dos) |
