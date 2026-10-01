# Plan · SPEC-813

## Enfoque

1. **Derivación pura (HECHA).** `clasificarAvisoReps(hecho, config, now)` sobre el contrato de #792
   (`HechoReps`/`EstadoReps`/`ConfigReps` de `reps-elegibilidad.ts`). Mapea los 8 estados a 4 categorías,
   discriminando por HECHO + relojes (no por `motivo`). Helpers `debeMostrarAvisoCaducadoReps` (4,6) y
   `requiereRevisionAdminReps` (5,7,8). Fail-closed. `switch` exhaustivo → un 5º `EstadoReps` rompe `tsc`.
2. **Candado unit (HECHO).** 8 estados plantados + control positivo por mutación + atado por conducta a
   `repsElegible` + exhaustividad. RED-first verificado.
3. **Aviso al profesional (PENDIENTE #792 en main + forma v4.0).** Banner en la superficie del profesional,
   disparado por `debeMostrarAvisoCaducadoReps`, consumiendo `repsAlDia` de `/api/me`. Copy según la v4.0 de
   Diseño (no inventar). Candados de copy y de no-promesa.
4. **Canal de admin (PENDIENTE).** Superficie de admin para 5, 7 y 8 (candado: no construir silencio).

## Orden y precondiciones

- La derivación pura NO necesita copy ni #792-en-main para compilar/probar como unit → se adelanta.
- Las superficies esperan **#792 en main** (viven ahí `repsAlDia` y `/api/me`) y la **forma v4.0**.
- **Merge `--squash`:** al entrar #792, ramificar limpio de `origin/main` y **cherry-pick** de los commits
  de 813 (NO rebase). Verificar `gh pr view 792 --json state` == MERGED antes.

## Gate antes de cerrar

`tsc` · `lint` · candados (unit) · `arch:check` · recorrido de las superficies cuando existan.
