# SPEC-803 · Los docs generados globales (00/01/06) salen del gate byte-exacto del PR

**Feature Branch**: `work/pi-SPEC-803-docs-generados-fuera-del-gate`
**Created**: 2026-09-30
**Status**: DESARROLLO
**Base**: `main`

## Contexto

`docs/architecture/00-INDICE.md`, `01-modelo-datos.md` y `06-stack.md` se verificaban **byte-exactos**
en cada PR (`arch:check (a)`, SPEC-126). Eso obliga a cada PR a cargar una **foto del estado GLOBAL**
dentro de un cambio local — y las fotos no componen: el 30-09, mergear cinco PRs en ráfaga (tres de
schema) dejó `main` ROJO con el `01` describiendo un modelo que ya no era el de `main`, y tres PRs
heredaron el rojo. Es la cadena de uno-a-la-vez + un rebase por Dev por cada merge ajeno.

## Decisión · extender a 00/01/06 el tratamiento que SPEC-487 dio a 02/03

El precedente ya vive en el repo: `02-roles-capacidades.md` y `03-pantallas.md` salieron del gate
byte-exacto (el PR verifica REPRESENTABILIDAD, no `committed == regen`) y los regenera el barrido
post-merge. Esta spec aplica lo MISMO a 00/01/06, por otra razón (aquéllos por orden de filas; éstos
por ser una foto global).

- **Gate del PR (arch:check (a)):** marca `fueraDelGatePorPR` en 00/01/06. El generador SIGUE
  corriendo (REPRESENTABILIDAD — si no puede representar la fuente, es rojo); NO se compara byte a
  byte contra lo commiteado.
- **Post-merge (`generados-post-merge.yml`):** regenera también 00/01/06 sobre `main` y los incluye en
  los ARCHIVOS que detecta/commitea; si driftearon, el bot pushea la rama y el operador abre el PR.

## La TENSIÓN, dicha de frente (no escondida)

Se cambia «el doc está **exacto** en cada PR» por «está al día **eventualmente** (tras el merge)».
**Decidido: vale la pena.** Nadie lee ese documento durante la revisión de un PR, y el costo actual es
un `main` roto por cada ráfaga de merges de schema más un rebase por Dev por merge ajeno. No se perdió
una verificación por descuido: **se cambió a propósito, y se ganó que `main` no se rompa.**

## Candados

- **El gate NO se quita, cambia de pregunta** (candado #1): `docs-globales-fuera-del-gate.candado.test.ts`
  afirma que `verificarDrift` SIGUE corriendo el generador ANTES del salto (si alguien hiciera que el
  flag saltara también el generador, el gate quedaría ciego → rojo). Más: 00/01/06 marcados
  `fueraDelGatePorPR`, y el post-merge los regenera+commitea.
- **Control positivo (operacional, verificado):** con el `01` drifteado a mano, `arch:check` sigue
  VERDE (representabilidad tolera el drift) **y** la regeneración (sim post-merge) detecta/arregla el
  drift. Las dos mitades.
- FUERA de alcance: `modulos-huerfanos-allowlist.json` (misma forma pero se resuelve por UNIÓN, no
  regeneración — otra ficha).

## Impacto en arquitectura:

- **Esquema / proxy / navegación / datos:** SIN cambios. NO se edita el contenido de 00/01/06.
- **Gate (arch:check):** 00/01/06 pasan de byte-exacto a representabilidad (nuevo flag
  `fueraDelGatePorPR` en `artefactos.ts`; `verificarDrift` lo respeta tras correr el generador).
- **CI:** `generados-post-merge.yml` regenera y commitea también 00/01/06; nuevo candado en el carril
  `test:unit` (corre y bloquea vía `pi-gate`).
