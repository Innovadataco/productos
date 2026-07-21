# Research — 001-auth-despacho-doble-token

> Decisiones técnicas de la P1, resueltas contra el código real (scaffold 003 + patrones de 002) y `HANDOFF-SICOV.md`. Cada decisión indica Contexto → Decisión → Alternativas → Justificación.

## R1. Stack y versiones (alineado con la fábrica)
**Decisión:** portar el demo a **Next.js 16 + React 19 + Prisma + PostgreSQL 16**, replicando versiones de 002:
`next@16.2.10`, `react@19.2.4`, `@prisma/client@5.22.0`, `prisma@5.22.0`, `jose@^6`, `bcryptjs@^3`, `pg-boss@^12.26`, `zod@^4`, `vitest@^3.2.3`, `tsx@^4`, `typescript@^5.8`, `eslint-config-next@16.2.10`.
**Alternativas:** mantener NestJS + Vite (rechazado: diverge de 001/002); Next 15 (rechazado: 002 ya usa 16.2.10).
**Justificación:** homogeneidad de artefactos, revisión y despliegue; el scaffold demo es reaprovechable a nivel de páginas/UI y lógica de negocio (thin controllers).

## R2. Mecanismo de cola: worker table-driven sobre `tbl_despachos_solicitudes` (no pg-boss, no Redis)
**Decisión (revisada tras leer el legacy):** replicar el patrón real — un **worker Node independiente que sondea la propia tabla** `tbl_despachos_solicitudes` por `(des_sol_estado='pendiente', des_sol_procesado=false, des_sol_siguiente_intento<=now)`, lote 20, orden `des_sol_id asc`, usando el índice `des_sol_estado_intento_idx`. Reintentos con backoff **fijo de 5 min**, máx 3 → `fallido`. Instancia única con **advisory lock** (`pg_try_advisory_lock(<ID_003>)` vía Prisma `$queryRaw`), supervisor `scripts/worker-supervisor.mjs` + `scripts/worker-despachos.mjs` (patrón de resiliencia de 002).
**Alternativas:** pg-boss (rechazado: el legacy ya modela la cola en la tabla de dominio con columnas y un índice diseñados para ello; el UI "logs de cola" lee esa tabla — meter pg-boss duplicaría el estado); BullMQ+Redis (rechazado: servicio extra); `setInterval` en proceso web (rechazado: antipatrón del demo).
**Justificación:** máxima fidelidad al sistema real, cero dependencias/servicios extra, estado de cola visible en la tabla de dominio, un solo worker garantizado por advisory lock. `ADVISORY_LOCK_ID` del 003 **distinto** al de 002. Consecuencia: **no** se añade `pg-boss` a `package.json`.

## R3. Integración Supertransporte tras interfaz, con STUB por defecto (guardarraíl)
**Decisión:** definir una interfaz `ClienteSupertransporte` con **dos implementaciones**: `ClienteStub` (default) y `ClienteHttp` (real). La selección se hace por env:
```
INTEGRACIONES_MODO=stub            # stub | real  (default: stub)
SUPERTRANSPORTE_HABILITADO=false   # gate explícito adicional; real requiere =true
```
El `ClienteHttp` **solo se instancia** si `INTEGRACIONES_MODO=real` **y** `SUPERTRANSPORTE_HABILITADO=true` **y** existen las credenciales. En cualquier otro caso se usa `ClienteStub`. Los tests siempre usan `ClienteStub` (o `vi.mock`).
**Justificación:** cumple la condición dura del responsable — **no se consume ninguna API productiva hasta revisión humana**. El contrato de las 3 cabeceras se respeta idéntico en el stub, de modo que activar el modo real no cambia el código de dominio.
**Alternativas:** llamar directo a la Super detrás de un flag simple (rechazado: un flag mal puesto dispararía tráfico productivo; se exige doble condición + credenciales presentes).

## R4. Doble token (proveedor + vigilado) — el núcleo
**Decisión:** toda petición transaccional envía **3 cabeceras** (`HANDOFF-SICOV.md:20-31`):
| Header | Valor | Fuente |
|---|---|---|
| `Authorization` | `Bearer <tokenExterno>` | token de **proveedor** (Gesmovil), cacheado con vigencia y **auto-refresh** |
| `token` | `<usn_token_autorizado>` | token del **vigilado**; subusuario rol 3 hereda el del administrador |
| `documento` | `<nitVigilado>` | NIT del vigilado (o del admin, si subusuario) |
El token de proveedor se maneja con un `TokenProveedorStore` en memoria (singleton) con `{ token, expiraEn }`; `obtenerToken()` refresca si `expiraEn <= now + margen`. En stub, devuelve un token ficticio con vigencia simulada.
**Justificación:** replica el `TokenExterno.ts` del sistema real; evita pedir token por request (SC-004).

## R5. Esquema de datos: `sicov` real, alcance P1
**Decisión:** modelar en Prisma con `@@map` a las tablas reales del esquema `sicov`. La P1 requiere **4 entidades**: `Usuario` (`tbl_usuarios`), `ProveedorVigilado` (`tbl_proveedores_vigilados`), `DespachoSolicitud` (`tbl_despachos_solicitudes`), y catálogo `Rol`. Las 25 tablas restantes del esquema real se modelan en features siguientes (no en P1) para no inflar el alcance. Columnas exactas confirmadas en `HANDOFF-SICOV.md:42-52`.
**Alternativas:** mapear las 29 tablas ahora (rechazado: fuera del alcance P1, muchas columnas aún `[NEEDS CLARIFICATION]`); mantener el schema simplificado del demo (rechazado: no refleja el real ni el doble token).
**Justificación:** migraciones **aditivas**; se parte del esquema real correcto desde P1 para las tablas del core.

## R6. Autenticación: jose HS256 + cookie httpOnly, login único
**Decisión:** replicar `src/lib/auth.ts` de 002 (jose `SignJWT`/`jwtVerify` HS256, `verifyAuth(requiredRol?)` central, cookie httpOnly dual `__Host-token`/`token`, bcrypt cost 12). Adaptaciones al dominio SICOV:
- Roles **numéricos** 1/2/3/9 (no enum de strings); payload JWT `{ sub, rol, nit, tokenAutorizado }` para el subusuario ya resuelto.
- **Eliminar** el endpoint/pestaña "Vigía" (`auth.controller.ts:22`, `Login.tsx:83-113`).
- `usn_clave_temporal` → fuerza cambio de contraseña (equivalente a `debeCambiarPassword` de 002).
- Resolver herencia rol 3 → admin (`usn_administrador`) en el login, guardando `tokenAutorizado`+`nit` efectivos.
**Justificación:** patrón probado en 002; corrige la desviación del demo.

## R7. Aislamiento Docker del 003
**Decisión:** `docker-compose.yml` con: `image: postgres:16-alpine` (el 003 no usa pgvector), `container_name: 003-2026-sicov-otpc-db-1`, puerto **5434→5432**, volumen `003-2026-sicov-otpc_db_data`, `mem_limit: 512m`, healthcheck `pg_isready`. App en puerto **5010** (`next dev -p 5010`). `.env` local; solo `.env.example` en repo.
**Justificación:** cumple constitución §1.1; corrige el compose del demo que colisiona con el puerto 5432 de 001. `mem_limit` y `container_name` (ausentes en 002) se añaden explícitamente.

## R8. Corrección de los 5 bugs del demo (durante el port)
| # | Bug (ubicación demo) | Corrección en el port |
|---|---|---|
| 1 | `reintentarDespacho` no resetea `reintentos` (`colas.service.ts:68`) | pg-boss maneja `retryLimit`/`retryCount`; el reintento manual re-encola con contador correcto |
| 2 | Botón "Reintentar" sin `onClick` (`Despachos.tsx:70`) | handler que llama al endpoint `POST /api/despachos/[id]/reintentar` |
| 3 | Login enmascara 5xx (`auth.tsx:51`) | sin fallback demo; un 5xx propaga error real, no "inicia sesión" |
| 4 | `useRecurso` muestra demo ante 401 (`client.ts:73`) | ante 401 → limpiar sesión y redirigir a `/login`; nunca datos demo |
| 5 | KPI "Despachos hoy" sin filtro fecha (`dashboard.module.ts:13`) | `count({ where: { fecha >= inicioDiaBogota } })` en zona America/Bogota |

## R9. Zona horaria y normalización tolerante
**Decisión:** fechas en `America/Bogota`; normalizar respuestas externas aceptando `array_data | data | obj` y claves snake/camel (helper `normalizarRespuesta`). Aplica en `ClienteHttp` y en el parseo de resultados.

## Preguntas que pasan a `/speckit.clarify` (no bloquean P1 con stub)
- Contrato exacto del payload de `despachosempresa` y forma de respuesta de éxito/error real.
- Endpoint y forma de autenticación del proveedor (para el `ClienteHttp` real).
- Política de contraseñas / umbral de bloqueo del sistema real.
- Alcance operativo del rol 9.
