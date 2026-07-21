# Cierre — 001-auth-despacho-doble-token

**Estado:** IMPLEMENTADO — pendiente de (a) prueba en vivo con BD levantada y (b) **verificación humana antes de consumir las APIs productivas**.
**Fecha:** 2026-07-21 · **Stack:** Next.js 16.2.10 + Prisma 5.22 + PostgreSQL 16 (esquema `sicov`).

## Qué se entregó
- **Spec-Kit completo:** `spec.md`, `research.md`, `data-model.md`, `contracts/{auth,integracion-despachos}.md`, `plan.md`, `quickstart.md`, `checklists/requirements.md`, `tasks.md`.
- **Infra aislada 003:** `docker-compose.yml` (contenedor `003-2026-sicov-otpc-db-1`, puerto 5434, `mem_limit`, volumen propio), `.env.example` con gate de stub, `.gitignore`.
- **Prisma:** `schema.prisma` con 13 tablas del core del esquema `sicov` (multiSchema, `@map` a columnas físicas reales verificadas contra el legacy). Cliente generado OK.
- **US1 Auth:** login único (sin Vigía), logout, cambiar-clave (política regex del legacy), recuperar (stub email), `/api/me`; bloqueo por intentos (`tbl_bloqueo_usuarios`); herencia rol 3; páginas `/login` y `/dashboard`.
- **US2 Despacho doble token:** cliente `ClienteStub`/`ClienteHttp` tras interfaz con **gate doble**, `TokenProveedorStore` (cache+refresh), armado de las 3 cabeceras, `POST /api/integracion/despachos`, worker table-driven (`scripts/worker-despachos.mjs` + supervisor con advisory lock ID_003), reintento manual, dashboard con KPI de hoy.
- **Seed demo:** roles 1/2/3, admin, vigilado con token, subusuario rol 3, proveedor vigente, despachos en varios estados.

## Guardarraíl cumplido
🔒 **No se consumió ninguna API productiva de Supertransporte.** `INTEGRACIONES_MODO=stub` + `SUPERTRANSPORTE_HABILITADO=false` por defecto; `ClienteHttp` solo se instancia con ambos gates + credenciales, y ni los tests ni el build lo ejercitan. El log del stub imprime solo NOMBRES de cabecera, nunca los tokens.

## Verificación (sin BD ni APIs)
| Gate | Resultado |
|---|---|
| `tsc --noEmit` | ✅ 0 errores |
| `vitest run` | ✅ 35/35 (auth, política, JWT, normalización, gate stub, token proveedor, herencia rol 3, cliente stub) |
| `eslint .` | ✅ 0 errores |
| `next build` | ✅ compila; 12 rutas |

## Bugs del demo corregidos
1. Reintento resetea `reintentos` a 0 (`reintentarSolicitud`). 2. Botón "Reintentar" con endpoint real. 3. Login sin fallback demo (error real propaga). 4. `/dashboard` ante 401 redirige a `/login`, nunca datos demo. 5. KPI "Despachos hoy" filtra por `inicioDiaBogota()`.

## Pendiente (fuera de esta entrega)
- **Prueba en vivo:** `docker compose up` + `db:migrate:dev` + `db:seed` + `npm run dev`/`worker` y recorrer el `quickstart.md`. (No ejecutado aquí por no levantar contenedor en este entorno.)
- **VERIFICACIÓN HUMANA antes de APIs productivas** (TX01): activar `ClienteHttp` y probar contra la Super requiere aprobación explícita + credenciales rotadas.
- `/speckit.clarify` de payloads/endpoints reales y umbral de bloqueo (TX02).
- Retiro del demo antiguo (`api/`, `web/`) y pantallas inventadas al validar el port.

## Deuda técnica
- `ClienteHttp` real implementado pero **inactivo** (gate) y **no probado** contra la Super.
- Relación `usn_administrador → usn_identificacion` se resuelve por consulta explícita (no FK Prisma) por el desajuste de tipos Int/varchar del legacy.
- UI mínima (login + dashboard); la paridad completa de pantallas (wizard de salidas, etc.) es de features siguientes.
