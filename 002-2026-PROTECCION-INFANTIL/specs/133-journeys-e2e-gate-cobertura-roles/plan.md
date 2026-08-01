# Implementation Plan: SPEC-133 — Journeys E2E por rol: gate de merge + cobertura completa

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/133-journeys-e2e-gate-cobertura-roles/spec.md` (002-PI-056, ítem Q-1)

## Summary

Dos frentes sin tocar runtime. (1) **Gate explícito**: script `test:journeys` + paso
dedicado en el workflow de CI + branch protection documentada para el CEO. (2)
**Cobertura por rol**: ampliar los 4 journeys de rol con las capacidades críticas que el
gap analysis (2026-08-01) encontró sin red de tests — apelaciones (padre y comité),
carga masiva y alertas (colegio), anonimización (operador), configuración (admin) — y
añadir los negativos donde vive el control real: handlers (403 finos), asignación
estricta y aislamiento multi-tenant A/B.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: las ya instaladas (vitest, helpers SPEC-114); ninguna nueva

**Storage**: PostgreSQL de test (misma BD compartida de la suite; siembra via
`sembrarBase`/`datosCiclo`/`sembrarBancoCiclo`)

**Testing**: Vitest — journeys de integración contra handlers reales (patrón SPEC-114:
import del `route.ts`, `Request` nativo, `mock-headers`, §9 efecto en BD)

**Target Platform**: CI (GitHub Actions, `ci-002-proteccion-infantil`) + local

**Project Type**: QA / hardening de tests (sin cambios de producto)

**Performance Goals**: suite completa < 2× el tiempo actual (~6 min)

**Constraints**: FR-009 — no tocar `src/app` ni `src/lib` no-test; estados del motor se
siembran (CI sin Ollama); piso de cobertura Q-2 nunca baja; defectos descubiertos se
reportan, no se arreglan en esta spec

**Scale/Scope**: 4 journeys ampliados + 1-2 archivos de negativos nuevos + script npm +
paso CI + runbook

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Presunción de inocencia / solo texto / IA local**: OK — no se toca producto.
- **Canales oficiales / disputas (Ley 1581)**: REFUERZO — las apelaciones (disputa del
  titular) pasan a tener red de tests en dos roles.
- **Migraciones aditivas**: N/A — sin schema.
- **No debilitar tests**: OK — solo se añaden afirmaciones; ningún test existente se relaja.
- **Metodología Spec-Kit**: OK — compuerta §4: spec+plan y PARA.

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/133-journeys-e2e-gate-cobertura-roles/
├── spec.md
├── plan.md              # este archivo
├── research.md          # gap analysis rol × capacidades (ya hecho, resumido)
├── quickstart.md        # cómo correr los journeys (local y CI)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/lib/e2e/journeys/
├── admin.test.ts               # + config/parametros, spam resolver, correcciones RAG
├── colegio.test.ts             # + carga masiva, alertas colegio, auditoría
├── padre.test.tsx              # + apelaciones, alertas, recuperar contraseña
├── operador-comite.test.ts     # + anonimización (operador), apelaciones (comité)
├── aislamiento.test.ts         # + multi-tenant colegio A/B (o archivo nuevo)
└── negativos-handler.test.ts   # NUEVO: 403 handler-level + asignación estricta + cross-parent

package.json                    # + script test:journeys
.github/workflows/ci.yml        # + paso dedicado journeys (repo monorepo, raíz)
docs/                           # runbook: branch protection (acción del CEO)
```

## Data Model

N/A — no cambia schema ni entidades; los journeys siembran y afirman sobre los modelos
existentes. Sin migración.

## Contracts

N/A — no cambia ni crea ningún endpoint; los tests consumen las APIs tal como están.

## Fases de implementación (resumen para tasks)

1. **Gate**: `test:journeys` en package.json → paso CI → runbook branch protection.
2. **Journey padre**: apelaciones, alertas, recuperar contraseña (FR-003).
3. **Journey colegio**: carga masiva, alertas, auditoría (FR-004).
4. **Journey operador-comite**: anonimización + apelaciones comité (FR-005).
5. **Journey admin**: parámetros, spam, correcciones (FR-006).
6. **Negativos**: handler-level 403, asignación estricta, cross-parent (FR-007) y
   multi-tenant A/B (FR-008).
7. **Cierre**: gates completos (suite + tsc + lint + build + arch:check), piso de
   cobertura Q-2 revisado (solo sube), cierre documental.

Orden con commits separados por fase (un commit por journey ampliado, como manda la
regla de la cola). Si en cualquier fase un journey nuevo sale ROJO por un defecto real
del producto → PARAR esa fase y reportar a ZEUS (FR-009).
