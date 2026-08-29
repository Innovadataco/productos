# Feature Specification: Fix sentinel CI cross-producto (SPEC-300)

**Feature Branch**: `work/pi-SPEC-300-fix-sentinel-cross-producto`
**SPEC**: 300
**Created**: 2026-08-29
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-205-FIX-SENTINEL-CROSS-PRODUCTO · SPEC-299/A-49 · Ruleset "Gate CI - main"

Impacto en arquitectura: cambio solamente sobre `.github/workflows/ci.yml` y `.github/workflows/bi.yml`. Los names literales `pi-gate` y `bi-gate` (referenciados por el ruleset "Gate CI - main" en GitHub) se conservan **byte-a-byte**. Ambos workflows arrancan en TODOS los PR contra `main`: en `ci.yml` se elimina el filtro `paths:` de los eventos `push`/`pull_request` (el job `should-skip` existente sigue vigilando y hace que los jobs pesados queden `skipped` cuando el PR no toca `002-2026-PROTECCION-INFANTIL/**`); en `bi.yml` se elimina el filtro `paths:` equivalente y se añade un job `should-skip` análogo al de PI que hace saltar los jobs pesados (`verify`/`typecheck`/`test-unit`/`build`) cuando el PR no toca `005-2026-BI-INTELIGENCIA-NEGOCIO/**`. `bi-gate` incorpora `should-skip` a sus `needs:` conservando `if: always()`. Cero impacto en `src/**`, Prisma, DAL, proxy, navegación, `docs/architecture/**` o `arch:check`. No toca `scripts/deploy-prod.sh` ni `verificar-base-pr.yml`. Alternativa B (nuevo `.github/workflows/gates.yml` con polling `gh api`) queda como fallback si Opción A muestra un edge case durante `/speckit-plan`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — PR que solo toca BI ya no bloquea el ruleset (Priority: P1)

Un desarrollador BI abre un PR contra `main` que modifica únicamente archivos bajo `005-2026-BI-INTELIGENCIA-NEGOCIO/**` (típico de Vanna PR #137). Hoy: el workflow `ci.yml` NO arranca porque su `paths:` filtra por `002-2026-PROTECCION-INFANTIL/**` → el check `pi-gate` nunca aparece → el ruleset "Gate CI - main" queda `expected but not seen` → Jelkin tuvo que sacar `bi-gate` de required para poder mergear. Después del fix: `ci.yml` arranca en cualquier PR contra `main`, el job `should-skip` detecta que no hay archivos PI tocados, todos los jobs pesados quedan `skipped`, y `pi-gate` reporta verde trivial en < 60 s. El PR queda mergeable con el ruleset completo.

**Why this priority**: Es el bloqueo real HOY. BI perdió su compuerta de calidad porque Jelkin quitó `bi-gate` de la lista required para desbloquear Vanna. Sin este fix no se puede restaurar el ruleset completo sin volver a bloquear BI.

**Independent Test**: Abrir un PR contra `main` con un cambio de un espacio en `README.md` de la raíz (sin tocar `002-*` ni `005-*`). Verificar en `gh pr checks`: aparecen `pi-gate` y `bi-gate` (ambos serán verdes triviales — cubre US1 y US2 en la misma corrida).

**Acceptance Scenarios**:

1. **Given** un PR contra `main` que solo modifica archivos bajo `005-2026-BI-INTELIGENCIA-NEGOCIO/**`, **When** GitHub evalúa los checks del PR, **Then** aparece un check con name exacto `pi-gate` reportando `success` en menos de 60 segundos.
2. **Given** el mismo PR, **When** el ruleset "Gate CI - main" evalúa los required checks, **Then** el estado del PR es "All checks passed" y el PR es mergeable sin intervención humana en la config del ruleset.
3. **Given** el mismo PR, **When** se inspecciona el run de `ci.yml`, **Then** los jobs `verificaciones`, `test-unit`, `test-integration`, `test-integration-coverage`, `journeys` y `build` reportan `skipped` (no `failure`).

---

### User Story 2 — PR que solo toca PI ya no bloquea el ruleset (Priority: P1)

Un desarrollador PI abre un PR contra `main` que modifica únicamente archivos bajo `002-2026-PROTECCION-INFANTIL/**` (típico de las specs recientes, p.ej. SPEC-298). Hoy: si Jelkin restaurara `bi-gate` como required, `bi.yml` NO arrancaría porque filtra por `005-2026-BI-INTELIGENCIA-NEGOCIO/**` → el check `bi-gate` no aparecería → el ruleset quedaría indefinido en el sentido opuesto al US1. Después del fix: `bi.yml` arranca en cualquier PR contra `main`, el nuevo job `should-skip` detecta que no hay archivos BI tocados, los jobs `verify`/`typecheck`/`test-unit`/`build` quedan `skipped`, y `bi-gate` reporta verde trivial.

**Why this priority**: Simétrico a US1. Sin esta pieza el ruleset queda estable "en una dirección" pero se rompe cuando se restaura `bi-gate` como required, que es exactamente lo que se hará post-fix. US1 y US2 son las dos caras del mismo bug y ambas deben cerrar antes de que Jelkin restaure el ruleset completo.

**Independent Test**: Abrir un PR contra `main` con un cambio trivial en `002-2026-PROTECCION-INFANTIL/AGENTS.md` (p.ej. un espacio extra). Verificar en `gh pr checks`: aparece `bi-gate` reportando `success` en menos de 60 segundos, y los jobs de `bi.yml` `verify`/`typecheck`/`test-unit`/`build` aparecen `skipped`.

**Acceptance Scenarios**:

1. **Given** un PR contra `main` que solo modifica archivos bajo `002-2026-PROTECCION-INFANTIL/**`, **When** GitHub evalúa los checks del PR, **Then** aparece un check con name exacto `bi-gate` reportando `success` en menos de 60 segundos.
2. **Given** el mismo PR, **When** se inspecciona el run de `bi.yml`, **Then** los jobs `verify`, `typecheck`, `test-unit` y `build` reportan `skipped` (no `failure`).
3. **Given** el mismo PR, **When** el ruleset "Gate CI - main" (con `bi-gate` restaurado como required) evalúa los required checks, **Then** el PR es mergeable sin intervención humana.

---

### User Story 3 — PR cross-producto ejecuta ambos pipelines completos (Priority: P2)

Un desarrollador abre un PR contra `main` que toca simultáneamente archivos de PI y de BI (p.ej. una refactorización compartida en `.github/workflows/**` o una convención transversal). Antes del fix este caso ya funcionaba porque ambos `paths:` matcheaban. Después del fix debe seguir funcionando: ambos workflows arrancan, ambos `should-skip` reportan `false`, los jobs pesados de ambos productos corren, y los dos gates reportan según el veredicto real (fallando si alguno de sus jobs falló).

**Why this priority**: Regresión previsible. El fix cambia el trigger de los workflows, y si el nuevo `should-skip` de BI está mal escrito puede saltar todo aunque el PR sí toque paths BI, dejando pasar código roto. Necesario cubrir para no cambiar un bug por otro.

**Independent Test**: Abrir un PR contra `main` con un cambio simultáneo en `002-2026-PROTECCION-INFANTIL/AGENTS.md` y en `005-2026-BI-INTELIGENCIA-NEGOCIO/README.md` (o su equivalente). Verificar que ambos `should-skip` reportan `skip=false` y que los jobs pesados de ambos workflows corren.

**Acceptance Scenarios**:

1. **Given** un PR contra `main` que toca archivos bajo AMBOS productos, **When** los workflows arrancan, **Then** `should-skip` de `ci.yml` reporta `skip=false` y `should-skip` de `bi.yml` reporta `skip=false`.
2. **Given** el mismo PR, **When** se inspecciona el run de `ci.yml`, **Then** los jobs pesados (`verificaciones`, `test-unit`, etc.) corren; **And** en `bi.yml` los jobs `verify`/`typecheck`/`test-unit`/`build` corren.
3. **Given** el mismo PR con un fallo real inyectado en el producto BI, **When** los workflows completan, **Then** `bi-gate` reporta `failure` y `pi-gate` reporta `success` (o viceversa si el fallo está en PI).

---

### Edge Cases

- **PR que solo toca `.github/workflows/**`**: el filtro `paths` actual ya incluye `.github/workflows/**` en ambos workflows, así que este caso ya funcionaba. Tras el fix ambos workflows arrancan igual (el filtro se elimina completo, no se sustituye). `should-skip` de PI usa un grep que hoy trata cualquier archivo fuera de `002-*/docs|specs` y no-`.md` como "code file"; un cambio en `.github/workflows/**` NO matchea el filtro de exclusión y por tanto `skip=false` en PI (jobs pesados corren) — comportamiento actual que se conserva. En BI el nuevo `should-skip` debe adoptar la misma lógica exacta: cambios en `.github/workflows/**` deben marcarse como `skip=false` en BI también.
- **PR que solo toca `002-2026-PROTECCION-INFANTIL/docs/**` o `002-*/specs/**` o cualquier `*.md`**: hoy `ci.yml` arranca porque matchea el `paths:` de `002-*/**`, y `should-skip` de PI reporta `skip=true` → jobs pesados quedan `skipped`, `pi-gate` reporta `success` trivial. Tras el fix `ci.yml` arranca igual (por el trigger sin filtro), `should-skip` se comporta idéntico. **Sin cambio.**
- **PR base `feature/001-scaffolding` (no `main`)**: el trigger `push` de `ci.yml` matchea solo `branches: [feature/001-scaffolding]`, y el trigger `pull_request` no filtra por base. Tras el fix `pull_request` cubre TODOS los PR (contra `main`, contra `feature/001-scaffolding`, etc.). Aceptable — no hay ruleset en ramas distintas de `main` (verificar).
- **PR que borra todos los archivos del producto contrario**: `should-skip` calcula `git diff --name-only HEAD^ HEAD`; un archivo borrado aparece en el diff → `skip=false` en el producto tocado. El gate del producto tocado corre completo. Comportamiento esperado.
- **`should-skip` corre `git diff HEAD^ HEAD`, pero `actions/checkout@v4` clona con `fetch-depth: 2`**: la fórmula funciona en PR merge commits pero se rompe si el PR tiene commits force-push o rebase durante la vida del PR. Ya es un limitación pre-existente del `should-skip` de PI; el fix lo hereda para BI. Documentar riesgo residual.
- **Runtime > 60 s del gate trivial**: si `should-skip` mismo tarda > 60 s (por ejemplo `actions/checkout` lento), el objetivo de SC-001 se degrada. Aceptable si sigue < 3 min (tiempo actual del check trivial de PI).
- **Ruleset "Gate CI - main" no tiene `bi-gate` como required durante la ventana pre-merge**: verificado — Jelkin lo sacó temporalmente. El test acid US1 pasa igual porque `pi-gate` sí es required. Jelkin restaura `bi-gate` después del CUMPLE (fuera de alcance del fix).
- **Nombres del ruleset case-sensitive**: GitHub matchea check names case-sensitive. `pi-gate` y `bi-gate` son minúsculas — cualquier cambio a `Pi-Gate` o similar rompe el ruleset. Candado dura del PR.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El workflow `.github/workflows/ci.yml` DEBE arrancar en **todo** `pull_request` cuya base sea `main` (o cualquier rama), sin filtrar por `paths:`. El bloque `on.push` conserva su comportamiento actual (`branches: [feature/001-scaffolding]`) pero también DEBE quitar el filtro `paths:` para que los merges directos al scaffolding sigan protegidos por `pi-gate`.
- **FR-002**: El workflow `.github/workflows/bi.yml` DEBE arrancar en **todo** `pull_request` (contra `main` u otra base) y en **todo** `push` que ya cubriera antes, sin filtrar por `paths:`.
- **FR-003**: El job `should-skip` existente en `ci.yml` DEBE conservar exactamente su lógica actual: `skip=true` si y solo si NO existen archivos tocados fuera del set `(^002-2026-PROTECCION-INFANTIL/(docs|specs)/|^docs/|^specs/|\.md$)`. Ningún otro cambio.
- **FR-004**: `bi.yml` DEBE incorporar un job `should-skip` **nuevo** con estructura idéntica al de `ci.yml`, adaptado al producto BI: `skip=true` si y solo si NO existen archivos tocados fuera del set `(^005-2026-BI-INTELIGENCIA-NEGOCIO/(docs|specs)/|^docs/|^specs/|\.md$)`. Debe declarar el `output` `skip` para consumo por los jobs siguientes.
- **FR-005**: Los jobs pesados de `bi.yml` (`verify`, `typecheck`, `test-unit`, `build`) DEBEN incorporar en su encabezado `needs:` la referencia a `should-skip` y agregar el gate `if: needs.should-skip.outputs.skip != 'true'`. La cadena de dependencias `needs:` interna entre esos jobs se conserva (p.ej. `typecheck` sigue `needs: verify`, etc.), solo se agrega `should-skip` como dependencia adicional donde falte.
- **FR-006**: El job `bi-gate` DEBE agregar `should-skip` a su lista `needs:` y conservar `if: always()`. Su cuerpo DEBE seguir evaluando `contains(needs.*.result, 'failure')` / `contains(needs.*.result, 'cancelled')` — sin cambios de lógica. Un `should-skip` con `result: success` cuando `skip=true` NO debe convertirse en `failure`.
- **FR-007**: El **name** literal del job `pi-gate` en `ci.yml` DEBE quedar exactamente `pi-gate` (byte-a-byte). El **name** literal del job `bi-gate` en `bi.yml` DEBE quedar exactamente `bi-gate` (byte-a-byte). Cualquier renombramiento rompe el ruleset "Gate CI - main".
- **FR-008**: El fix NO DEBE tocar `scripts/deploy-prod.sh`, `.github/workflows/verificar-base-pr.yml`, `src/**`, `prisma/**`, ni ningún archivo fuera de `.github/workflows/ci.yml`, `.github/workflows/bi.yml`, `002-2026-PROTECCION-INFANTIL/specs/300-*/**` y `002-2026-PROTECCION-INFANTIL/specs/README.md` (para la fila índice).
- **FR-009**: El check `pi-gate` para un PR que no toca `002-2026-PROTECCION-INFANTIL/**` DEBE reportar `success` sin ejecutar los jobs pesados. Idem `bi-gate` para un PR que no toca `005-2026-BI-INTELIGENCIA-NEGOCIO/**`.
- **FR-010**: Los ratchets existentes de BI (`verify`) DEBEN seguir corriendo cuando el PR SÍ toca `005-2026-BI-INTELIGENCIA-NEGOCIO/**`. `should-skip` es una compuerta, no un reemplazo de los ratchets.
- **FR-011**: Si el enfoque Opción A demostrara durante `/speckit-plan` un edge case bloqueante (p. ej. imposibilidad de agregar `should-skip` a BI sin romper la cadena `needs:` interna), el fix DEBE pivotar a Opción B (nuevo `.github/workflows/gates.yml`) preservando FR-007 y FR-008. La decisión A/B y su justificación quedan registradas en `plan.md`.

### Key Entities

- **Workflow `ci.yml`**: dispara CI de Protección Infantil. Contiene los jobs `should-skip`, `verificaciones`, `test-unit`, `test-integration`, `test-integration-coverage`, `journeys`, `build`, `pi-gate`. Este fix modifica su bloque `on:` (elimina `paths:`) y NO toca ningún job.
- **Workflow `bi.yml`**: dispara CI de Business Intelligence. Contiene los jobs `verify`, `typecheck`, `test-unit`, `build`, `bi-gate`. Este fix modifica su bloque `on:` (elimina `paths:`), añade un job `should-skip` nuevo, agrega `needs: [should-skip]` + `if: needs.should-skip.outputs.skip != 'true'` a los jobs pesados, y añade `should-skip` a `needs:` de `bi-gate`.
- **Ruleset "Gate CI - main"** (GitHub Settings, gestionado por Jelkin, fuera del repo): lista los required checks bloqueantes para PRs contra `main`. Referencia `pi-gate` y `bi-gate` por name literal. Este fix NO modifica el ruleset — su restauración con `bi-gate` como required es responsabilidad de Jelkin post-CUMPLE.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para un PR contra `main` que NO toca ni `002-2026-PROTECCION-INFANTIL/**` ni `005-2026-BI-INTELIGENCIA-NEGOCIO/**` (p.ej. cambio en README raíz), ambos checks `pi-gate` y `bi-gate` reportan `success` en **menos de 90 segundos** desde que el PR queda abierto. Medido en el "Checks" tab de GitHub, sin retries.
- **SC-002**: Para un PR contra `main` que toca únicamente `005-2026-BI-INTELIGENCIA-NEGOCIO/**`, el check `pi-gate` reporta `success` con TODOS los jobs `needs:` de `pi-gate` (excepto `should-skip`) en estado `skipped`. Verificable en el JSON de `gh api /repos/:owner/:repo/actions/runs/:id/jobs`.
- **SC-003**: Para un PR contra `main` que toca únicamente `002-2026-PROTECCION-INFANTIL/**`, el check `bi-gate` reporta `success` con TODOS los jobs `needs:` de `bi-gate` (excepto `should-skip`) en estado `skipped`. Verificable en el JSON de `gh api`.
- **SC-004**: Para un PR contra `main` que toca AMBOS productos con un fallo real inyectado en uno de ellos, el gate del producto con el fallo reporta `failure` y el gate del otro producto reporta según su propio veredicto (usualmente `success`). Cero falsos positivos ni falsos negativos.
- **SC-005**: Post-CUMPLE, Jelkin restaura `bi-gate` como required en el ruleset "Gate CI - main" y un PR nuevo cualquiera contra `main` (BI, PI, doc-only o cross) queda mergeable sin intervención manual en la config del ruleset por al menos **7 días consecutivos** de operación. (Verificado por Fábrica en el reporte de cierre semanal.)
- **SC-006**: Cero regresiones en el runtime **P95** del CI de PI para PRs que sí tocan `002-*` (comparado con la última semana pre-fix). Medido con `gh api` sobre los últimos 20 runs de `ci.yml` que corrieron con `should-skip=false`, antes y después del merge.
- **SC-007**: Cero regresiones en el runtime **P95** del CI de BI para PRs que sí tocan `005-*` (comparado con la última semana pre-fix). Mismo criterio que SC-006 pero sobre `bi.yml`.

---

## Assumptions

- El ruleset "Gate CI - main" matchea check names en modo case-sensitive y exact-match, no por regex. (Comportamiento documentado de GitHub Branch Protection Rulesets.)
- `contains(needs.*.result, 'success')` acepta jobs `skipped` como no-falla — GitHub Actions evalúa `skipped` como distinto de `success`/`failure`/`cancelled`, y `contains(...,'failure')` == false cuando todos los needs están en `skipped`. Esto es lo que hoy hace funcionar el gate trivial verde de PI y se hereda para BI.
- `actions/checkout@v4` con `fetch-depth: 2` sigue siendo suficiente para que `git diff HEAD^ HEAD` reporte el diff del PR (comportamiento actual del `should-skip` de PI). Riesgo residual con force-pushes documentado en Edge Cases.
- El worktree de trabajo parte de `origin/main @ 53398327e` (contiene el merge de PR #138 SPEC-251 · commit `d3a62e561` de SPEC-251 previo). La base garantiza que `pi-gate` y su `should-skip` ya existen tal como están descritos.
- El equipo BI no tiene compuertas adicionales en `bi.yml` fuera de `verify`/`typecheck`/`test-unit`/`build` (verificado en la lectura de `bi.yml`).
- La restauración de `bi-gate` como required en el ruleset la hace Jelkin manualmente en la UI de GitHub Settings tras el CUMPLE. NO es tarea del fix.
- Los PRs actualmente abiertos (Vanna PR #137, Dashboards PR #136) se re-run tras el merge del fix y deberían mergear limpios sin cambios en su código. Verificable por Fábrica post-merge; fuera del alcance de esta spec.
