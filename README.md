# productos

Monorepo oficial de **código** de los productos de IDC (Innovadataco). Repositorio
**público**: nunca negocio, legal, secretos ni datos personales. La gestión de proyectos
(actas, estado, decisiones) vive aparte, en `Innovadataco/Gestion-de-proyectos`.

## Estructura

Una carpeta por producto, `NNN-AAAA-<NOMBRE>`:

- `002-2026-PROTECCION-INFANTIL/` — Protección Infantil (PI): reportes comunitarios de
  riesgos para menores.
- `006-2026-BI-INTELIGENCIA-NEGOCIO/` — Inteligencia de Negocio (BI).
- `007-2026-PIWEB/` — sitio de marketing de PI (estático, HTML/CSS/JS).
- `008-2026-INVERSIONES/` — Inversiones (INV): seguimiento de portafolio, solo lectura.

Cada producto de código trae su propio `AGENTS.md` (002, 006, 008); 007 es estático
(solo `README.md`).

## Reglas de gobierno

Ramas, staging, metodología y los checks del ruleset «Gate CI - main» están en
**[`AGENTS.md`](AGENTS.md)** (fuente única, no se repiten aquí). En corto:

1. `main` es producción; todo entra por **PR** (prohibido commitear directo a `main`), con
   **CI verde + revisión adversarial**. El merge y el deploy los hace el CEO.
2. Rama desde `origin/main` en worktree propio: `work/<pi|bi|inv>-SPEC-<N>-<slug>`.
3. Staging solo de rutas de tu producto; nunca `git add -A` ni `git add .`.
4. Nunca subir secretos ni datos sensibles: solo variables de entorno.

**008 (INV):** PRs `work/inv-<slug>`; checks obligatorios `inv-gate` y `frontera-008-main`
(este encierra sus cambios dentro de `008-2026-INVERSIONES/`). Detalle y metodología ECC en
[`008-2026-INVERSIONES/AGENTS.md`](008-2026-INVERSIONES/AGENTS.md).

Metodología de PI y BI: manual 02 de ODIN (`Innovadataco/odin`) y el `AGENTS.md` de cada
producto.

---
> **📋 Control del documento** · v2.0 · 2026-11-20 · Autor: Dev 2 (PI) · SPEC-976 — README
> reescrito a la estructura real (4 productos `NNN-AAAA-*`); se retiran las dos carpetas
> ficticias que el texto anterior citaba y la regla derogada de validación por acta. Las reglas
> del repo quedan como fuente única en `AGENTS.md`. Versión anterior en el historial de git.
