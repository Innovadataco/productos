# Implementation Plan: SPEC-001 — Centro de Control de Consumo de Tokens

**Spec**: [spec.md](spec.md) · **Fecha**: 2026-07-29 · **Autor**: ZEUS

## Constitution Check
- §1.2 Monitorear, nunca actuar → el servidor solo tiene handlers GET; no existe endpoint
  que mate procesos, escriba config ni toque sesiones. ✅
- §1.3 Datos no salen de la Mac → bind a `127.0.0.1`; el HTML no referencia ningún origen
  externo (ni fuentes, ni JS, ni CSS). ✅
- §1.4 Cero dependencias → `http.server`, `json`, `glob`, `os`, `datetime`, `collections`,
  `unittest`. Frontend vanilla en un archivo. ✅
- §1.5 Solo lectura → `open(..., 'r')` exclusivamente; sin `os.remove/rename/write` fuera
  de la carpeta del producto. ✅

## Arquitectura

```
app/
  datos.py       ← módulo puro: recolección + agregación + alertas (testeable, sin HTTP)
  servidor.py    ← http.server: sirve web/index.html y /api/resumen (usa datos.py)
  web/index.html ← panel completo (CSS+JS inline; SVG generado en cliente)
tests/
  test_datos.py  ← unittest de agregación, estado, alertas y nombres
bin/
  modelos        ← lanzador (chequea puerto, imprime URL, arranca servidor)
```

### `datos.py` — el corazón (reutiliza lo probado en `~/.local/bin/consumo-tokens`)
- `titulos()` → `{cliSessionId: (title, cwd)}` desde los `local_*.json` de la app.
- `recolectar(dias)` → por sesión: `in/out/cw/cr`, turnos, mtime, **contexto_ultimo**
  (input + cache_read + cache_creation del último turno = ocupación real del contexto),
  contexto_medio, proyecto, nombre, es_subagente; y serie diaria para la tendencia.
- `alertas(sesiones)` → lista de dicts `{sev, chat, metrica, accion}` con umbrales en
  `UMBRALES = {...}` (un solo lugar, FR-004).
- Peso USD: tarifa Opus de referencia, constante documentada.

### `servidor.py`
- `GET /` → `web/index.html`.
- `GET /api/resumen?dias=N` → JSON: `{kpis, sesiones[], tendencia[], alertas[], generado}`.
- Errores de parseo: contador `lineas_saltadas` en la respuesta (transparencia sin ruido).

### `web/index.html` — mission control (skill dataviz aplicada)
- **Forma antes que color**: KPI row (stat tiles) · barras diarias (magnitud → secuencial,
  un tono) · tabla canónica de sesiones · meter de contexto por sesión (ratio vs límite) ·
  comparador (barras agrupadas, categórico ≤3 series).
- **Paleta**: dataviz IDC modo oscuro — superficie `#1a1a19`, plano `#0d0d0d`,
  azul `#3987e5` (secuencial/serie 1), naranja `#d95926` (serie 2), aqua `#199e70` (serie 3);
  estado: good `#0ca30c` / warning `#fab219` / serious `#ec835a` / critical `#d03b3b`,
  siempre icono+texto, nunca color solo. Validación: orden y pasos ya validados en
  `references/palette.md` del skill (adyacentes CVD ΔE 8.4 dark); se re-ejecuta el
  validador si se cambia un hex.
- **Marcas**: barras ≤24px con remate redondeado 4px, gap de superficie 2px, grid hairline,
  texto en tintas (nunca color de serie), `tabular-nums` solo en columnas.
- **Interacción**: tooltip por barra, filtros en una fila sobre los gráficos, auto-refresh 60 s
  con pausa cuando la pestaña no está visible.

## Decisiones
| # | Decisión | Razón |
|---|----------|-------|
| D1 | Límite de contexto de referencia: 200.000 tok | ventana estándar de los modelos usados; configurable en `UMBRALES` |
| D2 | ACTIVA = mtime < 15 min | mismo criterio probado en el CLI `consumo-tokens` |
| D3 | Subagentes plegados en fila propia etiquetada | inflan la tabla y no son accionables uno a uno |
| D4 | Sin websockets; polling 60 s | stdlib puro y suficiente para monitoreo humano |
| D5 | Puerto 8899 | libre en la máquina; 8787 lo usa headroom |

## Testing (Regla de Oro 3)
`tests/test_datos.py` con fixtures sintéticos (JSONL temporal): agregación correcta,
línea corrupta ignorada, estado activa/inactiva, disparo de cada alerta y su acción,
nombre por título vs primer mensaje.

## Riesgos
- Formato de transcripción cambia con versiones de Claude Code → el parser ignora lo que no
  reconoce y reporta `lineas_saltadas`; el test fija el contrato actual.
- El puerto en uso → mensaje claro y exit 1 (edge case del spec).
