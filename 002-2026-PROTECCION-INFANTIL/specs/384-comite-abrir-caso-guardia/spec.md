# SPEC-384 · El comité no puede abrir NINGÚN caso (I-278 · I-279)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1) · **Origen**: radicado 006 del CEO (Jelkin bloqueado en prod probando el flujo del comité)

## Para qué

Dos defectos en el flujo del comité que Jelkin toca ahora mismo:

**I-278 — el detalle del reporte del comité responde 403 SIEMPRE.**
`GET /api/admin/reportes-revision/[id]` (y también la lista `GET /api/admin/reportes-revision`) exige `assertModulo(user, "bandeja_reportes")`. En prod, para el rol `COMITE_VALIDACION`, ese módulo está `activo=false` — es del operador (I-274 los separó a propósito, PR #282). `assertModulo` corta con 403 antes de llegar a la rama de autorización fina por caso (`route.ts:51`, `user.rol === "COMITE_VALIDACION" && permisosReporte.comiteId !== user.id`), que era la que autorizaba al comité en su propio caso — quedó muerta. Todos los miembros del comité, todos los casos, siempre 403.

**I-279 — el banner miente y descarta el mensaje real del servidor.**
`ComiteBandeja.tsx` capturaba el error de un `POST /api/admin/comite/[id]/asignar` en un único estado `error` y lo pintaba con `title="No pudimos cargar las solicitudes"` (que es falso, la lista sí cargó) y `onRetry={fetchSolicitudes}` (que reintenta lo que NO falló). El mensaje real del backend se descartaba y el usuario quedaba ciego.

## Qué cambia

### I-278 · Guardia por módulo (OR, nunca sustituir)

Nuevo helper compartido en `permisos-modulos.ts`:

```ts
export async function assertAnyModulo<T extends { rol: string }>(user: T, claves: readonly string[]): Promise<T>
```

Devuelve al primer módulo que autorice al rol; lanza 403 si ninguno. Se usa en los dos endpoints que sirven tanto al operador como al comité:

- `GET /api/admin/reportes-revision` — lista (route.ts:14).
- `GET /api/admin/reportes-revision/[id]` — detalle ([id]/route.ts:12).

Ambos pasan `["bandeja_reportes", "comite_bandeja"]`. El operador entra por el primero, el comité por el segundo; ninguno de los dos hereda el módulo del otro (I-274 se mantiene). La autorización fina por caso (dueño de la solicitud) queda intacta más abajo en el propio endpoint — el cambio del guardia no abre nada nuevo.

**Endpoints que NO se tocan** (verificado por `grep -rn "reportes-revision"` en `src/`):
- `clasificar`, `confirmar` (`[id]/*`), `reasignar` (`operadores/reasignar`): 0 menciones del comité, son del operador; el comité resuelve por `/api/admin/comite/[id]/resolver`.
- `AdminReportesTable.tsx:166` y `useReporteDetalle.ts:41,58,106`: consumidos por operador/admin, no por el comité.

### I-279 · Dos banners, mensaje real, retry correcto

`ComiteBandeja.tsx`:
- `error` se separa en `errorLista` y `errorAccion`.
- `fetchSolicitudes` set `errorLista` (texto genérico + retry a la lista).
- `handleVer` set `errorAccion = err.message` (mensaje REAL del backend, sin retry — la lista ya cargó).
- Al abrir un caso nuevo, `errorAccion` se limpia (si el segundo intento funciona, el banner se va).

Dos `<ErrorState>` distintos con propósitos distintos:

- «No pudimos cargar las solicitudes» → `onRetry={fetchSolicitudes}` (solo si `errorLista`).
- «No pudimos abrir el caso» → `description={errorAccion}` (mensaje real del servidor, sin retry).

## Candados

- **Candado 22 v5**: enumerados los 5 callsites de `reportes-revision` en `src/` antes de tocar (2 server-side son del propio route + un comentario; 3 client-side son el ComiteSolicitudDetalle que motiva el fix y dos useReporteDetalle del operador que no cambian).
- **Candado 26**: quitar/mover un guardia no puede haber abierto acciones adyacentes. Archivo dedicado `comite-candado26.spec-384.test.ts` afirma que el comité SIGUE en 403 al golpear `clasificar`, `confirmar` y `reasignar`.
- **Assert fuerte en I-278**: los tests reproducen el estado de prod (`permisoModulo.activo=false` para `COMITE_VALIDACION` × `bandeja_reportes`) antes de la aserción, y en la lista comprueban que la respuesta solo trae el caso propio del comité, no todos.
- **La autorización fina se prueba explícita**: comité asignado → 200; comité no asignado → 403 con el mensaje "no tienes permiso para ver este caso" (no el de "sin acceso al módulo") — confirmando que llegamos a `route.ts:51`, no que otro guardia cortó.
- **I-279**: el test afirma que el mensaje real del backend llega a pantalla y que el texto viejo NO aparece.

## Impacto en arquitectura: no

Un helper nuevo en `permisos-modulos.ts` (mismo módulo, misma responsabilidad). Cambios menores en 2 route handlers y 1 componente. Sin migración, sin nuevos modelos.

## Cómo se probó

- **Integration** (`[id]/route.test.ts`, 2 nuevos): comité asignado → 200 con `permisoModulo.bandeja_reportes.activo=false`; comité con otro caso → 403 con el mensaje de la autorización fina.
- **Integration** (`route.test.ts` lista, 1 nuevo): comité con `comite_bandeja` activo pero `bandeja_reportes` desactivado → 200 con solo su caso.
- **Integration** (`comite-candado26.spec-384.test.ts`, 3): comité → 403 en `clasificar`, `confirmar`, `reasignar`.
- **Unit** (`ComiteBandeja.test.tsx`, 1 nuevo I-279): `asignar` devuelve 403 con mensaje del backend → banner muestra el mensaje real bajo "No pudimos abrir el caso", la fila sigue visible, el texto viejo del banner NO aparece.
- Regresión completa del árbol `src/app/api/admin/reportes-revision`: 26/26 verdes.
- Local: `tsc --noEmit` limpio, lint 0 errores en archivos tocados, `arch/tokens/locks/ratchets` verdes, `specs-discipline` 8/8.

## Pendiente

- Verificación en vivo del CEO con la cuenta real del rector y el comité PI de Jelkin:
  · Comité entra a `/dashboard/admin/comite`, apreta "Ver" en una PENDIENTE → asigna y abre el modal.
  · Comité apreta "Ver" en una ASIGNADA → carga el detalle del reporte.
  · Si aparece algún error en cualquier caso, el banner muestra el mensaje real del servidor.
