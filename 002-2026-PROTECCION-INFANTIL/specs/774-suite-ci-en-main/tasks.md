# Tasks · SPEC-774 · la suite de CI corre sobre `main`

> **PARÁ en §4:** implementación espera aprobación del CEO (D-1..D-4). Y `ci.yml` NO se toca hasta
> que entre el PR de Calidad (#775). Nada marcado salvo el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: barrido clasificado (2 funcionales en `ci.yml` + fantasma inexistente; ~438 texto histórico PI; 4+459 otros productos), números (17.5 min · ~9 merges/día · pico 38), meta-aserción, protocolo de `main` rojo, D-1..D-4. **PARÁ.**

## Tras aprobación §4 (parte que NO toca `ci.yml`)
- [ ] **T1** · Candado meta-aserción (`*.candado.test.ts`): lee el `ci.yml` REAL (`../.github/workflows/ci.yml`), parseo dirigido de `on.push.branches`, afirma `⊇ {main}`. Control positivo por mutación (fixture con/sin `main`). Registrar en `vitest.unit.includes.ts`. Nace **ROJO** hoy (el `ci.yml` sin `main`) → confirmar born-red por exit code.

## Tras #775 (job e2e de Calidad) en `main`
- [ ] **T2** · Rebase sobre `main` (con el `ci.yml` de Calidad). `push.branches → [main]` (L12); quitar la rama fantasma.
- [ ] **T3** · `if` del paso `test-durations.json` → `refs/heads/main` (L378, D-2); comentarios L30/L376 → `main`.
- [ ] **T4** · Candado VERDE (ya incluye `main`); confirmar por exit code. Aserción segunda (L378 → `main`) si D-4 la aprueba.
- [ ] **T5** · Gate: `tsc` + `lint` + `test:unit` completo + candado + `build`. PR + REALIZADO. (El protocolo de `main` rojo queda escrito en `spec.md`.)
