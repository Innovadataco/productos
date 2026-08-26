# Implementation Plan: Guardián de índices (cierra I-49)

**Branch**: `work/002-PI-154` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-154-GUARDIAN-INDICES-I49 · BRIEF-GUARDIAN-INDICES-I49 v1.1 · D-72 (reutilizar, no clonar)

---

## Summary

Cerrar I-49 automatizando lo que hoy es disciplina humana. Se **extiende** `scripts/verify-hnsw-indexes.ts` (48 líneas, ya cubre 2 de 5 índices) para verificar los 5 índices en riesgo con generalización de tipo (`btree`/`gin`/`hnsw`/`unique`), detección de huérfanos y salida `--json`. Se cablea a las **tres compuertas** que hoy faltan: CI (paso nuevo tras cada `prisma migrate deploy` en `.github/workflows/ci.yml`), `scripts/deploy-prod.sh` (entre L27 y L41), y `pi-monitor` (nueva señal `indices` con frecuencia parametrizable). Migración aditiva única: `monitoreo.indices.frecuencia_horas` (default 24) en `ParametroSistema` (`upsert({create,update:{}})`, anti-I-100). Se conserva `pnpm db:verify:hnsw` como alias de `pnpm indices:check` para no romper invocaciones existentes.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Node.js ≥ 22 · TypeScript 5 · Prisma 5.22.0 (raw SQL sobre `pg_indexes` / `pg_class` / `pg_am`) |
| **Runtime del guardián** | `tsx scripts/verify-hnsw-indexes.ts` (mismo runner que hoy) |
| **BD** | PostgreSQL 16 + pgvector; consultas a catálogos (no a datos) |
| **Testing** | Vitest para unit del formatter y del parser de tipos; test de integración que crea BD desde cero y verifica los 5 índices |
| **Rendimiento** | < 2 s p95 sobre BD de producción; presupuesto duro de 5 s con timeout explícito |
| **Constraints** | Cero cambios al motor · el guardián NUNCA modifica índices · una sola migración aditiva · sin `Math.random`/`Date.now` en tests |
| **Autonomía** | Régimen D-51 dentro de este frente: build → PR → gate CI → auditoría ZEUS → deploy CEO |

---

## Constitution Check

- ✅ **Solo texto** — irrelevante para este frente (no toca reportes ni multimedia).
- ✅ **IA local** — irrelevante; el guardián no consume Ollama ni APIs externas.
- ✅ **Migraciones aditivas y no destructivas** — la única migración añade una fila de parámetro por `upsert`; no borra ni modifica índices reales.
- ✅ **Frontera DAL (Q-3)** — el script sigue viviendo en `scripts/` con cliente Prisma propio; no se importa desde `src/app/**`.
- ✅ **Sin `any` ni stack traces al cliente** — el guardián no es endpoint; las funciones nuevas se tipan estrictamente.
- ✅ **Un solo commit por User Story + uno de docs** — plan §Fases documenta el mapa de commits.

Sin violaciones. `Complexity Tracking` no aplica.

---

## Project Structure

### Documentation (this feature)

```text
specs/251-guardian-indices-i49/
├── plan.md              # Este archivo
├── spec.md              # ya creado
├── research.md          # Fase 0 (a producir con /speckit.tasks)
├── data-model.md        # Fase 1 (parámetro nuevo + REQUIRED como fuente de verdad)
├── quickstart.md        # Fase 1 (guía de pruebas SC-000..SC-009)
├── contracts/           # sólo si se expone endpoint (v1: no)
└── tasks.md             # Fase 2 (a producir con /speckit.tasks)
```

### Código a tocar (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── scripts/
│   ├── verify-hnsw-indexes.ts          # EXTENDER (D-72): REQUIRED de 2 → 5, tipos, huérfanos, --json, alias
│   ├── deploy-prod.sh                  # INSERTAR guardián entre L27 y L41
│   └── monitor-probes.mjs              # AGREGAR señal `indices` (probe + frecuencia parametrizable)
├── src/lib/monitoreo/
│   └── probes.ts                       # AGREGAR probeIndices() reutilizando el guardián en modo --json
├── .github/workflows/
│   └── ci.yml                          # AGREGAR paso `npm run indices:check` tras cada `prisma migrate deploy` (L137, L234, L292)
├── prisma/
│   ├── seed.ts                         # AGREGAR upsert de monitoreo.indices.frecuencia_horas=24
│   └── migrations/                     # NO se agregan migraciones nuevas (el parámetro entra por seed)
├── package.json                        # AGREGAR script `indices:check`; conservar `db:verify:hnsw` como alias
└── specs/251-guardian-indices-i49/     # spec-kit del frente
```

**Structure Decision**: monolito Next.js del PI (Option 2 web sin split visible). El guardián es un script one-shot que reutiliza el singleton `PrismaClient`; las tres compuertas viven donde ya viven sus vecinos (CI, deploy script, monitor).

---

## Implementation Steps

### Phase 1 — Extender el guardián (US1, US4)

1. **`scripts/verify-hnsw-indexes.ts`**: ampliar `REQUIRED` a los 5 índices con estructura tipada (`name`, `table`, `type`, `sostiene`, `migracion`). Documentar en comentario junto al índice truncado por qué está truncado.
2. Generalizar la verificación de tipo: parsear `indexdef` para extraer `USING <am>` y comparar con `type`; para `unique`, mirar `pg_class.relkind`/`pg_index.indisunique`.
3. Consulta única a `pg_indexes` filtrando por `schemaname='public'` **sin** filtro por nombre (para detectar huérfanos también). Ignorar los prefijados con `pg_`.
4. Cambiar los prefijos de log de `[VERIFY HNSW]` a `[INDICES]`; conservar los antiguos como sinónimo para no romper greps existentes (o mantener ambos en una sola línea de header).
5. Flag `--json` que emite `{ ok, missing, wrongType, orphans, checkedAt, durationMs }`; humano por defecto.
6. Timeout duro de 5 s con `AbortController` sobre las queries de Prisma; salida con código `2` si expira (distinguible de `1` = falta/tipo).
7. Manejo de fallo de conexión: código `2` con mensaje explícito, sin stack.

### Phase 2 — Cablear las 3 compuertas (US1, US2, US3)

8. **`package.json`**: agregar `"indices:check": "tsx scripts/verify-hnsw-indexes.ts"` y reescribir `"db:verify:hnsw": "npm run indices:check"` para conservar el alias (SC-000).
9. **`.github/workflows/ci.yml`**: tras cada `- run: npx prisma migrate deploy` (L137, L234, L292) agregar `- run: npm run indices:check`. En un solo commit, con el mismo bloque de env que el step anterior.
10. **`scripts/deploy-prod.sh`**: insertar `echo "==> Verificar índices (guardián I-49)"` + `$COMPOSE exec -T app npm run indices:check` inmediatamente después de L27 (`prisma migrate deploy`). `set -e` ya garantiza que si falla, el script sale sin ejecutar L29-L41.
11. **`scripts/monitor-probes.mjs`**: agregar constante `SENALES.push('indices')`, leer `monitoreo.indices.frecuencia_horas` (default 24) por tick, invocar `probeIndices()` cuando toca; registrar como `HealthProbe`. **Nunca reiniciar nada.**
12. **`src/lib/monitoreo/probes.ts`**: implementar `probeIndices()` que ejecuta el guardián en modo `--json` (spawn de proceso hijo o import in-process; preferir import in-process para <200 ms) y devuelve `{ estado: 'OK'|'ROJO', detalles }` respetando la interfaz de las otras probes.

### Phase 3 — Parámetro y seed (FR-010)

13. **`prisma/seed.ts`**: agregar `upsert({ where: { clave: 'monitoreo.indices.frecuencia_horas' }, create: { clave, valor: '24', tipo: 'INT', descripcion: 'Cada cuántas horas pi-monitor re-verifica los 5 índices críticos (SPEC-251)' }, update: {} })`. Anti-I-100 estricto.
14. Verificar que el seed sigue idempotente corriendo `node --import tsx prisma/seed.ts` dos veces en dev; sin cambios entre corridas.

### Phase 4 — Tests (SC-000..SC-009)

15. **Unit (Vitest)**: `scripts/verify-hnsw-indexes.test.ts` cubre el parser de tipos (`USING hnsw` vs `USING btree` vs `UNIQUE`), el clasificador de huérfanos, y el formatter humano/JSON.
16. **Integración (Vitest secuencial)**: `tests/integration/indices-check.test.ts` crea la BD desde cero (`prisma migrate deploy` sobre BD efímera), ejecuta el guardián y verifica que los 5 índices aparecen `OK` (SC-001, SC-008). Segundo caso: borra un índice → salida ≠ 0 (SC-002). Tercer caso: convierte HNSW → btree → salida ≠ 0 (SC-003). Cuarto caso: crea índice extra → advertencia + salida 0 (SC-004).
17. Sin `Math.random`, sin `Date.now()` en asserts; los timestamps se comparan con matchers `expect.any(String)`.

### Phase 5 — Docs de arquitectura

18. Regenerar `docs/architecture/` si aplica (probablemente sí, porque cambia el mapa de `scripts/` y `pi-monitor`). Correr `npm run arch:check` en verde antes del PR.

### Phase 6 — Gate LOCAL + PR

19. `npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build` · `./scripts/dev-restart.sh` con healthcheck OK.
20. `npm run arch:check` verde.
21. Gate pre-push (I-101): `git fetch origin && git rebase origin/feature/001-scaffolding && git diff --name-status origin/feature/001-scaffolding..HEAD` — si aparecen archivos ajenos → HALLAZGO · PARA.
22. Commit map (un cambio lógico = un commit; español, imperativo):
    - `feat(indices): extender verify-hnsw-indexes a los 5 índices con --json y huérfanos [SPEC-251]`
    - `feat(indices): cablear indices:check en CI, deploy-prod y pi-monitor [SPEC-251]`
    - `feat(indices): sembrar monitoreo.indices.frecuencia_horas (upsert, anti-I-100) [SPEC-251]`
    - `test(indices): unit + integración de los 5 índices (SC-001..SC-004, SC-008) [SPEC-251]`
    - `docs(indices): spec-kit 251-guardian-indices-i49 + regenerar architecture [SPEC-251]`

---

## Test Strategy

- **Unit**: parser `indexdef → { am, unique }`, formatter humano vs JSON, clasificador `esperado/faltante/tipo_incorrecto/huérfano`.
- **Integración**: BD desde cero + los 4 escenarios SC-001..SC-004 corriendo el binario real vía `tsx`; validar exit code y stdout capturado.
- **Deploy dry-run**: simular el bloque de `deploy-prod.sh` (L26..L28) con el guardián retornando error → confirmar que L29+ no se ejecuta. Se puede hacer con un test bash o simplemente con inspección + `bash -n`.
- **CI**: PR de prueba en rama descartable que rompe un índice → confirmar que el step falla y el PR queda rojo (SC-005). Se documenta en `cierre.md`, no se mergea.
- **pi-monitor**: unit de `probeIndices()` con un guardián stubeado; smoke con frecuencia baja en local.

---

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| El parser de `indexdef` no distingue `unique` correctamente. | Cruzar con `pg_index.indisunique` en la misma query; test unit dedicado al caso `patrones_institucionales`. |
| `pi-monitor` se recarga y pierde el intervalo. | El tick de 5 s ya relee `ParametroSistema`; el probe se dispara cuando `(ahora - ultimoRun) ≥ frecuencia_horas·3600s`. Persistir `ultimoRun` en `HealthProbe`. |
| El deploy en el VPS no encuentra `npm run indices:check`. | El script vive en `scripts/`, ya empaquetado en la imagen; se prueba en un build local antes de mergear. |
| Un huérfano legítimo hace ruido perpetuo. | Advertencia (no error) por diseño; se documenta la regla: si aparece, se agrega a `REQUIRED` en un PR posterior. Es la disciplina que queremos forzar. |
| El nombre truncado de `patrones_institucionales` se "corrige" sin querer. | Comentario en `REQUIRED` junto a la entrada, y una nota en `AGENTS.md` (fuera de esta SPEC si excede alcance, dentro si el diff lo permite). |
| Cambia el número de línea de `deploy-prod.sh` antes del merge. | Anclar por texto (`prisma migrate deploy`) en el patch, no por número; validar en la revisión del diff. |

---

## Out of Scope

- **Reparación automática** de índices faltantes (v2, sólo si el CEO lo pide).
- **Renombrar** el índice truncado de `patrones_institucionales`.
- **Limpiar la deriva de fondo** (declarar los índices HNSW/GIN en `schema.prisma`) — frente aparte.
- **Alertas por email** cuando el guardián falla en `pi-monitor` — reutilizable después con el Motor de Notificaciones.
- **Cambios al motor** `src/lib/ai/**` — prohibido en este frente.
