# Implementation Plan: Hotfix de validación funcional

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `004-hotfix-validacion-funcional`) | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/004-hotfix-validacion-funcional/spec.md` (Status: **Approved** por ZEUS y Jelkin, 2026-07-23, con las correcciones de D-036 y §10 ya aplicadas)

## Summary

Cuatro arreglos independientes que devuelven la aplicación al estado de *probable*:
sesión que persiste (I-005), *Descubrir* operativo (I-004), catálogos poblados (I-006) y
listado de proyectos protegido (I-007). Ninguno es trabajo pesado: `/api/tags` de Ollama
devuelve metadatos y el seed no ejecuta modelos — **no requiere turno** (ADR_002).

Orden de aplicación: **I-005 primero**, porque sin sesión útil no se puede verificar
manualmente ninguno de los otros tres.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10, Prisma 5.22.0, Vitest 4.1.9, jose

**Storage**: PostgreSQL 16 + pgvector (puerto host 5435). El stack está **arriba y en uso por Jelkin**: no se baja.

**Testing**: Vitest sin BD ni Ollama (mocks de la spec 002)

**Target Platform**: compose sobre Colima (`http://localhost:5001`)

**Project Type**: hotfix de aplicación web

**Constraints**: cero `any` nuevos, cero fugas de `err.message` (spec 002); staging explícito por ruta; puertos 5005/5433/5010/5434 intocables; **no** tocar las rutas de I-008/I-009 (spec 005)

**Scale/Scope**: 4 archivos de código, 1 script nuevo, 1 migración, 2 archivos de configuración, 2 de documentación, 2 de pruebas

## Constitution Check

*GATE inicial y re-check post-diseño: PASS.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada; entra como spec propia y no como excepción (D-035). |
| §0.2 Pruebas | ✅ `projects` estrena pruebas (hoy no tiene); la bandera de cookie se prueba como función pura. Suite verde sin infraestructura. |
| §0.3 Tipado / errores | ✅ Cero `any` nuevos; `projects` migra al contrato `apiError`, cerrando la última ruta fuera de él. |
| §0.4 12-factor | ✅ La bandera de cookie es configuración de entorno, documentada en `.env.example`; el secreto real solo en `.env` local. |
| §0.5 Aislamiento | ✅ Solo `001-2026-INNOVADATACO/` (+ `AGENTS.md` de raíz, ya commiteado). Sin tocar puertos ni infra ajena. |
| §0.6 IA local | ✅ *Descubrir* consulta metadatos de Ollama; sin inferencia. |
| §0.7 Configurabilidad | ✅ El literal de la UI desaparece. **Excepción documentada**: la bandera `Secure` se resuelve solo por entorno (D-036), nunca desde BD/UI. |
| §0.8 Agentes | ✅ No aplica. |

## Cambios exactos por defecto

### I-005 · Sesión que persiste (US1) — primero

1. **`src/lib/authCookie.ts`** (nuevo). Función pura:

   ```ts
   /** `Secure` salvo que la variable valga exactamente "false" (D-036). */
   export function cookieSecure(): boolean
   ```

   Lee `process.env.AUTH_COOKIE_SECURE`; normaliza a minúsculas y recorta espacios;
   devuelve `false` **solo** ante `"false"`. Cualquier otro valor → `true`.

2. **`src/app/api/auth/login/route.ts:29`**: `secure: process.env.NODE_ENV === "production"`
   → `secure: cookieSecure()`. `httpOnly`, `sameSite` y `maxAge` **no se tocan** (FR-006).

3. **`.env.example`**: documentar la variable, su default (`true`) y cuándo apagarla.

4. **`.env` local** (no se commitea): `AUTH_COOKIE_SECURE=false`, porque se sirve por
   `http://localhost`.

5. **`docker-compose.yml`**: pasar la variable a los servicios que emiten la cookie.

### I-004 · *Descubrir* operativo (US2)

En `src/app/configuracion/page.tsx`, dos cambios y ni uno más:

- `:102` — `baseUrl: "http://localhost:11434"` → `baseUrl: ""`.
- `:289` — construir la URL de la petición **omitiendo** el parámetro cuando el campo esté
  vacío:

  ```ts
  const baseUrl = form.baseUrl?.trim();
  const url = baseUrl
    ? `/api/config/models/discover?baseUrl=${encodeURIComponent(baseUrl)}`
    : `/api/config/models/discover`;
  ```

- `:380` (`placeholder`) — **intacto**.

El backend ya resuelve la precedencia (`resolveOllamaBaseUrl`, FR-010 de la spec 001): no
se toca.

### I-006 · Seed reproducible (US3)

1. **Migración**: `@unique` en `EntidadLicitacion.key` y `LicitacionStatus.key`. Tablas
   vacías (0 filas verificadas) → índice instantáneo y sin riesgo. Habilita `upsert`.

2. **`scripts/seed.mjs`** (nuevo). Un único punto de entrada idempotente y no destructivo
   (research D-03):

   | Catálogo | Estrategia | Contenido |
   |---|---|---|
   | `LicitacionStatus` | `upsert` por `key` | Las 5 claves que la UI ya colorea |
   | `EntidadLicitacion` | `upsert` por `key` | Derivadas de `entidadesColombia.ts` |
   | `AgentApi` | `upsert` por `key` | El catálogo de `seedApis.mjs`, sin borrar |
   | `AiModel` | `findFirst` + `create` | Un modelo de referencia, **inactivo** |

   Informa por consola qué creó y qué omitió (FR-010). Falla explícito si la base no está
   migrada (edge case de la spec).

3. **`package.json`**: `"seed": "tsx scripts/seed.mjs"`.

4. **`README.md`**: procedimiento de arranque limpio (recrear volumen → `migrate deploy`
   → `init-pgboss` → `seed`), cerrando el gap operativo de la spec 001 (D-010).

5. **`scripts/seedApis.mjs`**: se conserva como está para no romper a quien lo invoque, y
   el README pasa a apuntar al seed nuevo.

### I-007 · Listado de proyectos protegido (US4)

En `src/app/api/projects/route.ts`:

- `GET`: añadir `verifyAuth()` y responder 401 sin sesión, con el mismo texto que el resto
  del proyecto (`{ error: "No autenticado" }`).
- `catch` del `GET`: migrar a `apiError("Proyectos", "GET lista", …)` — es la última ruta
  fuera del contrato de la spec 002.

**No se toca ninguna otra ruta**: las demás `GET` sin `verifyAuth` son I-008/I-009 y
pertenecen a la spec 005 (research D-07).

## Orden de aplicación

1. **I-005** (cookie) — desbloquea la verificación manual de todo lo demás.
2. **I-007** (`projects`) — cambio pequeño y aislado, con sus pruebas.
3. **I-006** (migración + seed) — el más largo; toca la BD viva.
4. **I-004** (UI) — se verifica de último, ya con sesión y con datos.
5. **Cierre**: suite, build, lint, verificación manual y commit.

## Verificación por requisito

| FR | Comando / comprobación | Esperado (baseline) |
|---|---|---|
| FR-001, FR-003 | `grep -n "11434" src/app/configuracion/page.tsx` | **1** ocurrencia, el `placeholder` (hoy 3) |
| FR-002 | Inspección del `fetch`: sin `baseUrl` cuando el campo está vacío | sin parámetro |
| FR-004 | `grep -rn "NODE_ENV" src/app/api/auth/` | **0** líneas que decidan `Secure` (hoy 1) |
| FR-005 | `grep AUTH_COOKIE_SECURE .env.example` | documentada |
| FR-006 | Diff de la ruta de login | `httpOnly`/`sameSite`/`maxAge` sin cambios |
| FR-007, FR-008 | Ejecutar el seed dos veces y comparar recuentos | los 4 catálogos > 0 e iguales entre ejecuciones (hoy 0/0/0/0) |
| FR-009 | Desactivar una API, re-ejecutar el seed, comprobar que sigue desactivada | conserva el ajuste |
| FR-010 | Salida del seed | detalla creados y omitidos |
| FR-011 | `README.md` | procedimiento de arranque limpio presente |
| FR-012, FR-013 | Pruebas de `projects` + `curl` sin cookie | 401 sin sesión; 200 con sesión (hoy 200 sin sesión) |
| FR-014 | `ls src/app/api/projects/` | existe `route.test.ts` (hoy no) |
| FR-015 | `npx eslint src/lib src/app/api` | 0 `no-explicit-any`; sin fugas |
| FR-016 | `npm run test` con contenedores irrelevantes | ≥ 107 verdes, sin BD ni Ollama |
| FR-017 | `git diff --cached --name-only` | solo rutas de `001-2026-INNOVADATACO/` |

## Complexity Tracking

Sin violaciones que justificar. La única desviación de un principio es **deliberada y
aprobada**: la bandera `Secure` no sigue la precedencia de §0.7 porque D-036 la clasifica
como característica de despliegue (research D-01).

## Riesgos

- **R-01**: la migración toca la BD que Jelkin está usando. Mitigación: es aditiva
  (crear índice único sobre tablas vacías), se aplica con `migrate deploy` y no requiere
  reinicio ni bajar el stack.
- **R-02**: el `.env` local necesita `AUTH_COOKIE_SECURE=false` para que la sesión
  funcione en `http`. Si se olvida, el síntoma es idéntico al defecto original. Queda en
  el procedimiento del README y en `.env.example`.
- **R-03**: sembrar 52 entidades cambia lo que ve el usuario en los desplegables. Es el
  efecto buscado, pero conviene que ZEUS lo confirme al revisar.
- **R-04**: proteger `GET /api/projects` puede romper alguna pantalla que lo consumiera
  sin sesión. Se verifica el consumidor antes de dar por cerrado el cambio.
