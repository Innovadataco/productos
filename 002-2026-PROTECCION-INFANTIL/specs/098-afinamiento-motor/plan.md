# Implementation Plan: Spec 098 — Afinamiento del motor (targeting, principal por gravedad, métrica)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

> Backfill documental (cierre cola 002-PI-014): plan reconstruido a partir del spec.md,
> el cierre.md y los commits `e07890ab` y `27484b45`. Documenta lo hecho — incluido que
> **FR-004 NO se alcanzó**, sin maquillarlo.

## Summary

Tres ajustes al motor por rúbrica sobre el banco curado (línea base spec 095: accuracy
70.5%, subestimaciones 4, ESPS 625, 0 silenciosos peligrosos), con disciplina de una
variable a la vez (terna de modelos y umbral 60% intactos): decisiva de "targeting"
anti-spam, selección interna de `categoria` por gravedad y corrección de la métrica de
silenciosos. Re-medición solo de la rúbrica (`--rubrica-only`, legacy reusado).

## Diseño (lo que se hizo)

1. **FR-001 (targeting)**: preguntas decisivas en `OFRECIMIENTO_REGALOS` y
   `CONTACTO_INSISTENTE` para distinguir contacto interpersonal de spam/publicidad masiva.
   Dos iteraciones: v1 con preguntas compuestas ("…y no es masivo") que colapsaron la
   rúbrica (107/200 a revisión — la copia verbatim exigida por el motor no tolera preguntas
   largas/compuestas); v2 con preguntas cortas afirmativas ("¿El contacto/ofrecimiento es
   personal, dirigido específicamente a este menor?"). Param propagado con
   `scripts/actualizar-rubrica-098.ts` (el seed es upsert no destructivo).
2. **FR-002 (principal por gravedad)**: en `clasificarConRubrica`, `categoria` (campo
   interno requerido) = la de MAYOR gravedad entre las presentes (severidades
   parametrizadas; empate: mayor %, alfabético). La presentación sigue mostrando todas
   las conductas (D-13).
3. **FR-003 (métrica)**: en `scripts/eval-dual-banco.ts`, `esperada === asignada`
   (abstención con contenido correcto, Δ=0) ya no cuenta como error silencioso. Modo
   `--rubrica-only` para re-medir solo la rúbrica reutilizando el detalle legacy.

## Resultado de la medición — FR-004 NO alcanzado (sin maquillar)

| Corrida | accuracy | silenciosos (graves) | subestimaciones | ESPS | REVISION_MANUAL |
|---------|---------:|---------------------:|----------------:|-----:|----------------:|
| Línea base (095) | 70.5% | 18 (0) | 4 | 625 | 32/200 |
| v1 (targeting compuesto) | 41.0% | 1 (0) | 64 | 5 | 107/200 |
| v2 (targeting corto) | 44.5% | 1 (0) | 58 | 70 | 102/200 |
| A/B mismo día, SIN targeting (20 casos) | 65% | — | — | — | 7/20 |
| Línea base, esos mismos 20 casos | **95%** | — | — | — | **1/20** |

**El objetivo FR-004 (subestimaciones ≤ 4, ESPS a la baja, 0 silenciosos peligrosos) NO se
alcanzó en subestimaciones (58–64).** La investigación (A/B mismo día, mismos casos,
con/sin targeting) demostró que la causa NO es el afinamiento:

- El targeting es **inocuo**: presencia idéntica caso a caso con y sin él (13/20 vs 12/20).
- **La línea base misma NO es reproducible**: mismo parámetro, mismos modelos (sin cambios
  desde el 21-jul), mismo servidor Ollama (proceso del 24-jul), mismo código de votación →
  95% → 65% en los mismos 20 casos. La regla "decisiva = copia VERBATIM de la pregunta +
  2/3 modelos" es de filo de navaja: en vivo, qwen copia sin "¿" y aya con prefijos
  "1. [DECISIVA] …" → `cumple:false` aunque el modelo entendió el caso.
- Las "subestimaciones" de v1/v2 son en su inmensa mayoría **abstenciones**
  (REVISION_MANUAL, confianza 0 → revisión humana en producción, no error silencioso).
  Subestimaciones ACTIVAS (silenciosas con Δ<0): **0 en todas las corridas**.
- La fragilidad verbatim ya estaba documentada en el cierre-092 y por eso la rúbrica no es
  el motor por defecto (D-19: legacy en producción, sin cambios).

**Recomendación registrada (spec futura, no implementada — una variable a la vez)**:
normalizar el match de preguntas cumplidas (trim, casefold, quitar prefijos numerados y
marcadores, tolerar ausencia de "¿") o pasar a decisiva por índice. Es la palanca real;
sin ella, todo afinamiento de preguntas es ruido.

## Riesgos

| Riesgo | Mitigación aplicada |
|--------|---------------------|
| Afinar sin línea base limpia | Banco curado (095) + `--rubrica-only` (legacy reusado, una variable a la vez) |
| Targeting dañe casos reales | A/B con/sin targeting en la misma sesión (demostrado inocuo) |
| Confundir abstención con error | FR-003: OTRO→OTRO correcto ya no es silencioso; subestimaciones activas reportadas aparte |
| Parámetro divergente entre entornos | `actualizar-rubrica-098.ts` idempotente; prod sincronizado a v2 por `psql` |

## Pruebas

Gate: lint + test + tsc + build (917/917), incluido el test de `clasificarConRubrica`
actualizado a la principal por gravedad. Mediciones: baseline y v1 en
`scripts/simulacion/` (la v2 completa quedó sobrescrita por el A/B — error de proceso
registrado en el cierre; su resumen está en la tabla).
