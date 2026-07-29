# Cierre: SPEC-121 — Sobre de error único (R2) + timeout de Ollama

**Fecha**: 2026-07-29 · **Bloque**: cola nocturna 002-PI-041, B7 · **Rama**: `feature/001-scaffolding`

## Resultado

- **R2**: pieza central `src/lib/api-handler.ts` (`errorToResponse` +
  `withErrorHandler`) y **18/18 rutas migradas** (27 bloques de colapso a 403
  eliminados). `grep "safeErrorMessage(error), code: error.code" src/app/api`
  → **0 ocurrencias**.
- **Timeout Ollama**: los dos `fetch` a `/api/generate` aplican
  `AbortSignal.timeout(await getOllamaTimeoutMs())`; parámetro
  `ia.ollama.timeout_ms` (ADR_004), default **120 000 ms** documentado en
  seed y spec. Ninguna decisión del motor tocada (rúbrica/umbrales/terna/
  modelos intactos; `efecto-motor-111.test.ts` verde 2/2).

## Commits (sin push; empuja el coordinador)

| Hash | Contenido |
| --- | --- |
| `9d49b4fe` | docs(spec-121): spec, plan y tasks |
| `8fa240d7` | feat(api): pieza central `errorToResponse` + test de equivalencia (18 tests) |
| `db0b6dcd` | feat(ia): timeout configurable `ia.ollama.timeout_ms` + test de efecto + seed |
| `b52016f5` | refactor(api): zona colegio/cursos (4 rutas, 6 catch) |
| `e38aa227` | refactor(api): zona colegio/alumnos (3 rutas, 5 catch) |
| `6250c6b5` | refactor(api): zona colegio/alertas + identificadores (4 rutas, 4 catch) |
| `298775cc` | refactor(api): zona admin/colegios (2 rutas, 3 catch) |
| `62de09a5` | refactor(api): zona admin/operadores (2 rutas, 4 catch) |
| `8429f9b7` | refactor(api): zona admin/comite/integrantes (2 rutas, 4 catch) |
| `d0b6c280` | refactor(api): zona admin/reportes-revision/reasignar (1 ruta, 1 catch) |

## Archivos tocados

- Nuevos: `src/lib/api-handler.ts`, `src/lib/api-handler.test.ts`,
  `src/lib/ai/ollama-timeout.test.ts`, `specs/121-error-wrapper-ollama-timeout/*`.
- Modificados: `src/lib/validation.ts` (export de `formatZodError`, aditivo),
  `src/lib/ai/ollama-config.ts` (`getOllamaTimeoutMs`),
  `src/lib/ai/ollama-client.ts` (2 `signal`), `prisma/seed.ts` (upsert aditivo
  del parámetro) y las 18 rutas enumeradas en `plan.md`.

## Evidencia de gate (todo bajo candado `/tmp/pi-gate-lock`)

- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errores (1 warning preexistente en
  `src/components/modules/ia/IaModelSelector.tsx`, ajeno a este bloque).
- `npm run build` → exit 0.
- Tests por pieza: `api-handler.test.ts` 18/18 · `ollama-timeout.test.ts` +
  `ollama-config.test.ts` + classifier 27/27 · zona colegio 26/26 · zona admin
  28/28 · `efecto-motor-111.test.ts` 2/2.
- Suite completa `npm run test`: **1066/1067 verdes** (176 archivos + 1 skip).
  Único fallo: `src/lib/specs-discipline.test.ts` — exige que
  `specs/README.md` indexe todas las carpetas de specs; faltan
  `115-catalogo-geografico-latam` (agente paralelo en vuelo) y
  `121-error-wrapper-ollama-timeout` (esta). **No corregido aquí: este bloque
  tiene prohibido tocar `specs/README.md`**; el índice lo actualiza el
  coordinador al cerrar la cola.

## Comportamiento deliberado encontrado y conservado

- `src/app/api/admin/operadores/route.ts:126-133` (POST): `try/catch` ANIDADO
  que traduce el `AppError` `EXCLUSIVIDAD_ROL` a **400** con su código. Es una
  rama por `code` deliberada y acotada (no un colapso a 403): se conserva
  intacta y sigue usando `safeErrorMessage` (import mantenido).
- `src/app/api/reportes/procesar/helpers/finalizacion.ts` (`obtenerErrorCode`)
  y `src/lib/errors.ts` (`safeErrorMessage`): usos internos de `"code" in
  error`, no son respuestas HTTP; fuera de alcance, intactos.
- Los 403/409/429 explícitos de negocio fuera del `catch` (rol, vigencia,
  módulo, duplicados, rate limit) no se tocaron en ninguna ruta.

## Hallazgo colateral (corregido por la migración)

En las 5 rutas sin rama `AppError` previa (`admin/operadores`,
`admin/operadores/[id]`, `admin/comite/integrantes`,
`admin/comite/integrantes/[id]`, `admin/reportes-revision/[id]/reasignar`), un
`AppError` de autenticación (401) caía en la rama por `code` y salía como
**403**. Tras la migración esos errores salen con su status real. Ningún test
existente dependía del 403 espurio (verificado: 28/28 zona admin verdes).

## Deuda técnica

- 4 de las 18 rutas migradas no tenían test de ruta propio (brecha
  preexistente): `colegio/identificadores/[id]/route.ts`,
  `colegio/identificadores/[id]/estado/route.ts`,
  `admin/colegios/[id]/route.ts`,
  `admin/reportes-revision/[id]/reasignar/route.ts`. Quedan cubiertas por el
  test de equivalencia de la pieza central + tsc/lint; conviene dotarlas de
  test en una spec de saneamiento de cobertura.
- El fallback del timeout (120 s) solo se ejerce si el parámetro falta o es
  inválido; entornos ya desplegados deben correr el seed para ver el parámetro
  en la consola de configuración (no requiere migración SQL).
- Flake observado una vez: 6 fallos espurios en una corrida de zona admin por
  contención de la BD de test compartida con otro agente; la re-corrida bajo
  candado salió 28/28. No se tocó ninguna aserción.

## Verificaciones del bloque

- Sin push ✔ · sin tocar motor (rúbrica/umbrales/terna/modelos) ✔ · sin
  ablandar tests ✔ · sin tocar `specs/README.md`, `docs/cola-nocturna-041.md`,
  rutas de apelaciones ni `admin/padres/**` (agentes paralelos) ✔ · commits en
  español, imperativo, un cambio lógico por commit ✔.
