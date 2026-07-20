# Cierre: Corrección de fidelidad de la simulación (Spec 071)

**Spec**: specs/071-correccion-fidelidad-simulacion-070/spec.md
**Fecha de cierre**: 2026-07-20
**Status**: CERRADA

---

## Resumen

Se corrigió la simulación para que un reporte creado por ella sea indistinguible de uno creado por un anónimo desde el formulario. El parser y el schema ahora aceptan los mismos campos de entrada (`fechaIncidente`, `ciudad`, `pais`, `edadVictima`) y el executor los usa sin inventar valores. Se mantuvo el override de modelo por job de pg-boss y no se tocó el modelo `Reporte`.

---

## User Stories implementadas

- **US1 (P1)**: Entrada idéntica a la de un reporte anónimo. `casoSimulacionSchema` extiende `crearReporteSchema`; el parser valida por línea.
- **US2 (P1)**: Executor con valores reales y pipeline completo sin atajos. Los casos fallidos no detienen la corrida; se registran en `metricasJson`.
- **US3 (P1)**: Verificación de fidelidad documentada en `quickstart.md` y ejemplo de formato en `NuevaSimulacionForm.tsx`.

---

## Archivos tocados

```
src/lib/schemas/simulacion.ts
src/lib/simulacion/parser.ts
src/lib/simulacion/parser.test.ts
src/lib/simulacion/executor.ts
src/lib/simulacion/executor.test.ts
src/app/api/admin/ia/simulaciones/route.test.ts
src/components/modules/ia/simulacion/NuevaSimulacionForm.tsx
specs/071-correccion-fidelidad-simulacion-070/spec.md
specs/071-correccion-fidelidad-simulacion-070/quickstart.md
```

---

## Commits

- `feat(071): US1 - schema y parser con campos reales de reporte anónimo`
- `feat(071): US2 - executor con valores reales y continuidad ante fallos`
- `test(071): tests de parser, executor y simulaciones actualizados`
- `ui(071): US3 - ejemplo de formato en NuevaSimulacionForm`
- `docs(071): spec.md implementación + quickstart verificación fidelidad`
- `docs(071): cierre.md`

---

## Validación

| Check | Comando | Resultado |
|-------|---------|-----------|
| TypeScript | `npx tsc --noEmit` | ✅ Sin errores |
| Lint | `npm run lint` | ✅ Sin errores |
| Tests | `npm run test` | ✅ 595 tests en verde |
| Build | `npm run build` | ✅ Exitoso |
| Deploy | `./scripts/dev-restart.sh` | ✅ Puerto 5005, healthcheck OK, un worker |
| Quickstart | Manual | ✅ Verificación de fidelidad reproducible |

---

## Deploy

Se ejecutó `./scripts/dev-restart.sh` tras el build. La app levantó en `:5005` con un solo worker. El healthcheck respondió OK.

---

## Deuda técnica

Ninguna nueva. El conteo de fallos durante la corrida se almacena en `metricasJson.casosFallidos` (fallos de creación de reportes). Los fallos durante el pipeline real se reflejan en los estados finales de los reportes y se muestran en la distribución de estados del análisis.

---

## Notas

- No se requirió migración de base de datos.
- El override de modelo sigue siendo por job de `pg-boss`; no se tocó `ParametroSistema`.
- El formato legacy del 070 se rechaza intencionalmente para forzar fidelidad.
