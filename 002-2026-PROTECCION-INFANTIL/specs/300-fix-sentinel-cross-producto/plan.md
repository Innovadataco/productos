# Implementation Plan: Fix sentinel CI cross-producto (SPEC-300)

**Branch**: `work/pi-SPEC-300-fix-sentinel-cross-producto` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/300-fix-sentinel-cross-producto/spec.md`

## Summary

El ruleset "Gate CI - main" de GitHub referencia los checks `pi-gate` y `bi-gate` por name literal exact-match. Los workflows `ci.yml` y `bi.yml` filtran hoy sus triggers `on:` por `paths:` propios de cada producto, así que un PR que solo toca un producto no dispara el workflow del otro y el gate del otro nunca aparece — el ruleset queda `expected but not seen`. Bloqueo real vigente: Jelkin quitó `bi-gate` de required para desbloquear Vanna PR #137.

**Decisión de plan**: se implementa **Opción A** — quitar `paths:` de `on:` en ambos workflows y añadir un job `should-skip` a `bi.yml` gemelo del ya existente en `ci.yml`. Los jobs pesados de BI reciben `if: needs.should-skip.outputs.skip != 'true'`, y `bi-gate` incorpora `should-skip` a `needs:` conservando `if: always()`. Fundamentación en [research.md](./research.md). Alternativa B (`gates.yml` con polling `gh api`) queda descartada por costo de complejidad y frágil sincronía cross-workflow — se documenta como fallback contingente.

Cambio total: 2 archivos YAML modificados, ~20 líneas de diff efectivas. Cero código de aplicación, cero cambios a schema/DAL/proxy/deploy.

## Technical Context

**Language/Version**: YAML 1.2 (GitHub Actions workflow schema).

**Primary Dependencies**: GitHub Actions (`actions/checkout@v4`), `bash` en runner `ubuntu-latest`. **Sin** dependencias nuevas.

**Storage**: N/A — el fix es de configuración de CI, sin persistencia.

**Testing**: Verificación empírica sobre PRs reales contra `main` (test acid del instructivo 002-PI-205 §Test acid). Sin tests unitarios de YAML (no hay linter Vitest de workflows en este proyecto).

**Target Platform**: GitHub-hosted runners `ubuntu-latest`.

**Project Type**: Cambio en infraestructura CI del monorepo `productos`. NO es un componente del producto Protección Infantil, aunque vive en su carpeta por convención de dueño (SPEC-299 y su fix SPEC-300 los administra el equipo PI, no BI).

**Performance Goals**: gate trivial verde < 90 s (SC-001), sin regresiones en runtime P95 de PRs con `should-skip=false` (SC-006, SC-007).

**Constraints**:
- Names literales `pi-gate` y `bi-gate` inmutables (FR-007 · contrato con el ruleset).
- `verificar-base-pr.yml` y `deploy-prod.sh` intocables (candados del instructivo).
- Cambios YAML deben validarse en GitHub Actions real; no hay linter local (`actionlint` no está instalado en el repo).

**Scale/Scope**: 2 archivos, ≤ 20 líneas de diff, 3 PRs de test acid contra `main` (README-only + solo-PI + cross).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

La constitución (§1–§8) rige el producto Protección Infantil: reglas de contenido (solo texto, presunción de inocencia, IA local), stack (Next.js 16.2.10 + React 19 + Prisma 5.22.0 + Vitest), estructura de rutas API, patrones de código TS estricto, seguridad (JWT, AES-GCM, rate limit), UI Tailwind.

**Análisis por sección**:

| Sección constitución | Aplicabilidad al fix | Veredicto |
|---|---|---|
| §1 Principios del producto (solo texto, IA local, disputas, umbral) | No aplica — el fix no toca contenido, procesamiento ni consulta pública | ✅ PASS trivial |
| §2 Stack técnico (Next.js, Prisma, JWT, pg-boss) | No aplica — el fix es YAML de GitHub Actions | ✅ PASS trivial |
| §3 Calidad de código TypeScript (any prohibido, error handling) | No aplica — cero código TS tocado | ✅ PASS trivial |
| §4 Arquitectura API y persistencia | No aplica — cero API tocada, cero migraciones | ✅ PASS trivial |
| §5 Testing (Vitest, cobertura) | Parcial — el fix se prueba con PRs acid contra CI real; no requiere test unitario Vitest porque no hay código a probar | ✅ PASS con nota (test acid documentado en quickstart) |
| §6 Seguridad (JWT, encriptación, rate limit) | No aplica — cero endpoints, cero secretos, cero rate limit | ✅ PASS trivial |
| §7 Componentes y UI | No aplica — cero UI | ✅ PASS trivial |
| §8 Proceso de desarrollo (commit atómico, lint, test) | Aplica indirecto — el PR de este fix debe pasar `pi-gate` cuando se abre contra `main`. Y aquí está la trampa recursiva: el fix se auto-valida — al hacer push del PR con solo cambios en `.github/workflows/**`, `should-skip` de PI reporta `skip=false` (los workflows quedan bajo el filtro "no docs/no md") y `pi-gate` corre completo, protegiendo el propio fix. | ✅ PASS con nota (auto-validación es una feature, no un bug) |

**Gates**: sin violaciones. La constitución no legisla sobre CI YAML.

**Complexity Tracking**: N/A (no hay violaciones a justificar).

## Project Structure

### Documentation (this feature)

```text
specs/300-fix-sentinel-cross-producto/
├── plan.md                 # este archivo
├── spec.md                 # feature spec (Status PLANEADO)
├── research.md             # Phase 0: decisión A vs B
├── data-model.md           # Phase 1: N/A — sin entidades de datos
├── quickstart.md           # Phase 1: guía del test acid contra CI real
├── contracts/
│   └── check-names.md      # Phase 1: contrato con el ruleset "Gate CI - main"
├── checklists/
│   └── requirements.md     # generada por /speckit-specify (12/12 PASS)
└── tasks.md                # Phase 2 output (/speckit-tasks — NO creado aquí)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml              # MODIFICADO — quitar `paths:` de on.push y on.pull_request
    ├── bi.yml              # MODIFICADO — quitar `paths:` de on:, añadir job should-skip, gates if: en jobs pesados, should-skip en needs de bi-gate
    ├── verificar-base-pr.yml   # INTOCADO (candado A-47)
    └── README.md           # revisar si necesita nota (Phase 1 lo evalúa)

002-2026-PROTECCION-INFANTIL/
├── specs/300-fix-sentinel-cross-producto/    # documentación de esta spec
└── specs/README.md                            # fila SPEC-300 ya añadida en /speckit-specify

# INTOCADOS por candados del instructivo:
002-2026-PROTECCION-INFANTIL/src/lib/ai/**    # SOLO LECTURA
002-2026-PROTECCION-INFANTIL/prisma/**        # SOLO LECTURA
002-2026-PROTECCION-INFANTIL/scripts/deploy-prod.sh   # SOLO LECTURA
```

**Structure Decision**: infraestructura CI del monorepo. Cambio se localiza en `.github/workflows/` (raíz del repo) más documentación de la spec en `002-2026-PROTECCION-INFANTIL/specs/300-*`. No hay estructura de "código fuente" en el sentido de librerías o servicios porque el fix es cambio de config YAML.

## Complexity Tracking

Sin violaciones a la constitución. Tabla vacía.
