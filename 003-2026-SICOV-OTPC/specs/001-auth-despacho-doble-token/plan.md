# Implementation Plan — 001-auth-despacho-doble-token

**Feature Branch:** `feature/001-scaffolding` (sesión) · **Status:** PLANEADO
**Stack:** Next.js 16 (App Router) + React 19 + Prisma 5.22 + PostgreSQL 16 (esquema `sicov`) + TypeScript 5.8 · Node ≥22
**Entrada:** `spec.md`, `research.md`, `data-model.md`, `contracts/`, `HANDOFF-SICOV.md`, `legacy-sistema-original/`.

## 1. Resumen técnico
Reimplementar la **funcionalidad** del legacy (AdonisJS + Angular) sobre el stack de fábrica, empezando por el núcleo: login único usuario/contraseña (roles 1/2/3, herencia del subusuario rol 3), y el reporte de un despacho a Supertransporte con **doble token** vía **worker table-driven** sobre `tbl_despachos_solicitudes`. La integración externa vive **detrás de una interfaz con stub por defecto**; el modo real está bloqueado por doble gate de env y **no se consume hasta verificación humana**.

## 2. Constitution Check (§ constitución 003)
| Principio | Cumplimiento en este plan |
|---|---|
| §1.1 Aislamiento Docker | compose `003-*`, puerto 5434, `mem_limit`, no toca 001/002 ✔ |
| §1.2 Migraciones aditivas | BD nueva; `migrate dev` inicial; nunca `reset` ✔ |
| §1.3 Secretos por env | `.env` local, `.env.example` sin valores; credenciales Super vacías ✔ |
| §1.4 Doble token | 3 cabeceras (`Authorization`/`token`/`documento`), `TokenProveedorStore` con refresh, herencia rol 3 ✔ |
| §1.5 5 reglas de oro | spec completo + commits por US + deploy limpio + pruebas + cierre (al final) ✔ |
| §2.1 Stack | Next.js/Prisma/Postgres/Vitest ✔ |
| Guardarraíl APIs | stub por defecto; tests solo stub; sin llamadas productivas ✔ |

Sin desviaciones que requieran justificación adicional. Única desviación de arquitectura vs. legacy: **sesión por cookie httpOnly** (no `localStorage`), alineada con 002.

## 3. Estructura del proyecto (destino)
```
003-2026-SICOV-OTPC/
├── docker-compose.yml            # ✅ BD aislada 5434
├── .env.example                  # ✅ gate stub
├── package.json / tsconfig.json / next.config.ts / eslint.config.mjs / vitest.config.ts / tailwind
├── prisma/
│   ├── schema.prisma             # esquema sicov (13 tablas P1) multiSchema
│   ├── migrations/               # init_sicov_p1 (aditiva)
│   └── seed.ts                   # roles 1/2/3, admin, vigilado, subusuario, despachos demo
├── scripts/
│   ├── worker-supervisor.mjs     # relanza el worker, advisory lock, worker.pid
│   └── worker-despachos.mjs      # loop table-driven sobre tbl_despachos_solicitudes
├── src/
│   ├── lib/
│   │   ├── prisma.ts             # singleton
│   │   ├── auth.ts               # jose HS256, verifyAuth(roles), cookie httpOnly, bcrypt
│   │   ├── errors.ts             # AppError + ERROR_CODES
│   │   ├── env.ts                # requireEnv
│   │   ├── bogota.ts             # fechas America/Bogota
│   │   ├── normalizar.ts         # array_data|data|obj, snake/camel, extraerId
│   │   └── integracion/
│   │       ├── cliente.ts        # interface ClienteSupertransporte + factory (gate stub/real)
│   │       ├── cliente-stub.ts   # NUNCA toca red
│   │       ├── cliente-http.ts   # real (solo si INTEGRACIONES_MODO=real && SUPERTRANSPORTE_HABILITADO=true)
│   │       ├── token-proveedor.ts# TokenProveedorStore (cache+refresh)
│   │       └── contexto-usuario.ts# herencia rol 3 (usn_administrador → identificacion)
│   ├── app/
│   │   ├── api/auth/{login,logout,cambiar-clave,recuperar}/route.ts
│   │   ├── api/me/route.ts
│   │   ├── api/integracion/despachos/route.ts
│   │   ├── api/despachos/[id]/reintentar/route.ts
│   │   ├── api/dashboard/route.ts            # KPI con filtro fecha (bug 5)
│   │   ├── login/page.tsx                    # SIN pestaña Vigía (bug fuente)
│   │   └── dashboard/… (US3/siguientes)
│   └── components/…
└── (api/, web/  → demo antiguo; se retira al validar el port)
```

## 4. Decisiones de diseño (de research.md)
- **Cola:** worker table-driven sobre `tbl_despachos_solicitudes` (R2), no pg-boss. Advisory lock `pg_try_advisory_lock` vía Prisma `$queryRaw`, ID_003 propio.
- **Integración:** interfaz + `ClienteStub` (default) / `ClienteHttp` (gate doble). `TokenProveedorStore` singleton con refresh y margen de expiración.
- **Auth:** jose HS256, cookie httpOnly (`verifyAuth`), bcrypt cost 12, bloqueo por `tbl_bloqueo_usuarios` (3 intentos, gate `BLOQUEO_CREDENCIALES`). Política de contraseña regex confirmada del legacy.
- **Herencia rol 3:** `usn_administrador` = identificación del admin; join a `usn_identificacion`.
- **Prisma:** `multiSchema`, `@@schema("sicov")`, `@map` a nombres físicos.
- **Zona horaria:** `America/Bogota` en todo cálculo de fecha/hora.

## 5. Fases de implementación
1. **Scaffold** (config Next.js + tailwind + vitest) — sin lógica.
2. **Prisma** — `schema.prisma` (13 tablas), migración `init_sicov_p1`, `seed.ts`.
3. **Lib base** — prisma, env, errors, auth, bogota, normalizar.
4. **US1 Auth** — endpoints login/logout/cambiar-clave/recuperar/me + página login (sin Vigía) + guardas por rol; corrige bugs 3 y 4. Tests.
5. **US2 Despacho doble token** — `lib/integracion/*` (stub), endpoint `POST /api/integracion/despachos`, worker table-driven + supervisor, endpoint reintentar; corrige bugs 1, 2 y 5 (KPI fecha). Tests contra stub.
6. **Verificación** — `tsc --noEmit`, `lint`, `vitest run` (stub), `next build`. Script de deploy limpio. **Sin** llamadas productivas.
7. **Cierre** — `cierre.md` + sección Implementación en `spec.md` + deuda técnica.

## 6. Riesgos / deuda
- El `ClienteHttp` real queda **implementado pero inactivo** (gate) hasta que el responsable verifique y provea credenciales; su prueba end-to-end contra la Super es un paso posterior fuera de esta entrega.
- El demo (`api/`, `web/`) se retira al validar el port (US3); mientras tanto coexiste como referencia.
- Contratos exactos de payload de la Super quedan como `[NEEDS CLARIFICATION]` para `/speckit.clarify` (no bloquean el stub).
- Rama: se trabaja en `feature/001-scaffolding` por indicación de sesión (AGENTS.md §4 nombra otra); alinear en gobierno del repo.

## 7. Comandos clave (quickstart resumido)
```
docker compose up -d                 # BD 003 en 5434
cp .env.example .env                 # editar secretos locales (modo stub)
npm install
npm run db:migrate:dev               # init_sicov_p1
npm run db:seed
npm run dev                          # app en 5010
npm run worker                       # worker de despachos (otra terminal)
npm run typecheck && npm run lint && npm run test && npm run build
```
