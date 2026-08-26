# Implementation Plan: IDs de advisory lock únicos (cierra I-130, I-137)

**Branch**: `work/002-PI-184` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-184-IDS-ADVISORY-LOCK · REPORTE-004-2026-08-26-2310 §1 · I-130 (causa raíz reescrita) · I-137 (clase de fallo)

---

## Summary

Cerrar I-130 e I-137 con el fix **más pequeño posible** que reactive el monitor de producción sin romper `pi-senal-comunitaria`. Se cambian **tres literales numéricos** en `scripts/worker-senal-comunitaria.mjs`, `scripts/worker-sesiones.mjs` y `scripts/worker-tasas.mjs` (respectivamente `123456796`, `123456797`, `123456798`). El `monitor-probes` conserva `123456790` — no cambia su identidad porque el worker que está roto es él. Se agrega `scripts/ADVISORY-LOCKS.md` como fuente única de verdad de los 12 IDs y `scripts/locks-check.ts` como compuerta que corre en el job `verificaciones` de CI, normaliza separadores JS antes de comparar y falla si detecta colisión o desalineo tabla ↔ código. **Cero migraciones**. **Cero cambios al motor**. **NO se implementa "reclamar candado huérfano"** (candado crítico del INSTRUCTIVO — el lock no está huérfano, lo tiene un proceso vivo). La lógica `pg_try_advisory_lock` / `pg_advisory_unlock` NO se toca.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Node.js ≥ 22 · TypeScript 5 · sin dependencias nuevas |
| **Runtime de la compuerta** | `tsx scripts/locks-check.ts` (mismo runner que `tokens:check` y `arch:check`) |
| **I/O** | Solo lectura de archivos (`scripts/*.mjs` + `scripts/ADVISORY-LOCKS.md`). Cero conexiones a Postgres. |
| **Testing** | Vitest unit: parser de literales con `_`, detector de colisiones, comparador tabla ↔ código. Integración: BD no aplica (compuerta es puro texto). |
| **Rendimiento** | < 500 ms p95; presupuesto duro 5 s con timeout explícito. |
| **Constraints** | Cero cambios en `src/lib/ai/**` · cero migraciones · NO reclamar locks huérfanos · NO levantar `worker-sesiones` ni `worker-tasas` · lógica de `pg_try_advisory_lock` intacta |
| **Autonomía** | Régimen D-51 dentro del frente: build → PR → gate CI → auditoría Fábrica → deploy Jelkin → verificación en vivo (obligatoria) |

---

## Constitution Check

- ✅ **Solo texto** — irrelevante (no toca reportes ni multimedia).
- ✅ **IA local** — irrelevante; la compuerta no consume Ollama ni APIs externas.
- ✅ **Migraciones aditivas y no destructivas** — **cero migraciones** en este frente.
- ✅ **Frontera DAL (Q-3)** — la compuerta vive en `scripts/`, no importa `@/lib/prisma` desde `src/app/**`.
- ✅ **Sin `any` ni stack traces al cliente** — la compuerta es CLI; funciones nuevas tipadas estrictamente.
- ✅ **Un solo commit por User Story + uno de docs** — plan §Fases documenta el mapa de commits.

Sin violaciones. `Complexity Tracking` no aplica.

---

## Project Structure

### Documentation (this feature)

```text
specs/284-ids-advisory-lock-i130-i137/
├── plan.md              # Este archivo
├── spec.md              # ya creado
└── tasks.md             # Fase 2 (a producir con /speckit.tasks)
```

### Código a tocar (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── scripts/
│   ├── worker-senal-comunitaria.mjs   # CAMBIAR literal 123_456_790 → 123456796 + comentario
│   ├── worker-sesiones.mjs            # CAMBIAR literal 123456790 → 123456797 + comentario
│   ├── worker-tasas.mjs               # CAMBIAR literal 123456790 → 123456798 + comentario
│   ├── monitor-probes.mjs             # SIN cambio (mantiene 123456790 por identidad)
│   ├── ADVISORY-LOCKS.md              # NUEVO — fuente única de verdad, 12 filas
│   ├── locks-check.ts                 # NUEVO — compuerta de CI (< 500 ms, solo I/O de archivos)
│   └── locks-check.test.ts            # NUEVO — unit tests (parser, detector, comparador)
├── .github/workflows/
│   └── ci.yml                         # AGREGAR paso `npm run locks:check` en job `verificaciones` (junto a tokens:check y arch:check)
├── package.json                       # AGREGAR script `"locks:check": "tsx scripts/locks-check.ts"`
└── specs/284-ids-advisory-lock-i130-i137/   # spec-kit del frente
```

**Structure Decision**: monolito Next.js del PI. La compuerta sigue el patrón de `tokens-check.ts` (TypeScript en `scripts/`, corrida por `tsx`, integrada al job `verificaciones` del CI). La tabla en Markdown y no en TypeScript importable porque su audiencia principal es humana (Jelkin, Fábrica, Desarrollo revisando en PR) y porque el CI ya la parsea desde el binario `locks-check.ts` sin necesidad de que sea código.

---

## Implementation Steps

### Phase 1 — Cambiar los tres IDs en colisión (US1, US4)

1. **`scripts/worker-senal-comunitaria.mjs:20`**: reemplazar `const ADVISORY_LOCK_ID = 123_456_790;` por `const ADVISORY_LOCK_ID = 123456796;` con comentario `// SPEC-284 (I-130): ID único, sin separadores JS — antes 123_456_790 colisionaba con monitor-probes`.
2. **`scripts/worker-sesiones.mjs:22`**: reemplazar `const ADVISORY_LOCK_ID = 123456790;` por `const ADVISORY_LOCK_ID = 123456797;` con comentario `// SPEC-284 (I-130): ID único — antes 123456790 era bomba latente, colisionaba con monitor-probes`.
3. **`scripts/worker-tasas.mjs:14`**: reemplazar `const ADVISORY_LOCK_ID = 123456790;` por `const ADVISORY_LOCK_ID = 123456798;` con comentario `// SPEC-284 (I-130): ID único — antes 123456790 era bomba latente, colisionaba con monitor-probes`.
4. **`scripts/monitor-probes.mjs`**: **NO tocar**. Mantiene `123456790` por identidad. Se documenta en la tabla que este ID es del monitor.

### Phase 2 — Tabla única (US2)

5. **`scripts/ADVISORY-LOCKS.md`** (nuevo): tabla con 12 filas cubriendo todos los IDs conocidos, más una sección "Regla operativa" que declara: (a) *fuente única de verdad*, (b) *todo worker nuevo se registra aquí antes de existir*, (c) *sin separadores `_` en el literal para que sea greppeable*, (d) *la compuerta `locks:check` verifica coherencia tabla ↔ código*.

### Phase 3 — Compuerta CI (US3)

6. **`scripts/locks-check.ts`** (nuevo): script Node/TS que:
   - Lee todos los `scripts/*.mjs` (glob).
   - Extrae con regex `^\s*const\s+ADVISORY_LOCK_ID\s*=\s*([0-9_]+)\s*;` una única declaración por archivo (falla si aparecen varias en el mismo archivo).
   - Normaliza cada literal quitando `_`.
   - Detecta colisiones (dos archivos con el mismo ID normalizado) → salida ≠ 0 con archivos + ID.
   - Parsea `scripts/ADVISORY-LOCKS.md` extrayendo la primera columna de la tabla (los IDs) y normalizando.
   - Verifica igualdad de conjuntos entre IDs-en-código y IDs-en-tabla → salida ≠ 0 si difieren.
   - Timeout duro de 5 s con `AbortController` (defensa contra I/O colgado en CI).
   - Reporta "N IDs verificados, sin colisiones" en verde.
7. **`package.json`**: agregar `"locks:check": "tsx scripts/locks-check.ts"`.
8. **`.github/workflows/ci.yml`**: en el job `verificaciones` (L39), tras el paso `- run: npm run arch:check` (L60), agregar `- run: npm run locks:check`. Un solo commit.

### Phase 4 — Tests (SC-005..SC-007, SC-009)

9. **`scripts/locks-check.test.ts`** (unit, Vitest): tres archivos temporales con IDs sintéticos:
   - Caso feliz: 3 IDs únicos, tabla coincidente → salida 0.
   - Colisión literal exacta (dos archivos con `123`) → salida ≠ 0.
   - Colisión con separadores (`123_456_790` vs `123456790`) → salida ≠ 0 (SC-006).
   - Desalineo tabla ↔ código (ID en código faltante en tabla, o al revés) → salida ≠ 0 (SC-007).
   - Rendimiento: assertar `durationMs < 500` con timers falsos o con `performance.now()`.
10. Los tests corren `verificarLocks({ scriptsDir, tablaPath })` como función pura importable (main() solo hace `process.exit`), para poder testear sin spawns.

### Phase 5 — Verificación previa al push

11. **Gate LOCAL** (I-101/I-104):
    - `npx tsc --noEmit`
    - `npm run lint`
    - `npm run tokens:check`
    - `npm run arch:check`
    - `npm run locks:check` (verde con los 12 IDs corregidos)
    - `npm run test:unit`
12. **Gate pre-push OBLIGATORIO**: `git fetch origin && git rebase origin/feature/001-scaffolding && git diff --name-status origin/feature/001-scaffolding..HEAD` — si aparecen archivos ajenos (fuera de las 8 rutas listadas en §Código a tocar) → HALLAZGO · PARA · reporta.

### Phase 6 — PR + CI + deploy + verificación en vivo (obligatoria)

13. Push a `origin/work/002-PI-184`. Fábrica abre PR y mergea cuando CI cierre verde.
14. Jelkin ejecuta `deploy-prod.sh` en el VPS.
15. **⭐ Verificación en vivo obligatoria (sin ella no hay CUMPLE, del INSTRUCTIVO):**
    - `ssh pi-vps "docker compose -f docker-compose.prod.yml ps"` → `monitor` en **Up** (no `Restarting`), `pi-senal-comunitaria` en **Up**.
    - `ssh pi-vps "docker compose ... exec -T db psql -U proteccion -d proteccion_infantil -c 'SELECT COUNT(*) FROM \"HealthProbe\"'"` → devuelve **> 0**.
    - Reporte con los tres números concretos.

### Commit map (español, imperativo, un cambio lógico = un commit)

- `docs(spec-kit): SPEC-284 · spec + plan · IDs de advisory lock únicos (I-130, I-137) [002-PI-184]`
- `fix(workers): IDs advisory lock únicos para senal-comunitaria/sesiones/tasas [SPEC-284]`
- `docs(scripts): tabla ADVISORY-LOCKS.md como fuente única de verdad [SPEC-284]`
- `feat(ci): compuerta locks:check en job verificaciones (normaliza separadores JS) [SPEC-284]`
- `test(locks): unit de compuerta locks:check (colisiones, desalineo, separadores) [SPEC-284]`

---

## Test Strategy

- **Unit (Vitest)**: parser de literales con `_`, detector de colisiones (misma clave normalizada en distintos archivos), comparador de conjuntos tabla ↔ código, medición de duración.
- **Integración**: no aplica — la compuerta no toca BD ni servicios. La "integración" real es el CI corriendo el paso en el job `verificaciones` sobre el árbol de la rama.
- **CI**: el propio PR de esta SPEC ejecuta `locks:check` en verde. Un PR sintético descartable puede probar el rojo (SC-006) documentado en `cierre.md` sin mergear.
- **Verificación en vivo**: post-deploy en el VPS, tres comprobaciones concretas (monitor Up, HealthProbe > 0, pi-senal-comunitaria Up). Reporte con los números, no con narrativa.

---

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| Al cambiar el ID de `worker-senal-comunitaria`, la sesión Postgres que hoy retiene `123456790` **NO se libera** hasta que el proceso muera. En el compose, el proceso muere en el `docker compose up -d --force-recreate` del deploy. Si Jelkin hace deploy sin recrear el contenedor, el lock queda tomado con el ID viejo (huérfano de verdad) y el monitor sigue sin arrancar. | El script `deploy-prod.sh` ya recrea todos los servicios modificados (`docker compose up -d`). Se documenta en `cierre.md` para verificación explícita: reiniciar `pi-senal-comunitaria` es parte del deploy. Si por algún motivo el CEO opta por `restart` en vez de `up -d`, la sesión anterior muere igual. |
| Regex de la compuerta no detecta declaraciones multi-línea o con comentarios inline. | El patrón hoy en los 12 archivos es uniforme (`const ADVISORY_LOCK_ID = <n>;` en una línea). La compuerta se ajusta a ese patrón y falla explícitamente si un archivo declara el símbolo pero no matchea. |
| Alguien "corrige" el literal `123456796` a `123_456_796` pensando que es un descuido de formateo. | Comentario junto a cada literal explicando el porqué; regla explícita en `ADVISORY-LOCKS.md`; la compuerta normaliza igualmente y no lo caza — es riesgo residual, mitigado por documentación densa. |
| Al rebasar sobre `origin/feature/001-scaffolding` aparece conflicto en `scripts/` porque Desarrollo 1 tocó otros workers en A-25. | Conservar ambos bloques (§9.6 CLAUDE.md). Los archivos tocados por este frente (`senal-comunitaria`, `sesiones`, `tasas`) son distintos de los de A-25 (`analisis-score`, `supervisor`). Si hay conflicto, es en la tabla `ADVISORY-LOCKS.md` — se resuelve manteniendo todas las filas nuevas de ambos frentes. |
| El test unit crea archivos temporales en `/tmp` con nombres colisionantes entre corridas paralelas. | Usar `mkdtempSync` con prefijo por test para aislar; limpieza en `afterEach`. |
| `locks:check` sube el tiempo del job `verificaciones` de CI. | El paso es < 500 ms; despreciable frente a los ~2 min actuales del job. Se mide en el PR. |

---

## Out of Scope

- **"Reclamar candado huérfano"** (candado crítico del INSTRUCTIVO). Prohibido: el lock lo tiene un proceso vivo y sano; reclamarlo mataría a `pi-senal-comunitaria`.
- **Levantar `worker-sesiones` o retirar `worker-tasas`** (I-132). Decisión de negocio de Jelkin, aparte.
- **Refactorizar `pg_try_advisory_lock` / `pg_advisory_unlock`** en los cuatro archivos. Funciona bien; solo cambian los números.
- **Ampliar la compuerta a otros patrones de lock** (por nombre, por schema, etc.). v1 solo cubre `ADVISORY_LOCK_ID` constante en `scripts/*.mjs`.
- **Cambios al motor** `src/lib/ai/**`. Prohibido en este frente.
- **`ensureQueue` en workers pg-boss**: si aparece pendiente en un archivo tocado, se **reporta** (I-131 asignado a Desarrollo 1 en A-25) — no se arregla aquí.
- **Migraciones Prisma**. Cero. No se toca `schema.prisma` ni `prisma/migrations/`.
- **Endpoint HTTP** que exponga el estado de la compuerta. La compuerta es CI-only.
