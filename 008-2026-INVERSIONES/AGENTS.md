# AGENTS.md · 008 · INVERSIONES

Sistema personal de seguimiento de un portafolio de inversiones: importa las exportaciones de la casa de bolsa, calcula posiciones, costo, dividendos y rentabilidad (TWR), trae precios y envía reportes por Telegram y en una web con gráficas. Es de solo lectura: no opera ni guarda credenciales de plataformas de inversión.

## Stack (D-008, igual al de la fábrica)
- Web y API: Next.js (App Router) + React, Node 22 (fijar en `.nvmrc` y `engines`, igual que el CI).
- Datos: Prisma + PostgreSQL 16 en **contenedor propio** (`docker-compose.yml` del producto, sobre Colima). Puerto local **5438**.
- Tareas programadas (precios al cierre, valor del fondo, reporte diario): pg-boss sobre la misma PostgreSQL.
- Reportes: bot de Telegram.
- App local en el puerto **5008**. Producción: `docker-compose.prod.yml` (copiar repo + `.env` + `docker compose up`).
- **No crear otras bases de datos ni otros servicios** fuera del compose del producto.

## Cómo se trabaja
Metodología: `~/GitHub/ODIN/manuales-operativos/02-metodologia-desarrollo/README.md` (repo `Innovadataco/odin`).
- Rama `work/inv-SPEC-<entero>-<slug>` desde `origin/main`, en worktree propio. Base del PR: `main`.
- El número de SPEC lo asigna el CEO de 008.
- Staging solo de rutas de `008-2026-INVERSIONES/` (o del workflow `inv.yml`). Nunca `git add -A` ni `git add .`.

## Guardianes del CI (correr local antes de pedir revisión)
Workflow: `.github/workflows/inv.yml` · check agregado: `inv-gate`.

| Comando (desde la raíz del repo) | Qué verifica |
|---|---|
| `bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.test.sh` | Que el candado de datos reales sigue mordiendo (prueba por mutación) |
| `git ls-files 008-2026-INVERSIONES \| bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.sh` | Que no hay extractos, exportaciones, capturas ni `.env` versionados |
| `bash 008-2026-INVERSIONES/scripts/ci/frontera-008.test.sh` | Que el candado de frontera sigue mordiendo (prueba por mutación) |
| `git diff --name-only origin/main...HEAD \| bash 008-2026-INVERSIONES/scripts/ci/frontera-008.sh` | Que la rama solo toca `008-2026-INVERSIONES/` e `inv.yml` (si toca algo más, ese PR lo mergea el CEO de PI) |

Cada SPEC que agregue código suma aquí sus guardianes (lint, tipos, pruebas) y su job en `inv.yml`, con `needs` en `inv-gate`.

## Datos (regla dura)
- **Los datos reales nunca entran al repo**: ni montos, ni cuentas, ni posiciones, ni extractos, ni capturas; tampoco en seeds, tests o fixtures. Viven solo en la base de datos del servidor y en sus secretos.
- Los datos de prueba son **inventados** y van en archivos marcados `.ficticio.` (ej. `tests/fixtures/ordenes.ficticio.csv`).

## ECC (D-010): metodología de 008
008 se construye con ECC (affaan-m/ECC v2.2.3): planear, diseñar, construir con pruebas primero, revisar y verificar con sus agentes y comandos. **Merge y despliegue autónomos (D-011):** el número de SPEC lo da el CEO; cada cambio entra por PR con CI verde y revisión adversarial de los agentes `code-reviewer` y `security-reviewer` de ECC, registrada en el PR. Si se cumple, ECC mergea (de a uno, nunca con `main` en rojo) y despliega. Los PR que tocan archivos fuera de `008-2026-INVERSIONES/` e `inv.yml` los mergea el CEO de PI. El CEO de 008 audita después de cada merge y puede ordenar detener.
- ECC está instalado solo en el clon de trabajo propio de 008, nunca a nivel global ni en la raíz de este repo ni en la de la gestión.
- Prohibido que ECC instale git hooks o toque `core.hooksPath` en este repo, o que escriba memoria o reglas en archivos compartidos.

## Cómo se cierra un cambio
PR con CI verde (`verificar_base`, `inv-gate` y los checks requeridos del repo) → revisión adversarial de ECC sobre la rama del PR → merge y despliegue por ECC (D-011) → auditoría del CEO de 008.

## Prohibido
- Secretos, datos personales, negocio o legal en el repo (es público).
- Cambios a mano sobre la base de producción.
- Tocar carpetas o workflows de otros productos.

---
> v1.4 · 2026-11-20 · CEO 008 · candado de frontera y workflow que no corre en PRs de PI (condiciones 5 y 6 del CEO de PI)
> v1.3 · 2026-11-20 · CEO 008 · merge y despliegue autónomos de ECC (D-011)
> v1.2 · 2026-11-20 · CEO 008 · ECC como metodología de 008 (D-010)
> v1.1 · 2026-11-20 · CEO 008 · stack definido (D-008): el de la fábrica, puertos 5438/5008
> v1.0 · 2026-11-20 · CEO 008 · creación desde la plantilla del manual 02
