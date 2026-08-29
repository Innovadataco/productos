# Research — SPEC-205

## Hallazgo de divergencia (motivador del SPEC)

Verificado en BD prod y código:

- `Usuario` no tiene columnas operativas; solo identidad, rol, estado y fechas.
- `PerfilOperador` solo guarda `cupoMaximo`; los `casosAbiertos` se calculan con `COUNT` sobre `Reporte`.
- El endpoint `GET /api/admin/usuarios?rol=OPERADOR` (usado por sub-tab) NO hace el join/cont de casos abiertos.
- El endpoint `GET /api/admin/operadores/asignacion` (usado por `/operadores/asignar`) SÍ calcula `casosAbiertos` desde `Reporte` vía `OperadorService.panelAsignacion()`.
- Resultado: un mismo operador (p. ej. Mateo Domínguez) muestra información distinta entre `/usuarios/operadores` y `/operadores/asignar`.

## Código actual relevante

### `/dashboard/admin/usuarios/UsuariosAdminClient.tsx`
- Cliente genérico con tabla de columnas fijas: Email, Nombre, Estado, Registro, Última sesión, Reportes, Colegio.
- No distingue roles en las columnas.
- Usa `GET /api/admin/usuarios?rol=...`.

### `/api/admin/usuarios/route.ts`
- Devuelve DTO genérico para todos los roles.
- Para `rol=PARENT` cuenta reportes enviados; para otros roles no enriquece con datos de PerfilOperador/Colegio/Comité.

### `/api/admin/operadores/asignacion/route.ts`
- Delega en `OperadorService.panelAsignacion()`.
- Calcula `casosAbiertos` por operador desde `Reporte`.
- Es la fuente de verdad operativa para operadores.

### `/api/admin/operadores/[id]/metricas/route.ts`
- Delega en `OperadorMetricasService.obtenerMetricas()`.
- Devuelve métricas detalladas: abiertos, resueltos 24h/7d/30d, tiempo medio, tasa de escalamiento, casos por categoría.

### `src/components/modules/admin/UsuariosSubNav.tsx`
- 5 tabs: Padres, Rectores, Operadores, Comité, Admins.
- Falta separar Comité en convivencia/validación.
- Activo por `pathname === href || pathname.startsWith(...)`.

## Lecciones de SPECs anteriores

- SPEC-194: introdujo `/api/admin/usuarios` genérico y sub-tab Padres. El DTO es básico y no distingue roles.
- SPEC-197: creó las páginas de sub-tabs y hizo que `UsuariosAdminClient` acepte prop `rol`, pero mantuvo la tabla genérica.
- SPEC-189: consolidó métricas de operador en `OperadorMetricasService`; se puede reusar para el detalle de operador.
- SPEC-053: `OperadorService.panelAsignacion()` es la fuente correcta de conteos operativos.

## Restricciones detectadas

- No se puede modificar `src/lib/ai/**`.
- No se permiten migraciones destructivas.
- Los textos de reporte nunca deben salir en agregados.
- El rate-limit `admin_read` debe aplicarse en endpoints nuevos.
