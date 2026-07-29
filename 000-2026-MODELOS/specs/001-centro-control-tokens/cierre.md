# Cierre — SPEC-001 · Centro de Control de Consumo de Tokens

**Fecha:** 2026-07-29 · **Autor:** ZEUS · **Estado:** IMPLEMENTADO

## Verificación contra Success Criteria
| SC | Resultado |
|----|-----------|
| SC-001 (sesión más costosa en <10 s) | ✅ tabla ordenada por peso, KPI row arriba |
| SC-002 (alerta ≤60 s) | ✅ auto-refresh 60 s; en la primera carga real disparó CRITICAL sobre una sesión al >90% |
| SC-003 (tests en verde sin red) | ✅ 14/14 `unittest`, fixtures sintéticos |
| SC-004 (curl 200 sin red externa) | ✅ `/` 200 (21 KB) · `/api/resumen?dias=7` 200 en 0,22 s (NF-002 <3 s) |

## Verificación de constitución
- Solo GET, solo 127.0.0.1, solo lectura ✅ · Cero dependencias (stdlib + vanilla) ✅ ·
  Cero orígenes externos en el HTML ✅.

## Paleta (skill dataviz)
Se usan los valores **documentados y pre-validados** del modo oscuro de la paleta de
referencia (cero cambios de hex): categóricas 1-3 (`#3987e5`/`#d95926`/`#199e70` — las tres
primeras validan all-pairs en oscuro, por eso el comparador limita a 3 series), estados
(`#0ca30c`/`#fab219`/`#ec835a`/`#d03b3b`) siempre con icono+texto, tintas para todo texto.
Regla aplicada: si se cambia un hex, correr `validate_palette.js` antes de commitear.

## Hallazgos / deuda
1. Los fixtures del test deben ser JSON **compacto** (las transcripciones reales no llevan
   espacios; el pre-filtro del parser depende de eso). Documentado en el propio test.
2. El límite de contexto es una referencia fija (200k en `UMBRALES`); si la flota de modelos
   cambia de ventana, se ajusta ahí. Posible mejora futura: detectar el modelo por sesión.
3. El lanzador no se instala como servicio (constitución: la herramienta no se auto-instala);
   si el CEO quiere arranque automático, es un LaunchAgent que crea él.

## Handoff
```
commit <hash> — SPEC-001 implementado: panel mission-control de consumo de tokens (000-MODELOS)
hallazgos/pendientes: los 3 de arriba
push: sí (feature/001-scaffolding y liberación a main)
```
