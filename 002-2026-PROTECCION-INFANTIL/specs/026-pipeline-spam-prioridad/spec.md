# Spec 026 — Pipeline de spam

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Alcance

Rediseñar el juicio de spam en el pipeline de ingreso: separar protección contra volumen (rate-limit) del juicio de spam por contenido; agregar `SPAM` como categoría del clasificador; y enviar spam confirmado a revisión de operadores.

## Decisiones

- **Portero**: la heurística/rate-limit solo frena ráfagas y fingerprint (volumen), no juzga contenido.
- **Spam por contenido**: la IA decide. Se agrega `SPAM` a `CategoriaConducta` y se alimenta el RAG con ejemplos de spam.
- **SPAM confirmado por IA → cola de operadores**: un operador revisa y decide; no se autodestruye.
- **Prioridad y reintentos**: viven en **Spec 027** (motor de encolamiento). La 026 consume esos servicios, no los implementa.

## Requisitos

1. Quitar juicio de spam por contenido de la heurística rápida.
2. Agregar `SPAM` a `CategoriaConducta`.
3. Sembrar dataset/RAG con ejemplos de spam anonimizados.
4. Cuando la IA clasifica como `SPAM` con confianza suficiente, el reporte pasa a `POSIBLE_SPAM` o `REVISION_MANUAL` para revisión humana.
5. UI de operador: marcar si finalmente es spam o reporte válido.
6. Registrar transiciones en Spec 022.

## Riesgos mitigados

- Reportes reales marcados como spam por heurística deficiente.
- Spam autodestruido sin trazabilidad humana.

## R7

**Sí aplica parcialmente**: se agrega `SPAM` como categoría del clasificador y se alimenta el RAG, pero **no se afina el modelo** (umbrales, precisión). El tuning queda para SPEC-050.
