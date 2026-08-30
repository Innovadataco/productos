# Implementation Plan: SPEC-311 · Ficha colegio admin Fase 2 (rediseño 4 bloques A→D)

**Branch**: `work/pi-SPEC-311-ficha-colegio-rediseno` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/311-ficha-colegio-rediseno/spec.md`

## Summary

Cierra I-98 reorganizando `ColegioDetalleSecciones.tsx` (7 secciones planas) en 4 bloques con propósito A→D. Cambio estructural UI + ampliación aditiva del payload de `/api/admin/analytics/colegios/[id]`. Bloque A accionable con KPIs + CTAs + operadores + semáforo → aparece primero. Bloque B analítico con TendenciaReportes + BarChart + distribución por rol. Bloque C nuevo componente `ColegioLineaTiempo` (SVG puro). Bloque D referencia (5 secciones existentes reordenadas).

**Decisión clave**: `analytics-colegio.ts` compone las 4 ampliaciones (`distribucionRol`, `operadoresAsignados`, `lineaTiempo`, `serieMensual`) invocando `ColegioActividadRepository.actividadDelColegio` de Fase 1 con rangos apropiados. **Cero cambios en `colegio-actividad.ts`** (contrato inmutable). Cero migración destructiva. Cero librería nueva.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node.js ≥ 22, Next.js 16.2.10 (App Router API), React 19.

**Primary Dependencies**: Recharts 3.10.1 (ya instalado, sin dep nueva), `@prisma/client` (existente), tokens PI. Sin librerías nuevas.

**Storage**: PostgreSQL — modelos existentes `Usuario`, `AlertaColegio`, `Reporte`, `Colegio`. Cero migración.

**Testing**: Vitest + jsdom + Testing Library (constitución §5). Tests colocados junto al componente/repo.

**Target Platform**: 002-2026-PROTECCION-INFANTIL. Sin impacto BI.

**Project Type**: Feature de UI + ampliación aditiva de payload backend.

**Performance Goals**: `/api/admin/analytics/colegios/[id]` responde < 800 ms para colegio con más volumen de prod (SC-009). Cero N+1: las 4 queries adicionales van en `Promise.all` junto con las existentes.

**Constraints**:
- Cero cambio en `colegio-actividad.ts` (repo Fase 1 · fuente única de "reportes del colegio").
- Cero migración, cero campo Prisma nuevo.
- Cero librería de charts nueva. Reutiliza `BarChart`, `TendenciaReportes`, `RitmoMensual`.
- Names de CTAs con query params `?colegioId=` — validar rutas destino existentes durante implement (candado 17 D-98 si fallan).
- Tokens PI + contraste AA (`scripts/contrast_check.js`).

**Scale/Scope**: ~10-15 archivos totales (2-3 componentes nuevos/refactor + payload types + tests + spec-kit + fila README).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución `.specify/memory/constitution.md` v1.1.0. Análisis por sección:

| Sección | Aplicabilidad | Veredicto |
|---|---|---|
| §1 Principios del producto (solo texto, presunción de inocencia, IA local, disputas) | No aplica — Fase 2 UI · sin contenido nuevo, sin procesamiento IA, sin consulta pública | ✅ PASS trivial |
| §2 Stack técnico (Next.js, React, Prisma, JWT, Vitest) | Reutiliza stack existente; cero librería nueva | ✅ PASS |
| §3 Calidad TS estricto (any prohibido, error handling) | Componentes y ampliación de payload respetan `strict: true`, tipar payloads con types de `analytics-colegio-types.ts`, sin `any` | ✅ PASS con nota (candado en tasks) |
| §4 Arquitectura API + persistencia | Endpoint existente `/api/admin/analytics/colegios/[id]` amplía payload aditivo; sin nuevas rutas | ✅ PASS |
| §5 Testing (Vitest, cobertura, patrón) | Añade tests de componentes y regresión SC-006, siguiendo el patrón existente | ✅ PASS |
| §6 Seguridad (JWT, encriptación) | Endpoint admin ya usa `verifyAuth`+`assertModulo`; sin exposición de texto crudo (operadores expone nombre+email, no datos sensibles) | ✅ PASS |
| §7 UI (Tailwind, no `Math.random` en render) | Cambios en componentes respetan tokens PI, sin `Math.random`, sin `setState` sincrónico en `useEffect` | ✅ PASS |
| §8 Proceso desarrollo (commit atómico, lint, test, build) | Antes de PR: lint + test + build en verde; candado 24 D-55 aplicado (`npm run lint -- <archivo>` + grep `error`) | ✅ PASS |

**Gates**: sin violaciones. Cero justificación pendiente.

**Complexity Tracking**: N/A.

## Project Structure

### Documentation (this feature)

```text
specs/311-ficha-colegio-rediseno/
├── plan.md                 # este archivo
├── spec.md                 # feature spec (Status PLANEADO · SPEC-311 reasignado)
├── research.md             # Phase 0: decisiones + verificaciones en fuente
├── data-model.md           # Phase 1: shape de las 4 ampliaciones del payload
├── quickstart.md           # Phase 1: guía tests + SC-009 medición + verificación visual
├── contracts/
│   └── payload-extension.md    # Phase 1: contrato aditivo del endpoint
├── checklists/
│   └── requirements.md     # 12/12 PASS generada por /speckit-specify
└── tasks.md                # Phase 2 output (/speckit-tasks — NO creado aquí)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/dal/repositories/
│   ├── colegio-actividad.ts             # SOLO LECTURA (repo Fase 1 · contrato inmutable)
│   ├── analytics-colegio.ts             # MODIFICADO — poblar 4 bloques nuevos del payload
│   └── analytics-colegio-types.ts       # MODIFICADO — declarar 4 bloques nuevos en ColegioDetalleResponse
├── src/app/api/admin/analytics/colegios/
│   └── [id]/route.ts                    # SIN CAMBIOS (respuesta viene del repo modificado)
├── src/components/modules/admin/
│   ├── ColegioDetalleSecciones.tsx      # MODIFICADO/REEMPLAZADO — 4 bloques A→D
│   └── ColegioLineaTiempo.tsx           # NUEVO — Bloque C
├── src/app/dashboard/admin/estadisticas/operacion/colegios/[colegioId]/
│   └── ColegioDetalleClient.tsx         # SIN CAMBIOS previstos (consume payload igual)
└── specs/311-ficha-colegio-rediseno/    # docs de esta spec
```

**Rutas prohibidas** (candados instructivo · SOLO LECTURA absoluta):
```text
src/lib/dal/repositories/colegio-actividad.ts
src/lib/ai/**
scripts/deploy-prod.sh
.github/workflows/verificar-base-pr.yml
prisma/schema.prisma  # cero migración · cero campo nuevo
```

**Coordinación con otros Devs** (worktrees vivos verificados en `git worktree list`):
- `pi-SPEC-305-semaforo-circulo-confianza` (mergeado)
- `pi-SPEC-306/307/308-*` (círculo confianza · Kimi)
- `pi-SPEC-309-home-padre-proactivo` (Kimi · el que debería ocupar SPEC-304 según README stale)
- `pi-SPEC-310-*` (Dev PI-2 · puente sesión PI↔BI · 002-PI-211)

**Rutas ortogonales**: yo en `src/components/modules/admin/**` + `src/lib/dal/repositories/analytics-colegio.ts` + `analytics-colegio-types.ts` · otros Devs en rutas totalmente distintas (padre, círculo, notificaciones, sesión). Cero solape previsible.

**Structure Decision**: feature de producto sobre stack existente. Composición en `analytics-colegio.ts` respeta principio "extender, no reescribir" y preserva contrato Fase 1 (`colegio-actividad.ts` intocable).

## Complexity Tracking

Sin violaciones a la constitución. Tabla vacía.
