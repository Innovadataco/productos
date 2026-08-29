# Implementation Plan: SPEC-138 — Eval/sandbox alineados con la rúbrica + `posibleAgresorPar` (E-7)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/138-eval-sandbox-rubrica-posible-agresor-par/spec.md` (002-PI-056, E-7)

## Summary

Dos correcciones al laboratorio IA: (1) sandbox y eval-runner dejan de llamar siempre
al motor legacy y usan el MISMO selector que producción (rúbrica si `ia.rubrica.enabled`),
con registro del motor usado por corrida; (2) la rúbrica calcula `posibleAgresorPar`
por una regla conservadora derivada de las respuestas existentes (agresor
adulto/desconocido), alimentando la métrica F7 y el detalle del reporte — señal
ADITIVA que no altera categorías ni estados.

## Technical Context

**Language/Version**: TypeScript 5 (strict maximal), Node.js >= 22
**Primary Dependencies**: `src/lib/ai/rubrica.ts` (`clasificarConRubrica`,
`cargarConfigRubrica`), `classifier.ts` (legacy). Nada nuevo.
**Storage**: PostgreSQL — sin cambios de schema (señal dentro del payload de rúbrica)
**Testing**: Vitest — tests unitarios de la regla + tests del selector + red existente
**Project Type**: corrección de laboratorio IA (medir lo que corre en prod)
**Constraints**: FR-005 — la decisión de clasificación NO cambia (señal aditiva);
FR-006 — expectativas intactas salvo el hardcodeo documentado
**Scale/Scope**: 3 archivos del laboratorio + rubrica.ts + tests

## Constitution Check

- **Presunción de inocencia (§1.3)**: ES la regla de derivación — conservadora por
  defecto (`false` ante ausencia de evidencia); la señal alimenta métricas internas,
  no la consulta pública.
- **IA local**: OK — todo sigue en Ollama local.
- **Metodología Spec-Kit**: OK — compuerta §4.

Sin violaciones que justificar.

## Diseño

### 1. Selector de motor unificado (FR-001/FR-002)

Extraer el selector de `reporte-processing/clasificacion.ts` (hoy inline:
`cargarConfigRubrica` + `config.enabled ? rúbrica : legacy`) a una función compartida
(p.ej. `seleccionarMotor()` / `clasificarConMotorActivo(texto)` en `src/lib/ai/`):
producción, sandbox y eval-runner la llaman. Cada corrida de eval/simulación persiste
`motorUsado: "rubrica" | "legacy"` en su config/resultado (lectura tolerante:
históricos sin el campo = legacy, como afirman los guards de SPEC-136).

### 2. Regla de `posibleAgresorPar` (FR-003/FR-004)

Derivación sobre las respuestas de la rúbrica (las preguntas de vínculo ya existen:
"¿Quien pide es un adulto o un desconocido?", "¿La propuesta viene de un adulto o un
desconocido?" — `rubrica-semilla.ts:34,38`):

- Si la categoría resultante tiene preguntas de vínculo Y alguna respondió que el
  agresor NO es adulto/desconocido (respuesta negativa explícita) → `true`.
- Si respondió adulto/desconocido, o no hay preguntas de vínculo en la categoría, o no
  hay evidencia → `false` (conservador).

La regla exacta (qué preguntas cuentan como "de vínculo" — marca en la semilla o lista
explícita) se fija en implementación y se documenta en el cierre; si la cobertura de
preguntas resulta insuficiente para una regla fiable → PARA y NEEDS CLARIFICATION a
ZEUS (Assumptions de la spec).

`ResultadoRubrica` gana `posibleAgresorPar: boolean`; `leerPosibleAgresorPar` lo
propaga; `eval-runner.ts:349` deja el hardcodeo y usa el valor real (FR-004).

## Data Model

N/A — no cambia schema ni entidades; la señal viaja en el payload de la rúbrica que ya
se persiste. Las corridas nuevas registran `motorUsado` en su config/resultado (Json).

## Contracts

N/A — no cambia ningún endpoint; el detalle del reporte y las métricas de eval muestran
el valor real (infraestructura de UI ya existente).

## Fases de implementación (resumen para tasks)

1. **Selector unificado** + registro de `motorUsado` + tests del selector (FR-001/002).
2. **Regla de derivación** + `posibleAgresorPar` en `ResultadoRubrica` + tests
   unitarios (adulto/par/sin evidencia) (FR-003).
3. **Métrica real** en eval-runner + verificación del banco (SC-003) (FR-004).
4. **Gates + cierre**: suite completa, tsc, lint, build, arch:check.
