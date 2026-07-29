# 000-2026-MODELOS

Herramientas internas de **observabilidad y gestión de los modelos IA** de la fábrica IDC.
Desarrollo guiado por especificaciones (Spec-Driven Development con Spec Kit).

> **Naturaleza especial:** producto interno de gestión, no de cliente. Lo construye y
> mantiene **ZEUS** directamente por orden del CEO (2026-07-29) — excepción documentada al
> flujo ZEUS→ODIN. Constitución en [`.specify/memory/constitution.md`](.specify/memory/constitution.md):
> **monitorear nunca actuar · nada sale de la Mac · cero dependencias**.

## Fases del producto

| Fase | Feature | Estado | Spec |
|------|---------|--------|------|
| F1 | Centro de Control de Consumo de Tokens | ✅ Implementado | `specs/001-centro-control-tokens/` |

## Uso

```bash
# lanzar el panel (stdlib puro, sin instalación)
bin/modelos                 # → http://127.0.0.1:8899
# u otro puerto:
python3 app/servidor.py 9001
```

El panel muestra: KPIs del rango, tendencia diaria, tabla de sesiones con medidor de
contexto, alertas con **la acción recomendada**, filtros (hoy/7/30 días, activas) y
comparador de hasta 3 sesiones. Auto-refresh 60 s.

## Pruebas

```bash
python3 -m unittest discover -s tests
```

## Estructura

```
app/datos.py        agregación + motor de alertas (módulo puro, testeable)
app/servidor.py     HTTP local (solo GET, solo 127.0.0.1)
app/web/index.html  panel mission-control (HTML/CSS/JS vanilla, un archivo)
tests/              unittest con fixtures sintéticos
bin/modelos         lanzador
specs/              especificaciones Spec Kit
```

## Fuentes de datos (solo lectura)

- `~/.claude/projects/**/*.jsonl` — transcripciones de Claude Code (contabilidad `usage`).
- `~/Library/Application Support/Claude/claude-code-sessions/**/local_*.json` — títulos de
  chat de la app de escritorio (`title` ↔ `cliSessionId`).
