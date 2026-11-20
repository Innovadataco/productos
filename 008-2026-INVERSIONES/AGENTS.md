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

Cada SPEC que agregue código suma aquí sus guardianes (lint, tipos, pruebas) y su job en `inv.yml`, con `needs` en `inv-gate`.

## Datos (regla dura)
- **Los datos reales nunca entran al repo**: ni montos, ni cuentas, ni posiciones, ni extractos, ni capturas; tampoco en seeds, tests o fixtures. Viven solo en la base de datos del servidor y en sus secretos.
- Los datos de prueba son **inventados** y van en archivos marcados `.ficticio.` (ej. `tests/fixtures/ordenes.ficticio.csv`).

## Piloto de ECC (affaan-m/ECC v2.2.3)
008 pilotea ECC como caja de herramientas dentro de las sesiones (planear, pruebas primero, revisar, verificar). **El manual 02 sigue mandando**: radicados, ramas, CI, revisión adversarial y merge por el CEO.
- ECC se instala solo en el clon de trabajo propio de 008, nunca a nivel global ni en la raíz de este repo ni en la de la gestión.
- Prohibido que ECC instale git hooks o toque `core.hooksPath` en este repo, o que escriba memoria o reglas en archivos compartidos.

## Cómo se cierra un cambio
PR con CI verde (`verificar_base`, `inv-gate` y los checks requeridos del repo) → revisión adversarial del CEO sobre la rama del PR → merge y despliegue por el CEO → certificación de Calidad.

## Prohibido
- Secretos, datos personales, negocio o legal en el repo (es público).
- Cambios a mano sobre la base de producción.
- Tocar carpetas o workflows de otros productos.

---
> v1.1 · 2026-11-20 · CEO 008 · stack definido (D-008): el de la fábrica, puertos 5438/5008
> v1.0 · 2026-11-20 · CEO 008 · creación desde la plantilla del manual 02
