# Cierre — Spec 098: Afinamiento del motor (targeting, principal por gravedad, métrica)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding` · **Línea base** (banco curado, spec 095):
rúbrica accuracy 70.5%, subestimaciones 4, ESPS 625, 0 silenciosos peligrosos.

## Lo que se adoptó (en prod)

- **FR-002 — Principal interna por gravedad** ✅: `categoria` (uso interno) = la de MAYOR
  gravedad entre las presentes (empate: mayor %, alfabético). Verificado: #75 y #44 conservan
  las mismas presentes y ahora la principal interna es EXTORSION / SOLICITUD_MATERIAL (caso
  guía #131). Sin efecto en presencia ni en la presentación (sigue mostrando todas, D-13).
- **FR-003 — Métrica sin OTRO→OTRO silenciosos** ✅: `esperada === asignada` (abstención con
  contenido correcto) ya no cuenta como error silencioso. Legacy: 47 → 17 silenciosos con el
  MISMO detalle (recalculado). Modo `--rubrica-only` del runner (reusa el legacy, una variable
  a la vez).
- **FR-001 — Decisiva de targeting** ✅ con evidencia A/B: preguntas cortas afirmativas
  ("¿El contacto/ofrecimiento es personal, dirigido específicamente a este menor?") en
  OFRECIMIENTO_REGALOS y CONTACTO_INSISTENTE. El A/B de 20 casos (misma sesión, mismos casos)
  demuestra que **no dañan**: presencia idéntica caso a caso salvo uno (A 13/20 CLASIFICADO
  vs B 12/20). En la corrida completa, los 5 casos guía de spam masivo (#178/180/184/185/188)
  dejaron de disparar OFRECIMIENTO/CONTACTO. Param aplicado a prod (v2).
- **Terna de modelos y umbral 60% intactos** (disciplina respetada).

## El número y por qué NO se certifica mejora (lectura honesta)

| Corrida | accuracy | silenciosos (graves) | subestimaciones | ESPS | REVISION_MANUAL |
|---------|---------:|---------------------:|----------------:|-----:|----------------:|
| Línea base (095) | 70.5% | 18 (0) | 4 | 625 | 32/200 |
| v1 (targeting compuesto) | 41.0% | 1 (0) | 58→64 | 5 | 107/200 |
| v2 (targeting corto) | 44.5% | 1 (0) | 58 | 70 | 102/200 |
| **A/B mismo día, sin targeting** | 65% (20 casos) | — | — | — | 7/20 |
| **Línea base, esos mismos 20** | **95%** | — | — | — | **1/20** |

**Objetivo FR-004 (subestimaciones ≤ 4): NO alcanzado.** La investigación demuestra que la
causa NO es el afinamiento:

1. **El targeting es inocuo** (A/B idéntico con y sin él).
2. **La línea base no es reproducible hoy**: mismo parámetro, mismos modelos (sin cambios
   desde el 21-jul), mismo servidor Ollama (proceso del 24-jul), mismo código de votación →
   95% → 65% en los mismos 20 casos. La regla "decisiva = copia VERBATIM de la pregunta +
   2/3 modelos" es de filo de navaja: en vivo se observó a qwen copiar la pregunta sin "¿" y
   a aya con prefijos "1. [DECISIVA] …" → `cumple:false` aunque el modelo entendió el caso.
   Pequeñas variaciones de formato de salida voltean la presencia de forma masiva.
3. Las "subestimaciones" de v1/v2 son en su inmensa mayoría **abstenciones** (REVISION_MANUAL,
   confianza 0): en producción eso es revisión humana (seguro), no error silencioso.
   **Subestimaciones ACTIVAS (silenciosas con Δ<0): 0 en todas las corridas** ✅.
4. La fragilidad verbatim ya estaba documentada en el cierre-092 ("rinde peor", ESPS 2100)
   y por eso la rúbrica NO es el motor por defecto (D-19: legacy en producción).

## Recomendación (spec futura, NO hecha — una variable a la vez)

**Normalizar el match de preguntas cumplidas** (trim, casefold, quitar prefijos numerados /
marcadores [DECISIVA], tolerar ausencia de "¿" inicial) antes de exigir verbatim. Es el
arreglo de mayor palanca para estabilizar el motor; sin él, cualquier afinamiento de
preguntas es ruido. Alternativa: decisiva por índice de pregunta, no por texto.

## Artefactos y prod

- `scripts/simulacion/resultados-dual-095-baseline-pre098.json` (línea base),
  `resultados-dual-098-v1-preguntas-largas.json` (v1). La corrida v2 completa quedó
  sobrescrita por el A/B (error de proceso); su resumen está en la tabla de arriba.
  A/B: `/tmp` (efímero; resumen en este cierre).
- Prod: app `e07890a` desplegada y verificada (Gesmovil intacto, healthcheck OK); parámetro
  `ia.rubrica.preguntas` sincronizado a v2 (targeting corto). Motor productivo: LEGACY (D-19,
  sin cambios).
- Gate: tsc + lint + **917/917 tests** + build (tras los cambios de rúbrica).

## Deuda

- Varianza inter-corrida alta del motor 092 (medir dos veces antes de cualquier afinamiento).
- El subconjunto A/B de 20 casos quedó archivado como `resultados-ab-098-20casos.json`
  (renombrado tras el cierre para no inducir a error: NO es la corrida de 200 de la 095);
  `resultados-dual-095.json` lo regenera el runner en la próxima medición completa.
