# SPEC-774 · La suite de CI nunca corre sobre `main`

**Status**: DESARROLLO

**Origen:** el CEO verificando `main` tras seis merges. `.github/workflows/ci.yml` dispara `push` sobre `branches: [feature/001-scaffolding]` — una rama **base OBSOLETA que ni siquiera existe** (verificado: `git ls-remote` no la lista). La suite de PI solo corre en `pull_request`; **sobre `main` no corre nunca.** Cada PR se verifica contra su base al abrirlo; **nadie verifica el resultado INTEGRADO.** La madrugada del 29-09 entraron 6 PRs en horas y ningún trabajo verificó los seis juntos. **Carril:** Dev 1 · Calidad (toca `ci.yml` en paralelo por #775). **Radicado:** `RADICADO-SPEC-774`. **Base:** `main`. **Después de 767** (serie #735→767→774 sobre `ci.yml`).

> **Compuerta §4 (DISEÑO):** este `spec.md` + `plan.md` PARAN — el CEO aprueba antes de `tasks.md`+implementación. **NO se toca `ci.yml` hasta que entre el PR de Calidad (#775, job e2e).** Dos sesiones sobre el mismo archivo pierden un cambio: su PR primero, después el mío.

## Lo medido — el barrido de `feature/001-scaffolding` (conteo + clasificación)

La rama **NO EXISTE** (local ni remoto) — el trigger apunta a un fantasma, por eso el `push` nunca dispara. Referencias clasificadas por lo que HACEN, no por ocurrencia:

| # | Dónde | Qué hace | Clasificación |
|---|---|---|---|
| **2** | **`ci.yml` (PI)** — líneas **12** y **378** | **FUNCIONALES.** L12 `push.branches: [feature/001-scaffolding]` = el defecto (push nunca corre en `main`). **L378** `if: github.ref == 'refs/heads/feature/001-scaffolding'` gatea el paso «Actualizar test-durations.json» (SPEC-281): apunta al MISMO fantasma → **las duraciones nunca se actualizan** y el sharding por peso degrada en silencio. **Segunda vez que la rama engaña.** | **ARREGLAR** (ambas → `main`) |
| 2 | `ci.yml` (PI) — líneas 30, 376 | Comentarios que nombran la rama obsoleta. | Texto en archivo funcional → **actualizar con el arreglo** |
| ~438 | PI `.md`: **423** en `specs/*/{spec,plan,tasks,cierre}.md` + **15** en `docs/cierre-*.md`, `docs/historico/*`, `IMPLEMENTATION-REPORT.md` | Metadata HISTÓRICA («Feature Branch: feature/001-scaffolding» de specs cerradas meses atrás). | **TEXTO MUERTO — no se reescribe** (histórico, decisión de proyecto) |
| 4 | `000-2026-MODELOS`×2 + `003-2026-SICOV-OTPC`×2 (`AGENTS.md`, `constitution.md`) | Convención de base de **OTROS productos** del monorepo. | **NO ES MÍO** (otro producto; su barrido, si aplica, es aparte) |
| ~459 | Otros productos (`.md/.yml/.ts`) | — | **NO ES MÍO** |

- **PI propio:** `002/AGENTS.md` y `002/README.md` tienen **CERO** referencias — PI ya usa `main` + `work/pi-SPEC-*`. La deuda viva es **solo** `ci.yml` (2 funcionales + 2 comentarios).

## Lo medido — los números (para decidir con dato, no de oído)

- **Duración de la suite completa:** **17.5 min de wall** (corrida manual del CEO sobre `main`, `36550822604`). Camino crítico: un shard de `test-integration` (~15.3 min) + coverage; `test-unit` 5.8 min, `verificaciones`/`build`/`journeys` ~2.5 min cada uno, corriendo en paralelo.
- **Corridas/día que agregaría el `push` sobre `main`:** merges a `main` medidos — **8–9/día típico** (24:8, 25:8, 26:9, 28:9) con **pico 38** el 29-09. Cada merge = 1 corrida de suite.
- **`concurrency` ya existe** (`ci.yml:32-34`): `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` → los PR se cancelan al superarse, **`main` NO se cancela** (cada estado integrado se verifica). Es la intención correcta para atribución; también es lo que hace que el pico de 38 cueste 38 corridas.

## El arreglo

1. **El trigger de `push` pasa a `main`** y se quita la rama fantasma (`ci.yml:12`).
2. **Se corrige la 2ª referencia funcional** (`ci.yml:378`): el paso de `test-durations.json` se gatea sobre `refs/heads/main` (si no, el sharding por peso sigue degradado). Y se actualizan los comentarios (L30, L376).
3. **Meta-aserción (candado):** un test que LEE el `ci.yml` REAL, extrae `on.push.branches`, y **falla si no contiene `main`**. No una constante copiada — el defecto fue una lista que nadie volvió a leer. Sin dep de YAML: parseo dirigido del bloque `push.branches`. Control positivo: mutar el trigger quitando `main` → rojo.
4. **Protocolo de `main` rojo** (escrito, ver §Protocolo): dueño, notificación y acción — un rojo sin dueño se apaga.

## Requisitos funcionales (FR)

- **FR-1:** el `push` de `ci.yml` corre la suite de PI sobre `main` (rama fantasma removida). *(Implementa Dev-1 tras el PR de Calidad — coordinación.)*
- **FR-2:** el paso `test-durations.json` (SPEC-281) se gatea sobre `main`, no sobre la rama fantasma — el sharding por peso vuelve a nutrirse.
- **FR-3 (meta-aserción):** un candado lee el `ci.yml` real y falla si `on.push.branches` no incluye `main`. Control positivo por mutación.
- **FR-4 (protocolo):** el documento define quién es dueño de un `main` rojo, cómo se entera y qué hace.

## Criterios de éxito (SC)

- **SC-1:** un push a `main` dispara la suite completa (o el agregador, según D-1) y su resultado es visible.
- **SC-2:** si alguien vuelve a poner una rama que no sea `main` en `push.branches` (o borra `main`), el candado se pone **rojo** en el PR — antes de mergear.
- **SC-3:** `test-durations.json` se actualiza tras merges a `main`.
- **SC-4:** un `main` rojo tiene dueño y acción escritas; no queda como ruido.

## Escenarios de aceptación (candado)

- **A-1 (meta-aserción, real):** con `push.branches` conteniendo `main` → verde. **Mutación:** quitar `main` (o dejar solo una rama obsoleta) → **rojo**. Lee el `ci.yml` real, no una copia.
- **A-2 (control positivo del defecto original):** el candado, corrido contra el `ci.yml` de HOY (rama fantasma, sin `main`) → rojo. (Nace rojo hasta que FR-1 entre — como todo guardián, se confirma born-red antes de gate.)
- **A-3 (barrido):** no queda ninguna referencia FUNCIONAL a `feature/001-scaffolding` en `ci.yml` (las 2 líneas). El texto histórico de specs NO se toca.

## Protocolo de `main` rojo (FR-4)

- **Dueño:** el **CEO** (mergea y despliega, tiene el ci-monitor y SSH). Un `main` rojo es suyo por rol.
- **Notificación:** el ci-monitor del CEO sobre `main` + el estado del workflow en GitHub. La corrida `push` sobre `main` es la señal; sin ella (el defecto de hoy) no hay a quién avisar.
- **Acción:** (1) `main` rojo **congela merges** — el estado integrado está roto, mergear encima lo entierra; (2) el CEO identifica el merge culpable (job que falla + últimos merges) y **revierte o radica el fix**; (3) **no se despliega con `main` rojo** ([[ceo-no-desplegar-mientras-jelkin-prueba]] es el vecino: prod refleja `main`). Un guardián que nace rojo NO es este caso: acá `main` verde es el estado normal y el rojo es un evento accionable.

## Impacto en arquitectura

**Impacto en arquitectura:** corrige el disparador de un workflow (dato de configuración, no código de producto ni esquema): el `push` de `ci.yml` deja de apuntar a una rama fantasma y pasa a `main`, de modo que el **resultado integrado** de cada merge se verifica (hoy solo se verifica cada PR contra su base). Suma un candado de CI que lee su propio `ci.yml` para que la lista de ramas no vuelva a pudrirse en silencio. No toca qué jobs corren en un PR, ni el ratchet de #760, ni el CI de otros productos.

## Decisiones para la compuerta §4 (el CEO decide con los números)

- **D-1 · Suite completa vs agregador.** Números: **17.5 min wall**, ~**9 corridas/día típico** (pico 38). **Recomendado: suite COMPLETA sobre `main`** — el costo es modesto y un agregador liviano que saltee `test-integration` (el shard de 15 min) **se perdería justo la clase de bug** del radicado (un candado que B viola tras mergear A vive en la lane de integración). Si el pico de 38 preocupa, la palanca es `cancel-in-progress: true` **también para `main`** (verifica solo el último estado en ráfaga; pierde atribución por-merge). ¿Suite completa (recomendado) o agregador?
- **D-2 · Corregir también `ci.yml:378`** (el paso de duraciones) en el mismo cambio: es la 2ª referencia funcional al fantasma y degrada el sharding. **Recomendado: sí.** ¿Confirmás?
- **D-3 · Protocolo de `main` rojo** (arriba): dueño = CEO, congela merges, no deploy. ¿Lo aprobás como está o querés otro dueño/acción?
- **D-4 · Alcance del candado.** ¿La meta-aserción cubre solo `push.branches ⊇ {main}` (FR-3), o también que el paso de duraciones (L378) apunte a `main`? **Recomendado: FR-3 dura; L378 verificada como aserción blanda/segunda** para no acoplar el candado a un nº de línea.

## Fuera

Cambiar qué jobs corren en un PR · el ratchet `continue-on-error` de #760 · el CI de otros productos · reescribir el texto histórico de specs (423) o los `AGENTS/constitution` de otros productos (4) · el parche manual `workflow_dispatch` del CEO (fue puente, no solución).
