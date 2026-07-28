# Cola nocturna 002-PI-025 — reporte de la mañana

> 2026-07-28 · ODIN · Rama `feature/001-scaffolding`. Un bloque = un commit + push, gate verde antes de cada commit.

```
B1 · TERMINADO · 9a18f500 (+50f4bd61 docs) · SPEC-104: rúbrica por índices (adiós verbatim) + I-30; aceptación formato-independiente en test; 935/935
B2 · TERMINADO · cb6b9e05 · backfill plan/tasks de 099 y plan de 087
B3 · TERMINADO · e20c9336 · SPEC-107: DEUDA_HEREDADA acotada, anti-literal repo-ancho, CI, .venv-presidio (10 112) y dev.db fuera del índice (historial intacto), imagen sin devDeps; 938/938
B4 · TERMINADO · 99003aaa · SPEC-108: cambiar-password enlazada (I-33), scorePromedio fuera de la API pública (I-29), rate-limit fail-closed también ante fallo de lectura de parámetros (O-1); 939/939
B5 · TERMINADO · (hash del commit de este reporte) · dos corridas de 200, IDÉNTICAS métrica a métrica y 0/200 discrepancias caso a caso en ambos motores
B6 · TERMINADO · b0430341 · docs/deuda-tecnica-recorrido-2026-07.md — 15 hallazgos (3 del propio CI del B3: D-01 a D-03), R5/R2/R7 levemente peores, sin corregir nada
```

## B5 — números crudos (sin interpretar)

Cronometraje: 20 casos = **27.6 min** → extrapolado ~4.6 h/corrida (real: ~4.5 h y ~4.4 h).

| Corrida | Motor | Accuracy | Silenciosos (graves) | Subestimaciones | ESPS | REVISION_MANUAL |
|---------|-------|---------:|---------------------:|----------------:|-----:|----------------:|
| 1 (`resultados-104-20260727-corrida1.json`) | legacy | 74.5% | 17 (9) | 9 | 1240 | 38/200 |
| 1 | rúbrica | 70.5% | 17 (0) | 4 | 595 | 34/200 |
| 2 (`resultados-104-20260728-corrida2.json`) | legacy | 74.5% | 17 (9) | 9 | 1240 | 38/200 |
| 2 | rúbrica | 70.5% | 17 (0) | 4 | 595 | 34/200 |

**Discrepancias caso a caso entre corridas (categoría+estado): legacy 0/200 · rúbrica 0/200.**
Referencia (no parte del experimento): baseline SPEC-095 pre-104 = rúbrica 70.5%, silenciosos 18, subestimaciones 4, ESPS 625, RM 32.

## Puntos donde me detuve por la regla 8 (dudas de arquitectura documentadas)

- Ninguna decisión de arquitectura se improvisó. Notas:
  - En B3, `git rm -r --cached` conserva el historial (212 MB aceptados como deuda por ZEUS) — ejecutado tal cual la instrucción.
  - En B6 se reportó sin corregir que el CI entregado en B3 no puede dar verde (D-01 a D-03); su corrección llegó por instructivo aparte (002-PI-027).
