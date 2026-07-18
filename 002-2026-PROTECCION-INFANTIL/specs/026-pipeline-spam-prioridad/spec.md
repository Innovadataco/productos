# Spec 026 — Pipeline de spam + prioridad + reintentos

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Alcance

Rediseñar el pipeline de ingreso de reportes: separar protección contra volumen (rate-limit) del juicio de spam por contenido; agregar SPAM como categoría del clasificador; implementar priorización de jobs y reintentos automáticos con fallback a operador.

## Decisiones

- **Portero**: la heurística/rate-limit solo frena ráfagas y fingerprint (volumen), no juzga contenido.
- **Spam por contenido**: la IA decide. Se agrega `SPAM` a `CategoriaConducta` y se alimenta el RAG con ejemplos de spam.
- **SPAM confirmado por IA → cola de operadores**: un operador revisa y decide; no se autodestruye.
- **Prioridad**: autenticado = ALTA, anónimo = BAJA. Anónimo con keyword de alto riesgo (`src/lib/ai/keywords-riesgo.ts`) sube a ALTA.
- **Reintentos**: ante fallo del worker, se reintenta hasta N veces (`worker.max_reintentos` en `ParametroSistema`). Si se agotan, queda en `REVISION_MANUAL` con historial de intentos.

## Requisitos

1. Quitar juicio de spam por contenido de la heurística rápida.
2. Agregar `SPAM` a `CategoriaConducta`.
3. Sembrar dataset/RAG con ejemplos de spam.
4. Implementar prioridad de jobs con pg-boss (verificar soporte nativo).
5. Implementar reintentos con contador y metadata de intentos.
6. UI de operador: ver intentos fallidos, reenviar a reprocesar.

## Riesgos mitigados

- Reportes reales marcados como spam por heurística deficiente.
- Pérdida de reportes por fallos transitorios del worker.

## R7

**Sí aplica parcialmente**: se agrega `SPAM` como categoría del clasificador y se alimenta el RAG, pero **no se afina el modelo** (umbrales, precisión). El tuning queda para SPEC-050.
