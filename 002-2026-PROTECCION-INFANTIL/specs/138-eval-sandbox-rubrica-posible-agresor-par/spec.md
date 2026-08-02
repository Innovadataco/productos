# Feature Specification: SPEC-138 — Eval/sandbox alineados con la rúbrica de prod + `posibleAgresorPar` calculado (E-7)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: PLANEADO

**Input**: Instructivo 002-PI-056 (BANDA 2, ítem E-7; radica ZEUS). Reverificado en
fuente 2026-08-01: (a) **desalineo** — producción clasifica con la rúbrica cuando
`ia.rubrica.enabled` (`reporte-processing/clasificacion.ts:71-76`), pero `sandbox.ts:183`
y `eval-runner.ts:283` llaman SIEMPRE `clasificarConVotos` (motor legacy): las evals y
el laboratorio miden un motor que NO es el de producción. (b) **`posibleAgresorPar`
nunca se calcula**: la infraestructura existe (tipo en `ResultadoRubrica`/UI, métrica
`posibleAgresorParRate` en evals, display en `ReporteDetalleInfo.tsx:54`, guard
`leerPosibleAgresorPar`) pero la rúbrica no lo produce — `eval-runner.ts:349` lo
hardcodea a `false`. La semilla de la rúbrica ya tiene preguntas sobre el vínculo del
agresor ("¿Quien pide es un adulto o un desconocido?", `rubrica-semilla.ts:34,38`) de
las que se puede derivar la señal (agresor NO adulto/desconocido ⇒ posible PAR — otro
menor o par de la víctima).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sandbox y evals ejercitan el MISMO motor que producción (Priority: P1)

Como responsable del laboratorio IA, quiero que sandbox y eval-runner clasifiquen con
la rúbrica cuando `ia.rubrica.enabled` está activa (misma rama que producción, misma
config), de modo que una eval mida lo que realmente corre en prod.

**Why this priority**: Una eval que mide el motor legacy mientras prod corre la rúbrica
da números que no predicen el comportamiento real — peor que no medir.

**Independent Test**: con `ia.rubrica.enabled` activa, el sandbox y una eval usan
`clasificarConRubrica` (verificable en su salida/traza); con el flag apagado, usan el
legacy (comportamiento actual intacto).

**Acceptance Scenarios**:

1. **Given** `ia.rubrica.enabled = true`, **When** corre una eval o el sandbox,
   **Then** la clasificación sigue el camino de la rúbrica (misma rama que prod) y la
   salida lo refleja (campos de rúbrica presentes).
2. **Given** `ia.rubrica.enabled = false`, **When** corre, **Then** usa el legacy
   (idéntico a hoy).
3. **Given** las evals históricas guardadas, **When** se consultan, **Then** siguen
   leyéndose igual (ADITIVO: se registra qué motor usó cada corrida nueva).

---

### User Story 2 — La rúbrica calcula `posibleAgresorPar` (Priority: P1)

Como responsable de producto, quiero que `ResultadoRubrica` incluya `posibleAgresorPar`
derivado de las respuestas de la rúbrica (agresor no adulto/no desconocido ⇒ posible
par), de modo que la métrica F7 y el detalle del reporte muestren una señal real.

**Why this priority**: La UI y las evals ya lo muestran como si existiera — mostrar
`false` hardcodeado es información falsa sobre un indicador de grooming entre pares.

**Independent Test**: casos con respuestas de rúbrica conocidas → la derivación da el
valor esperado (test unitario puro); una clasificación de rúbrica con texto donde el
agresor es claramente un adulto → `posibleAgresorPar = false`; sin evidencia de adulto
→ `true` solo bajo la regla definida (conservadora).

**Acceptance Scenarios**:

1. **Given** la regla de derivación definida en plan (sobre respuestas existentes de la
   rúbrica, SIN inventar preguntas nuevas salvo que ZEUS lo apruebe), **When** la
   rúbrica clasifica, **Then** `posibleAgresorPar` se calcula y persiste con la
   clasificación.
2. **Given** `leerPosibleAgresorPar` (guard de `clasificacion.ts`), **When** la rúbrica
   lo reporta, **Then** lo propaga (ya no siempre false).
3. **Given** la métrica `posibleAgresorParRate` de las evals, **When** corre una eval
   con la rúbrica, **Then** deja de ser 0 por construcción y refleja los casos PAR del
   banco.

---

### Edge Cases

- Regla conservadora: ante ausencia de evidencia sobre el vínculo, `posibleAgresorPar`
  es `false` (no acusar por defecto — presunción de inocencia, §1.3).
- Casos donde la rúbrica no preguntó por el vínculo (categoría sin preguntas de
  agresor): la derivación devuelve `false` y se documenta como límite.
- La rama legacy de votos NO calcula `posibleAgresorPar` (queda `false`, como hoy) —
  la señal es de la rúbrica; se documenta.
- Evals históricas (resultadoJson viejo): los guards tolerantes de SPEC-136 ya leen
  bloques opcionales; nada se migra.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `sandbox.ts` y `eval-runner.ts` DEBEN usar el mismo selector de motor que
  producción (rúbrica si `ia.rubrica.enabled`, legacy si no — UNA fuente del selector;
  E-4 ya unificó guardas, esto es el mismo principio para el clasificador).
- **FR-002**: Las corridas nuevas de eval/simulación DEBEN registrar qué motor usaron
  (campo en la config/resultado persistido; lectura tolerante para históricos).
- **FR-003**: `ResultadoRubrica` DEBE incluir `posibleAgresorPar` calculado por una
  regla explícita sobre las respuestas de la rúbrica (definida en plan; conservadora;
  sin preguntas nuevas salvo aprobación de ZEUS).
- **FR-004**: `posibleAgresorParRate` de las evals DEBE computarse sobre el valor real
  (eliminar el hardcodeo de `eval-runner.ts:349`).
- **FR-005**: La lógica de clasificación (umbrales, embudo, decisión de categoría) NO
  cambia: la señal es ADITIVA (se calcula y expone; no altera categorías ni estados).
- **FR-006**: Suite verde sin tocar expectativas existentes (los fixtures de evals que
  afirman `posibleAgresorPar: false` por el hardcodeo se revisan: si el valor real
  calculado es false también, no se tocan; si cambia por el cálculo real, se documenta
  y se ajusta la EXPECTATIVA con justificación — regla 1 aplica a todo lo demás).

### Key Entities *(include if feature involves data)*

N/A — no cambia schema (`ClasificacionIA.detalleJson`/equivalente ya persiste campos de
la rúbrica; la señal viaja en el mismo payload).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el flag activo, sandbox y eval-runner ejecutan la rama de la rúbrica
  (test que lo afirma).
- **SC-002**: `posibleAgresorPar` se calcula por regla explícita con tests unitarios
  (adulto → false; par → true; sin evidencia → false).
- **SC-003**: `posibleAgresorParRate` ≠ 0 en una eval del banco con casos PAR (o 0
  justificado si el banco no tiene casos PAR — verificar y documentar).
- **SC-004**: Suite completa + tsc + lint + build + arch:check verdes.

## Assumptions

- El flag `ia.rubrica.enabled` es la fuente de verdad del motor activo (SPEC-111/D-28;
  la reversión en caliente sigue funcionando igual).
- La regla de derivación usa SOLO preguntas/respuestas existentes de la rúbrica
  (agresor adulto/desconocido); si la cobertura de preguntas es insuficiente para una
  regla fiable, se reporta a ZEUS antes de implementar (posible NEEDS CLARIFICATION).
- El banco de eval puede no tener casos PAR etiquetados; la métrica es real aunque el
  banco aún no la alimente.

## Impacto en arquitectura

Impacto en arquitectura: selector de motor unificado en sandbox/eval + señal aditiva en
la rúbrica. NO toca schema, umbrales, visibilidad ni la decisión de clasificación.
`arch:check` no debería requerir regeneración.
