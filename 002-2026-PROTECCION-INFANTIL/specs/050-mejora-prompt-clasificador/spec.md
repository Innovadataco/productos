# Feature Specification: Mejora del prompt del clasificador (Spec 050)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: Mejora quirúrgica del prompt de clasificación en `src/lib/ai/classifier.ts` para corregir dos fallos sistemáticos detectados en simulación: confusión de `SOLICITUD_MATERIAL` con `OFRECIMIENTO_REGALOS`, y bajo recall de `CONTACTO_INSISTENTE` frente a señales tempranas de grooming.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ajuste quirúrgico del prompt de clasificación (Priority: P1)

El sistema debe clasificar correctamente dos conductas de riesgo que hoy fallan sistemáticamente en todos los modelos probados:

1. **SOLICITUD_MATERIAL cuando se ofrece algo a cambio**: cuando un mensaje pide material íntimo (fotos, videos, descripción de cuerpo) y a la vez ofrece algo (dinero, regalos, créditos de juego, beneficios), la categoría debe ser `SOLICITUD_MATERIAL`, no `OFRECIMIENTO_REGALOS`. El ofrecimiento es el método de coerción; la solicitud de material íntimo es la conducta grave.
2. **CONTACTO_INSISTENTE con señales tempranas de grooming**: cuando un adulto inicia contacto con un menor y muestra señales de acercamiento inapropiado en los primeros mensajes (preguntar edad/curso/colegio, pedir secreto a los padres, insistir en hablar en privado, aislar al menor), debe clasificarse como `CONTACTO_INSISTENTE` en lugar de quedar sin detectar o como `OTRO`.

**Why this priority**: Estos dos fallos afectan la detección de conductas de alto riesgo. La corrección por prompt es la intervención más barata y reversible antes de evaluar fine-tuning o cambio de modelo.

**Independent Test**: Tras aplicar el nuevo prompt, se mide el recall y precisión de `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE` contra un set de referencia validado por humanos (operador/comité o eval harness con casos reales corregidos). El objetivo es subir el recall sin destruir la precisión de las otras 10 categorías.

**Acceptance Scenarios**:

1. **Given** un texto que pide fotos íntimas y ofrece dinero o regalos a cambio, **When** el clasificador lo procesa con el nuevo prompt, **Then** la categoría asignada es `SOLICITUD_MATERIAL` y no `OFRECIMIENTO_REGALOS`.
2. **Given** un texto donde un adulto pregunta a un menor su edad, curso o colegio, **When** el clasificador lo procesa con el nuevo prompt, **Then** la categoría es `CONTACTO_INSISTENTE` (grooming temprano) si hay contexto de acercamiento inapropiado, o `OTRO` si no hay riesgo evidente.
3. **Given** un texto donde un adulto le pide a un menor que mantenga la conversación en secreto de sus padres, **When** el clasificador lo procesa, **Then** la categoría es `CONTACTO_INSISTENTE`.
4. **Given** un texto donde un adulto insiste en pasar a chat privado o en aislar al menor de su entorno, **When** el clasificador lo procesa, **Then** la categoría es `CONTACTO_INSISTENTE`.
5. **Given** un texto de ofrecimiento de regalos sin pedir material íntimo (por ejemplo, "te regalo skins si me sigues"), **When** el clasificador lo procesa, **Then** sigue siendo `OFRECIMIENTO_REGALOS` y no cambia a `SOLICITUD_MATERIAL`.
6. **Given** las 10 categorías que hoy tienen recall 100%, **When** se mide su clasificación con el nuevo prompt, **Then** no se alteran sus definiciones ni fronteras.

**Edge Cases**:
- ¿Qué pasa si un texto tiene ambas conductas (pide material y ofrece regalo)? La regla de prioridad favorece `SOLICITUD_MATERIAL`.
- ¿Qué pasa si el contacto inicial es inocente y solo se pregunta la edad sin contexto de acercamiento? Debe seguir como `OTRO`; el cambio no convierte toda pregunta casual en riesgo.
- ¿Qué pasa si el modelo no tiene confianza suficiente? Debe responder `OTRO` con confianza baja, no forzar una categoría.
- ¿Qué pasa si el set de referencia humano es pequeño? La medición se documenta con su limitación y no se presenta como conclusiva.

---

## Edge Cases generales

- ¿Qué pasa si el nuevo prompt aumenta la tasa de `REVISION_MANUAL`? Se mide y se decide si el trade-off es aceptable; la preferencia es no empeorar el throughput actual.
- ¿Qué pasa si el prompt más largo aumenta la latencia o el costo de tokens? Se mide la latencia promedio y p95 en el Laboratorio IA antes de desplegar.
- ¿Qué pasa si el cambio de prompt mejora recall pero baja precisión en otras categorías? Se documenta como riesgo y se decide con el owner si se acepta, se itera o se descarta.
- ¿Qué pasa si el equipo humano no tiene capacidad de validar el set de referencia? La implementación queda bloqueada hasta contar con ese insumo; no se mide contra ejemplos sintéticos.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE modificar únicamente el texto del system prompt en `src/lib/ai/classifier.ts` (función `buildSystemPrompt`), sin cambiar lógica, modelos, schema de respuesta ni base de datos.
- **FR-002**: El prompt DEBE establecer una regla de prioridad: cuando un mensaje solicita material íntimo y ofrece algo a cambio, prevalece `SOLICITUD_MATERIAL` sobre `OFRECIMIENTO_REGALOS`.
- **FR-003**: El prompt DEBE corregir el ejemplo actual `"te compro un celular si me mandas fotos" → OFRECIMIENTO_REGALOS` y reemplazarlo por el criterio correcto para protección infantil.
- **FR-004**: El prompt DEBE ampliar la definición de `CONTACTO_INSISTENTE` para incluir señales tempranas de grooming: preguntar edad/curso/colegio, pedir secreto a los padres, insistir en privado, aislar al menor.
- **FR-005**: El prompt DEBE agregar 2-3 ejemplos contrastivos para `CONTACTO_INSISTENTE` vs. `OTRO`.
- **FR-006**: El sistema NO DEBE alterar las definiciones ni fronteras de las otras 10 categorías.
- **FR-007**: La validación DEBE medirse contra un set de referencia validado por humanos (reportes reales corregidos por operador/comité o eval harness con `casoEval`), no contra ejemplos sintéticos.
- **FR-008**: El sistema DEBE reportar recall y precisión por categoría antes y después del cambio, con énfasis en `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE`.

### Key Entities

- **Prompt de sistema**: texto enviado al modelo en `buildSystemPrompt`. Es el único artefacto modificado.
- **Categorías afectadas**: `SOLICITUD_MATERIAL`, `OFRECIMIENTO_REGALOS`, `CONTACTO_INSISTENTE`, `OTRO`.
- **Set de referencia**: casos validados por humanos para medir el cambio.
- **Métricas**: recall, precisión, error silencioso, falsos positivos por categoría.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El prompt propuesto se documenta textualmente en el plan/spec.
- **SC-002**: El recall de `SOLICITUD_MATERIAL` en el set de referencia mejora respecto al baseline actual (medido con el mismo set).
- **SC-003**: El recall de `CONTACTO_INSISTENTE` en el set de referencia mejora respecto al baseline actual.
- **SC-004**: Las otras 10 categorías mantienen su recall/precisión dentro de un margen aceptable (±5% o sin caída estadísticamente significativa, a definir con el owner).
- **SC-005**: No se modifica el modelo, el schema de respuesta, la base de datos ni la lógica de votación/desempate.
- **SC-006**: La validación se realiza contra datos validados por humanos; se documenta el tamaño y origen del set de referencia.
- **SC-007**: Si el set de referencia no está disponible, la implementación se bloquea y se documenta el gap.

---

## Assumptions

- El prompt actual en `src/lib/ai/classifier.ts` es el punto de partida.
- La mejora es viable sin cambiar de modelo ni hacer fine-tuning; si el plan aprobado muestra lo contrario, se descarta.
- El Laboratorio IA (`IaEvalManager`) o el flujo de corrección operador/comité pueden generar el set de referencia validado por humanos.
- La votación con 5 votos y el desempate por modelo grande se mantienen sin cambios.
- El criterio de aceptación es subir recall sin destruir precisión; el balance exacto requiere decisión del owner.
- No se toca el modelo `Reporte`, `ClasificacionIA`, `DatasetEntrenamiento` ni ninguna tabla.
- No se implementa código hasta aprobación humana del plan.

---

## Implementación

- Se reemplazó el `basePrompt` en `src/lib/ai/classifier.ts` (función `buildSystemPrompt`, líneas ~100-145) por el texto aprobado en este spec.
- Se agregó regla de prioridad para `SOLICITUD_MATERIAL` sobre `OFRECIMIENTO_REGALOS` cuando hay solicitud de material íntimo + ofrecimiento.
- Se corrigió el ejemplo `"te compro un celular si me mandas fotos" → SOLICITUD_MATERIAL`.
- Se amplió la definición de `CONTACTO_INSISTENTE` con señales de grooming temprano y ejemplos contrastivos.
- Se agregaron smoke tests en `src/lib/ai/classifier.test.ts` para verificar que el prompt contiene las reglas, ejemplos y fronteras correctas.
- No se modificó lógica, modelos, schema de respuesta ni base de datos.

## Deuda técnica

- La validación formal de recall/precisión del nuevo prompt queda pendiente hasta contar con un set de casos corregidos por humanos reales (operador/comité o eval harness con casos validados). Los smoke tests sintéticos no son suficientes para medir mejora real. Registrado como ítem de pre-producción en `docs/PRE-PRODUCCION.md`.

## Status

CERRADA

---

## Prompt propuesto (texto completo para `buildSystemPrompt`)

```text
Eres un clasificador especializado en protección infantil. Analiza el texto del reporte y responde con el JSON estructurado solicitado.

Categorías:
- CONTACTO_INSISTENTE: contacto repetido e incómodo, o primeros acercamientos inapropiados de un adulto a un menor con señales de grooming temprano (preguntar edad, curso, colegio o datos personales; pedir que la conversación se mantenga en secreto de los padres; insistir en pasar a chat privado; intentar aislar al menor de su entorno de confianza). El contexto de acercamiento inapropiado es clave: una pregunta casual sin contexto de riesgo no basta.
- SOLICITUD_MATERIAL: solicitud explícita de fotos, videos, descripción del cuerpo o cualquier material íntimo/desnudo. Si la solicitud de material íntimo va acompañada de un ofrecimiento (dinero, regalos, créditos de juego, beneficios), prevalece SOLICITUD_MATERIAL porque el ofrecimiento es el método de coerción, no la conducta principal.
- OFRECIMIENTO_REGALOS: ofrecimiento de dinero, regalos o beneficios sin solicitud de material íntimo
- SUPLANTACION_IDENTIDAD: fingir ser menor, familiar, amigo o figura de autoridad
- SOLICITUD_ENCUENTRO: solicitud de reunión física o encontrarse en persona
- COMPARTIMIENTO_SEXUAL: envío, exhibición o compartición de material sexual
- EXTORSION: chantaje o amenazas para obtener contenido, dinero o silencio
- CONTENIDO_GENERADO_IA: uso de IA para generar material sexual o manipular imágenes
- DIFUSION_NO_CONSENTIDA: compartir imágenes o información íntima sin permiso
- DOXING: publicar información personal para identificar, localizar o dañar
- SPAM: contenido promocional, comercial o irrelevante sin relación con protección infantil
- OTRO: conducta real que no encaja en las anteriores

Fronteras excluyentes y ejemplos contrastivos:
- SOLICITUD_MATERIAL vs COMPARTIMIENTO_SEXUAL:
  - "envíame fotos desnudas" → SOLICITUD_MATERIAL
  - "te mando mis fotos íntimas" → COMPARTIMIENTO_SEXUAL
  - "muéstrate por cámara" → SOLICITUD_MATERIAL
  - "mira lo que te envío" (contenido sexual) → COMPARTIMIENTO_SEXUAL
- SOLICITUD_MATERIAL vs OFRECIMIENTO_REGALOS (regla de prioridad):
  - "te compro un celular si me mandas fotos" → SOLICITUD_MATERIAL (pide material íntimo; el regalo es el método)
  - "te doy dinero si me describís tu cuerpo" → SOLICITUD_MATERIAL (pide material íntimo; el dinero es el método)
  - "te regalo skins si me seguís y hablamos" → OFRECIMIENTO_REGALOS (no pide material íntimo; solo busca contacto/seguidores)
  - "si no me mandas fotos, le cuento a todos" → EXTORSION
- CONTACTO_INSISTENTE vs OTRO:
  - "Hola, ¿cuántos años tenés? ¿en qué curso estás? Hablame por privado, no le digas a tus papás" → CONTACTO_INSISTENTE (grooming temprano: aislamiento + secreto + privado)
  - "¿qué edad tenés? yo tengo 13" → OTRO (pregunta casual en un chat público sin contexto de acercamiento inapropiado)
  - "Sos lindo/a, ¿me agregás? Podemos ser amigos" → CONTACTO_INSISTENTE (acercamiento inapropiado de adulto a menor, aunque sea leve)
- SUPLANTACION_IDENTIDAD requiere fingimiento de identidad; un adulto contactando a un menor no basta.
- DOXING requiere intención de publicar, difundir o revelar datos personales para identificar, localizar o dañar. Mencionar una dirección o teléfono NO es DOXING si no hay intención de publicación.
  - "Voy a publicar su dirección: cra 7 # 45-67" → DOXING
  - "El menor vive en carrera 45 # 12-34" → OTRO (dato personal mencionado, sin intención de publicar)
- OTRO: usa esta categoría cuando el texto no describa una conducta de riesgo específica, aunque mencione el tema sexual o datos personales. Una categoría sexual requiere que la conducta (pedir o enviar) esté presente en el texto.
  - "me dijo cosas raras por chat" → OTRO (no se describe conducta concreta)
  - "hablamos de sexo" → OTRO (tema sexual, sin solicitud ni envío)
  - "me mostró un video de otra persona" → OTRO (menciona video, pero no se sabe si es íntimo ni si lo envió el agresor)
  - "me pidió que le contara detalles de mi cuerpo" → SOLICITUD_MATERIAL (solicitud de contenido íntimo)
  - "me envió fotos de partes íntimas" → COMPARTIMIENTO_SEXUAL (envío concreto de material sexual)

posible_agresor_par: true si el posible agresor parece ser otro adolescente, compañero de escuela, amigo de la edad o par del entorno cercano (lenguaje adolescente, juegos como Roblox/Free Fire, colegio, compañeros).

Si el texto es ambiguo, incompleto o no puedes clasificar con confianza, usa categoria "OTRO" y confianza baja (< 0.5).
```

El resto de `buildSystemPrompt` (concatenación de ejemplos corregidos y cierre "Responde SOLO el JSON...") se mantiene sin cambios.
