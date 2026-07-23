# Implementation Plan: Deuda técnica P0

**Branch**: `feature/001-scaffolding` (dir de spec: `002-deuda-tecnica-p0`) | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-deuda-tecnica-p0/spec.md` (Status: **Approved** por ZEUS y Jelkin, 2026-07-22)

## Summary

Saneamiento en cuatro tramos, en el orden que ZEUS fijó: **US1 harness** (desbloquea
medir todo lo demás) → **US2 contrato de errores** → **US3 tipado** → **US4 cobertura**.

El orden no es arbitrario: hoy la suite tiene un archivo permanentemente rojo, así
que ningún tramo posterior puede usar "suite verde" como gate hasta que US1 cierre.
Y US4 (16 tests nuevos) sería trabajo perdido si se escribiera antes de que US2 fije
el contrato de error que esos mismos tests deben verificar.

**Enfoque**: infraestructura de tests, un helper de errores compartido y sustitución
de `any` por tipos reales. Cero funcionalidad nueva; ninguna respuesta de éxito
cambia (FR-011).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10 (App Router), Prisma 5.22.0, Vitest 4.1.9, jose, bcryptjs

**Storage**: PostgreSQL 16 + pgvector — **no se usa en la suite unitaria** (mocks)

**Testing**: Vitest + jsdom; mocks con `vi.mock` (patrón ya validado en `src/app/api/config/apis/[id]/test/route.test.ts`, escrito durante la spec 001)

**Target Platform**: Mac (dev, PM2) y VPS Linux (docker compose)

**Project Type**: Web app — refactor interno de calidad

**Performance Goals**: N/A. Métrica relevante: la suite debe seguir corriendo en segundos (hoy ~0,9 s)

**Constraints**: Sin regresión funcional observable (FR-011); sin secretos reales versionados; puertos 5005/5433/5010/5434 intocables (FR-012); prohibido introducir `any` nuevo (§0.3)

**Scale/Scope**: 20 rutas API (19 en módulos críticos), 34 `any` a eliminar (5 lib + 29 rutas), 13 archivos con fuga de `err.message`, 16 archivos de test nuevos

## Constitution Check

*GATE inicial y re-check post-diseño: PASS.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec 002 aprobada por ZEUS y Jelkin. Este plan no implementa nada. |
| §0.2 Pruebas | ✅ Es el objeto de la spec: US1 hace aplicable el gate de suite verde; US4 lo extiende a las rutas críticas. |
| §0.3 Tipado / errores | ✅ US3 lleva `any` a 0 en lib y rutas; US2 elimina la fuga de `err.message`, corrigiendo la contradicción que la propia constitución arrastraba hasta v2.0.0. |
| §0.4 12-factor | ✅ El entorno de test usa valores dummy versionados; ningún secreto real entra al repo. |
| §0.5 Aislamiento | ✅ Cambios puramente de código bajo `001-2026-INNOVADATACO/`; no se toca infra ni puertos. |
| §0.6 IA local | ✅ No aplica (sin inferencia; los tests mockean `fetch`). |

## Project Structure

### Documentation (this feature)

```text
specs/002-deuda-tecnica-p0/
├── spec.md              # Aprobada (ZEUS + Jelkin, 2026-07-22)
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas D-01…D-07
├── quickstart.md        # Comandos de verificación (los números del baseline)
└── tasks.md             # /speckit-tasks
```

`data-model.md` y `contracts/` se omiten: no hay entidades nuevas. El único
contrato nuevo es la forma de respuesta de error, definida en US2 más abajo.

### Source Code (repository root)

Archivos a tocar (NINGUNO se modifica en esta fase de plan):

```text
001-2026-INNOVADATACO/
├── vitest.config.ts                    # MODIFICAR — cargar entorno de test (US1)
├── .env.test                           # CREAR — valores dummy versionados (US1)
├── src/test/prismaMock.ts              # CREAR — mock reutilizable de Prisma (US1)
├── src/lib/apiError.ts                 # CREAR — helper de error normalizado (US2)
├── src/lib/documentProcessor.ts        # MODIFICAR — 5 `any` de pdf2json (US3)
├── src/app/api/**/route.ts             # MODIFICAR — 13 rutas (US2) + 16 archivos con `any` (US3)
└── src/app/api/**/route.test.ts        # CREAR — 16 archivos de test (US4)
```

**Structure Decision**: se añade `src/test/` para utilidades compartidas de test.
Es el único directorio nuevo; el resto son archivos en su ubicación actual.

## Cambios exactos por tramo

### US1 — Harness de tests (FR-001, FR-002, FR-003)

**Bloqueador raíz identificado**: [`src/lib/auth.ts:4-8`](../../src/lib/auth.ts) hace
`throw` **a nivel de módulo** si falta `JWT_SECRET`. Como `auth/login/route.test.ts`
importa la ruta, que importa `auth.ts`, la suite revienta en tiempo de *import*,
antes de ejecutar un solo test. Verificado empíricamente durante la spec 001: dentro
de Vitest, `process.env.JWT_SECRET` tiene longitud 0 y `DATABASE_URL` está ausente
(Vitest **no** inyecta `.env` en `process.env`).

1. **`.env.test`** (nuevo, versionado, sin secretos reales):

   ```bash
   # Valores DUMMY exclusivos para la suite de tests. NO son secretos.
   JWT_SECRET=test_jwt_secret_dummy_no_es_secreto_real_0123456789
   ENCRYPTION_KEY=00000000000000000000000000000000
   DATABASE_URL=postgresql://test:test@localhost:5435/test_db?schema=public
   OLLAMA_BASEURL=http://localhost:11434
   ```

   `DATABASE_URL` existe solo para que Prisma pueda instanciarse; **ninguna prueba
   abre conexión** (todas mockean el cliente).

2. **`vitest.config.ts`**: cargar ese archivo en `process.env` antes de los tests
   (vía `env` en la config de Vitest con `loadEnv` apuntando a `.env.test`).
   Decisión y alternativas en research.md → D-01.

3. **`src/test/prismaMock.ts`** (nuevo): mock reutilizable de `@/lib/prisma` con
   `vi.mock`, siguiendo el patrón ya validado en
   `src/app/api/config/apis/[id]/test/route.test.ts`.

4. **`auth/login/route.test.ts`**: reescribir usando el mock de Prisma en vez de
   `prisma.user.create` real. Cubre 401 con credenciales inválidas y 200 + cookie
   `token` con credenciales válidas (hash bcrypt precomputado en el fixture).

**Nota deliberada**: NO se elimina el `throw` de `auth.ts`. Fallar rápido al arrancar
sin `JWT_SECRET` es una protección de producción; el problema era que la suite no
proveía la variable, no la validación en sí (research.md → D-02).

### US2 — Contrato de errores (FR-004, FR-005, FR-006)

1. **`src/lib/apiError.ts`** (nuevo). Forma normalizada única:

   ```ts
   // Respuesta al cliente: { error: string } — nada más.
   // El detalle técnico va SOLO al log del servidor.
   export function apiError(
     modulo: string,
     accion: string,
     mensajeCliente: string,
     status: number,
     err?: unknown,
   ): NextResponse
   ```

   Registra `[Módulo] Acción: error — <detalle>` (constitución §2.5) y devuelve
   `NextResponse.json({ error: mensajeCliente }, { status })`. El campo `details`
   desaparece del contrato.

2. **13 rutas a migrar** (las que hoy filtran `err.message` al cliente):
   `research/analyze`, `config/apis/[id]/test`, `config/models`,
   `config/models/discover`, `config/models/test`, `config/models/[id]`,
   `config/module-settings`, `auth/login`, `licitaciones`, `licitaciones/estados`,
   `licitaciones/[id]`, `licitaciones/entidades`, `projects`.

   En cada una: `catch (err: unknown)` + `return apiError(...)` con el código HTTP
   correcto de §2.4 — no todo es 500: los fallos de upstream de IA son 502 y los de
   input, 400.

   **Cuidado**: las llamadas `auditLog({... message: err.message })` **se conservan**.
   Eso es log de servidor, no respuesta al cliente; la spec prohíbe filtrar al
   cliente, no registrar internamente.

3. **Riesgo de contrato con el frontend, ya verificado**: los componentes leen
   `error.error` (p. ej. `LicitacionesTab.tsx:121`, `ProjectForm.tsx:33`) y
   **ninguno lee `.details`**. Quitar `details` no rompe pantallas (research.md →
   D-04). Aun así, US2 incluye revisar los componentes que consumen esas rutas.

4. **Tests del contrato**: por ruta migrada, un caso que fuerza el error (mock que
   lanza) y verifica que el JSON de respuesta **no** contiene `err.message`,
   `details` ni stack.

### US3 — Tipado (FR-007, FR-008)

**34 `any` a eliminar**, con ubicación exacta ya medida:

- **`src/lib/documentProcessor.ts` (5)**: líneas 147, 154, 159, 160, 161 — todos
  callbacks de `pdf2json` (`pdfParser_dataError`, `pdfParser_dataReady` y el
  recorrido `Pages/Texts/R`). Se resuelven con interfaces locales mínimas para la
  forma del JSON de pdf2json (research.md → D-05).

- **Rutas API (29 ocurrencias en 16 archivos)**, por densidad:

  | Ocurrencias | Archivo |
  |---|---|
  | 4 | `licitaciones/[id]/route.ts` |
  | 3 | `documents/route.ts` |
  | 3 | `config/apis/[id]/test/route.ts` |
  | 2 | `licitaciones/route.ts`, `licitaciones/estados`, `licitaciones/entidades`, `config/module-settings`, `config/models/discover`, `config/models/[id]` |
  | 1 | `research/analyze`, `projects`, `documents/search`, `config/models/test`, `config/models`, `config/apis/[id]/toggle`, `auth/login` |

  Dos patrones dominantes: (a) `catch (err: any)` → `catch (err: unknown)`, que US2
  ya elimina en 13 de los 16 archivos; (b) filtros `where` dinámicos →
  `Prisma.XWhereInput` (FR-008, constitución §2.2).

  **Solapamiento**: US2 y US3 tocan los mismos archivos. Ese es justamente el motivo
  del orden: US3 hereda el trabajo de US2 y no hay conflicto de ediciones
  (research.md → D-06).

### US4 — Cobertura (FR-009)

**19 rutas en módulos críticos**, de las que 3 ya tienen test → **16 archivos nuevos**:

| Módulo | Rutas | Ya cubiertas | A crear |
|---|---|---|---|
| auth | 2 | 1 (`login`) | 1 (`logout`) |
| licitaciones | 4 | 0 | 4 |
| documents | 3 | 0 | 3 |
| config | 9 | 2 (`models/discover`, `apis/[id]/test`) | 7 |
| research | 1 | 0 | 1 |

Cada archivo cubre el mínimo de FR-009: caso feliz, 401 sin auth y 400 con input
inválido. Todos con mocks; ninguno abre BD (coherente con US1).

`projects` (1 ruta) no figura entre los módulos críticos de la spec: queda fuera del
conteo obligatorio, como opcional.

## Orden de aplicación

1. **US1** — `.env.test`, `vitest.config.ts`, `src/test/prismaMock.ts`, reescribir
   `auth/login/route.test.ts`. **Gate**: `npm run test` verde sin BD ni `.env`.
2. **US2** — `src/lib/apiError.ts` + migrar 13 rutas + tests de contrato.
   **Gate**: 0 rutas devolviendo `err.message`; suite verde.
3. **US3** — eliminar los 34 `any` (lib primero, luego rutas por densidad).
   **Gate**: conteos en 0; `npm run build` y suite verdes.
4. **US4** — 16 archivos de test nuevos. **Gate**: ≥15 archivos; suite verde.
5. **Cierre** — medir todos los números contra el baseline y commitear.

Cada tramo es committeable por separado: si ZEUS decide parar tras US2, el
repositorio queda en estado consistente.

## Verificación por requisito

Los criterios **son** los comandos; el baseline está en la spec (§Contexto).

| FR | Comando de verificación | Esperado (baseline) |
|---|---|---|
| FR-001 | Inspección de `vitest.config.ts` + `git ls-files .env.test` | archivo versionado, sin secretos reales |
| FR-002 | `npx vitest run src/app/api/auth/login/route.test.ts` **con los contenedores abajo** | verde (hoy: rojo) |
| FR-003 | `npm run test` en entorno sin BD ni `.env` | exit 0, 0 archivos fallidos (hoy: 1 rojo) |
| FR-004 | `grep -rn "err.message\|error.message" src/app/api --include="route.ts"`, revisando respuestas al cliente | 0 rutas (hoy: 13 archivos) |
| FR-005 | Rutas importando `apiError`; `grep -rn "details:" src/app/api --include="route.ts"` | 0 ocurrencias |
| FR-006 | `npm run test` — casos que fuerzan error por ruta migrada | verdes |
| FR-007 | `grep -rnE ":\s*any\b\|<any>\|as any\|\bany\[\]" src/lib --include="*.ts" \| grep -v ".test.ts" \| wc -l` y equivalente sobre `src/app/api` | **0** y **0** (hoy: 5 y 29) |
| FR-008 | `grep -rn "WhereInput" src/app/api --include="route.ts"` | filtros dinámicos tipados |
| FR-009 | `find src/app/api -name "*.test.ts" \| wc -l` | **≥ 15** (hoy: 3) |
| FR-010 | `npm run lint \| tail -3` y `npm run build` | < 112 problemas, 0 `no-explicit-any`; build OK |
| FR-011 | Tests de caso feliz por ruta migrada | mismos datos que antes |
| FR-012 | `lsof` sobre 5005/5433/5010/5434 antes/después | sin cambios |

## Complexity Tracking

Sin violaciones constitucionales que justificar.

## Riesgos

- **R-01**: al tipar filtros de Prisma pueden aflorar bugs latentes (p. ej. un filtro
  que nunca aplicaba). La spec ya fija la conducta: corregir si es trivial, escalar a
  ZEUS si cambia comportamiento — nunca silenciar con un cast.
- **R-02**: `documents/route.ts` maneja `FormData`/`File`; sus 3 `any` pueden requerir
  tipos del DOM no disponibles en el runtime de Node. Si hay fricción, se resuelve con
  interfaces locales, no con `any`.
- **R-03**: el umbral "< 112 problemas de ESLint" es débil — eliminar 34 `any` debería
  dejarlo cerca de 78. Se reportará el número real al cierre en vez de conformarse con
  el umbral.
- **R-04**: los 16 archivos de test son el grueso del esfuerzo. Si el tiempo aprieta,
  US4 es el tramo divisible (por módulo) sin dejar el repo inconsistente.
