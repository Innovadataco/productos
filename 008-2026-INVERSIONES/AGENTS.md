# AGENTS.md · 008 · INVERSIONES

Sistema personal de seguimiento de un portafolio de inversiones: importa las exportaciones de la casa de bolsa, calcula posiciones, costo, dividendos y rentabilidad (TWR), trae precios y envía reportes por Telegram y en una web con gráficas. Es de solo lectura: no opera ni guarda credenciales de plataformas de inversión.

## Stack (D-008, igual al de la fábrica)
- Web y API: Next.js (App Router) + React, Node 22 (fijar en `.nvmrc` y `engines`, igual que el CI).
- Datos: Prisma + PostgreSQL 16 en **contenedor propio** (`docker-compose.yml` del producto, sobre Colima). Puerto local **5438**.
- Tareas programadas (precios al cierre, valor del fondo, reporte diario): pg-boss sobre la misma PostgreSQL.
- Reportes: bot de Telegram.
- App local en el puerto **5008**. Producción: `docker-compose.prod.yml` (copiar repo + `.env` + `docker compose up`).
- **No crear otras bases de datos ni otros servicios** fuera del compose del producto.

## Cómo se trabaja: solo ECC (orden de Jelk, 2026-11-20)
008 se construye **solo con la metodología de ECC** (affaan-m/ECC v2.2.3). No hay SPEC numeradas ni radicados.
1. **PRD** (`/plan-prd`, en la gestión privada) → **`/plan`**.
2. **Orquestador** según el caso: `/orch-add-feature` (nuevo), `/orch-fix-defect` (defecto o hallazgo), `/orch-change-feature` (cambiar algo que funciona) o `/orch-refine-code` (refactor sin cambiar el comportamiento).
3. **Pasos completos:**
   - `planner` → `tdd-workflow` (prueba que falla primero) → implementación;
   - `code-reviewer` + `security-reviewer`, más `react-reviewer` o `database-reviewer` si aplica;
   - `verification-loop` → `/quality-gate` → PR → merge con CI en verde.
   - Si hay pantalla, `e2e-runner` con la app corriendo.
4. **Cada PR** lleva una sección **«ECC usado»** con los comandos, skills y agentes que corrieron.
5. **Ramas y staging:**
   - Rama `work/inv-<nombre-corto>` desde `origin/main`, en worktree propio. Base del PR: `main`.
   - Varios frentes en paralelo, cada uno en su worktree y sin tocar los mismos archivos. Merge de a uno.
   - Staging solo de rutas de `008-2026-INVERSIONES/`. Nunca `git add -A` ni `git add .`.

## Guardianes del CI (correr local antes de pedir revisión)
Workflow: `.github/workflows/inv.yml` · check agregado: `inv-gate`.

| Comando (desde la raíz del repo) | Qué verifica |
|---|---|
| `bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.test.sh` | Que el candado de datos reales sigue mordiendo (prueba por mutación) |
| `bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.sh` | Que no hay extractos, exportaciones, capturas, bases, comprimidos, claves ni `.env` versionados (lee las rutas crudas con `-z`, también con tildes) |
| `bash 008-2026-INVERSIONES/scripts/ci/frontera-008.test.sh` | Que el candado de frontera sigue mordiendo (prueba por mutación) |
| `bash 008-2026-INVERSIONES/scripts/ci/frontera-008.sh origin/main` | Que la rama solo toca `008-2026-INVERSIONES/` e `inv.yml`, contando un renombre como borrado + alta (si toca algo más, ese PR lo mergea el CEO de PI) |

**App**, desde `008-2026-INVERSIONES/` con Node 22 (`.nvmrc`) y `npm ci`:

| Comando | Qué verifica |
|---|---|
| `npm run typecheck` | Tipos de TypeScript (`next typegen` y `tsc --noEmit`, modo estricto; `next-env.d.ts` se genera, no se versiona) |
| `npm test` | Pruebas unitarias, incluidos los candados del esquema (sin `Float`, dinero en `Decimal`, acciones en `BigInt`, trazabilidad, sin archivo original) y de infraestructura (un solo servicio, base en el 5438, app en el 5008) |
| `npm run db:up && npm run test:integracion` | Integración contra la base `inversiones_test` del compose: reinicia esa base con las migraciones y verifica que existan y muerdan los CHECK, los índices parciales, la exclusión de vigencias y la regla de solo inserción. Se niega a correr si la base no termina en `_test` |
| `npm run build` | Que la app compila (`next build`) |
| `npm run importar:trii -- --email <correo> <archivos.csv>` | Carga local de los CSV de Trii. Solo para datos del dueño en su base; en el repo, solo fixtures `.ficticio.csv` |
| `npm run escision:registrar -- --origen <NEMO> --destino <NEMO> --fecha AAAA-MM-DD …` | Registro local de eventos de escisión, antes de cargar dividendos. Datos reales: solo en la base del dueño |
| `npm run lotes:construir` · `npm run lote:escision -- …` | Lotes desde las órdenes, ventas FIFO y lote de escisión con costo del portal. Datos reales: solo en la base del dueño |
| `npm run precios:actualizar [-- --desde …]` | Cierres diarios de Yahoo `.CL`, versionados y verificados contra la certificación. Consulta un servicio externo con los símbolos del portafolio: solo desde la máquina del dueño o el servidor |

Cada cambio que agregue código suma aquí sus guardianes y su job en `inv.yml`, con `needs` en `inv-gate`. `inv.yml` está fuera de la zona de ECC: ese cableado va en un PR aparte que mergea el CEO de PI.

**Migraciones:** créelas con `npx prisma migrate dev --create-only` y revise el SQL antes de aplicarlas. La migración inicial trae reglas escritas a mano (CHECK, índices parciales, exclusión y disparadores de solo inserción) que Prisma no conoce; si una migración nueva las borra, `npm run test:integracion` se pone rojo.

## Datos (regla dura)
- **Los datos reales nunca entran al repo**: ni montos, ni cuentas, ni posiciones, ni extractos, ni capturas; tampoco en seeds, tests o fixtures. Viven solo en la base de datos del servidor y en sus secretos.
- Los datos de prueba son **inventados** y van en archivos marcados `.ficticio.` (ej. `tests/fixtures/ordenes.ficticio.csv`).

## ECC: instalación y merge autónomo
**Merge y despliegue autónomos (D-011).** Cada cambio entra por PR con CI verde y con la revisión de `code-reviewer` y `security-reviewer` registrada en el PR.
- Si se cumple, ECC mergea (de a uno, nunca con `main` en rojo) y despliega.
- Los PR que tocan archivos fuera de `008-2026-INVERSIONES/` los mergea el CEO de PI.
- El CEO de 008 audita después de cada merge y puede ordenar detener.
- ECC está instalado solo en el clon de trabajo propio de 008, nunca a nivel global ni en la raíz de este repo ni en la de la gestión.
- El CLI de ECC (`ecc.js install`) escribe su base de estado en `$HOME/.claude/ecc/state.db`. Se corre con `HOME` apuntando al clon y primero con `--dry-run`.
- Prohibido que ECC instale git hooks o toque `core.hooksPath` en este repo, o que escriba memoria o reglas en archivos compartidos.

## Frontera de 008 y su límite
- **Zona de ECC:** `008-2026-INVERSIONES/**` y nada más. El check `frontera-008-main` (`.github/workflows/inv-frontera.yml`, con `pull_request_target`) lo toma GitHub **siempre de `main`**, así que un PR no lo puede aflojar. Cualquier cambio fuera de la zona, incluidos `inv.yml` e `inv-frontera.yml`, da rojo, y ese PR lo revisa y lo mergea el CEO de PI.
- **Checks obligatorios (2026-11-20):** el ruleset «Gate CI - main» exige `verificar_base`, `pi-gate`, `bi-gate`, **`inv-gate`** y **`frontera-008-main`**, y que todo entre por PR. Si la frontera o las pruebas de 008 dan rojo, GitHub bloquea el merge. En los PR de PI esos dos checks salen «skipped» y no los frenan.
- **Límite conocido:** la frontera se activa por el **nombre** de la rama (`work/inv-*`). Protege de **errores** de ECC, no de un ECC que use otra rama. Por eso la regla de ECC también es parte de la barrera: **solo ramas `work/inv-<nombre-corto>`.**
- **Cambios de 008 en `.github` (raros):** los hace el **CEO de 008**, no ECC, en una rama **`work/pi-*`** de PI (allí `frontera-008-main` se omite), y los revisa y mergea el **CEO de PI**. ECC no abre ramas `work/pi-*`.

## Cómo se cierra un cambio
1. Orquestador de ECC completo con «ECC usado» en el PR.
2. CI en verde: los 5 checks obligatorios del repo.
3. Merge y despliegue por ECC (D-011).
4. `ESTADO.md` de la gestión al día.
5. Auditoría del CEO de 008.

## Prohibido
- Secretos, datos personales, negocio o legal en el repo (es público).
- Cambios a mano sobre la base de producción.
- Tocar carpetas o workflows de otros productos.

---
> v1.12 · 2026-11-20 · 21:16 (-05) · INV · Fábrica ECC · solo ECC por orden de Jelk: sin SPEC, radicados ni manual 02; ramas `work/inv-<nombre-corto>`; «ECC usado» en cada PR
> v1.11 · 2026-11-20 · 19:39 (-05) · INV · Fábrica ECC · INV-SPEC-13: precios de Yahoo
> v1.10 · 2026-11-20 · 19:22 (-05) · INV · Fábrica ECC · INV-SPEC-12: lotes, FIFO y lote de escisión
> v1.9 · 2026-11-20 · 18:35 (-05) · INV · Fábrica ECC · INV-SPEC-10: comando de eventos de escisión
> v1.8 · 2026-11-20 · 18:04 (-05) · INV · Fábrica ECC · INV-SPEC-8: comando de importación de Trii
> v1.7 · 2026-11-20 · 17:22 (-05) · INV · Fábrica ECC · INV-SPEC-5: guardianes de la app (tipos, pruebas unitarias e integración, build) y regla de migraciones
> v1.6 · 2026-11-20 · ≈17:16 (-05) · INV · Fábrica ECC · INV-SPEC-4: candados de punta a punta (rutas crudas con `-z`, frontera sin renombres, más extensiones y claves)
> v1.5 · 2026-11-20 · CEO 008 · frontera desde main (INV-SPEC-3) y su límite conocido
> v1.4 · 2026-11-20 · CEO 008 · candado de frontera y workflow que no corre en PRs de PI (condiciones 5 y 6 del CEO de PI)
> v1.6 · 2026-11-20 · CEO 008 · inv-gate y frontera-008-main obligatorios; procedimiento para cambios de 008 en .github (INV-SPEC-13)
> v1.3 · 2026-11-20 · CEO 008 · merge y despliegue autónomos de ECC (D-011)
> v1.2 · 2026-11-20 · CEO 008 · ECC como metodología de 008 (D-010)
> v1.1 · 2026-11-20 · CEO 008 · stack definido (D-008): el de la fábrica, puertos 5438/5008
> v1.0 · 2026-11-20 · CEO 008 · creación desde la plantilla del manual 02
