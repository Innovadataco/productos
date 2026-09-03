# SPEC-400 · Plan — PR 1 (cliente resiliente)

## Alcance del PR 1
**Solo cliente.** Nada del middleware cambia. Si el interceptor falla, el servidor sigue tolerante como hoy — este es el candado principal, por eso el CEO pidió partir el trabajo en dos PRs.

## Orden aprobado (CEO 03-09 11:15)
1. **PR 1 (este)** — cliente resiliente: interceptor global sobre `globalThis.fetch` que atrapa `401 { code: "SESION_ESTADO_REQUERIDO" }`, dispara `POST /api/vigencia/refresh` una sola vez (single-flight) y reintenta el request. Inofensivo por construcción.
2. **PR 2 (SPEC-400b, separado)** — cerrar el middleware para `/api/**` cuando `estado===null`, con lista blanca explícita (`/api/pagos/**`, `/api/session/ping`, `/api/vigencia/refresh` y las ya exentas por `publicas`/`sesion`). Se despliega **después** de PR 1 verificado en producción.

## Pasos
1. Worktree fresco `.worktrees/pi-SPEC-400` desde `origin/main d832ec3db` + `npm install`.
2. **Análisis de fuente** (reportado al CEO ANTES de codear): identificar los 3 guardianes vulnerables (`middleware.ts:189-225` dentro de `if (estado)`), enumerar los 275 endpoints `/api/**` y clasificarlos por comportamiento (grupos A/B/C/D del reporte).
3. **Reverificación contra `origin/main`** (candado 15v3 del CEO): `git show origin/main:...guardias.ts` para no leer un árbol stale. `/api/publico/**` ya está exento por SPEC-346 → NO es bug, lo retiro del alcance.
4. `src/lib/http/sesion-refresh-interceptor.ts` — monkey-patch idempotente con:
   - Single-flight sobre `/api/vigencia/refresh` (una promesa compartida).
   - Bypass propio de la ruta de refresh (no recursión).
   - Reintento único (no reintento del reintento).
   - Clonado de `Request` para que el body pueda releerse.
   - Fallback silencioso: si refresh falla, devuelve el 401 original.
5. `src/components/modules/SesionRefreshInterceptor.tsx` — client component con `useEffect` que instala el parche una vez.
6. `src/app/layout.tsx` — dos líneas: import + `<SesionRefreshInterceptor />` junto a `<ServiceWorkerRegister />`.
7. 10 tests unit en `sesion-refresh-interceptor.test.ts` (jsdom): 200 pasa · 401 sin code pasa · 401+code refresca+reintenta · refresh falla → 401 original · reintento vuelve a caer → no bucle · ruta de refresh es bypass · single-flight con concurrentes · idempotencia · Request con body · content-type no-JSON pasa.
8. `spec.md`, `plan.md`, `tasks.md` + fila en `specs/README.md`.
9. `npm run test:unit` completo + `tsc --noEmit` + `eslint` verdes.
10. Commit específico (`git add <archivos>`, nunca `-A`), push, `gh pr create`.

## Verificación

### Automatizada
- 10 tests unit del interceptor.
- Toda la suite unit (2110 tests) en verde.
- `tsc` sin errores.
- `eslint` sin warnings en archivos tocados.

### En vivo (post-deploy)
- Abrir el producto, esperar >5 min de inactividad.
- Ejecutar cualquier acción que pegue a `/api/**`.
- Verificar en DevTools que llegan estos 3 requests en el orden correcto: `401 SESION_ESTADO_REQUERIDO` → `POST /api/vigencia/refresh` → request original reintentado, ambos 200. Todo transparente para el usuario.
- Confirmar que ningún usuario ve un error visible en pantalla durante la ventana de 5 min.

## Fuera de este PR
- Cerrar el middleware (SPEC-400b) — espera 24-48h con PR 1 en producción antes de subir la ley.
- Refresh sliding automático de la cookie — no necesario: interceptor + cerrojo cierra el hueco sin necesidad de tocar el TTL.
- Bugs pre-existentes que aparecieron en el análisis: `/api/publico/**` era falsa alarma (resuelto en `origin/main` por SPEC-346); `/api/webhooks/resend` es real → ya fue a SPEC-402 (PR aparte).
