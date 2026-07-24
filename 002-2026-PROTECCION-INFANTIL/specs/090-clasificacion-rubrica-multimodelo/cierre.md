# Cierre — Spec 090: Clasificación por rúbrica multi-etiqueta + multi-modelo

**Fecha**: 2026-07-24
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/090-clasificacion-rubrica-multimodelo/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS (validación banco 200 en background, ver US4)

## Resumen por US

| US | Resultado |
|---|---|
| US1 Motor rúbrica | Embudo → N modelos diversos secuencial (default 3: gemma2:27b, qwen2.5:14b, aya-expanse:32b) → 0/1 por categoría → % → umbral de presencia (0.6). Matriz persistida en `clasificacion_rubrica_votos` con preguntas cumplidas. |
| US2 Principal | Mayor gravedad entre presentes; ninguna/OTRO → REVISION_MANUAL. 089 intacta (esReporteAprobado, 2 estados, exclusión SPAM/OTRO, OTRO→revisión, sin nivelRiesgo). |
| US3 Mis reportes | Detalle PRIVADO del dueño: tabla categoría×modelo (✓/—) + % + análisis por plantilla. 403 para no dueños. Sin "% de riesgo". |
| US3-bis Config | Tab "Rúbrica" en el centro IA (CRUD de preguntas por categoría + modelos/umbral/temperatura/embudo), módulo `ia_rubrica` en permisos, endpoints con guard + AuditLog. |
| US3-ter Docs | IaDocsPanel al flujo real (con Deduplicación, sin "moda"). |
| US4 Validación | `scripts/eval-rubrica-banco.ts` escrito y corrida completa (200 casos) en background; sanity subset 6/6 aciertos, 0 silenciosos. Resultados completos en `scripts/simulacion/resultados-rubrica-090.json` al terminar. |

## Cómo se deriva la conducta principal y convive con esReporteAprobado (089)

Embudo (1 llamada, modelo rápido) → categorías plausibles. Cada modelo vota 0/1 por categoría (1 solo si TODAS las preguntas activas se cumplen con evidencia clara). % por categoría = 1s/N. **Presentes** = % ≥ `ia.rubrica.umbral_presencia` (0.6). **Principal** = mayor severidad (`scoring.severity.*`) entre presentes. Ninguna presente → desacuerdo → `REVISION_MANUAL`; OTRO → revisión. `confianza` = % de la principal (contrato de estados/guardas sin cambios). El predicado `esReporteAprobado` no se tocó: sigue excluyendo SPAM/OTRO de la superficie pública; la suite completa de la 089 pasa.

## Validación

- Tests nuevos: motor (8), Mis reportes endpoint+UI (9), endpoints rúbrica (13), pipeline adaptado (16), suite total **829/829** tras ajustes (mock de la rúbrica en tests del pipeline + persistencia defensiva + passthrough de `posibleAgresorPar`).
- Sanity en vivo (Ollama real): 6/6 aciertos, 0 silenciosos, 0 ESPS; ~10-17 s por llamada (embudo + 3 modelos ≈ 55 s/caso — la cola async la absorbe).
- Gate: lint 0 errores (1 warning heredado) · tsc OK · build limpio · `dev-restart.sh` healthcheck OK.

## Métricas comparativas — banco de 200 (corrida completa, 2026-07-24)

| Motor | Accuracy | Silenciosos | Subestim. | ESPS | Revisión manual |
|---|---|---|---|---|---|
| Anterior (5 votos mismo modelo, spec 085, mejor: qwen2.5:32b) | 100% | 0 | 0 | 0 | — |
| Anterior (gemma2:27b) | 98% | 0 | 0 | 0 | — |
| **Nuevo (rúbrica, 3 diversos)** | **74% (148/200)** | **23** | **15** | **595** | 54 |

**Resultado honesto: el motor nuevo RINDE PEOR que el anterior sobre el banco de 200.**
¿3 modelos diversos aciertan más que 5 votos del mismo? **No, con la configuración actual.**
Lectura técnica: las preguntas estrictas (todas deben cumplirse para marcar 1) más el umbral
de presencia 0.6 producen 54 casos a revisión manual (27%) y una tasa de aciertos de la
principal inferior. Los 23 errores silenciosos (confianza=1.0, es decir, 3/3 modelos de
acuerdo en la categoría equivocada) muestran que el desacuerdo entre familias no siempre
captura el sesgo compartido. La matriz quedó en `scripts/simulacion/resultados-rubrica-090.json`.
Decisión pendiente de ZEUS + CEO: afinar la rúbrica (preguntas por categoría, umbral, terna
de modelos) o mantener el motor legacy como default (`ia.rubrica.enabled=false`). NO se
cambia nada por cuenta propia.

## Deuda / notas

- La corrida completa (200×~55s ≈ 3 h) quedó en background al momento del commit; su artefacto (`resultados-rubrica-090.json`) se adjunta al cierre cuando termine.
- `ia.rubrica.enabled=false` devuelve el motor legacy sin desplegar (rollback por parámetro).
- Modelos por defecto incluyen aya-expanse:32b (sesgo conocido hacia COMPARTIMIENTO_SEXUAL, spec 085): como VOTO diverso es información, pero si el umbral se baja conviene revisar la terna.

## Commit

- `feat(clasificacion): motor por rúbrica multi-etiqueta multi-modelo + detalle Mis reportes + tab Rúbrica (spec 090)`
