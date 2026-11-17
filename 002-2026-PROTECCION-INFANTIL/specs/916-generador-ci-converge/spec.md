# SPEC-916 · El barrido de generados converge (I-443, cierre real)

**Prioridad:** sin deploy (CI/tooling).
**Rama:** `work/pi-SPEC-916-generador-ci-converge` desde `origin/main` (54145873).
**I-443:** el PR del generador de arquitectura no convergía en CI. SPEC-885 arregló el
force-push/aviso del workflow `generados-post-merge.yml`, pero el issue siguió vivo
(Calidad lo re-trió contra prod).

## Síntoma verificado (no supuesto)

Corriendo los 6 generadores sobre `origin/main` fresco (determinista — dos corridas dan
el MISMO drift):

```
specs/README.md                         8 líneas
docs/architecture/01-modelo-datos.md   62 líneas   ← drift REAL (schema nuevo)
docs/architecture/03-pantallas.md       2 líneas
docs/architecture/06-stack.md           6 líneas   ← drift REAL (deps/scripts/Docker)
```

`arch:check` queda **VERDE** sobre el estado regenerado (chequea REPRESENTABILIDAD, no
byte-exacto) — por eso el drift de 01/06 se pudre en silencio sin poner rojo a ningún PR normal.

## Causa raíz

El workflow tiene la lista de generados en **tres lugares** y divergieron:

| Paso | Archivos |
|---|---|
| Regenerar (pasos `npx tsx …`) | README, 00, 01, 02, 03, 06 (6) |
| Detectar drift (`$ARCHIVOS`) | README, 00, 01, 02, 03, 06 (6) |
| **Committear (`git add`)** | **README, 02, 03 (3)** ← solo el trío append-por-spec de SPEC-487 |

SPEC-803 añadió los byte-exactos **00/01/06** a la regeneración y a la detección, pero **no
al `git add`**. Consecuencia:

1. El drift de 00/01/06 nunca entra a la rama del barrido → `main` queda driftado para siempre.
2. Una vez que el trío (README/02/03) queda limpio pero 00/01/06 siguen driftados, el gate
   `cambio=si` dispara el push, pero `git add` del trío no stagea nada → `git commit` muere
   con "nothing to commit" (`set -euo pipefail`) → **job ROJO en cada push**. No converge.

## Fix

1. **`generados-post-merge.yml`**: el `git add` del paso de push ahora stagea los **6**
   generados (añade 00-INDICE, 01-modelo-datos, 06-stack). El gate es `cambio=si` (drift en
   los 6), así que al menos uno está modificado y el commit siempre procede. Esto arregla la
   convergencia Y la muerte por "nothing to commit".
2. **Reconciliación de `main`**: se commitean en este PR los 4 generados driftados
   (README, 01, 03, 06) regenerados sobre main fresco — `main` queda convergido de una vez,
   no esperando a que el bot abra su rama.

## Candado (muere con el defecto)

`scripts/ci/generados-post-merge-converge.candado.test.ts` (extiende el de SPEC-885):
invariante **`$ARCHIVOS` (regenerado/chequeado) ⊆ `git add` (committeado)**. Parsea el YAML,
normaliza el prefijo del producto y exige que todo generado que se regenera y se detecta como
drift se committee. Con el YAML viejo (git add de 3) → ROJO; con el fix (git add de 6) → VERDE.
Control positivo: un YAML sintético que omite un generado chequeado dispara el detector.

## Fuera de alcance

- La lógica de convergencia/aviso de SPEC-885 (gating por PR abierto, Issue `generados-drift`)
  queda intacta — sus 4 candados siguen verdes.
- No se toca `arch:check` ni el gate de PR (siguen midiendo representabilidad).
