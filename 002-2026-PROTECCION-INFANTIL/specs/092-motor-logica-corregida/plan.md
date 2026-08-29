# Implementation Plan: Spec 092 — Motor: lógica corregida

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Corregir la lógica del motor rúbrica sin tocar terna ni umbral: preguntas decisivas/contexto (la causa raíz del 74%), medición del embudo, mostrar todas las conductas sin principal por gravedad, guardas baratas antes del paso caro, longitud mínima desde parámetro, y re-validación sobre el banco de 200 con análisis de fallos.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16, Prisma 5.22, Ollama local
**Storage**: sin cambios de schema (estructura de preguntas en `ParametroSistema`, JSON)
**Testing**: Vitest por regla + script de evaluación del banco (background)

## Diseño por US

### US1 — Decisivas vs contexto
- `PreguntaRubrica` gana `tipo: "decisiva" | "contexto"` (default "contexto" al leer JSON viejo — tolerancia).
- Semilla reestructurada (`rubrica-semilla.ts`): 1-2 decisivas por categoría (el núcleo: acción + víctima menor) y el resto contexto. Ejemplo SOLICITUD_MATERIAL: decisivas = "¿alguien pide fotos/videos?" + "¿el material pedido es íntimo?"; contexto = menor/adulto.
- Prompt del voto: marca 1 solo si TODAS las decisivas se cumplen con evidencia clara; las de contexto se reportan (suman al análisis, no bloquean). "Ante la duda, 0" solo en decisivas.
- Evaluación: `cumple = todasLasDecisivasCumplidas` (el motor valida que las preguntasCumplidas incluyan las decisivas; fallback: confiar en el 0/1 del modelo con el prompt reforzado + verificación determinista: si alguna decisiva NO está en preguntasCumplidas → cumple=false).

### US2 — Medición del embudo
- Script `scripts/medir-embudo-092.ts`: corre SOLO el embudo sobre los 200 casos y verifica si la `categoriaEsperada` (o secundaria) estaba en plausibles. Reporta: total de descartes erróneos y lista por caso. Con el número se decide (permisivo o desactivar) y se documenta en research.md.

### US3 — Todas las conductas, sin principal
- `clasificarConRubrica`: `categoriasPresentes` es el resultado; `estado = presentes.length > 0 ? "CLASIFICADO" : "REVISION_MANUAL"`. `categoria` (campo requerido por schema) = la presente con mayor % (empate → primera alfabética), SIN usar severidad para decidir.
- UI: seguimiento/mis-reportes/consulta listan todas las conductas presentes (ya lo hacen desde categoriasSecundarias; ajustar para que la fuente sea `categoriasPresentes` completa).

### US4 — Guardas previas + orden del pipeline
- `helpers/guardas-previas.ts`: `aplicarGuardasPrevias({texto, identificador, plataformaId, parametros})` → si ráfaga o doxing → `{ cortar: true, estadoFinal: "REVISION_MANUAL", prioridadAlta }` ANTES de llamar modelos.
- Nuevo orden: embedding → **dedup** → **RAG** → guardas previas → clasificar (rúbrica) → PII → guardas posteriores → finalizar.

### US5 — min_text_length
- Param `reportes.spam.min_text_length` (ya sembrado, 20). Backend: `crearReporteSchema.texto` valida contra el parámetro (refinamiento dinámico en la route de creación). Front: `ReporteStepDetalle` y `ReporteStepDescripcion` leen `/api/config/parametros/publicos` (si existe el endpoint público) o un pequeño fetch del param público — verificar disponibilidad; si no existe endpoint público, marcar el parámetro `esPublico: true` y usarlo.

### US6 — Re-corrida y análisis
- `scripts/eval-rubrica-banco.ts` actualizado (nueva lógica, detalle con plausibles + preguntas fallidas por caso). Corrida completa en background + análisis en cierre.md: fallos uno por uno, etiquetas sospechosas listadas.
- Tab Eval: si el tiempo alcanza, botón "Correr banco rúbrica" que dispara el script como job; si no, pendiente documentado.

## Fases
1. US1 (semilla + motor + tests).
2. US4 (pipeline + tests).
3. US5 (param front+backend + tests).
4. US3 (motor + UI + tests).
5. US2 (medición embudo).
6. US6 (re-corrida + análisis) + gate + commit/push.

## Riesgos
| Riesgo | Mitigación |
|--------|------------|
| Cambiar el prompt rompe los modelos | Tests con mocks exactos del nuevo prompt; corrida de sanity en vivo antes del banco completo |
| Guardas previas cortan casos legítimos | Solo ráfaga (frecuencia) y doxing (patrones fuertes), mismas reglas que hoy actúan post-clasificación |
| JSON viejo de preguntas en BD | Lectura tolerante (sin `tipo` → "contexto"); seed re-escribe el parámetro al nuevo formato |
