# Implementation Plan: SPEC-170 — Limpieza del Centro de Control IA

**Branch**: `work/002-pi-068` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

---

## Summary

Tres fases secuenciales de limpieza técnica en un solo PR:

1. **Fase 1 — Split CI `test`**: dividir el job monolítico en `test-unit` (sin BD, paralelizable) y `test-integration` (con BD, `singleFork`), bajando wall-clock del CI.
2. **Fase 2 — Retiro de Experimentos**: exportar el banco curado como fixture, eliminar endpoints/UI/DAL/modelos/Enums de Experimentos y renombrar la tab `Eval` → `Simulación`.
3. **Fase 3 — Retiro de motor Legacy**: eliminar `classifier.ts`, simplificar `motor.ts`, limpiar `sandbox.ts` y Playground; solo rúbrica en producción.

Cada fase tiene commit propio. El CI verde se verifica una sola vez al final del PR.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10, Prisma 5.22.0, Vitest 3.2.x, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ con pgvector |
| **Testing** | Vitest + jsdom + `@testing-library/react`; projects `unit` e `integration` |
| **CI** | GitHub Actions `.github/workflows/ci.yml` (monorepo productos) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Limpieza de código, sin nuevo contenido multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública ni reportes |
| §2.1 Stack heredado | ✅ Pass | Reusa Next.js + Prisma |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma |
| §3.5 Logs y auditoría | ✅ Pass | No se eliminan logs de auditoría reales |
| §4.1 Singletons | ✅ Pass | No se toca singleton de Prisma |
| I-49 Migraciones aditivas | ⚠️ Nota | Fase 2 incluye `DROP TABLE IF EXISTS` para tablas de Experimentos; es seguro porque son tablas exclusivas de código muerto |

---

## Project Structure

### Documentation (this feature)

```text
specs/170-limpieza-centro-control-ia/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── vitest.config.ts              # MOD: projects unit + integration
├── package.json                  # MOD: + test:unit, test:integration, exportar-banco-curado
├── .github/workflows/ci.yml      # MOD: split job test → test-unit + test-integration
├── fixtures/
│   ├── banco-curado-v2.jsonl     # NUEVO (Fase 2)
│   └── README.md                 # NUEVO (Fase 2)
├── scripts/
│   └── exportar-banco-curado.ts  # NUEVO (Fase 2)
├── prisma/
│   ├── schema.prisma             # MOD: -EvalRun -EvalResultado -CasoEval -EvalRunEstado -CasoEvalFuente
│   └── migrations/               # ADD: migración DROP IF EXISTS
└── src/
    ├── lib/
    │   ├── ai/
    │   │   ├── motor.ts          # MOD: solo rúbrica
    │   │   ├── classifier.ts     # DEL (Fase 3)
    │   │   ├── sandbox.ts        # MOD: overrides de rúbrica, cartel motor
    │   │   └── eval-runner.ts    # DEL (Fase 2)
    │   ├── dal/
    │   │   ├── repositories/
    │   │   │   ├── caso-eval.ts      # DEL (Fase 2)
    │   │   │   ├── eval-resultado.ts # DEL (Fase 2)
    │   │   │   └── eval-run.ts       # DEL (Fase 2)
    │   │   └── services/
    │   │       └── ia-evals.ts       # DEL (Fase 2)
    │   └── permisos-catalogo.ts  # MOD: retirar ia_eval, renombrar/ajustar ia_simulaciones
    ├── app/
    │   └── api/admin/ia/
    │       ├── experimentos/     # DEL (Fase 2)
    │       └── evals/            # DEL (Fase 2)
    └── components/modules/ia/
        ├── eval/                 # DEL (Fase 2)
        ├── IaEvalManager.tsx     # MOD: solo tab Simulación
        ├── IaPlayground.tsx      # MOD: cartel + sliders rúbrica
        └── IaModelSelector.tsx   # MOD: ajustar a overrides rúbrica
```

---

## Fase 1 · Split del job `test` de CI

### Cambios técnicos

1. **Vitest projects** en `vitest.config.ts`:
   - Define `unit` e `integration` con su propio `test.include`/`exclude`.
   - `integration` hereda `pool: forks`, `singleFork: true`, mutex de BD.
   - `unit` usa default (`forks` sin `singleFork`) o `threads` si es estable.
   - Ambos projects reportan cobertura (`coverage.enabled` true por defecto o vía CLI).

2. **Scripts en `package.json`**:
   - `test:unit`: `vitest run --project unit --coverage.enabled`
   - `test:integration`: `vitest run --project integration --coverage.enabled`
   - `test:coverage` se mantiene corriendo ambos projects (agregador local).

3. **Clasificación de tests**:
   - Criterio: si el archivo importa `@/lib/prisma` o `src/lib/test-setup.ts` (el que contiene el mutex), va a `integration`.
   - Todo lo demás va a `unit`.

4. **`.github/workflows/ci.yml`**:
   - Reemplazar job `test` por dos jobs:
     - `test-unit`: sin servicio `db`, corre `npm run test:unit`.
     - `test-integration`: con servicio `db` (igual que hoy), corre `npm run test:integration`.
   - Ajustar `gate.needs` a `[verificaciones, test-unit, test-integration, journeys, build]`.

### Gate de fase

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run arch:check`
- `npm run build`

### Commit

`fase 1 (002-PI-068): split job test en test-unit + test-integration`

---

## Fase 2 · Retiro de Experimentos + preservación del banco curado

### Bloque 2.A — Exportar banco curado

1. Crear `scripts/exportar-banco-curado.ts`:
   - Lee `CasoEval` desde Prisma.
   - Filtra `activo=true` (o todos, según decisión; por defecto activos).
   - Escribe `fixtures/banco-curado-v2.jsonl` con los campos requeridos.
   - Idempotente (sobreescribe archivo).

2. Añadir script `exportar-banco-curado` en `package.json`.

3. Crear `fixtures/README.md` con origen, aprobación y fecha.

4. Correr el script y commitear el `.jsonl`.

### Bloque 2.B — Eliminar Experimentos

1. **Endpoints** (borrar carpetas/archivos):
   - `src/app/api/admin/ia/experimentos/**`
   - `src/app/api/admin/ia/evals/**`

2. **Componentes UI** (borrar carpeta):
   - `src/components/modules/ia/eval/**`

3. **DAL** (borrar archivos):
   - `src/lib/dal/repositories/caso-eval.ts`
   - `src/lib/dal/repositories/eval-resultado.ts`
   - `src/lib/dal/repositories/eval-run.ts`
   - `src/lib/dal/services/ia-evals.ts`
   - `src/lib/ai/eval-runner.ts`

4. **Modelos Prisma**:
   - Eliminar `EvalRun`, `EvalResultado`, `CasoEval`.
   - Eliminar enums `EvalRunEstado`, `CasoEvalFuente`.
   - Crear migración `DROP TABLE IF EXISTS "EvalResultado", "EvalRun", "CasoEval"; DROP TYPE IF EXISTS "EvalRunEstado", "CasoEvalFuente";`.

5. **UI tab**:
   - Modificar `IaEvalManager.tsx`: quitar tabs Laboratorio/Casos/Historial; renombrar estado a solo `"simulacion"`.
   - En `src/lib/nav-items.ts`: cambiar `IA_TABS` key `"eval"` → `"simulacion"`, label `"Simulación"`, módulo `"ia_simulaciones"`.

6. **Permisos**:
   - Retirar `ia_eval` de `CATALOGO_MODULOS` en `src/lib/permisos-catalogo.ts`.
   - Ejecutar `sync-modulos-grants` si aplica (o dejarlo para el seed; ver `prisma/seed-modulos-grants.ts`).

### Gate de fase

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run arch:check`
- `npm run build`

### Commit

`fase 2 (002-PI-068): export banco curado como fixture + retiro Experimentos`

---

## Fase 3 · Retiro del motor Legacy

### Cambios técnicos

1. **`src/lib/ai/motor.ts`**:
   - Eliminar tipo `MotorClasificacion`.
   - `motorActivo()` puede eliminarse o retornar constante `'rubrica'`.
   - `clasificarConMotorActivo()` llama directo a `clasificarConRubrica`.
   - Eliminar `OpcionesMotor.modeloClasificacionLegacy` y `OpcionesMotor.voting`.
   - Eliminar campos `ResultadoMotor.motor`, `usoCascada`, `modeloCascada`.
   - Mantener `ResultadoMotor.rubrica`.

2. **`src/lib/ai/classifier.ts`**:
   - Eliminar completo.
   - Verificar con `grep` que nadie más lo importe.

3. **`src/lib/ai/defaults.ts`**:
   - Revisar si `MODELO_CLASIFICACION_DEFAULT` se usa fuera de legacy. Si no, eliminar. Si se usa en simulación como fallback, dejarlo.

4. **`src/lib/ai/schemas.ts`**:
   - No hay schema legacy separado; `classificationResponseSchema` se usa por `llamarOllamaStructured`. Mantener si aún se usa en rúbrica u otros sitios; si solo era para legacy, evaluar eliminación.

5. **`src/lib/ai/sandbox.ts`**:
   - Eliminar campos legacy de `SandboxOverrides`.
   - Agregar overrides de rúbrica: `temperatura`, `umbral_presencia`, `modelos` (subset).
   - Eliminar guards `esVotoIndividual` y `esSecundariaLegacy`.
   - Ajustar la traza para reflejar que el motor es rúbrica.

6. **UI Playground**:
   - `IaPlayground.tsx`: cartel "Motor activo: RÚBRICA".
   - Retirar sliders legacy.
   - Agregar controles para temperatura, umbral_presencia y selección multi-modelo (subset de modelos activos).
   - `IaModelSelector.tsx`: ajustar a modelos de rúbrica.

7. **Parámetro `ia.rubrica.enabled`**:
   - Opción 1 (recomendada): eliminar del seed, de `cargarConfigRubrica`, y migración que borre la fila.
   - Ajustar tests que mockeen `ia.rubrica.enabled`.

### Gate de fase

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run arch:check`
- `npm run build`

### Commit

`fase 3 (002-PI-068): retiro motor Legacy — solo rúbrica`

---

## PR y CI final

1. Push de `work/002-pi-068`.
2. Abrir PR a `feature/001-scaffolding`.
3. Verificar que CI corra con los nuevos jobs `test-unit` + `test-integration` y que `gate` pase.
4. No mergear sin aprobación de ZEUS.

---

## Notas de auditoría

- Cada fase se commitea por separado; ZEUS puede auditar el diff de cada fase sin esperar CI intermedio.
- El `grep` de verificación de Fase 2 y Fase 3 se documenta en `tasks.md` con los comandos exactos.
- La Opción 1 para `ia.rubrica.enabled` se confirma en la Nota final del mensaje de cierre.
