# Implementation Plan: Ingesta resiliente y documentos no indexables

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Dos cosas distintas, con la misma raíz: un documento puede quedar fuera del corpus **sin que
nadie se entere**. Se ataca (1) reintentando la extracción que hoy no reintenta y (2) diciendo
por documento si la búsqueda puede encontrarlo. **Sin migración, sin dependencias, sin OCR.**

## Decisión central: la indexabilidad se DERIVA, no se guarda

La pregunta del usuario es *"¿puedo encontrarlo si lo busco?"*, y eso tiene una respuesta
exacta: **¿tiene fragmentos?**

| Alternativa | Por qué se descartó |
|---|---|
| Campo `indexable` en la tabla | Se desincroniza el día que se borre un fragmento o se reprocese un documento, y exige migración + backfill. Un campo que hay que acordarse de actualizar acaba mintiendo. |
| Usar `status` | **No sirve**: `needs_review` agrupa hoy "no se pudo leer el PDF", "se leyó pero no había modelo de IA" y "falló la vectorización". En la BD viva hay un documento con **68 fragmentos** —buscable— en `needs_review`. |
| **Derivar de `_count.chunks` al leer** | Es un hecho, no una opinión, y no puede desincronizarse. Sin migración (RZ-2). Los documentos ya rotos quedan marcados solos. |

Coste asumido: un `_count` por consulta de listado. Con el corpus actual (3 documentos) es
irrelevante; si creciera, se revisa. Queda dicho para no descubrirlo por sorpresa.

## Decisión: reintentar donde de verdad falta

La cola (pg-boss) **ya reintenta**: 3 intentos con espera creciente. El problema es que el
documento que falla al extraer **nunca llega a la cola**: `POST /api/documents` extrae dentro
de la petición y, si falla, marca `needs_review` y **no encola**. Los reintentos existentes no
se aplican jamás.

Por eso el reintento va **en la subida**, con parámetros cortos (3 intentos, 500 ms): ahí hay
un usuario esperando, no un proceso de fondo.

## Technical Context

**Dependencias nuevas**: ninguna · **Migración**: ninguna · **Trabajo pesado**: no

**Testing**: la espera se inyecta (`dormir`) para que la suite no tarde de verdad.

## Constitution Check — **PASS**

| Principio | Evaluación |
|---|---|
| §0.2 Pruebas | ✅ Reintento e indexabilidad, puros y con test; la ruta, con test propio. |
| §0.3 Tipado | ✅ Cero `any`; el motivo que ve el usuario es texto propio, no `err.message`. |
| §2.5 Auditoría | ✅ Los reintentos quedan en la metadata del registro de subida. |
| §3.4 Pipeline | ✅ No se toca el troceado ni los embeddings: solo la resiliencia y el informe. |

## Cambios exactos

| Archivo | Qué |
|---|---|
| `src/lib/reintento.ts` (+test) | `conReintento`: límite, aviso por fallo, relanza el último error |
| `src/lib/indexabilidad.ts` (+test) | `evaluarIndexabilidad`: buscable / en proceso / motivo llano |
| `src/app/api/documents/route.ts` | Reintento en la subida + auditoría de los intentos; el `GET` añade `indexabilidad` por documento |
| `src/components/modules/BaseTab.tsx` | El listado marca "No buscable" (o "Indexando") con el motivo |

## Riesgos

- **R-01 · La subida se hace lenta.** Mitigación: 3 intentos y 500 ms; el peor caso añade ~1 s
  a un fallo que hoy es definitivo.
- **R-02 · Marcar de más y asustar.** Mitigación: un documento en cola sale como **"Indexando"**,
  no como roto (FR-004).
- **R-03 · Confundir esto con OCR.** Mitigación: RZ-1. Un escaneo se marca como no buscable;
  darle capa de texto es SPEC-010, que exige turno.
