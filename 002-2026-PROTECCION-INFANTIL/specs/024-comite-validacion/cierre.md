# Cierre — Spec 024: Rol Comité de Validación + escalamiento

## Resumen de implementación

Se implementó el rol `COMITE_VALIDACION`, el modelo de escalamiento y la bandeja del comité, respetando la exclusividad con `OPERADOR` y las reglas de privacidad de la Spec 025.

## Qué se implementó

1. **Base de datos** (Prisma + migración):
   - Nuevo valor `COMITE_VALIDACION` en el enum `RolUsuario`.
   - Nuevo campo `esComite` en `PerfilOperador` (default `false`).
   - Nuevo campo `comiteId` y relación inversa en `Reporte`/`Usuario`.
   - Nueva tabla `SolicitudComite` con estados `PENDIENTE` | `ASIGNADA` | `RESUELTA`.
   - Nuevas acciones `CASO_RESUELTO_POR_COMITE` y `CASO_REASIGNADO` en `AccionAudit`.
   - Migración generada y aplicada con `npx prisma migrate dev --name add_rol_comite_validacion`. Prisma aplicó enum, flag, `comiteId` y la tabla `SolicitudComite` en una sola migración; no fue necesaria una segunda.

2. **Auth y permisos**:
   - Helpers `requireComiteOAdmin`, `requireAdminOComiteOOperador` en `src/lib/auth.ts`.
   - Helpers `esComiteRol`, `validarExclusividadRolComite`, `normalizarEsComiteParaRol` en `src/lib/operadores/permisos.ts`.
   - `responsableTipoFromRol` ahora devuelve `COMITE` para `COMITE_VALIDACION`.

3. **Endpoints**:
   - `POST /api/admin/operadores` soporta `rol=COMITE_VALIDACION` y setea `esComite=true`; rechaza combinaciones inválidas con `400 EXCLUSIVIDAD_ROL` y devuelve `201`.
   - `POST /api/admin/reportes/[id]/escalar`: operador escala un caso al comité, crea `SolicitudComite`, desasigna el operador y registra transición `CASO_ESCALADO`.
   - `GET /api/admin/comite/pendientes`: solicitudes `PENDIENTE` sin asignar (rol `COMITE_VALIDACION` o admin).
   - `GET /api/admin/comite/mias`: solicitudes asignadas al comité autenticado.
   - `POST /api/admin/comite/[id]/asignar`: auto-asignación o asignación por admin; actualiza `Reporte.comiteId`.
   - `POST /api/admin/comite/[id]/resolver`: resuelve `CLASIFICAR` o `CORREGIR`, actualiza `Reporte.estado`, crea `CorreccionAdmin` si aplica, y registra transición `CASO_RESUELTO_POR_COMITE`.
   - `POST /api/admin/comite/[id]/reasignar`: admin reasigna a otro miembro del comité; registra `CASO_REASIGNADO`.
   - `GET /api/admin/reportes-revision` y `GET /api/admin/reportes-revision/[id]` ahora permiten a `COMITE_VALIDACION` ver casos asignados a él sin exponer datos del denunciante.

4. **UI**:
   - Página `/dashboard/admin/comite` con bandeja (tabs Pendientes / Mías) y detalle de solicitud.
   - Componentes `ComiteBandeja` y `ComiteSolicitudDetalle`.
   - Navegación `AdminNav` y `layout.tsx` actualizados para mostrar el ítem Comité a usuarios con ese rol.
   - `AdminReporteDetalle` ahora incluye acción "Escalar a comité" para operadores asignados y admin.

5. **Tests**:
   - `src/app/api/admin/operadores/route.test.ts`: creación de comité, rechazo de exclusividad, listado.
   - `src/app/api/admin/comite/pendientes/route.test.ts`: flujo completo de escalamiento, asignación y resolución; privacidad del denunciante.
   - Ajuste en `src/app/api/auth/cambiar-password/route.test.ts` para esperar `201` en la creación de operadores.

## Archivos tocados

- `prisma/schema.prisma`
- `prisma/migrations/20260718104515_add_rol_comite_validacion/migration.sql`
- `src/lib/auth.ts`
- `src/lib/operadores/permisos.ts`
- `src/lib/reporte-transiciones.ts`
- `src/app/api/admin/operadores/route.ts`
- `src/app/api/admin/operadores/[id]/route.ts`
- `src/app/api/admin/operadores/route.test.ts` (nuevo)
- `src/app/api/admin/reportes-revision/[id]/route.ts`
- `src/app/api/admin/reportes-revision/route.ts`
- `src/app/api/admin/reportes/[id]/escalar/route.ts` (nuevo)
- `src/app/api/admin/comite/pendientes/route.ts` (nuevo)
- `src/app/api/admin/comite/pendientes/route.test.ts` (nuevo)
- `src/app/api/admin/comite/mias/route.ts` (nuevo)
- `src/app/api/admin/comite/[id]/asignar/route.ts` (nuevo)
- `src/app/api/admin/comite/[id]/resolver/route.ts` (nuevo)
- `src/app/api/admin/comite/[id]/reasignar/route.ts` (nuevo)
- `src/app/dashboard/admin/layout.tsx`
- `src/app/dashboard/admin/comite/page.tsx` (nuevo)
- `src/components/modules/AdminNav.tsx`
- `src/components/modules/AdminReporteDetalle.tsx`
- `src/components/modules/ComiteBandeja.tsx` (nuevo)
- `src/components/modules/ComiteSolicitudDetalle.tsx` (nuevo)
- `src/app/api/auth/cambiar-password/route.test.ts`

## Resultados de tests y verificación

- `npm run lint`: ✅ (1 warning preexistente en `src/lib/sms.ts`, no relacionado).
- `npx tsc --noEmit`: ✅
- `npm run build`: ✅
- `npm run test`: ✅ 66 archivos, 334 tests pasados.
- `npm run smoke-e2e`: no existe en `package.json`.

## Decisiones y notas

- **Exclusividad**: se garantiza validando `rol=OPERADOR` vs `esComite` en el endpoint de creación y usando `esComite` como flag de filtrado. No se permite cambiar `OPERADOR` ↔ `COMITE_VALIDACION` vía PATCH; el contract indica que requiere regenerar el perfil.
- **Corrección por comité**: el modelo `CorreccionAdmin` usa `adminId` como FK del responsable. El comité se guarda en ese campo para mantener el historial de correcciones sin alterar el schema adicional; el audit y la transición registran que el responsable fue `COMITE`.
- **Estados de solicitud**: `PENDIENTE`, `ASIGNADA`, `RESUELTA`. La asignación mueve a `ASIGNADA` y setea `Reporte.comiteId`. La resolución pasa a `RESUELTA` y setea `resueltoEn`.
- **Privacidad**: los endpoints de operador/comité nunca devuelven `textoOriginal`, `usuarioId`, `usuario` ni datos del denunciante. La UI del comité usa el mismo detalle de reporte anonimizado.
- **Migración**: Prisma generó una sola migración que incluyó el enum, el flag, `comiteId` y la tabla `SolicitudComite`. Se aplicó tanto a la base de desarrollo como a la de test (`DATABASE_URL` explícita para `proteccion_infantil_test`).

## Commit de cierre

Hash del último commit: `8703591d862eb138c621681812cfa8564dc0c18a`

## Pendientes / follow-up

- No se implementó notificación por email al comité ante nuevas solicitudes pendientes; puede agregarse como mejora futura.
- No se agregó un dashboard de métricas del comité; la bandeja actual cubre los escenarios A-I del quickstart.
