# SPEC-354 · Cierre — el fix de 1 línea era un placebo; la causa raíz es otra

**Fecha**: 01-09-2026 · **Dev**: PI-2 · **Veredicto CEO**: cerrada SIN cambio de código.

## Hallazgo 1 — `should-skip` NO tiene el bug que se le atribuyó (en PRs)

En eventos `pull_request`, `actions/checkout` chequea el **merge ref**
(`refs/pull/N/merge`): un commit sintético "Merge <head> into <base>" cuyo
primer padre es la punta de la base. Por eso `git diff HEAD^ HEAD` en ese
contexto **ya es el diff completo del PR**, no el del último commit.

Evidencia (log del run 33517819248, job should-skip, PR #222):

```
git checkout --progress --force refs/remotes/pull/222/merge
HEAD is now at 903332f Merge 0cb6477f6... into 543fb2c1c...
```

El diff contra `HEAD^` en un push multi-commit sí mira solo el último commit,
pero `ci-002` solo corre `push` en `feature/001-scaffolding` (legado): el caso
no aplica a los PRs de trabajo. (Los checks "skipping" que se vieron en #223
eran del workflow **BI · CI** en sus runs de `push` — comportamiento correcto:
la rama no toca BI.)

## Hallazgo 2 — la causa raíz real: PR en conflicto = CERO runs de pull_request

Cuando GitHub **no puede construir el merge commit** de un PR (conflicto con la
base, o mergeabilidad aún sin calcular), **no dispara ningún workflow de
`pull_request`** para ese PR. No quedan "pendientes": no existen.

Evidencia:

- `gh pr view 223` → `mergeable: CONFLICTING, mergeStateStatus: DIRTY`
  (main avanzó con SPEC-350 después de abrirse el PR).
- API de runs desde las 14:43Z: **cero** runs de `ci-002-proteccion-infantil`
  y de `Verificar rama base del PR` para #223 — solo los `push` de BI · CI.
- `gh pr view 220` → `mergeable: UNKNOWN` (misma familia del fantasma que el
  CEO ya había visto desde afuera).

Resultado: el PR muestra únicamente los checks de BI (que saltan por no tocar
BI) y parece verde **por ausencia de checks**, no por checks aprobados.

## Por qué el fix propuesto no servía

Cambiar la base del diff en `should-skip` no puede hacer que GitHub dispare
workflows sobre un PR cuyo merge no existe. Habría "arreglado" un código que
ya era correcto sin tocar la anomalía observada (candado 26: el síntoma no es
la causa raíz).

## Decisiones del CEO (01-09-2026 10:05)

1. El gate del CEO **"checks de PI presentes"** antes de mergear queda como el
   control permanente — es el antídoto exacto a este fantasma.
2. Branch protection con checks requeridos queda **anotada, NO activada**: en
   el monorepo, un check de PI requerido bloquearía para siempre los PRs
   solo-BI (sus rutas no disparan `ci-002`). Necesita diseño con calma y
   decisión de Jelkin.
3. Operativo: un PR `CONFLICTING` debe rebasarse; al existir de nuevo el merge
   ref, los checks de PI disparan solos (aplicado a #223 en su turno).
