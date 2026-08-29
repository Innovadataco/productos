# Implementation Plan: SPEC-104 — Motor de rúbrica: votación por índices

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/104-motor-indices-rubrica/spec.md`

## Summary

El motor de rúbrica deja de exigir copia VERBATIM de las preguntas: el prompt las numera y
el modelo devuelve ÍNDICES (`integer[]`) en el schema estructurado ya existente;
`cumpleCategoria` compara índices. La persistencia (expediente/auditoría) sigue guardando
textos, pero ahora son los textos CANÓNICOS del parámetro (traducidos desde el índice en el
momento del voto), no los que escribió el modelo. La estabilidad del índice se garantiza
por construcción (la numeración nace y muere dentro de la misma llamada). Se cierra I-30:
la entrada de `--rubrica-only` pasa a ser argumento CLI con default al baseline.
Restricciones intactas: textos de preguntas, terna de modelos, umbral 60% y default LEGACY
(D-19). NO se corre ninguna evaluación del banco.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: `src/lib/ai/rubrica.ts` (motor), `src/lib/ai/ollama-client.ts`
(`llamarOllamaStructured`, sin cambios de contrato), Prisma (`ClasificacionRubricaVoto.preguntasJson`)

**Storage**: PostgreSQL 16 (votos persistidos como textos canónicos — sin migración)

**Testing**: Vitest (`src/lib/ai/rubrica.test.ts` y relacionados)

**Target Platform**: Linux server / macOS dev

**Constraints**: una variable a la vez (textos, terna, umbral y default intactos); sin eval
del banco; motor productivo LEGACY (D-19); sin secrets en logs.

**Scale/Scope**: `rubrica.ts` (prompt + schema + `cumpleCategoria`), helpers del pipeline de
votos, `eval-dual-banco.ts` (I-30), tests.

## Constitution Check

*GATE: verificado antes de Fase 0 y tras el diseño (2026-07-27).*

- **IA local, textos sensibles nunca salen del servidor**: sin cambios de transporte; solo
  cambia el formato del voto dentro de Ollama local. CUMPLE.
- **Todo parametrizable (ADR_004)**: los textos de la rúbrica siguen en
  `ia.rubrica.preguntas` y se leen en vivo; la numeración se deriva del parámetro, nada
  queda quemado. CUMPLE.
- **La IA clasifica conductas; presunción de inocencia**: sin cambios de dominio. CUMPLE.
- **Motor por defecto**: LEGACY (D-19) — la spec no lo altera. CUMPLE.

Sin violaciones que justificar.

## Diseño

### 1. Índice como transporte, texto canónico como almacenamiento (FR-001/002/004)

- `construirPromptVoto`: cada pregunta se presenta numerada por categoría
  (`1. [DECISIVA] ¿…?`, `2. [contexto] ¿…?` — la numeración se deriva del orden del set en
  `ia.rubrica.preguntas`, que ya es el orden de renderizado actual). La instrucción cambia
  de "copia VERBATIM" a "devuelve los NÚMEROS de las preguntas que se cumplen".
- `construirVotoSchema`: `preguntasCumplidas: number[]` (enteros ≥ 1) por categoría.
- Al recibir el voto: se filtran índices inválidos (fuera de rango del set de la categoría,
  duplicados — FR-003) y se traduce índice → pregunta del set (orden del parámetro leído en
  ESA llamada). El cumplimiento: `cumpleCategoria(sets, categoria, indicesCumplidos, voto)`
  compara índices: las decisivas (por posición) deben estar TODAS incluidas.
- Persistencia: `preguntasJson` de `ClasificacionRubricaVoto` guarda los TEXTOS CANÓNICOS
  mapeados desde los índices (idéntico shape de siempre) → el expediente (SPEC-096,
  `votacion.ts`) los sigue cruzando con el parámetro vivo sin cambios de código, y con
  match exacto garantizado mientras el texto no se edite (degrada como hoy si se edita).

### 2. Estabilidad del índice (FR-005) — el argumento

El índice es **formato de cable, no identidad**: se genera al construir el prompt y se
consume al evaluar el voto, dentro de la MISMA llamada de `clasificarConRubrica` (el set de
preguntas se lee una vez de `cargarConfigRubrica` y se reutiliza en embudo, prompts y
agregación). Por construcción es imposible que el parámetro cambie "a mitad de voto": no
hay concurrencia de edición dentro de una llamada y las llamadas son atómicas respecto a la
config leída.

Entre corridas, el reordenamiento del parámetro NO afecta: los índices nunca se persisten
(lo persistido son textos canónicos). Si un experto reordena o edita preguntas, la siguiente
clasificación numera según el nuevo orden y todo sigue consistente.

**Alternativa evaluada y descartada**: id estable por pregunta (`{ id: "ci-1", texto }`).
Rechazada porque (a) exigiría migrar el parámetro existente, la semilla y el expediente;
(b) viola "una variable a la vez" (toca los datos del parámetro); (c) no resuelve nada que
el transporte-por-índice + persistencia-por-texto no resuelva ya. Si en el futuro se
necesita historial inmune a EDICIÓN de textos (no solo reorden), se evaluará entonces.

### 3. I-30 (FR-006)

`eval-dual-banco.ts`: `--rubrica-only` acepta `--legacy-desde=<ruta>`; default
`scripts/simulacion/resultados-dual-095-baseline-pre098.json` (existe, 200 casos). La ruta
de escritura (`resultados-dual-095.json`) no cambia.

### 4. Compatibilidad y tests

- El formato viejo (textos del modelo) no se soporta (una variable a la vez); los votos
  históricos persistidos (ya textos) se leen igual.
- `rubrica.test.ts` (mocks de `llamarOllamaStructured`): respuestas por índices; casos de
  índices fuera de rango/duplicados; principal por gravedad intacto (SPEC-098); test del
  embudo/red de seguridad intacto.
- Pipeline (`procesar/helpers`): si lee `preguntasCumplidas` del voto en crudo, se ajusta al
  nuevo tipo (índices → textos canónicos en un solo punto del motor, consumidores sin tocar).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Modelos devuelven índices incorrectos (alucinación numérica) | Filtrado de rango (FR-003); el prompt conserva "denegar por defecto" y la evidencia clara; la medición posterior (2 corridas de ZEUS) lo valida |
| Expediente pierde trazado si se edita el texto de una pregunta | Degrada como hoy (match por texto del parámetro vivo); se documenta como comportamiento aceptado |
| Consumidores del voto esperan string[] | Traducción índice→texto dentro del motor; consumidores reciben textos como siempre |
| `--rubrica-only` con archivo incompatible | Validación de longitud/detalle existente (lanza error claro) |

## Project Structure

### Documentation (this feature)

```text
specs/104-motor-indices-rubrica/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── checklists/
│   └── requirements.md  # Validación de la spec
└── cierre.md            # Al cerrar (pendiente)
```

### Source Code (repository root)

```text
src/lib/ai/
├── rubrica.ts            # prompt numerado, schema integer[], cumpleCategoria por índices
└── rubrica.test.ts       # mocks y casos nuevos
src/app/api/reportes/procesar/helpers/
└── clasificacion.ts      # solo si consume preguntasCumplidas en crudo (verificar)
scripts/
└── eval-dual-banco.ts    # I-30: --legacy-desde con default al baseline
```

**Structure Decision**: proyecto único Next.js; el cambio se concentra en el motor
(`rubrica.ts`) con traducción índice→texto en un solo punto, y el runner (I-30). Sin
contratos externos nuevos (no aplica `contracts/`).
