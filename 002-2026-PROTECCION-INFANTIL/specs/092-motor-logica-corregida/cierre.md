# Cierre — Spec 092: Motor — lógica corregida y validada

**Fecha**: 2026-07-24
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/092-motor-logica-corregida/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS

## Resumen por US

| US | Resultado |
|---|---|
| US1 Decisivas/contexto | `PreguntaRubrica.tipo` (decisiva/contexto); la categoría cumple solo si TODAS las decisivas se cumplen (verificación determinista sobre preguntasCumplidas verbatim). Semilla reestructurada: 13 decisivas en 10 categorías. Tolerancia al formato viejo (sin tipo → contexto). |
| US2 Medir el embudo | Medición dedicada sobre los 200 casos: **el embudo descartó la categoría correcta en 70 casos (35%)** → se hizo PERMISIVO ("ante la duda incluye") + red de seguridad (plausibles < 2 → evaluar todas). Criterio documentado en research R5. |
| US3 Todas las conductas | Sin principal por gravedad: `categoriasPresentes` es el resultado; `categoria` = mayor % solo por schema; la UI lista todas. Gravedad solo priorización interna. |
| US4 Guardas baratas | `guardas-previas.ts`: ráfaga + doxing CORTAN a REVISION_MANUAL sin gastar modelos. RAG movido DESPUÉS de la deduplicación. Nuevo orden: embedding → dedup → guardas previas → RAG → rúbrica → PII → posteriores. |
| US5 min_text_length | Parámetro leído por backend (route, fallback 20) y front (`useMinTextoReporte` desde `/api/config/parametros/publicos`). Zod solo exige no-vacío. |
| US6 Re-corrida 200 | Ver sección de métricas abajo (con análisis de fallos y etiquetas sospechosas). |

## Métricas banco de 200 (misma terna, mismo umbral 60%)

| Corrida | Accuracy | Silenciosos | Subestim. | ESPS | Revisión manual |
|---|---|---|---|---|---|
| Motor 085 legacy (mejor: qwen2.5:32b, 5 votos mismo modelo) | 100% | 0 | 0 | 0 | — |
| Motor 090 (todas las preguntas, embudo estricto) | 74% (148/200) | 23 | 15 | 595 | 54 |
| **Motor 092 (decisivas + embudo permisivo)** | **69.5% (139/200)** | **42** | **24** | **2100** | 32 |

## Análisis de fallos (uno por uno)

**Resultado honesto: la lógica 092 NO mejoró al motor 090** (74% → 69.5%; silenciosos 23→42; ESPS 595→2100; revisión manual 54→32). El embudo permisivo dejó pasar más casos a clasificación pero con más errores ACORDADOS entre los 3 modelos (los 42 silenciosos son 3/3 en la categoría equivocada). Y ambos quedan MUY por debajo del motor legacy de la spec 085 (94-100% con 5 votos del mismo modelo).

**Fallos por categoría esperada**: SPAM 19, COMPARTIMIENTO_SEXUAL 10, OTRO 9, DOXING 6, SOLICITUD_MATERIAL 4, ENCUENTRO 3, REGALOS 2, CONTACTO_INSISTENTE 2, EXTORSION 2, DIFUSION 2, CONTENIDO_IA 2.

**Confusiones sistemáticas**: DOXING→DIFUSION_NO_CONSENTIDA (6), COMPARTIMIENTO→DIFUSION (5), COMPARTIMIENTO→EXTORSION (3) — fronteras vecinas genuinas. SPAM→OTRO (6), SPAM→CONTACTO_INSISTENTE (5), SPAM→OFRECIMIENTO_REGALOS (3) — los "adversariales" del lote nuevo (curado-085): el banco los etiqueta SPAM/OTRO pero el motor ve riesgo real.

**¿Falló el motor o está mal la etiqueta?** (la lección de #43): los 19 fallos SPAM y 9 OTRO son en gran parte del lote `curado-085` redactado para ser "falsos graves". Que los 3 modelos coincidan en riesgo real con 3/3 de acuerdo sugiere que esos casos quedaron **más ambiguos de lo previsto al redactarlos** — es deuda del banco, no solo del motor (ver lista abajo).

## Etiquetas sospechadas del banco (para revisión del CEO)

42 casos donde los 3 modelos (3/3) contradicen la etiqueta:
- **Curado-085 adversariales (motor ve riesgo, banco dice OTRO/SPAM)**: #112 (OTRO→SUPLANTACION), #117 (OTRO→CONTACTO_INS.), #118 (OTRO→REGALOS), #122 (OTRO→CONTACTO_INS.), #123 (SPAM→SUPLANTACION), #178 (SPAM→REGALOS), #180 (SPAM→CONTACTO_INS.), #184 (SPAM→REGALOS), #185 (SPAM→CONTACTO_INS.), #188 (SPAM→REGALOS), #193 (OTRO→REGALOS), #197 (OTRO→DIFUSION), #200 (OTRO→DIFUSION).
- **Frontera COMPARTIMIENTO vs DIFUSION/EXTORSION**: #102, #103, #104, #105, #106, #107, #108, #109, #110, #111.
- **Frontera DOXING vs DIFUSION**: #28, #169, #171, #172, #174, #175.
- **Otras**: #5 (SOLICITUD_MATERIAL→REGALOS), #43 (MATERIAL→CONTACTO_INSISTENTE — la sanitizada de la 085, el motor vuelve al leve: revisar si la rúbrica la cubre), #44, #67, #75, #95, #97, #98, #131, #135, #138, #146, #149.

**Recomendación (NO aplicada — decisión ZEUS+CEO)**: mantener `ia.rubrica.enabled=false` (motor legacy) como default productivo. El experimento de rúbrica es valioso por su auditabilidad (matriz + preguntas cumplidas), pero hoy rinde peor. Antes de otra iteración, el banco `curado-085` necesita curaduría de etiquetas (los adversariales), no más cambios de motor.

## Etiquetas sospechadas del banco (para revisión del CEO)

PENDIENTE_DE_RESULTADO

## Validación

- Tests: motor 8/8 (decisivas, embudo con red de seguridad, sin principal), pipeline 16/16 (guarda previa doxing corta sin clasificar), reportes 17/17 (min length por parámetro).
- Suite completa y healthcheck: ver gate final abajo.
- Incidencia ambiental: la BD de Docker murió por "No space left on device" (VM llena con ~52 GB de imágenes sin uso). Liberadas ~50 GB (`docker image prune`), BD recuperada, suite re-corrida completa: **832/832**. Las mediciones se relanzaron secuenciales (sin concurrencia).

## Commit

- `feat(motor): preguntas decisivas/contexto, embudo permisivo medido, todas las conductas y guardas baratas (spec 092)`
