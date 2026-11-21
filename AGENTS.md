# AGENTS.md — productos

Monorepo oficial de **código** de los productos de IDC (Innovadataco). Repositorio
**público**: nunca negocio, legal, secretos ni datos personales. La gestión de
proyectos (actas, estado, decisiones) vive aparte, en `Innovadataco/Gestion-de-proyectos`.

Este archivo cubre solo **lo común del repo**. El detalle de cada producto manda en su
propio `AGENTS.md`.

## Estructura

Una carpeta por producto, `NNN-AAAA-<NOMBRE>`:

- `002-2026-PROTECCION-INFANTIL/` — Protección Infantil (PI): reportes comunitarios de
  riesgos para menores. Next.js + Prisma + PostgreSQL. Con `AGENTS.md`.
- `006-2026-BI-INTELIGENCIA-NEGOCIO/` — Inteligencia de Negocio (BI). Con `AGENTS.md`.
- `007-2026-PIWEB/` — sitio de marketing de PI, **estático** (HTML/CSS/JS, sin build ni
  backend). Solo `README.md`; no entra en el ruleset de CI.
- `008-2026-INVERSIONES/` — Inversiones (INV): seguimiento de portafolio, solo lectura.
  Con `AGENTS.md`. Metodología ECC (ver abajo).

Además: `mockups/` (prototipos) y `.github/workflows/` (CI).

## Ramas (INQUEBRANTABLE)

- **`main`** es la rama canónica y de producción. **Prohibido commitear directo a `main`**:
  todo entra por PR.
- Rama de trabajo **desde `origin/main` fresco**, en un **worktree propio**:
  - PI, BI e INV con SPEC numerada: `work/<pi|bi|inv>-SPEC-<N>-<slug>` (N entero, sin letras).
  - 008 (INV) con metodología ECC, sin SPEC: `work/inv-<slug>`.
- El check `verificar_base` (`.github/workflows/verificar-base-pr.yml`) rechaza cualquier PR
  cuya base no sea `main` o cuya rama no cumpla esta convención. La regex viva está en ese
  workflow.

## Staging (INQUEBRANTABLE)

Cada frente stagea **solo rutas de su producto** (p. ej.
`git add 002-2026-PROTECCION-INFANTIL/...`). **Prohibido `git add -A` y `git add .`**: varios
frentes comparten el repo, y un staging global arrastra el trabajo de otro y arruina la
trazabilidad del commit.

## Merge y CI

El **merge y el deploy los hace el CEO**, de a uno, dejando `main` en verde; nunca se mergea
con el CI de `main` en rojo. Un PR entra con **CI verde + revisión adversarial**.

Checks exigidos por el ruleset **«Gate CI - main»** en todo PR a `main`:

| Check | Workflow | Cubre |
|---|---|---|
| `verificar_base` | `verificar-base-pr.yml` | Base `main` + convención de rama |
| `pi-gate` | `ci.yml` | 002 · Protección Infantil |
| `bi-gate` | `bi.yml` | 006 · BI |
| `inv-gate` | `inv.yml` | 008 · Inversiones |
| `frontera-008-main` | `inv-frontera.yml` | Encierra los PR `work/inv-` dentro de `008-2026-INVERSIONES/` (corre sobre `main` con `pull_request_target`, no desde la rama del PR) |

## Metodología

- **PI (002) y BI (006):** manual 02 de ODIN — repo `Innovadataco/odin`,
  `manuales-operativos/02-metodologia-desarrollo/`. Flujo: radicado del CEO (con el número de
  SPEC) → rama → PR con **candado que muere con el defecto** → revisión adversarial → el CEO
  mergea y despliega. Lo propio de PI vive en `Gestion-de-proyectos` (`EQUIPO/PROMPT-*.md`) y
  en `002-2026-PROTECCION-INFANTIL/AGENTS.md`.
- **008 (INV):** metodología **ECC** (affaan-m/ECC), sin SPEC ni radicados. Ver
  `008-2026-INVERSIONES/AGENTS.md`.

## Secretos

Nunca en el código ni en el chat: solo por variables de entorno (dev en la máquina, prod en
el VPS) y en el gestor de contraseñas. Si una clave se expone, se rota de inmediato.

---
> **📋 Control del documento** · v2.0 · 2026-11-20 · Autor: Dev 2 (PI) · SPEC-976 — reescrito a
> la estructura real: 4 productos `NNN-AAAA-*` (se retiran dos carpetas ficticias que el texto
> anterior citaba y que no existen en el repo); ramas pi/bi/inv + 008 ECC; ruleset «Gate CI -
> main»; metodología = manual 02 / ECC. Se retiran las «5 reglas de oro» (derogadas) y la
> referencia a la gestión como metodología del repo. Candado:
> `002-2026-PROTECCION-INFANTIL/scripts/ci/agents-raiz.candado.test.ts`.
> La versión anterior queda en el historial de git.
