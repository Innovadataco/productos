# Implementation Plan: Cierre de la superficie de la API y protección de páginas

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `005-cierre-superficie-lectura`) | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/005-cierre-superficie-lectura/spec.md` (Status: **Approved por ZEUS**,
2026-07-23, con la ampliación de alcance aprobada y repriorizada por **D-040**)

## Summary

Cerrar los **19 manejadores** de la API que hoy responden sin sesión y poner la barrera de
páginas que nunca existió. El orden lo fija **D-040**: **escritura primero** (un borrado
anónimo destruye), después la guarda de la pantalla de configuración —única que no
sobrevive a un 401—, después la lectura y por último el middleware.

El cierre se hace **ruta por ruta** con `verifyAuth()`; el middleware es una capa añadida,
no la que protege la API (research D-01). Cierra **I-010** (crítica), **I-009** e
**I-008**.

**No requiere turno de máquina** (ADR_002): no ejecuta inferencia. Al contrario, cierra la
vía por la que un anónimo podía provocarla (`POST /api/config/models/test`).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10, React 19.2.4, Prisma 5.22.0, Vitest 4.1.9, jose 6

**Storage**: PostgreSQL 16 + pgvector (puerto host 5435). El stack está **arriba y en uso
por Jelkin**: no se baja; se recrea al final, en un solo paso.

**Testing**: Vitest en entorno `node`, sin BD ni Ollama (mocks de la spec 002:
`@/test/prismaMock`, `@/test/authMock`). Línea base **118 pruebas en 23 archivos**.

**Target Platform**: compose sobre Colima (`http://localhost:5001`)

**Constraints**: cero `any` nuevos; cero fugas de `err.message`; gate de tipado
`npx tsc --noEmit`; staging explícito por ruta; puertos 5005/5433/5010/5434 intocables;
sin tocar RAG ni OCR (RZ-4)

**Scale/Scope**: 15 archivos de ruta, 1 middleware nuevo, 3 helpers nuevos en `src/lib`,
2 archivos de interfaz, ~17 archivos de prueba (15 extendidos + 2 nuevos)

## Constitution Check

*GATE inicial y re-check post-diseño: **PASS**.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada por ZEUS; la ampliación de alcance se aprobó explícitamente (D-040) en vez de asumirse. |
| §0.2 Pruebas | ✅ Prueba de 401 por manejador cerrado, prueba propia del middleware y **prueba estructural** que impide la reincidencia. Suite verde sin infraestructura. |
| §0.3 Tipado / errores | ✅ Cero `any` nuevos; el 401 usa el contrato único (`{ error: "No autenticado" }`); ningún detalle técnico al cliente. |
| §0.4 12-factor | ✅ Sin secretos nuevos ni configuración hardcodeada. **Se descarta** hornear `JWT_SECRET` como argumento de construcción (research D-04). |
| §0.5 Aislamiento | ✅ Solo `001-2026-INNOVADATACO/`. Sin tocar puertos, contenedores ni volúmenes ajenos. No hay trabajo pesado. |
| §0.6 IA local | ✅ No cambia el proveedor. Cierra el disparo **anónimo** de inferencia (FR-003). |
| §0.7 Configurabilidad | ✅ No introduce parámetros operativos. La lista de rutas públicas es una **decisión de seguridad declarada en código y probada**, no un ajuste de negocio: mismo criterio que D-036 para la bandera `Secure`. |
| §0.8 Agentes | ✅ No aplica. |
| §5.1 Rutas públicas | ✅ Es el principio que esta spec ejecuta. Al terminar, el conjunto público queda **cerrado, declarado y verificado por la suite**. |

## Cambios exactos por bloque

### Bloque 0 · Cimientos (habilitan todo lo demás)

1. **`src/lib/apiError.ts`** — añadir:

   ```ts
   /** Respuesta única de sesión ausente o inválida (§2.4, §5.1). */
   export function noAutenticado(): NextResponse
   // -> NextResponse.json({ error: "No autenticado" }, { status: 401 })
   ```

   Mismo cuerpo y mismo código que las 11 rutas ya protegidas: **no cambia ningún contrato
   existente**. Las 11 apariciones antiguas se dejan como están (research D-02).

2. **`src/lib/auth.ts` NO se toca** (D-041). La versión anterior del plan extraía la
   verificación a un módulo compartido para que el middleware pudiera verificar la firma en
   el borde; con la barrera optimista ese módulo ya no tiene consumidor y se retira del
   alcance. `verifyAuth` sigue siendo la autoridad y su mock, intacto.

### Bloque 1 · Cierre de la escritura (US-1, FR-001…FR-004) — primero

En cada manejador, **la primera línea del `try`**, antes de leer parámetros, parsear
cuerpo, consultar la base o hacer `fetch`:

```ts
const session = await verifyAuth();
if (!session) return noAutenticado();
```

| Archivo | Manejadores |
|---|---|
| `src/app/api/licitaciones/[id]/route.ts` | `PATCH` (:44), `DELETE` (:93) |
| `src/app/api/licitaciones/entidades/route.ts` | `POST` (:19) |
| `src/app/api/licitaciones/estados/route.ts` | `POST` (:19) |
| `src/app/api/config/apis/[id]/toggle/route.ts` | `PATCH` (:5) |
| `src/app/api/config/apis/[id]/test/route.ts` | `POST` (:24) |
| `src/app/api/config/models/test/route.ts` | `POST` (:7) |
| `src/app/api/documents/search/route.ts` | `POST` (:5) |
| `src/app/api/config/models/discover/route.ts` | `GET` (:20) — cierra aquí por su efecto (research D-10) |

**Detalle crítico de FR-002**: en `licitaciones/[id]` la verificación va **antes** de
`await params` y de `prisma.licitacion.findUnique`. Hoy el 404 que devuelve un `DELETE`
anónimo es la prueba de que consulta la base; después debe devolver **401 sin consultarla**.

Las pruebas de esos 8 archivos ya existen: se extienden con el caso 401 y la comprobación
de que la capa de datos y el `fetch` **no se invocaron**.

### Bloque 2 · Resiliencia de la pantalla de configuración (US-2, FR-005…FR-007)

1. **`src/lib/respuestaApi.ts`** (nuevo) — helper puro, probado en entorno node
   (research D-07):

   ```ts
   export async function listaSegura<T>(res: Response): Promise<{ items: T[]; error: string | null }>
   ```

   Devuelve `{ items, error: null }` solo si la respuesta fue correcta **y** el cuerpo es
   una lista; en cualquier otro caso `{ items: [], error: <mensaje legible> }`.

2. **`src/app/configuracion/page.tsx:149-162`** — las tres cargas (`loadModels`,
   `loadApis`, `loadAudit`) pasan por el helper y avisan con el `toast()` que la pantalla
   ya tiene. Ni un cambio más en el archivo.

3. **Verificación previa al cierre** (FR-006): con las rutas todavía abiertas, se fuerza el
   401 en las tres cargas y se comprueba que la pantalla se renderiza vacía y avisa.

### Bloque 3 · Cierre de la lectura (US-3, FR-008…FR-011)

El mismo patrón de dos líneas, siempre antes de tocar la base, en los **11** `GET`
restantes: `config/apis` (:5), `config/audit` (:4), `config/models` (:8),
`config/module-settings` (:6), `documents` (:133), `documents/[id]/logs` (:4),
`licitaciones` (:8), `licitaciones/[id]` (:7), `licitaciones/entidades` (:6),
`licitaciones/estados` (:6). *(`discover` ya quedó cerrado en el bloque 1.)*

Al terminar este bloque, **ningún archivo de ruta** queda con un método protegido y otro
abierto (FR-011).

### Bloque 4 · Barrera de páginas (US-4, FR-012…FR-019)

1. **`src/middleware.ts`** (nuevo). Lógica, en este orden:

   | Caso | Acción |
   |---|---|
   | Recurso estático (`/_next/*`, icono del sitio) | pasar (excluido por `matcher`) |
   | `POST /api/auth/login`, `POST /api/auth/logout` | pasar |
   | Resto de `/api/**` sin sesión | **401 JSON**, nunca redirección (FR-015) |
   | `/login`, haya cookie o no | **pasar siempre** (FR-014, FR-019 retirado por D-043) |
   | Cualquier otra página sin sesión | redirigir a `/login?next=<ruta+query>` (FR-017) |
   | Cualquier otra página con sesión | pasar |

   "Con sesión" significa aquí **`req.cookies.get("token")` presente**, y nada más
   (**D-041**, FR-016): sin verificar firma, sin tocar la base y sin importar `@/lib/auth`.
   Comprobación optimista en el borde, verificación real en cada ruta.

2. **`src/lib/destinoSeguro.ts`** (nuevo) — helper puro: devuelve el destino solo si
   empieza por `/` y **no** por `//` ni `/\`; en cualquier otro caso, `/` (FR-018).

3. **`src/app/login/page.tsx`** — tras un login correcto, navegar a
   `destinoSeguro(new URLSearchParams(window.location.search).get("next"))` en vez de a `/`
   fijo. Sin `useSearchParams` (research D-06). El resto de la pantalla no se toca.

### Bloque 5 · Red de seguridad (FR-020…FR-023)

- **`src/middleware.test.ts`** (nuevo): página protegida sin cookie → redirección a
  `/login?next=…`; con cookie → pasa; `/login` con y sin cookie; `/api/**` sin cookie →
  **401 JSON, no redirección**; `POST /api/auth/login` sin cookie → pasa. Se prueba también
  el **comportamiento declarado de D-041**: una cookie cualquiera (aunque sea basura) pasa
  la barrera — es la contrapartida asumida de la comprobación optimista, y la ruta la
  rechaza igual.
- **`src/app/api/superficie.test.ts`** (nuevo, prueba estructural): recorre
  `src/app/api/**/route.ts` con `import.meta.glob`, invoca cada manejador exportado sin
  sesión y exige 401. Lista blanca declarada: `POST /api/auth/login`,
  `POST /api/auth/logout`. Se comprueba **deliberadamente** que la prueba se pone roja al
  quitarle la verificación a una ruta cualquiera (SC-015).
- Los 15 archivos de prueba de rutas se extienden con su caso 401 + "no se invocó la capa
  de datos".

## Orden de aplicación (D-040) y commits

Un commit por bloque, cada uno con su suite en verde y **push en el mismo acto**:

1. **Cimientos** — `noAutenticado`, `session.ts`, `auth.ts` refactorizado, pruebas.
2. **Escritura (I-010)** — 8 manejadores + pruebas. *El daño irreversible se corta aquí.*
3. **Interfaz (US-2)** — `listaSegura` + las tres cargas + pruebas. *Antes de cerrar lo que
   consume.*
4. **Lectura (I-009)** — 11 `GET` + pruebas.
5. **Páginas (I-008)** — middleware, `destinoSeguro`, login con retorno + pruebas.
6. **Red de seguridad y cierre** — prueba estructural, recreación del stack, verificación
   manual y gates globales.

## Verificación por requisito

| FR | Comando / comprobación | Esperado (baseline) |
|---|---|---|
| FR-001, FR-004 | `npx vitest run src/app/api` | 401 sin sesión en los 8; comportamiento intacto con sesión |
| FR-002 | `curl -s -o /dev/null -w "%{http_code}" -X DELETE .../api/licitaciones/no-existe` | **401** (hoy **404**: llega a la base) |
| FR-003 | Prueba: `expect(fetch).not.toHaveBeenCalled()` en `discover`, `models/test`, `apis/[id]/test` sin sesión | sin llamada saliente |
| FR-005…FR-007 | `npx vitest run src/lib/respuestaApi.test.ts` + verificación manual del quickstart | pantalla vacía y aviso, sin romperse |
| FR-008…FR-010 | `curl` sin cookie a los 11 `GET`; con cookie, comparar cuerpo | 401 sin datos (hoy 200 con datos); mismo cuerpo con sesión |
| FR-011 | Revisión archivo por archivo + prueba estructural | ningún archivo mixto |
| FR-012…FR-014 | `curl -sI` a las 5 páginas sin cookie y con cookie | redirección al login / 200 |
| FR-019 (D-043) | `curl -sI /login` con y sin cookie | **200 en ambos**: la barrera nunca aparta del login |
| FR-015 | `curl -si .../api/documents` sin cookie | `401` + `content-type: application/json` |
| FR-016 | Revisión del middleware | sin importar Prisma ni `@/lib/auth`; decide por presencia de cookie (D-041) |
| FR-017, FR-018 | Pruebas de `destinoSeguro` + prueba manual del retorno | vuelve al destino; destino externo → `/` |
| FR-020, FR-021 | `npx vitest run` | 401 y "no se invocó la capa de datos" por manejador |
| FR-022, FR-023 | `npx vitest run src/middleware.test.ts src/app/api/superficie.test.ts` | verdes; rojas si se retira una verificación |
| FR-024 | `npx vitest run` con los contenedores irrelevantes | ≥ 118 verdes, sin BD ni Ollama |
| FR-025 | `npx tsc --noEmit` · `npx eslint src/lib src/app/api` | limpio · 0 `no-explicit-any` |
| FR-026 | `git diff --cached --name-only` · `docker ps` | solo rutas de `001-…` · 5005/5433/5010/5434 intactos |

## Complexity Tracking

Sin violaciones que justificar. Dos decisiones que parecen desviaciones y no lo son:

- **Verificar dos veces** (middleware + ruta) no es redundancia inútil: son capas con
  fallos distintos (research D-01). La autoridad sigue siendo `verifyAuth` (§5.1).
- **La lista de rutas públicas vive en el código y en la prueba**, no en configuración. Es
  un control de seguridad, no un parámetro de negocio: mismo criterio que D-036 aplicó a la
  bandera `Secure` frente a §0.7.

## Riesgos

- **R-01 · ~~El secreto podría no llegar al middleware~~ — cerrado por D-041.** El borde ya
  no necesita el secreto: comprueba presencia de cookie. **Riesgo que lo sustituye**: la
  barrera optimista solo es admisible si **no queda ni una ruta abierta** — con una sola,
  una cookie inventada permite navegar hasta ella. Mitigación: es exactamente lo que
  verifica la prueba estructural (FR-023), que por eso deja de ser un extra.
- **R-02 · Una barrera mal ajustada deja al CEO fuera de su aplicación.** Mitigación: el
  middleware es el **último** bloque, va con pruebas propias antes de recrear el stack, y
  las exclusiones (login y estáticos) se prueban explícitamente.
- **R-03 · Un consumidor no auditado se rompe con el 401.** Mitigación: los 41 `fetch` de
  la interfaz ya se revisaron uno a uno; el plan los reconfirma sobre el código del día
  antes de cerrar cada bloque (FR-007).
- **R-04 · La prueba estructural puede volverse frágil** si un manejador futuro necesita
  argumentos raros. Mitigación: invoca con una petición genérica y un `params` sintético;
  si algún manejador exigiera más, se documenta en la lista blanca **con motivo**, nunca
  se ablanda la prueba en silencio.
- **R-05 · Recrear el stack interrumpe a Jelkin.** Mitigación: como en la spec 004,
  reconstruir la imagen **antes** de recrear los servicios y hacerlo una sola vez, al
  final. **`down -v` prohibido.**
- **R-06 · Tras el cierre, cualquier pantalla que se abriera sin sesión deja de funcionar
  sin login.** Es el efecto buscado, no un daño colateral: conviene que ZEUS y el CEO lo
  tengan presente al validar.
