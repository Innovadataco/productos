# CIERRE — SPEC-125 (bloque R6): API, una sola forma de validar

- **Fecha**: 2026-07-29
- **Rama**: `feature/001-scaffolding` (sin push; lo empuja ZEUS)

## Qué se hizo

1. **Helper único del secreto del worker** — `src/lib/worker-auth.ts`
   (`verificarWorkerSecret`). Las dos copias del chequeo
   `secret !== requireEnv("WORKER_SECRET", 8)` (en
   `src/app/api/reportes/fallback/route.ts` y
   `src/app/api/reportes/procesar/helpers/seguridad.ts`) quedaron reemplazadas;
   hoy existe UNA sola comparación en todo el código. Test unitario:
   `src/lib/worker-auth.test.ts` (sin secreto → 403, erróneo → 403, correcto → ok).

2. **Esquemas nuevos en `src/lib/validators.ts`** (junto a los de auth
   existentes): `loginSchema`, `verificarSolicitarSchema`,
   `verificarValidarSchema`, `verificarCompletarSchema`,
   `recuperarValidarQuerySchema`, `procesarReporteSchema`,
   `fallbackReporteSchema`, `consultaBodySchema`. Los mensajes son contrato del
   frontend y se conservaron literal. Nota Zod 4: un campo ausente produce
   `invalid_type` con mensaje genérico de Zod, así que cada campo lleva `error`
   a nivel de campo para conservar el mensaje visible.

3. **Rutas migradas a esquema** (9 puntos que hacían `request.json()` crudo o
   query manual):

   | Ruta | Tipo | Test |
   |------|------|------|
   | `auth/login` | body | `route.test.ts` +4 casos (400 ×3, normalización email) |
   | `auth/verificar/solicitar` | body | ya existía (5 casos, verde) |
   | `auth/verificar/validar` | body | `route.test.ts` NUEVO (5 casos) |
   | `auth/verificar/completar` | body | `route.test.ts` NUEVO (5 casos) |
   | `auth/recuperar/validar` | query | `route.test.ts` NUEVO (3 casos) |
   | `reportes/procesar` (`helpers/seguridad.ts`) | body | existente (16 casos, verde) |
   | `reportes/fallback` | body | `route.test.ts` +2 casos (400 sin reporteId, 400 JSON roto) |
   | `consulta` (POST) | body tolerante | existente (12 casos, verde) |
   | `consulta/detalle` (POST) | body tolerante | existente (5 casos, verde) |

4. **Logger único en rutas API** — existía `src/lib/logger.ts` (usado en libs y
   en `api/apelaciones/route.ts`), así que se adoptó: codemod mecánico
   `console.error/warn` → `logger.error/warn` en **30 `route.ts`**
   (0 `console.*` restantes en `src/app/api/**/route.ts`). Se conserva el
   prefijo `[Módulo]` en el mensaje (patrón de AGENTS.md) y se reescribieron los
   dos mensajes en inglés sin módulo (`auth/verificar/solicitar`,
   `auth/recuperar/solicitar`).

## Contratos preservados (verificado)

- `AuthContext.login` (`src/lib/contexts/AuthContext.tsx:51-56`) solo lee
  `error.message` en no-ok: mensajes `Email y contraseña requeridos` /
  `Credenciales inválidos` intactos, mismos status (400/401/403/429).
- `registro/page.tsx:27,47,62` lee `error.message` en verificar/*: mensajes
  `Email inválido`, `Email y código de 6 dígitos requeridos`,
  `Token y contraseña requeridos`,
  `Contraseña: mínimo 8 caracteres, 1 letra y 1 número` intactos.
- Worker (`scripts/worker-reportes.mjs`): `reporteId requerido` (400) y 403 sin
  secreto intactos.
- Consulta pública: el body NUNCA produce 400 (privacidad, spec 091); el esquema
  tolerante `.catch({})` reproduce exactamente el comportamiento anterior.

## Cambios de comportamiento deliberados (mejoras, documentadas)

- Body no-objeto en `auth/login`, `verificar/*`: antes 500 (TypeError en el
  cast `as`), ahora 400 `VALIDATION_ERROR`.
- JSON malformado en `reportes/fallback`: antes 500, ahora 400 `Body inválido`
  (alineado con `procesar`).

## Commits (sin push)

1. `3b62ec5f` — helper worker-auth + esquemas (mecanismo)
2. `0f9eb8ac` — auth/login a esquema
3. `f70ef7c4` — auth/verificar ×3 + recuperar/validar + tests
4. `dc503bdf` — procesar + fallback al helper y esquemas
5. `46d20634` — consulta ×2 a esquema tolerante
6. `8919f6f8` — logger central en 30 rutas API
7. (docs) — specs/125

## Evidencia del gate

Todo bajo candado `/tmp/pi-gate-lock` (con `trap` de liberación):

- `npx tsc --noEmit` → limpio (0 errores).
- `npm run lint` → 0 errores (1 warning preexistente en
  `src/components/modules/ia/IaModelSelector.tsx`, zona de otro agente).
- `npm run build` (con `rm -rf .next` previo) → compila OK.
- Tests por ruta migrada (bajo candado, verdes antes de cada commit):
  worker-auth 3/3; login 11/11; verificar/solicitar 5/5; verificar/validar 5/5;
  verificar/completar 5/5; recuperar/validar 3/3; procesar 16/16;
  fallback 6/6; consulta + detalle 17/17.
- Suite completa (`npm run test`): **1215 passed / 1 failed / 1 skipped**
  (1217). El único fallo es `src/lib/specs-discipline.test.ts:130`: exige que
  toda carpeta `specs/NNN-*` esté enlazada en `specs/README.md` y faltan las
  entradas de 122, 123, 124 y 125. Ese README lo mantiene ZEUS y las reglas del
  bloque prohíben tocarlo — NO es una regresión de código: todas las rutas y
  libs pasan. ZEUS debe añadir la entrada
  `([125-validacion-unificada-api](...))` al cerrar la cola.

## Deuda restante (enumerada en plan.md, sección B)

GET con query params validados a mano, no públicas ni prioritarias:
`ciudades`, `departamentos`, `config/parametros`, `reportes/mis-reportes`,
`admin/spam/pendientes`, `admin/dataset-entrenamiento`,
`admin/anti-abuso/simulacion-score`, `admin/ia/evals/historial`,
`admin/ia/experimentos/[id]/resultados`. Todas funcionan y ninguna acepta body;
migrarlas es mecánico cuando haya bloque.
