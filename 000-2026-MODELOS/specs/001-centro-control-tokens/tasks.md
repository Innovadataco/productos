# Tasks: SPEC-001 — Centro de Control de Consumo de Tokens

**Plan**: [plan.md](plan.md) · Convención: `[X]` hecho · `[ ]` pendiente

## Fase A — Datos (US1, US2)
- [X] T01 `app/datos.py`: `titulos()` — títulos de la app de escritorio por `cliSessionId`.
- [X] T02 `app/datos.py`: `recolectar(dias)` — agregación por sesión + serie diaria + contexto último turno.
- [X] T03 `app/datos.py`: `alertas()` — motor con `UMBRALES` centralizados y acción por alerta.
- [X] T04 `app/datos.py`: `resumen(dias)` — ensamble JSON-serializable (kpis, sesiones, tendencia, alertas).

## Fase B — Servidor (US1)
- [X] T05 `app/servidor.py`: handler GET `/` (index.html) y `/api/resumen?dias=N`.
- [X] T06 Manejo de puerto ocupado con mensaje claro y exit 1.
- [X] T07 `bin/modelos`: lanzador ejecutable con URL impresa.

## Fase C — Panel (US1–US4)
- [X] T08 Estructura mission-control: header con reloj/estado, KPI row, zona de alertas.
- [X] T09 Tendencia diaria (barras SVG, secuencial azul, hoy destacado, tooltip).
- [X] T10 Tabla de sesiones: nombre, estado icono+texto, turnos, contexto, caché, peso, última actividad; orden por peso.
- [X] T11 Meter de contexto por sesión vs límite 200k (severidad por tramo, icono+texto).
- [X] T12 Filtros: rango 1/7/30 días + estado todas/activas (una fila, sobre los gráficos).
- [X] T13 Comparador: checkbox por sesión (máx 3), panel de barras enfrentadas.
- [X] T14 Panel de recomendaciones: alertas con severidad + acción imperativa.
- [X] T15 Auto-refresh 60 s con pausa en pestaña oculta; sello "generado a las HH:MM:SS".

## Fase D — Calidad (Reglas de Oro 3 y 5)
- [X] T16 `tests/test_datos.py`: fixtures sintéticos; agregación, corrupción, estado, alertas, nombres.
- [X] T17 Verificación en vivo: `curl` 200 en `/` y `/api/resumen`; sin peticiones salientes.
- [X] T18 Documentar: README del producto, quickstart, índice de specs, cierre.md.

## Fase E — GitHub (Reglas de Oro 2 y 4)
- [X] T19 Commit en `feature/001-scaffolding` (staging SOLO `000-2026-MODELOS/`) + push.
- [X] T20 Liberación a `main` (solo la carpeta del producto) + push.
