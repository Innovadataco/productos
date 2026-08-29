# PLAN — SPEC-125 (bloque R6)

## Enumeración completa (estado ANTES de la migración)

Método: recorrido de los 129 `src/app/api/**/route.ts` clasificando por
presencia de `request.json()`, `safeParse`/`parseBody`/`withValidation` y
`searchParams`.

### A. Body con `request.json()` crudo SIN esquema (objetivo principal)

| # | Ruta | Acceso | Validación actual |
|---|------|--------|-------------------|
| 1 | `src/app/api/auth/login/route.ts` | pública | `as { email; password }` + `!email \|\| !password` → 400 |
| 2 | `src/app/api/auth/verificar/solicitar/route.ts` | pública | `as { email }` + `!email \|\| !includes("@")` → 400 |
| 3 | `src/app/api/auth/verificar/validar/route.ts` | pública | `as { email; codigo }` + chequeo manual → 400 |
| 4 | `src/app/api/auth/verificar/completar/route.ts` | pública | `as { token; password; nombre? }` + chequeos manuales → 400 |
| 5 | `src/app/api/reportes/fallback/route.ts` | worker | `as { reporteId?; ... }` + `!reporteId` → 400 (JSON malformado → 500) |
| 6 | `src/app/api/reportes/procesar/helpers/seguridad.ts` (`parsearBody`) | worker | `as { reporteId? }` + chequeo manual → 400 |
| 7 | `src/app/api/consulta/route.ts` (POST) | pública | extracción tolerante manual (nunca 400, por diseño spec 091) |
| 8 | `src/app/api/consulta/detalle/route.ts` (POST) | autenticada | idem |

### B. Query params sin esquema (GET)

| Ruta | Acceso | Migrada en R6 |
|------|--------|---------------|
| `auth/recuperar/validar/route.ts` (token) | pública | SÍ |
| `ciudades/route.ts`, `departamentos/route.ts` | pública | no (deuda) |
| `config/parametros/route.ts` | admin | no (deuda) |
| `reportes/mis-reportes/route.ts` | PARENT | no (deuda) |
| `admin/spam/pendientes/route.ts` | admin | no (deuda) |
| `admin/dataset-entrenamiento/route.ts` | admin | no (deuda) |
| `admin/anti-abuso/simulacion-score/route.ts` | admin | no (deuda) |
| `admin/ia/evals/historial/route.ts` | admin | no (deuda) |
| `admin/ia/experimentos/[id]/resultados/route.ts` | admin | no (deuda) |

### C. Body CON esquema (ya migradas, no tocar)

~35 rutas con `safeParse`/`withValidation`/`parseBody`: `reportes` (POST),
`alertas/suscribir`, `auth/register`, `auth/cambiar-password`,
`auth/recuperar/{solicitar,restablecer}`, `circulo-confianza` (×3),
`admin/comite/**` (×8), `admin/correcciones`, `admin/ia/**` (×8),
`admin/operadores/**` (×3), `admin/permisos-modulos`,
`admin/reportes/[id]/{anonimizar,baja,escalar,reactivar,validar-anonimizacion}`,
`admin/reportes-revision/[id]/reasignar`, `admin/spam/[id]/resolver`, etc.

### D. GET/acciones sin entrada (nada que validar con esquema de body)

El resto (~75 rutas): GET sin params, POST sin body (logout, tomar, reactivar,
etc. — los que validan `:id` con `idSchema`/`parseParams` ya están cubiertos).

## Copias del secreto del worker (ANTES)

1. `src/app/api/reportes/fallback/route.ts:10-16` — `secret !== requireEnv("WORKER_SECRET", 8)`
2. `src/app/api/reportes/procesar/helpers/seguridad.ts:6-18` — misma comparación

`health/worker` es GET de salud sin secreto (expone solo status agregado); no usa
el helper por diseño.

## Contratos de error consumidos por el frontend (NO cambiar)

- `AuthContext.login` (`src/lib/contexts/AuthContext.tsx:51-56`): cualquier
  no-ok lee `data.error.message`. Mensajes actuales a conservar:
  `Email y contraseña requeridos` (400), `Credenciales inválidas` (401).
- `registro/page.tsx:27,47,62`: lee `json?.error?.message` en
  verificar/solicitar, verificar/validar y verificar/completar. Mensajes a
  conservar: `Email inválido`, `Email y código de 6 dígitos requeridos`,
  `Token y contraseña requeridos`,
  `Contraseña: mínimo 8 caracteres, 1 letra y 1 número`.
- Worker (`scripts/worker-reportes.mjs`) → procesar/fallback: conserva
  `reporteId requerido` (400) y 403 sin secreto.

## Diseño

1. **`src/lib/worker-auth.ts`** (nuevo): `verificarWorkerSecret(request)` →
   `{ ok: true } | { ok: false; response }` (403 FORBIDDEN). Única copia del
   chequeo. Test unitario `worker-auth.test.ts`.
2. **Esquemas nuevos en `src/lib/validators.ts`** (junto a los de auth
   existentes): `loginSchema`, `verificarSolicitarSchema`,
   `verificarValidarSchema`, `verificarCompletarSchema`,
   `fallbackReporteSchema`, `procesarReporteSchema`, `consultaBodySchema`,
   `recuperarValidarQuerySchema`. Mensajes idénticos a los actuales.
3. **Migración ruta por ruta** con su test (400 inválido + contrato válido).
4. **Logger**: existe `src/lib/logger.ts` (usado en libs y en
   `api/apelaciones/route.ts`). Codemod mecánico: `console.error/warn` →
   `logger.error/warn` en `src/app/api/**/route.ts` + import; se conserva el
   prefijo `[Módulo]` en el mensaje. Se corrigen además los 2 mensajes sin
   prefijo de módulo (`verificar/solicitar`, `recuperar/solicitar`).

## Orden de commits (aditivo)

1. Helper worker-auth + test (mecanismo).
2. Esquemas en validators.ts.
3. auth/login + test.
4. auth/verificar ×3 + recuperar/validar + tests.
5. procesar + fallback (helper + esquemas) + tests.
6. consulta ×2 (esquema tolerante) + test.
7. Logger sweep rutas API.
8. Docs specs/125 + cierre.

## Riesgos

- Zod 4: `trim()`/`toLowerCase()` transforman antes de `min(1)`; el primer
  `issue` determina el mensaje — se conserva el orden de chequeos para que el
  mensaje visible no cambie.
- Body no-objeto en login hoy da 500 (TypeError en `body.email?.toLowerCase`);
  tras migrar da 400 — mejora deliberada, documentada.
