# Implementation Plan: SPEC-121 — Sobre de error único (R2) + timeout de Ollama

**Spec**: `specs/121-error-wrapper-ollama-timeout/spec.md` · **Status**: DESARROLLO

## Contexto y decisión de arquitectura

Hoy la conversión error→respuesta está duplicada en ~27 bloques `catch` con tres
ramas: `AppError` → su status; `Error` con propiedad `code` string → **403
indiscriminado** filtrando `error.code` al cliente; resto → 500 genérico. La
rama del medio es el defecto R2: cualquier error de infraestructura con `code`
(Prisma `P2002`, `ECONNREFUSED`, etc.) sale como 403 con el código interno
expuesto.

Decisión: una pieza central `src/lib/api-handler.ts` con `errorToResponse`
(y wrapper `withErrorHandler`) que elimina la rama intermedia. La migración es
mecánica y conservadora: se reemplaza solo el `catch`, preservando ramas
específicas previas (404 por mensaje) y sin tocar respuestas de negocio fuera
del `catch`.

Para Ollama: los dos `fetch` a `/api/generate` (`llamarOllama`,
`llamarOllamaStructured`) carecen de `signal`. Se añade `getOllamaTimeoutMs()`
en `ollama-config.ts` (mismo patrón que `getOllamaBaseUrl`: parámetro de
sistema con fallback silencioso) y `AbortSignal.timeout(...)` en ambos fetch.
Default 120 000 ms, configurable con `ia.ollama.timeout_ms` (seed, INTEGER,
SYSTEM). No se tocan embeddings (ya tiene 8 s) ni `/api/tags` (ya tiene 10 s).

## Enumeración de las 18 rutas (27 bloques de colapso)

Detectadas con `grep -rn '"code" in error' src/app/api` y verificadas una a una
(misma forma exacta: `safeErrorMessage(error), code: error.code` + `status: 403`).

### Zona colegio/cursos (4 archivos, 6 bloques)

1. `src/app/api/colegio/cursos/route.ts` — 1 bloque (POST)
2. `src/app/api/colegio/cursos/[id]/route.ts` — 2 bloques
3. `src/app/api/colegio/cursos/[id]/estado/route.ts` — 1 bloque
4. `src/app/api/colegio/cursos/[id]/alumnos/route.ts` — 2 bloques

Tests existentes: `colegio/cursos/route.test.ts` (cubre route, [id], estado),
`colegio/cursos/[id]/alumnos/route.test.ts`.

### Zona colegio/alumnos (3 archivos, 5 bloques)

5. `src/app/api/colegio/alumnos/[id]/route.ts` — 2 bloques
6. `src/app/api/colegio/alumnos/[id]/estado/route.ts` — 1 bloque
7. `src/app/api/colegio/alumnos/[id]/identificadores/route.ts` — 2 bloques
   (conservar rama previa "Alumno no encontrado" → 404)

Tests existentes: `colegio/alumnos/[id]/identificadores/route.test.ts`.

### Zona colegio/alertas + identificadores (4 archivos, 4 bloques)

8. `src/app/api/colegio/alertas/route.ts` — 1 bloque
9. `src/app/api/colegio/alertas/[id]/estado/route.ts` — 1 bloque
10. `src/app/api/colegio/identificadores/[id]/route.ts` — 1 bloque
11. `src/app/api/colegio/identificadores/[id]/estado/route.ts` — 1 bloque

Tests existentes: `colegio/alertas/route.test.ts`.

### Zona admin/colegios (2 archivos, 3 bloques)

12. `src/app/api/admin/colegios/route.ts` — 1 bloque (POST)
13. `src/app/api/admin/colegios/[id]/route.ts` — 2 bloques

Tests existentes: `admin/colegios/route.test.ts`.

### Zona admin/operadores (2 archivos, 4 bloques)

14. `src/app/api/admin/operadores/route.ts` — 2 bloques
15. `src/app/api/admin/operadores/[id]/route.ts` — 2 bloques

Tests existentes: `admin/operadores/route.test.ts`, `admin/operadores/[id]/route.test.ts`.

### Zona admin/comite/integrantes (2 archivos, 4 bloques)

16. `src/app/api/admin/comite/integrantes/route.ts` — 2 bloques
17. `src/app/api/admin/comite/integrantes/[id]/route.ts` — 2 bloques

Tests existentes: `admin/comite/integrantes/route.test.ts`.

### Zona admin/reportes-revision (1 archivo, 1 bloque)

18. `src/app/api/admin/reportes-revision/[id]/reasignar/route.ts` — 1 bloque

Sin test propio preexistente (la zona tiene tests para otros endpoints);
lo cubre el test de equivalencia de la pieza central + tsc/lint.

## No migradas (deliberado)

- `src/lib/errors.ts`: define `safeErrorMessage`; el helper sigue existiendo
  para otros usos, no es un colapso.
- `src/app/api/reportes/procesar/helpers/finalizacion.ts` (`obtenerErrorCode`):
  extrae `code` para estado interno del pipeline del worker; no produce
  respuesta HTTP ni 403. Fuera de alcance.
- 403 explícitos de negocio fuera del `catch` (rol, vigencia, módulos,
  `auth/login`, etc.): comportamiento deliberado, intactos.
- Rutas públicas (`/api/reportes`, `/api/consulta`, `/api/auth/*`): verificado
  que ninguna usa el patrón de colapso; nada que migrar allí.

## Estado de migración

**Migradas las 18/18** (27 bloques). Commits por zona en `cierre.md`.

| Zona | Archivos | Estado |
| --- | --- | --- |
| colegio/cursos | 4 | migrada (tests zona 17/17) |
| colegio/alumnos | 3 | migrada (tests zona 26/26 acum.) |
| colegio/alertas + identificadores | 4 | migrada (tests zona 26/26 acum.) |
| admin/colegios | 2 | migrada (tests zona 28/28) |
| admin/operadores | 2 | migrada (tests zona 28/28) |
| admin/comite/integrantes | 2 | migrada (tests zona 28/28) |
| admin/reportes-revision | 1 | migrada (sin test propio; cubierta por equivalencia + tsc/lint) |

**Rama por `code` deliberada conservada (no migrada)**: en
`admin/operadores/route.ts` (POST) existe un `try/catch` ANIDADO alrededor de
`validarExclusividadRolComite` que mapea el `AppError` `EXCLUSIVIDAD_ROL` a
**400** con su código (`safeErrorMessage(err), code: err.code`, status 400).
No es un colapso a 403: es una traducción explícita y acotada de un error de
negocio conocido, cubierta por el test "rechaza crear OPERADOR con
esComite=true". Se deja intacta y se documenta aquí.

**Hallazgo colateral corregido por la migración**: en los 5 archivos sin rama
`AppError` (`operadores`, `operadores/[id]`, `comite/integrantes`,
`comite/integrantes/[id]`, `reportes-revision/reasignar`), un `AppError` de
autenticación (401) o permisos (403 con su código) caía en la rama por `code`
y salía como **403 con el código del AppError**. Tras la migración esos
`AppError` salen con su status real (401/403 según corresponda).

## Piezas

1. **`src/lib/api-handler.ts`** (nuevo): `errorToResponse(error, modulo?)` →
   `AppError` (incl. `ValidationError`) respeta `statusCode`/`toJSON()`;
   `ZodError` → 400 `VALIDATION_ERROR` con detalles `{ message, path }`;
   resto → `console.error` + 500 `{ error: { message: "Error interno", code:
   INTERNAL_ERROR } }`. `withErrorHandler(handler, modulo?)` envuelve handlers.
   Requiere exportar `formatZodError` desde `src/lib/validation.ts` (cambio
   aditivo de una palabra).
2. **`src/lib/api-handler.test.ts`** (nuevo): equivalencia contra una réplica
   local de la lógica legacy para AppError 400/401/403/404/409/429/500 y
   `ValidationError`; divergencia única y deseada: `Error` con `code` (p.ej.
   `P2002`) pasa de 403 a 500 sin filtrar código ni mensaje; no-`Error` → 500;
   `withErrorHandler` propaga éxito y errores igual que `errorToResponse`.
3. **`src/lib/ai/ollama-config.ts`**: `getOllamaTimeoutMs()` (param
   `ia.ollama.timeout_ms`, entero > 0, default 120 000, fallback silencioso).
4. **`src/lib/ai/ollama-client.ts`**: `signal: AbortSignal.timeout(await
   getOllamaTimeoutMs())` en los dos `fetch` a `/api/generate`. Nada más.
5. **Tests de timeout** (`src/lib/ai/ollama-timeout.test.ts`, nuevo): efecto —
   cambiar el parámetro cambia el valor aplicado (spy sobre
   `AbortSignal.timeout` + valor resuelto); fetch colgado aborta con timeout
   corto (fetch stub que solo rechaza al abortar); param inválido → default.
6. **`prisma/seed.ts`**: upsert aditivo de `ia.ollama.timeout_ms` = `"120000"`
   (INTEGER, SYSTEM, no público) con descripción. Sin migración SQL: la
   ausencia del parámetro cae al default en código (mismo criterio que
   `ia.rubrica.*`).

## Riesgos y mitigaciones

- **Clientes que dependían del 403 espurio**: ningún flujo legítimo depende de
  un 403 por `code` interno (los 403 legítimos son explícitos fuera del
  `catch`); los tests de rutas existentes lo confirman verdes.
- **Abortos espurios por timeout**: default 120 s muy por encima de la latencia
  real de generación local; el parámetro permite subirlo sin tocar código.
- **Concurrencia con otros agentes**: solo se tocan los 18 `route.ts`
  enumerados, `src/lib/{api-handler,validation}.ts`, `src/lib/ai/{ollama-config,
  ollama-client}.ts`, `prisma/seed.ts` y `specs/121-*`. Fuera de alcance:
  `api/apelaciones/**`, `api/admin/comite/apelaciones/**`, `api/admin/padres/**`.
