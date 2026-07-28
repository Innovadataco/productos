# Cierre · SPEC-114 — Suite E2E por rol (estabilización, 002-PI-039)

**Estado: FINALIZADA** · Rama `feature/001-scaffolding` · Sin despliegue (nada que desplegar: infra de pruebas + 3 fixes menores ya commiteados).

## Qué se construyó

Suite E2E por rol en `src/lib/e2e/` que prueba **caminos, no piezas** (lección I-35/I-36/I-38):
login real → proxy con JWT → home por rol → menú por la MISMA fuente de verdad del proxy →
logo nunca muerto → salir con la sesión muerta. Cada recorrido cierra comprobando la **base de
datos** (§9 del brief): texto original intacto y cifrado, hash bcrypt, transiciones,
correcciones, contadores, AuditLog.

- 7 journeys, 25 tests rápidos (~25 s): `sesion-roles`, `padre`, `colegio`, `admin`,
  `operador-comite`, `aislamiento`, `publico-agregacion`.
- 1 prueba lenta opt-in con el motor real (`E2E_LENTA=true`, `src/lib/e2e/lenta/`): un reporte
  real por el pipeline completo con Ollama. Verificada: 6,9 s, verde. Fuera del gate rápido y de CI.
- La suite corre dentro de `npm run test` (CI la hereda sin tocar el pipeline).

## Defectos REALES encontrados y arreglados (rojo → verde, un commit por arreglo)

| # | Recorrido | Defecto | Commit |
|---|---|---|---|
| 1 | sesión | Logo clic muerto: SPEC-106 dejaba logo=home del rol estando ya en el home (I-38) | f80d7240 |
| 2 | padre | I-38: el área del padre no tenía camino de interfaz a `/reportar` | 9e052874 |
| 3 | aislamiento | `esDestinoPermitidoPorRol` contradecía al proxy en `/dashboard/admin` (startsWith) | 224eae5a |
| 4 | suite completa | SPEC-114 no indexada en `specs/README.md` (rojo de specs-discipline) | 4fdabde3 |

## Aceptación (T011) — demostrada, no afirmada

Con `SESION_ROUTES` de SPEC-113 revertida (sin `/api/auth/cambiar-password` ni
`/api/auth/logout`), la suite va en **ROJO en 3 tests** (colegio ×2 + sesión SCHOOL_ADMIN).
Restaurada → verde. Nota: el recorrido padre no se ve afectado porque `/api/auth/*` es ruta
pública en el proxy para PARENT; la trampa I-35 era exclusiva del colegio.

## Ciclos

6 ciclos con datos distintos, bitácora completa en `docs/ciclos-estabilizacion-114.md`:

- Ciclos 1-4: verdes (ciclo 1 con el rojo del índice de specs, arreglado).
- Ciclo 5: 1 rojo **flaky** sin evidencia recuperable (captura tail-only, error propio).
- Ciclo 6 (obligatorio tras el rojo del 5): el flaky reapareció con nombre —
  `operador-comite · bandeja y confirma`, **5142 ms contra el default de 5000 ms de vitest**.
  Hipótesis fuerte: timeout del harness bajo contención de CPU (Ollama + bcrypt), no aserción
  rota. Calibración: `timeout: 30_000` SOLO en los 7 journeys, **sin tocar aserciones** (4b894066).
  40/40 verdes en caza dirigida; suite completa posterior: 965 verdes.

## Gate final

- `npx tsc --noEmit`: verde.
- `npm run lint`: 0 errores (1 warning preexistente en `IaModelSelector.tsx`, fuera de alcance).
- `npm run test`: 965 verdes, 1 skipped (la lenta opt-in).
- `npm run build` (con `rm -rf .next`): verde.
- CI GitHub: primer run (30406450104) en **ROJO** por dos causas, ambas arregladas (d7c07f93):
  1. `plan.md`/`research.md`/`tasks.md` de la 114 nunca se habían commiteado (untracked) —
     rojo de specs-discipline. Lección: verificar `git status`, no asumir.
  2. El journey admin exigía 200 de `/api/admin/ia/modelos`, que sin Ollama (CI no tiene
     cerebro) responde 500 con error **controlado** por diseño. El camino del admin ahora se
     verifica con cerebro presente (200 + lista) o ausente (500 estructurado, no excepción).
- CI run final: **30407027665 · success** (tras el fix d7c07f93).

## Deuda para ZEUS

1. **Flaky**: si reaparece CON 30 s de margen, ya no es timeout — capturar mensaje completo +
   estado de BD antes de tocar (protocolo en la bitácora).
2. **`/api/admin/ia/modelos` no degrada como el sondeo de I-24 (SPEC-101)**: con Ollama caído
   responde 500 con error controlado en vez de una respuesta degradada útil para el Centro IA.
   Misma familia que I-24; el journey ya acepta ambos contratos. Decisión de producto.
3. Warning de lint preexistente en `IaModelSelector.tsx:77` (exhaustive-deps) — no tocado.
4. El recorrido padre no puede verse afectado por una reversión tipo SPEC-113 vía proxy
   (`/api/auth/*` público): si se quiere esa cobertura, es decisión de diseño del proxy, no de la suite.

## Fuera de alcance (registrado, no decidido)

- I-37 (admin no ve usuarios padre) y pantalla "En proceso": decisiones de producto del CEO.
