# Implementation Plan: SPEC-166 — Alertas nivel dios: bandeja de prioridad, filtros, lote, SLA

**Branch**: `work/002-pi-0XX` (a definir al radicar) | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Rediseñar `/dashboard/colegio/alertas` como una única bandeja de prioridad ordenada por gravedad + novedad + SLA. Extender `AlertaColegio` con estados (`nueva | vista | gestionada | escalada | cerrada`), `prioridad`, `vencimientoSla` y `asignadoAId`. Añadir filtros por sujeto, curso, categoría, gravedad y fecha, acciones inline (gestionar, escalar, asignar) y acciones en lote. Mostrar contexto `EventoMatch` como indicador de reincidencia para decidir escalamiento. Todo colegio-scoped, sin exponer el contenido de los reportes ni la identidad de los denunciantes.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Multi-tenant** | `colegioId` obligatorio en todas las lecturas/escrituras (DAL E-1 / SPEC-134) |
| **Transaction boundary** | `withUnitOfWork` para operaciones que tocan múltiples entidades (escalamiento + audit, lote) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | La bandeja muestra metadatos de texto; sin multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | Lenguaje descriptivo ("N reportes independientes"); nunca veredictos |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | Todo colegio-scoped |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | FR-010: audit en estados, escalamiento, asignación y lote |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por endpoint/método |
| I-49 Migraciones aditivas | ✅ Pass | Solo columnas/índices nuevos en `AlertaColegio`; `Curso` y `Estudiante` no se tocan |

---

## Project Structure

### Documentation (this feature)

```text
specs/166-alertas-nivel-dios/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + campos/índices en AlertaColegio
└── migrations/                         # migración aditiva 166
src/
├── lib/
│   ├── dal/repositories/
│   │   ├── alerta-colegio.ts           # MODIFICADO: listar filtrado/ordenado, asignar, recalcular prioridad
│   │   └── alerta-colegio.test.ts      # MODIFICADO/AMPLIADO
│   ├── colegio/
│   │   ├── alertas.ts                  # MODIFICADO: listado con filtros/prioridad, acciones inline/lote
│   │   ├── alertas-prioridad.ts        # NUEVO: cálculo de prioridad y SLA
│   │   └── alertas-prioridad.test.ts   # NUEVO
│   ├── schemas/index.ts                # + alertaQuerySchema, alertaBatchSchema, alertaAsignarSchema
│   └── audit.ts                        # + acciones COLEGIO_ALERTA_* si no existen
├── app/
│   ├── api/colegio/alertas/
│   │   ├── route.ts                    # GET ampliado (filtros, paginación)
│   │   ├── route.test.ts               # MODIFICADO/AMPLIADO
│   │   ├── batch/
│   │   │   └── route.ts                # POST acciones en lote + test
│   │   └── [id]/
│   │       ├── estado/
│   │       │   └── route.ts            # PATCH estados extendidos + test
│   │       ├── escalar/
│   │       │   └── route.ts            # POST escalar + test
│   │       └── asignar/
│   │           └── route.ts            # POST asignar + test
│   └── dashboard/colegio/alertas/
│       ├── page.tsx                    # server component (sin cambios estructurales)
│       ├── AlertasColegioPageClient.tsx # MODIFICADO: bandeja de prioridad, filtros, lote
│       ├── AlertaFiltros.tsx           # NUEVO: barra/panel de filtros
│       ├── AlertaFila.tsx              # NUEVO: fila de alerta con acciones inline
│       └── AlertaLoteToolbar.tsx       # NUEVO: toolbar de acciones en lote
└── components/ui/                      # reusa Badge, Button, Select, GlassCard, Checkbox, etc.
```

---

## Fases

1. **Schema + migración aditiva**
   - Añadir `prioridad`, `vencimientoSla`, `asignadoAId` a `AlertaColegio`.
   - Extender estados permitidos a `nueva | vista | gestionada | escalada | cerrada`.
   - Añadir índices: `(colegioId, prioridad, vencimientoSla)`, `(colegioId, estado)`, `(colegioId, asignadoAId)`.
   - Generar y aplicar migración; ejecutar `prisma generate`.

2. **Cálculo de prioridad y SLA**
   - Implementar `alertas-prioridad.ts` con función determinista `calcularPrioridadYSLA(alerta, clasificacion, eventoMatch)`.
   - Leer pesos por defecto de `ParametroSistema` (con fallback seguro).
   - Tests unitarios por combinaciones de categoría/confianza/match.

3. **Backend: repositorio y servicios**
   - Extender `AlertaColegioRepository`:
     - `listarPorColegio` con filtros tipados y orden fijo.
     - `asignar` con validación de tenant.
     - `recalcularPrioridad` para uso posterior.
   - Extender `src/lib/colegio/alertas.ts`:
     - `listarAlertasColegio` con DTO enriquecido.
     - `escalarAlerta`, `asignarAlerta`, `aplicarAccionEnLote`.
   - Tests de repo y servicio.

4. **Backend: endpoints**
   - `GET /api/colegio/alertas` con filtros/paginación.
   - `PATCH /api/colegio/alertas/[id]/estado` estados extendidos.
   - `POST /api/colegio/alertas/[id]/escalar`.
   - `POST /api/colegio/alertas/[id]/asignar`.
   - `POST /api/colegio/alertas/batch`.
   - Tests de API con A/B y validaciones.

5. **Frontend**
   - Rediseñar `AlertasColegioPageClient.tsx` como bandeja de prioridad.
   - Crear `AlertaFiltros.tsx`, `AlertaFila.tsx`, `AlertaLoteToolbar.tsx`.
   - Integrar selección en lote, chips de estado/gravedad, badge EventoMatch.
   - Asegurar móvil-first, touch targets ≥ 44 px y `prefers-reduced-motion`.

6. **Auditoría y arquitectura**
   - Añadir valores a `AccionAudit`: `COLEGIO_ALERTA_ESCALADA`, `COLEGIO_ALERTA_ASIGNADA`, `COLEGIO_ALERTA_LOTE_ESTADO`, `COLEGIO_ALERTA_LOTE_ESCALAR`, `COLEGIO_ALERTA_LOTE_ASIGNAR`.
   - Auditar todas las mutaciones.
   - Regenerar artefactos de arquitectura (`npm run arch:check` verde).

7. **Integración**
   - Gate completo: `tsc --noEmit`, `lint`, `arch:check`, `test`, `build`.
   - Commit, push a rama de trabajo, PR a `feature/001-scaffolding`.
   - CI-PUSH verde.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| Bandeja única ordenada, no Kanban | Brief §7 descarta Kanban por bajo volumen, mal móvil y tono. | Riesgo bajo; se valida con rector en quickstart. |
| Persistir `prioridad` y `vencimientoSla` en `AlertaColegio` | Permite ordenar y filtrar en BD sin recalcular en cada request. | Mantener sincronizados al cambiar clasificación/match; se recalcula en esos eventos. |
| `asignadoAId` en `AlertaColegio` | Asignación ligera sin crear nueva entidad. | Validar siempre que el usuario pertenezca al colegio o tenga rol operativo; no exponer asignaciones ajenas. |
| Escalamiento a `SolicitudComite` (Comité de Validación de plataforma) | Reusa infraestructura existente; no bloquea Fase F. | Documentar claramente que Fase F cambiará el destino al Comité de Convivencia colegio-scoped. |
| Fase C como dependencia para filtro por sujeto | Evita rehacer matching de profesor/acudiente en Fase D. | Si Fase C no está lista, el filtro se limita a `ESTUDIANTE` y se registra deuda. |
| SLA configurable por `ParametroSistema` con defaults | Cada colegio puede ajustar sin cambiar código. | Validar que los valores sean números positivos; fallback a 24/48/72 h. |
| Acciones en lote con conteo de éxitos/errores | UX clara sin exponer datos ajenos. | Implementar transacciones cortas por alerta para limitar el radio de fallo. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 | Migración inspeccionada; `src/lib/dal/repositories/alerta-colegio.test.ts` |
| FR-003 | `src/lib/colegio/alertas-prioridad.test.ts` |
| FR-004 | `src/app/api/colegio/alertas/route.test.ts` |
| FR-005 | Tests de componente `AlertasColegioPageClient`, `AlertaFila`, `AlertaFiltros` |
| FR-006 | `src/app/api/colegio/alertas/[id]/estado/route.test.ts`, `[id]/escalar/route.test.ts`, `[id]/asignar/route.test.ts` |
| FR-007 | `src/app/api/colegio/alertas/batch/route.test.ts` |
| FR-008 | Tests de servicio y API que verifican conteo de match e indicador inter-ciudad |
| FR-009 | Tests A/B en todas las rutas y repositorios |
| FR-010 | Tests de auditoría en mutaciones |
| FR-011 | Migración SQL inspeccionada; regresión de `Curso`/`Estudiante` |
