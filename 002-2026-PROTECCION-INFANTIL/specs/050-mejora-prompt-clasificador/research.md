# Research: Mejora del prompt del clasificador (Spec 050)

**Date**: 2026-07-20
**Feature**: specs/050-mejora-prompt-clasificador/spec.md

---

## Decisions

### D1: Intervención de prompt antes que fine-tuning

**Decision**: Antes de evaluar fine-tuning o cambio de modelo, se prueba una mejora quirúrgica del system prompt.

**Rationale**: Fine-tuning es costoso, requiere datos curados y su resultado es incierto. Cambiar el prompt es reversible, barato y permite medir rápidamente si la frontera semántica puede corregirse con instrucciones más explícitas.

**Components**: `src/lib/ai/classifier.ts`, función `buildSystemPrompt`.

### D2: Regla de prioridad para SOLICITUD_MATERIAL

**Decision**: Cuando un mensaje pide material íntimo y ofrece algo a cambio, la categoría es `SOLICITUD_MATERIAL`.

**Rationale**: El error actual clasifica `"te compro un celular si me mandas fotos"` como `OFRECIMIENTO_REGALOS`. Eso refuerza una interpretación incorrecta: el ofrecimiento es el método de coerción, pero la conducta grave es la solicitud de material íntimo. La protección infantil prioriza detectar la solicitud.

**Components**: Nueva frontera en el prompt con ejemplos positivos y negativos.

### D3: Ampliación de CONTACTO_INSISTENTE a grooming temprano

**Decision**: La categoría debe incluir señales tempranas de acercamiento inapropiado de adulto a menor, no solo contacto repetido e incómodo.

**Rationale**: Los modelos probados no reconocen patrones como preguntar edad/colegio, pedir secreto o insistir en privado. Ampliar la definición con señales concretas y ejemplos contrastivos permite que el modelo generalice sobre el patrón de grooming temprano.

**Components**: Redefinición de `CONTACTO_INSISTENTE` en el prompt + 3 ejemplos contrastivos.

### D4: Criterio de validación: datos validados por humanos

**Decision**: La medición de mejora se hará contra un set de referencia validado por humanos (reportes reales corregidos por operador/comité o `casoEval` con etiqueta humana), nunca contra ejemplos sintéticos.

**Rationale**: Medir un prompt contra ejemplos que uno mismo inventó para probarlo es una validación circular. La "verdad" de referencia debe ser independiente del prompt. Los casos reales corregidos por el equipo humano son la única referencia válida.

**Components**: Eval harness (`IaEvalManager`, `casoEval`) con muestra de casos validados.

### D5: Riesgo de precisión

**Decision**: Se documenta que subir el recall de las dos categorías puede bajar la precisión (sobre-clasificación). Se medirá y se decidirá con el owner.

**Rationale**: Un prompt más amplio tiende a clasificar más casos como riesgo. Si la precisión baja demasiado, aumenta la carga de revisión manual y los falsos positivos. El balance exacto depende de los datos reales.

**Components**: Métricas de recall, precisión, falsos positivos y error silencioso por categoría.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Fine-tuning del modelo | Costoso, requiere datos curados, incierto; se deja como opción futura si el prompt no alcanza |
| Cambiar el schema de salida | No necesario; el problema es semántico, no estructural |
| Añadir más votos | Aumentaría latencia/costo sin garantizar corrección de la frontera |
| Validar con ejemplos sintéticos | Circular; no provee evidencia real de mejora |
| Modificar el umbral de confianza | No cambia la categoría asignada, solo el estado de revisión manual |

---

## Open Questions (1 remaining)

- **[NEEDS CLARIFICATION]**: ¿Se dispone de un set de `casoEval` o reportes corregidos por humanos con etiquetas confiables para `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE`? Sin este insumo, la implementación no puede validarse. El plan propone usar el eval harness existente, pero la decisión de cuántos casos y de qué fuente queda pendiente de revisión humana.

---

## Verification against the actual codebase

### Gap verified: ejemplo problemático en `buildSystemPrompt`

- `src/lib/ai/classifier.ts` (línea 124):
  ```text
  - "te compro un celular si me mandas fotos" → OFRECIMIENTO_REGALOS
  ```
- Este ejemplo refuerza el error que se observa en simulación: el modelo clasifica solicitudes con ofrecimiento como `OFRECIMIENTO_REGALOS` en lugar de `SOLICITUD_MATERIAL`.

### Gap verified: definición estrecha de `CONTACTO_INSISTENTE`

- `src/lib/ai/classifier.ts` (línea 104):
  ```text
  - CONTACTO_INSISTENTE: contacto repetido e incómodo
  ```
- No incluye señales tempranas de grooming. Esa definición corta no da al modelo pistas suficientes para detectar acercamiento inapropiado en primeros mensajes.

### Hallazgo de simulación (documentado en el prompt original)

- Tres modelos probados (qwen2.5:32b, ornith:9b, ornith:35b) fallan sistemáticamente en las mismas 2 categorías con recall ~60%.
- Un modelo más grande (ornith:35b vs ornith:9b) no resuelve el problema, lo que sugiere que el gap está en el prompt, no en la capacidad del modelo.

---

## Notes

- El único archivo a modificar es `src/lib/ai/classifier.ts`.
- No se toca `src/lib/ai/schemas.ts`, `ollama-client.ts`, ni el flujo de votación.
- No se requieren migraciones ni cambios de configuración.
- El prompt propuesto incluye ejemplos contrastivos para evitar sobre-clasificación de `CONTACTO_INSISTENTE`.
- La validación efectiva depende de un set de referencia humano; esta dependencia está marcada como `[NEEDS CLARIFICATION]`.
