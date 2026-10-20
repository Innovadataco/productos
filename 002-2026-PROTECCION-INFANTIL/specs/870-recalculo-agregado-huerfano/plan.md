# Plan · SPEC-870

Diseño y causa raíz en [`spec.md`](./spec.md). Mapa de cambios + verificación.

## Cambios

1. `scripts/limpieza/borrar-reporte.ts` — tras `reporte.delete`, recalcula el agregado PROPIO
   (`recalcularYGuardarScore` + `actualizarVisibilidadPublica`, en la tx). Reemplaza el borrado de
   agregados por-eventoMatch. Es la FUENTE del drift.
2. `scripts/limpieza/recalcular-agregados-huerfanos.ts` — corrector idempotente (dry-run/`--confirm`).
3. `src/lib/dal/services/agregados-huerfanos.ts` + `scripts/limpieza/detectar-agregados-huerfanos.ts` —
   detector blando solo-lectura.
4. `scripts/arch/no-reporte-delete-directo.ts` + wire en `scripts/arch/arch-check.ts` (sección (k)).
5. Retiro: `scripts/demo/borrar-demo{,-v2,-v4}.ts`, `scripts/generar-reportes-demo.ts` (sin caller).
6. Ruteo por `borrarReporte`: `scripts/limpieza/borrar-simulacion.ts`, `scripts/smoke-e2e.ts`.
7. Candado `src/lib/dal/services/agregado-huerfano.candado.test.ts` + ajuste del fake en
   `scripts/limpieza/borrar-limpieza.test.ts` (recalc ejercita scoring sobre el fake-client).

## Verificación (gate local)

- `tsc --noEmit` · `arch:check` (incl. nueva (k)) · `eslint .` · candado de integración (BD por worktree)
  · `borrar-limpieza.test.ts` (fake-client, FK-ordering). Node 22 en CI = fuente de verdad (SPEC-800).

> No despliego ni corro contra prod. El fix es RUNTIME → DEPLOY + corrida del corrector van APARTE,
> por el responsable. Verde en CI ≠ funciona: el candado prueba la conducta con BD real.
