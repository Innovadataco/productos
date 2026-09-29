# Tasks · SPEC-774 · la suite de CI corre sobre `main`

> **PARÁ en §4:** implementación espera aprobación del CEO (D-1..D-4). Y `ci.yml` NO se toca hasta
> que entre el PR de Calidad (#775). Nada marcado salvo el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: barrido clasificado (2 funcionales en `ci.yml` + fantasma inexistente; ~438 texto histórico PI; 4+459 otros productos), números (17.5 min · ~9 merges/día · pico 38), meta-aserción, protocolo de `main` rojo, D-1..D-4. **PARÁ.**

## Tras aprobación §4 (parte que NO toca `ci.yml`) — HECHO
- [x] **T1** · Candado `scripts/ci/trigger-push-main.candado.test.ts`: lee el `ci.yml` REAL (`../../../.github/workflows/ci.yml`), parseo dirigido de `on.push.branches` (FR-3, dura), + segunda aserción (la rama fantasma no queda en NINGÚN lado — cubre L378, D-4), + control positivo por mutación en fixtures (inline/bloque, no confunde `pull_request`). **Born-ROJO confirmado por exit code 1** (test 1&2 rojos = los dos defectos; test 3 verde = el parser). **SIN registrar en el manifiesto** a propósito: un candado que nace rojo NO se deja bloqueando el CI de siete sesiones — se registra en el PR del arreglo, cuando pasa a verde.

## Tras #754 (carril de Calidad libre) en `main` — edita `ci.yml` — HECHO
- [x] **T2** · Rebase sobre `main`. `push.branches → [main]`, rama fantasma removida del trigger. `cancel-in-progress: true` (D-1: solo la punta que se despliega importa; comentario reescrito).
- [x] **T3** · `if` del paso `test-durations.json` → `refs/heads/main` (D-2). Comentario del paso documenta el 2º defecto APARTE: apuntaba a la misma rama fantasma → duraciones congeladas → reparto por peso de shards degradado EN SILENCIO. Comentario de concurrency reescrito (D-1). *(La rama fantasma queda solo en ese comentario explicativo — deseable, D-2; el candado vigila posición FUNCIONAL, no comentarios.)*
- [x] **T4** · Candado REGISTRADO en `vitest.unit.includes.ts` → VERDE (push.branches=[main], sin gate fantasma vivo). Control positivo verificado por MUTACIÓN del ci.yml real (quitar main → rojo, revertido) + fixtures (inline/bloque, no confunde pull_request).
- [x] **T5** · Criterio del gate BLANDO del suite (decisión CEO de la mañana) escrito AL LADO del paso `test-e2e`: no se fija umbral mientras haya specs mudos (27, Calidad); el nº mide cuánto vemos, no cuánto está roto; se endurece cuando la suite entera corra. Gate: `tsc`+`lint`+`test:unit`(3284)+candado ✓. PR + REALIZADO.
