# SPEC-366 · A-71 — El duplicado refleja el estado VIVO del original

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: A-71 (brief del CEO; Jelkin probando RPT-QQ245W, duplicado de RPT-400XX7)

## Qué estaba mal

Un reporte duplicado (detectado por similitud de embeddings, paso 2 del pipeline)
se marcaba `DUPLICADO`, se saltaba la IA y al reportante le mostraba "Tu reporte
está en proceso — puede tardar hasta {sla} horas". **Mentira**: es estado final,
la respuesta nunca llega. El original ya está `CLASIFICADO` con su categoría y el
vínculo `reporteOrigenId` existe.

## Cómo quedó (decisión del CEO)

El duplicado **refleja el estado VIVO del original** (vía `reporteOrigenId`),
resuelto en **tiempo de lectura**:
- Original ya clasificado (caso común) → el reportante ve "Procesado" + la misma
  categoría del original, igual que si lo hubiera procesado la IA.
- Original aún en proceso/revisión → muestra el estado honesto del original
  ("en proceso"), y hereda la clasificación **cuando el original resuelve** —
  sin propagación, porque se lee del original cada vez. Nunca un mensaje que
  promete algo que no llega.

La IA **no se re-corre** (ya era así: la dedup corta antes de la IA). No se copia
la clasificación: se lee del original al mostrar.

## Por qué opción (a) read-time y no materializar el estado

Materializar `estado=CLASIFICADO` en el duplicado (brief v1.0) obligaba a migrar
la exclusión de señal comunitaria de `estado='DUPLICADO'` al marcador en TODOS
los callsites (o el duplicado se contaría dos veces). La opción (a) —resolver el
display siguiendo `reporteOrigenId`— deja el **estado almacenado en DUPLICADO**,
así que **la señal lo excluye exactamente igual que hoy**: cero migración de
exclusión, cero riesgo de doble conteo, sin migración de BD. Aprobada por el CEO.

## La invariante que sostiene el alcance mínimo

Los duplicados son **SIEMPRE anónimos** (`duplicados.ts` corta la dedup para
reportes con cuenta), así que solo se ven por la **consulta pública**
`seguimiento(numero)`. Ni "Mis reportes" ni el detalle del padre sirven
duplicados → un solo path de lectura toca. **Blindado con un test de invariante**:
un reporte con cuenta idéntico a otro NUNCA queda `DUPLICADO`. Si alguien quita
ese guard, el test se cae (señal de que "Mis reportes" y el detalle también
necesitarían la resolución read-time).

## Privacidad

El reportante ve SOLO la **categoría** heredada, nunca el texto del original
(cifrado, admin-reveal). El DTO de seguimiento ya expone solo categoría/labels.

## Impacto en arquitectura: no

Sin modelo, migración, ni campo nuevo: el marcador es el `reporteOrigenId` que ya
existe. `SELECT_SEGUIMIENTO` suma la relación `reporteOrigen{estado,clasificacion}`
y `reporte-query.ts seguimiento()` resuelve el estado/clasificación efectivos. La
escritura (`duplicados.ts`) no cambia; el estado sigue `DUPLICADO`.

## Cómo se probó

- `seguimiento/[numero]/route.test.ts` (2): duplicado de un original CLASIFICADO
  → "Procesado" + categoría del original (estadoInterno sigue DUPLICADO);
  duplicado de un original PROCESANDO → estado honesto "En proceso", sin
  clasificación (cuando el original resuelva, se refleja solo).
- `procesar/route.test.ts` — **invariante**: un reporte con cuenta idéntico a otro
  NO queda DUPLICADO (la dedup solo aplica a anónimos).
