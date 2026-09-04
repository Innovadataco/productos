# SPEC-435 · Cuentas de VERIFICADOR — el admin las crea con user y pass

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: Jelkin vivo 04-09-2026 16:00-16:21 + radicado `RADICADO-SPEC-435-2026-09-04.md`.

## Para qué

SPEC-408 introdujo el rol `VERIFICADOR` como puesto de trabajo aparte, pero solo dejó definidos el enum, el módulo y el grant por defecto — no había forma de dar de alta cuentas. Este SPEC cierra ese hueco: el admin crea cuentas con el mismo perfil que a operadores (user + pass + módulos), con la contraseña temporal siempre visible en pantalla al crear/restablecer.

## Qué trae

### 1) Módulo nuevo `verificadores_admin`
- Agregado al catálogo (`src/lib/permisos-catalogo.ts`), default SOLO ADMIN.
- No lo hereda el VERIFICADOR: el rol nace con `admin_verificacion_profesionales` y nada más (lección I-278/I-299).

### 2) `VerificadorService` (DAL)
- `src/lib/dal/services/verificadores.ts` — molde `OperadorService`, simplificado: no hay `cupoMaximo`, `esComite`, `esRevisorDeApelaciones`. Toda la información vive en `Usuario` (sin perfil auxiliar).
- Métodos: `listar()`, `crear(input, adminId)`, `cambiarEstado(id, estado, adminId)`, `restablecerPassword(id, adminId)`, `prepararReenvioEmail(id, adminId)`.
- Extiende `UsuarioRepository` con `listarPorRol(rol)` — antes solo tenía filtros específicos por rol.

### 3) API — 4 rutas
- `GET /api/admin/verificadores` — lista.
- `POST /api/admin/verificadores` — alta. **Respuesta trae `passwordTemporal` SIEMPRE** (contrato Jelkin).
- `PATCH /api/admin/verificadores/[id]/estado` — desactivar/reactivar.
- `POST /api/admin/verificadores/[id]/restablecer-password` — **`passwordTemporal` SIEMPRE en respuesta** (candado `credencial-siempre-visible.candado.test.ts` la protege).
- `POST /api/admin/verificadores/[id]/reenviar-email` — envía por correo; **NUNCA devuelve la clave** si el envío se encoló. Único fallback: si el envío falla, la clave viaja para copia manual.

### 4) UI
- Server component gate `/dashboard/admin/verificadores/page.tsx`.
- Client `VerificadoresGestionClient.tsx` — lista + form de alta + acciones por fila. Reusa los tokens de diseño existentes (`glass`, `microetiqueta`, `titular-h1`, `palabra-estado`, `anim-entrada`).
- Item nav agregado a `ADMIN_NAV_ITEMS` (`src/lib/nav-items.ts`) — visible solo con el módulo `verificadores_admin`.

### 5) Candados
- `src/lib/verificador-modulos.candado.test.ts` (NUEVO · unit) — importa `CLAVES_POR_ROL` de `prisma/seed-modulos-grants.ts` y afirma que `VERIFICADOR` tiene exactamente `["admin_verificacion_profesionales"]` y que la lista NO se contamina con módulos de operador/comité/colegio/padre/admin. Verificado por mutación: agregarle `operadores`/`padres` a la fuente hace caer los dos tests.
- `src/app/api/admin/credencial-siempre-visible.candado.test.ts` — el candado permanente ya barre la ruta `restablecer-password/route.ts`; el piso subió de 5 a 6 endpoints alcanzados.
- `src/app/api/admin/verificadores/route.test.ts` (NUEVO · integración) — 4 tests: crea + devuelve `passwordTemporal` en el alta, rechaza email duplicado con 409, lista solo cuentas VERIFICADOR, y `verifyAuth("ADMIN")` bloquea al propio verificador (403). Verificado por mutación: cambiar la respuesta del alta a `passwordTemporal: emailEnviado ? undefined : password` (patrón I-298) hace caer el primer test.

## Refactor liviano
- `clavesPorRol` (constante local dentro de `syncModulosYGrants`) → `CLAVES_POR_ROL` (constante top-level exportada). Sin cambio de comportamiento; solo hace la fuente importable por candados.
- `scripts/arch/lib/nav-fuentes.ts` — el scraper de arch:check aprende a leer `CLAVES_POR_ROL` (conserva el fallback al nombre viejo para PRs paralelos).

## Impacto en arquitectura:
- **Nuevo módulo**: `verificadores_admin`. Solo ADMIN. `arch:check` regenera `02-roles-capacidades.md` y `03-pantallas.md` con la fila nueva.
- **VERIFICADOR** sigue sin heredar de ADMIN — el candado nuevo lo hace explícito y bloquea la contaminación en PR.
- No hay migración de BD. Enum `RolUsuario.VERIFICADOR` ya existe (SPEC-408). El grant nuevo del módulo se hace por el seed idempotente + `sync-modulos-grants.ts` en prod.

## Contrato Jelkin (verbatim)
- «un perfil como lo es operadores, con su user y pass y módulos».
- «la cuenta nace con `admin_verificacion_profesionales` y nada más: no hereda módulos de admin».
- «el menú del verificador no muestra ítems de operador, comité ni padre» (candado I-299).
- «restablecer SIEMPRE muestra la contraseña · reenviar por email NUNCA la devuelve».
