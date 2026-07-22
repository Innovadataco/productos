# AGENTS.md — Software de Gestión IDC (001-2026-INNOVADATACO)

Guía operativa para agentes de IA que trabajen en este proyecto. `CLAUDE.md` referencia
este archivo con `@AGENTS.md`: todo agente (Claude Code u otro) debe cumplirlo.

## Roles de la fábrica de software

| Rol | Quién | Responsabilidad |
|---|---|---|
| **ODIN** | Agente implementador | Ejecuta specs aprobadas: código, tests, tooling, redacción. No decide arquitectura. |
| **ZEUS** | Arquitecto | Define alcance y diseño, revisa el trabajo de ODIN antes de integrarlo. |
| **Jelkin** | CEO | Aprueba specs, constitución y cualquier trabajo pesado. Última palabra. |

Flujo: ZEUS decide → Jelkin aprueba → ODIN implementa → ZEUS revisa.

## Reglas de aislamiento y puertos (INQUEBRANTABLES)

- A este proyecto le pertenecen **solo** los puertos **5001** (app) y **5435** (BD).
- Los puertos **5005 y 5433** (002-Protección Infantil) y **5010 y 5434** (003-SICOV)
  son **INTOCABLES**: no usarlos, no liberarlos, no reasignarlos, no detener ni
  reiniciar procesos o contenedores que los ocupen. Si un comando falla por conflicto
  de puertos: **DETENERSE y reportar** — nunca "solucionar" matando algo ajeno.
- Todo comando (git, docker, prisma, specify) va scopeado a esta carpeta
  (`001-2026-INNOVADATACO/`). **Prohibido** tocar `002-2026-PROTECCION-INFANTIL`,
  `003-2026-SICOV-OTPC`, sus contenedores, volúmenes o archivos.
- Prohibido `docker system prune` y cualquier borrado global con `-v`.
- En git: stagear **solo** archivos bajo `001-2026-INNOVADATACO/`. Si hay cambios de
  otros productos en el monorepo, no tocarlos ni commitearlos.
- Secretos jamás en código ni commits. `.env` está en `.gitignore` y **no se commitea**.

## Coordinación de trabajo pesado (ADR_002)

- Antes de cualquier trabajo pesado (inferencia con modelos locales, cargas largas de
  CPU/GPU/RAM en la MacStudio): **avisar a Jelkin y esperar su OK** (turno aprobado).
- Solo **un modelo grande a la vez** en la MacStudio: los tres proyectos comparten la
  máquina y la memoria unificada no admite dos modelos grandes simultáneos.
- Sin turno aprobado, el agente se limita a tooling, redacción y cambios de código
  que no ejecuten inferencia.

## Spec-driven development

Este proyecto usa Spec Kit (`.specify/` + skills `speckit-*` en `.claude/skills/`).
Regla de Oro: **ningún cambio sin spec aprobada** por ZEUS y Jelkin. La constitución
del proyecto vive en `.specify/memory/constitution.md`.
