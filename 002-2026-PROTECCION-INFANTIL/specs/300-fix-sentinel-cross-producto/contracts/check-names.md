# Contract — Check names del ruleset "Gate CI - main"

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`) · **SPEC**: 300

## Contrato

El ruleset "Gate CI - main" (GitHub Settings del repo `Innovadataco/productos`, gestionado por Jelkin fuera del código) referencia dos required checks por name literal exact-match:

- `pi-gate`
- `bi-gate`

Ambos names DEBEN aparecer byte-a-byte, minúsculas, sin sufijo, en el atributo `name` del job (o en la key del job en YAML, cuando `name` está ausente — GitHub deriva `check_run.name` de ambos con precedencia del `name` explícito). El ruleset matchea case-sensitive; cualquier variación (`Pi-Gate`, `pi_gate`, `pi-gate/main`) rompe la referencia y el PR queda indefinido.

## Ubicación autoritativa

- `pi-gate`: `.github/workflows/ci.yml`, job `pi-gate` (~línea 427-443)
- `bi-gate`: `.github/workflows/bi.yml`, job `bi-gate` (~línea 80-102)

## Contrato de comportamiento

Cada sentinel DEBE cumplir simultáneamente:

1. **Presencia universal**: aparecer como check en todo PR contra `main`, sin excepción por paths.
2. **Veredicto veraz**: `success` si y solo si (a) todos los jobs de su producto pasaron o fueron skipped legítimamente, y (b) ninguno fue cancelado; `failure` en cualquier otro caso.
3. **Latencia acotada**: reportar en < 90 s cuando el veredicto es trivial verde (SC-001).
4. **Idempotencia**: rerun del workflow con el mismo sha produce el mismo veredicto.

## Ratchet asociado

Fábrica verifica en fuente pre-CUMPLE que los strings literales `pi-gate` y `bi-gate` aparecen exactamente en sus workflows respectivos. Un `grep -c '^  pi-gate:' .github/workflows/ci.yml` DEBE reportar `1`; idem `grep -c '^  bi-gate:' .github/workflows/bi.yml` DEBE reportar `1`. Cualquier cero rompe el contrato.

## Rollback contract

Si el fix debe revertirse por un edge case en producción, el rollback DEBE:

1. Restaurar el bloque `paths:` en `on:` de ambos workflows (git revert del commit).
2. Notificar a Jelkin para volver a sacar `bi-gate` de required en el ruleset (mismo workaround pre-fix).
3. NO tocar los names literales `pi-gate` / `bi-gate` — su restauración post-fix es el estado deseado y el ruleset lo espera.

## Cambios prohibidos por este contrato

- Renombrar `pi-gate` → `pi_gate` o `Pi-Gate` o `protection-infantil-gate`: prohibido.
- Renombrar `bi-gate` → similar: prohibido.
- Mover los sentinels a otro workflow SIN preservar el `name: pi-gate` / `name: bi-gate` en el job: prohibido (Opción B del research documentaría el mecanismo explícito si se activa).
- Añadir un sufijo condicional al name (p. ej. `pi-gate (draft)`): prohibido.
