# Feature Specification: Sentinels CI multi-producto

**Feature Branch**: `work/pi-SPEC-299-sentinels-ci-multi-producto`

**Created**: 2026-08-28

**Status**: `DESARROLLO`

**Impacto en arquitectura:** sin impacto estructural sobre el código de producto — el cambio es puramente infra de GitHub Actions bajo `.github/workflows/`. No toca `src/**` de ningún producto, no altera schema/migraciones/DAL/repos/proxy, no cambia contratos HTTP ni navegación, no requiere regenerar `docs/architecture/**` y no mueve `arch:check`. Solo introduce un patrón operativo transversal (job sentinel `<slug>-gate` por producto + README canónico) que reemplaza la señalización agregada de CI hacia el ruleset "Gate CI - main" sin modificar jobs preexistentes de `ci.yml`/`bi.yml`. Efecto observable posterior al merge (cuando Jelkin registre los sentinels como required checks): PRs que solo tocan un producto dejan de quedar bloqueados por checks del otro producto que nunca disparaban.

**Input**: INSTRUCTIVO 002-PI-202 (BRIEF A-49). Fábrica BI-2 detectó que el ruleset "Gate CI - main" exige checks PI-específicos que nunca disparan en PRs que solo tocan BI (y viceversa) — el check queda "pendiente" para siempre y GitHub lo trata como bloqueante. Jelkin puso un parche temporal (solo `verificar_base` required). Este radicado construye la solución durable: cada producto expone un job "sentinel" (`pi-gate`, `bi-gate`, …) que SIEMPRE reporta un veredicto — éxito trivial si el PR no toca ese producto, éxito real si corrió y pasó, fallo si algo se rompió.

## User Scenarios & Testing *(mandatory)*

Los "usuarios" de esta feature son GitHub (orquestador de branch protection), Fábrica (auditora de PRs), Desarrollo (autor de PRs) y Jelkin (dueño del ruleset).

### User Story 1 — PR toca solo un producto y mergea limpio (Priority: P1)

Un PR modifica archivos únicamente del producto BI (`005-2026-BI-INTELIGENCIA-NEGOCIO/**`). GitHub arranca `bi.yml` porque sus paths coinciden, y NO arranca `ci.yml` (PI) porque los paths de PI no coinciden. El ruleset "Gate CI - main" espera `bi-gate` y `pi-gate` como required checks. Hoy `pi-gate` no existe y GitHub reporta el check como "expected but not seen" → el PR queda bloqueado indefinidamente.

Con esta feature, ambos workflows escuchan también `.github/workflows/**`; además, `pi-gate` reporta éxito trivial cuando los archivos del PR no corresponden a PI, y `bi-gate` reporta éxito real cuando `bi.yml` corrió completo. El ruleset ve los dos checks verdes y desbloquea el merge.

**Why this priority**: Es el problema de raíz. Sin esto, el ruleset no puede exigir gates por producto sin bloquear PRs cross-producto.

**Independent Test**: Abrir un PR que solo modifique un archivo dentro de `005-2026-BI-INTELIGENCIA-NEGOCIO/**` sin tocar ningún path de PI ni de otros productos, y verificar que `pi-gate` reporta éxito (trivial) y `bi-gate` reporta éxito (real). Ambos aparecen en `gh pr checks <PR>` como completed/success.

**Acceptance Scenarios**:

1. **Given** un PR que toca únicamente `005-2026-BI-INTELIGENCIA-NEGOCIO/**`, **When** GitHub evalúa los workflows, **Then** `ci.yml` no arranca sus jobs pesados (paths no coinciden), `pi-gate` reporta success trivial, `bi.yml` corre completo y `bi-gate` reporta success real.
2. **Given** un PR que toca únicamente `002-2026-PROTECCION-INFANTIL/**`, **When** GitHub evalúa los workflows, **Then** `bi.yml` no arranca, `bi-gate` reporta success trivial, `ci.yml` corre completo y `pi-gate` reporta success real.

---

### User Story 2 — PR toca workflows y verifica que el sentinel funciona (Priority: P1)

El propio PR que introduce esta feature toca `.github/workflows/**`. Bajo la lógica ampliada de `paths`, ambos workflows deben dispararse (independientemente de qué producto es "dueño" del cambio), y ambos sentinels deben aparecer con veredicto — éxito real si el workflow entero pasó, no trivial.

**Why this priority**: Sin esta ampliación de `paths`, la primera vez que se toca un workflow existente el ruleset ni siquiera los ve arrancar. Es el "test ácido" que valida el patrón antes de merge.

**Independent Test**: El propio PR de SPEC-299 debe disparar tanto `pi-gate` como `bi-gate`, ambos con conclusion=success, ambos visibles en `gh pr checks`.

**Acceptance Scenarios**:

1. **Given** este PR que modifica `.github/workflows/ci.yml`, `.github/workflows/bi.yml` y añade `.github/workflows/README.md`, **When** GitHub evalúa los workflows, **Then** ambos workflows arrancan (path `.github/workflows/**` coincide), corren todos sus jobs, y `pi-gate`+`bi-gate` reportan success real.

---

### User Story 3 — Un job real falla y el sentinel del producto también falla (Priority: P1)

Un PR toca código de PI y rompe `test-integration` (uno de los shards) en `ci.yml`. Hoy: `gate` no corre porque `test-integration` fue `failure` y `gate` no lleva `if: always()`, entonces GitHub reporta "gate skipped" y el ruleset (si tuviera `pi-gate` required) también quedaría pendiente. Con el sentinel: `pi-gate` corre igual (`if: always()`), evalúa `needs.*.result`, ve el fallo y reporta failure.

**Why this priority**: Un sentinel que siempre reporta success sería peor que nada — enmascararía regresiones. La lógica debe distinguir "no aplicó" de "aplicó y pasó" de "aplicó y falló".

**Independent Test**: Provocar deliberadamente un fallo local en un job de `ci.yml` (fuera del alcance de este PR — se prueba en el test ácido posterior con un PR falso), verificar que `pi-gate` reporta failure y bloquea el ruleset.

**Acceptance Scenarios**:

1. **Given** un PR de PI donde un job (p.ej. `verificaciones`) falla, **When** los jobs `needs:` de `pi-gate` terminan, **Then** `pi-gate` evalúa `needs.*.result`, encuentra al menos un `failure` y reporta failure. El ruleset bloquea el merge.
2. **Given** un PR donde `should-skip` sale `skip=true` (commit doc-only), **When** los jobs pesados se skipean, **Then** `pi-gate` reporta success (interpreta skipped como "no aplicó / trivial OK", no como failure).

---

### User Story 4 — Patrón documentado y reproducible para productos futuros (Priority: P2)

Cuando arranquen productos 000/001/003/004 con su propio CI, Desarrollo y Fábrica necesitan una guía canónica que diga exactamente cómo agregar su `<slug>-gate` sin reinventar la lógica ni copiar-pegar comentarios extensos en cada workflow. Un único `README.md` en `.github/workflows/` describe el patrón; cada workflow individual solo lleva un comentario corto arriba del sentinel apuntando al README.

**Why this priority**: Reduce el riesgo de que el próximo producto implemente el sentinel mal (needs incompleto, sin `if: always()`, lógica de skip incorrecta). Menos crítico que P1 porque no bloquea nada hoy.

**Independent Test**: Un desarrollador nuevo lee el README y puede escribir un sentinel para un producto ficticio sin consultar `ci.yml`/`bi.yml`.

**Acceptance Scenarios**:

1. **Given** `.github/workflows/README.md` existe, **When** un lector busca "cómo agregar un sentinel", **Then** encuentra pasos numerados: paths, job `<slug>-gate`, `if: always()`, `needs:` de TODOS los jobs, lógica de veredicto, cómo pedir a Jelkin que lo agregue al ruleset.

---

### Edge Cases

- **Workflow disparado por `workflow_dispatch` (manual)**: `pi-gate` debe funcionar igual — evalúa `needs.*.result` sin depender de `github.event_name`.
- **`should-skip` con `skip=true` y sin cambios PI**: hoy los jobs pesados llevan `if: needs.should-skip.outputs.skip != 'true'` → salen como `skipped`. El sentinel debe tratar `skipped` como "no aplicó → success trivial", no como failure.
- **Un job en `needs:` es `cancelled`** (p.ej. Jelkin canceló manualmente el run): `pi-gate` debe reportar failure — un cancel es un veredicto no-verde y el ruleset no debe mergear.
- **Un shard de `test-integration` falla y otro pasa**: `matrix.strategy.fail-fast: false` deja los cuatro correr; el `result` agregado del job `test-integration` es `failure` si al menos uno falló → `pi-gate` falla. OK con la lógica propuesta.
- **PR que toca `.github/workflows/README.md` (solo el README)**: `.github/workflows/**` en paths → ambos workflows arrancan. `should-skip` de PI probablemente detecte doc-only y reporte `skip=true` → jobs pesados skipped → `pi-gate` success trivial. `bi.yml` no tiene skip similar → correrá jobs completos aunque el cambio sea solo del README. **Aceptable** (falso positivo de carga pero no de veredicto); NO se resuelve en este SPEC.
- **PR que toca solo `verificar-base-pr.yml`**: mismo tratamiento — ambos workflows arrancan por `.github/workflows/**`; skip de PI puede aplicar; BI corre completo. Aceptable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `.github/workflows/ci.yml` DEBE ampliar sus filtros `paths` de `push` y `pull_request` para incluir `.github/workflows/**` (además del path actual `.github/workflows/ci.yml`).
- **FR-002**: `.github/workflows/bi.yml` DEBE ampliar sus filtros `paths` de `push` y `pull_request` para incluir `.github/workflows/**` (además del path actual `005-2026-BI-INTELIGENCIA-NEGOCIO/**`).
- **FR-003**: `.github/workflows/ci.yml` DEBE añadir un job nuevo `pi-gate` al final del archivo, con `if: always()` y `needs:` a TODOS los jobs existentes del workflow: `should-skip`, `verificaciones`, `test-unit`, `test-integration`, `test-integration-coverage`, `journeys`, `build`. NO incluir `resumen` ni `gate` (son jobs de reporte y agregador ya existente, respectivamente — el sentinel es aparte).
- **FR-004**: `.github/workflows/bi.yml` DEBE añadir un job nuevo `bi-gate` al final del archivo, con `if: always()` y `needs:` a TODOS los jobs existentes del workflow: `verify`, `typecheck`, `test-unit`, `build`.
- **FR-005**: El nombre del check reportado a GitHub por el job sentinel de PI DEBE ser exactamente `pi-gate` (nombre del job = nombre del check por defecto en GitHub Actions).
- **FR-006**: El nombre del check reportado a GitHub por el job sentinel de BI DEBE ser exactamente `bi-gate`.
- **FR-007**: La lógica de veredicto del sentinel DEBE inspeccionar `needs.*.result` (via `contains()` sobre los valores esperados) y aplicar esta tabla de decisión:
  - Si algún `needs.*.result` es `failure` → sentinel falla (exit 1).
  - Si algún `needs.*.result` es `cancelled` → sentinel falla (exit 1).
  - Si todos los `needs.*.result` son `success` o `skipped` (mezcla incluida) → sentinel pasa (exit 0).
- **FR-008**: `.github/workflows/README.md` DEBE existir en la raíz de `.github/workflows/` y documentar en secciones cortas: (a) por qué existe el patrón (problema del ruleset multi-producto), (b) requisitos por workflow (`paths` que cubra `.github/workflows/**`, job `<slug>-gate` con `if: always()` y `needs:` completo), (c) plantilla YAML mínima del job sentinel, (d) cómo pedir a Jelkin el registro del check como required en el ruleset.
- **FR-009**: NO se modificarán los jobs preexistentes de `ci.yml` ni de `bi.yml` más allá de la ampliación de `paths` (agregar el sentinel es aditivo).
- **FR-010**: NO se modificará `.github/workflows/verificar-base-pr.yml` (candado 3 de A-47 — funciona en su carril propio).
- **FR-011**: El propio PR de SPEC-299 DEBE disparar `pi-gate` y `bi-gate` y ambos DEBEN reportar success real (no trivial), porque toca `.github/workflows/**` y por tanto arranca los dos workflows completos.

### Key Entities

- **Workflow**: archivo YAML bajo `.github/workflows/` que declara jobs y disparadores por `paths`. Cada producto con CI tiene el suyo.
- **Job sentinel**: job especial `<slug>-gate` al final de cada workflow, con `if: always()` y `needs:` a todos los demás jobs del mismo workflow, que emite un único veredicto agregado.
- **Ruleset "Gate CI - main"**: regla de protección de rama en GitHub (fuera del repo, editable por Jelkin) que exige N required checks. Cada sentinel se registra ahí como un check requerido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el propio PR de SPEC-299, `gh pr checks <PR>` reporta ambos `pi-gate` y `bi-gate` con `conclusion=success` y estado `completed`.
- **SC-002**: Tras el merge (acción fuera de alcance de Desarrollo: Jelkin hace deploy y agrega los required checks al ruleset), un PR ficticio posterior que toca solo `005-2026-BI-INTELIGENCIA-NEGOCIO/**` mergea sin quedar bloqueado por un check "expected but not seen".
- **SC-003**: Cero jobs preexistentes de `ci.yml` o `bi.yml` cambian de comportamiento respecto a `main@62c9fb15a` — se puede verificar con `git diff main..HEAD -- .github/workflows/ci.yml .github/workflows/bi.yml` mostrando SOLO ampliación de `paths` y adición del job sentinel al final.
- **SC-004**: El README en `.github/workflows/README.md` cabe en una lectura de 3 minutos (< 150 líneas) y es autocontenido — no requiere leer `ci.yml` ni `bi.yml` para escribir un sentinel nuevo.

## Assumptions

- El ruleset "Gate CI - main" lo administra Jelkin en la UI de GitHub; agregar/quitar required checks NO es parte de este SPEC.
- `should-skip` en `ci.yml` ya distingue commits doc-only y devuelve `skip=true` con precisión suficiente para el objetivo actual — no se amplía en este SPEC, se acepta la asimetría (BI no tiene skip equivalente) como known limitation documentada en Edge Cases.
- Los jobs actuales de `bi.yml` (`verify`, `typecheck`, `test-unit`, `build`) son la lista completa a fecha 2026-08-28 22:10 COT sobre `main@62c9fb15a`. Si BI-2 añade jobs entre este SPEC y su merge, se coordina vía Fábrica antes de push.
- Un job en estado `skipped` se interpreta siempre como "no aplicó → OK trivial". Si en el futuro un producto añade un job pesado con `if:` que puede skiparse por otras razones (no doc-only), la lógica del sentinel sigue siendo válida porque un skip nunca debe bloquear el gate agregador — el veredicto real vive en los `needs:` que sí corrieron.
- La convención de nombre `<slug>-gate` es final: `pi-gate` para PROTECCION-INFANTIL, `bi-gate` para BI, `mod-gate` para MODELOS (000), `idc-gate` para INNOVADATACO (001), `sicov-gate` para SICOV-OTPC (003). Documentado en el README.
- No hay cambios de dependencias, ni de scripts npm, ni de contratos de código de producto. Es puramente infra de CI.
