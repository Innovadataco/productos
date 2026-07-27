# Tasks — SPEC-104: Motor de rúbrica — votación por índices

**Input**: plan.md, spec.md, research.md, data-model.md, quickstart.md de
`/specs/104-motor-indices-rubrica/` (spec y plan aprobados en `85a98300`) |
**Branch**: `feature/001-scaffolding`

## Fase 1: US1 (P1) — Votación por índices

**Goal**: el cumplimiento de una categoría depende del criterio del modelo, no de su copia
verbatim. Textos de preguntas, terna, umbral y default LEGACY intactos.
**Independent Test**: quickstart pasos 1–2.

- [x] T001 [US1] `src/lib/ai/rubrica.ts`: `construirPromptVoto` numera las preguntas por categoría (`1. [DECISIVA] …`, `2. [contexto] …`) y pide los NÚMEROS de las que se cumplen (elimina la instrucción "copia VERBATIM"); `construirVotoSchema` con `preguntasCumplidas: number[]` (enteros ≥ 1).
- [x] T002 [US1] Filtrado de índices inválidos (fuera de rango del set de la categoría, duplicados) al recibir el voto — nunca cuentan como cumplimiento.
- [x] T003 [US1] `cumpleCategoria` compara índices (decisivas por posición en el set leído en ESA llamada, todas incluidas), nunca cadenas. Traducción índice → texto canónico con el MISMO set de la llamada para la persistencia/reporte.
- [x] T004 [US1] Ajuste de tipos/consumidores internos del voto (helpers del pipeline solo si leen `preguntasCumplidas` en crudo; los persistidos siguen siendo textos canónicos).
- [x] T005 [P] [US1] Tests en `src/lib/ai/rubrica.test.ts`: cumplimiento por índices; índices fuera de rango y duplicados descartados; **aceptación B1: respuestas del modelo que antes morían por formato (`1. [DECISIVA] …`, sin `¿`) ahora producen el MISMO resultado (el texto no participa)**; principal por gravedad intacto (SPEC-098).

## Fase 2: US2 (P2) — Persistencia canónica y expediente

**Goal**: lo persistido por voto sigue siendo texto canónico trazable; el expediente (SPEC-096) cruza sin cambios.
**Independent Test**: expediente lee votos nuevos como hoy.

- [x] T006 [US2] Persistencia de `ClasificacionRubricaVoto.preguntasJson` con textos canónicos mapeados desde índice (shape idéntico al histórico).
- [x] T007 [P] [US2] Verificación (test o prueba directa): `src/lib/expediente/votacion.ts` cruza los textos canónicos con el parámetro vivo SIN cambios de código.

## Fase 3: US3 (P3) — I-30 entrada de --rubrica-only

**Goal**: el modo arranca sin ENOENT; escritura intacta.
**Independent Test**: quickstart paso 3.

- [x] T008 [US3] `scripts/eval-dual-banco.ts`: `--legacy-desde=<ruta>` con default `scripts/simulacion/resultados-dual-095-baseline-pre098.json`; la ruta de escritura no se toca.

## Fase 4: Cierre

- [x] T009 Verificación de restricciones: diff sin tocar `rubrica-semilla.ts`, `ia.rubrica.modelos`, `umbral_presencia`, `ia.rubrica.enabled` (LEGACY, D-19). NO correr eval del banco.
- [x] T010 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` (todo verde).
- [x] T011 `cierre.md` + `specs/README.md` (104 → Finalizada, SIN medir — la medición es B5) + commit + push.

## Dependencias

- T001 → T002/T003 → T004/T006 → T005/T007 · T008 independiente · T009–T011 al final.
