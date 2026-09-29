# Tasks · SPEC-774 · la suite de CI corre sobre `main`

> **PARÁ en §4:** implementación espera aprobación del CEO (D-1..D-4). Y `ci.yml` NO se toca hasta
> que entre el PR de Calidad (#775). Nada marcado salvo el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: barrido clasificado (2 funcionales en `ci.yml` + fantasma inexistente; ~438 texto histórico PI; 4+459 otros productos), números (17.5 min · ~9 merges/día · pico 38), meta-aserción, protocolo de `main` rojo, D-1..D-4. **PARÁ.**

## Tras aprobación §4 (parte que NO toca `ci.yml`) — HECHO
- [x] **T1** · Candado `scripts/ci/trigger-push-main.candado.test.ts`: lee el `ci.yml` REAL (`../../../.github/workflows/ci.yml`), parseo dirigido de `on.push.branches` (FR-3, dura), + segunda aserción (la rama fantasma no queda en NINGÚN lado — cubre L378, D-4), + control positivo por mutación en fixtures (inline/bloque, no confunde `pull_request`). **Born-ROJO confirmado por exit code 1** (test 1&2 rojos = los dos defectos; test 3 verde = el parser). **SIN registrar en el manifiesto** a propósito: un candado que nace rojo NO se deja bloqueando el CI de siete sesiones — se registra en el PR del arreglo, cuando pasa a verde.

## Tras #752 (job e2e de Calidad) en `main` — edita `ci.yml`
- [ ] **T2** · Rebase sobre `main` (con el `ci.yml` de Calidad). `push.branches → [main]` (L12); quitar la rama fantasma. `cancel-in-progress` también para `main` (D-1: solo la punta que se despliega importa).
- [ ] **T3** · `if` del paso `test-durations.json` → `refs/heads/main` (L378, D-2, defecto APARTE); comentarios L30/L376 → `main`. **Requisito del CEO (va en el PR, no en el spec):** el comentario de L378 debe decir POR QUÉ apuntaba al fantasma y QUÉ se degradaba en silencio — el **reparto por peso de los shards** (SPEC-281): las duraciones se congelaron, así que cada test nuevo desbalanceaba más los shards y nada avisaba. Que alguien que mire esa línea en 6 meses entienda que NO era cosmética.
- [ ] **T4** · REGISTRAR el candado en `vitest.unit.includes.ts` → ahora VERDE (ci.yml incluye `main`, sin fantasma); confirmar por exit code.
- [ ] **T5** · Gate: `tsc` + `lint` + `test:unit` completo + candado + `build`. PR + REALIZADO. (Protocolo de `main` rojo — notificación auto, freeze discrecional — queda en `spec.md`.)
