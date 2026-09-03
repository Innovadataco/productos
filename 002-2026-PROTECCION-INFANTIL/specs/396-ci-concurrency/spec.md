# SPEC-396 · `concurrency` en los flujos de CI · causa raíz de I-282

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 · **Origen**: I-282 (CEO idc-14, verificado 10:15).

## Qué

Ningún flujo de `.github/workflows/` declaraba `concurrency`. Consecuencia: cada `git push --force-with-lease` a una rama de PR dejaba viva la corrida anterior mientras arrancaba la nueva, y las dos peleaban por la misma base de datos compartida. Evidencia dura del CEO: **3 corridas simultáneas del mismo push en la rama de Calidad** (`33741605050/60/68`, todas a las 09:56:33Z), con `lock not available` en `PermisoModulo`.

## Por qué esto explota justo esta noche

Con cuatro Devs rebasando en paralelo (frente A-75), el ritmo de repushes se disparó. Antes casi no se notaba; ahora deja rojos fantasma que culpan a ramas inocentes:
- **#279**: shard 3 cancelado por corrida hermana → coverage sin blob → `pi-gate` rojo en cascada.
- **#298**: shard 1 con `text-integration` frágil (I-284) mientras una segunda corrida del mismo push consumía el runner.

Costó a los cuatro (idc-14 lo enumera): a Dev Infra timeout de 35 min, a Dev Guardianes cuelgue, a mí dos culpas ajenas.

## Arreglo

Bloque `concurrency` en los cuatro flujos:

```yaml
concurrency:
  group: <prefijo>-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

- **`ci.yml`** — grupo `ci-002-…`, excepción `main`.
- **`bi.yml`** — grupo `bi-…`, excepción `main` (este SÍ dispara en push a main sin filtro, la excepción es real).
- **`bi-006.yml`** — grupo `bi006-…`, excepción `main` defensiva (el trigger hoy no dispara en main pero puede abrirse).
- **`verificar-base-pr.yml`** — grupo por `pull_request.number`, `cancel-in-progress: true` a secas (dispara solo en PRs, nunca en main).

## Decisión que el CEO me pidió tomar: `cancel-in-progress` en main

**Elegí `${{ github.ref != 'refs/heads/main' }}`** en los tres flujos que pueden ver `main` (ci.yml y bi-006.yml defensivamente; bi.yml de verdad). Motivo: un merge a main que dispara la corrida oficial de CI/BI no debería ser interrumpido por el siguiente merge — si dos merges caen seguidos, el primero completa y el segundo arranca al terminar; ambos quedan registrados. En ramas de trabajo, cancelar es lo que uno quiere igual.

## Fuera de scope

- No cambio jobs, matrices ni tiempos.
- No toco las ratchets de I-282 registradas por el CEO (shard-que-cancela, coverage-sin-blob, prueba-frágil-I-284). Esta spec ataca la causa; los síntomas se calman solos.

## Impacto en arquitectura: no

Solo YAML de CI. Sin cambio en el producto.

## Cómo se probó

- YAML válido (parseo local con `python -c "import yaml; yaml.safe_load(open('...'))"` en los cuatro).
- Verificado con `grep -c "^concurrency:" .github/workflows/*.yml` → 4/4.
- No hay tests unit ni integración para YAML de CI; la validación real es la próxima corrida.
