# SPEC-421 · Plan

## Alcance
Espejo de `/admin/padres` para profesionales + solicitudes de registro pendientes. Ver `spec.md`.

## Pasos
1. Worktree fresco `.worktrees/pi-SPEC-421` desde `origin/main 36564bc55`.
2. Auditar `/admin/padres/[id]/restablecer-password:80` como patrón espejo.
3. Módulo nuevo `profesionales_admin` en `permisos-catalogo.ts`.
4. Service `ProfesionalesAdminService` (listar/obtener/restablecerPassword/desactivar/reactivar/listarSolicitudesPendientes). Sin `crear`.
5. Repo: agregar `findProfesionalesPaginados` + `findProfesionalById` a `UsuarioRepository`; agregar `findPendientesPorRol` a `TokenRegistroRepository`.
6. Endpoints:
   - `GET /api/admin/profesionales` (list + filtro)
   - `GET /api/admin/profesionales/[id]` (detalle)
   - `DELETE /api/admin/profesionales/[id]` (desactivar)
   - `POST /api/admin/profesionales/[id]/reactivar`
   - `POST /api/admin/profesionales/[id]/restablecer-password` (espejo exacto de padres)
   - `GET /api/admin/profesionales/solicitudes`
   - `POST /api/admin/profesionales/solicitudes/reenviar` (URL en pantalla si el correo falla)
7. UI `/dashboard/admin/profesionales/gestion` con dos tabs (Cuentas + Solicitudes).
8. Nav-item Profesionales.
9. Regenerar `docs/architecture/*.md`.
10. `test:unit` + `tsc` + `arch:check` + `tokens:check` verdes.
11. `spec.md`, `plan.md`, `tasks.md`, fila en `specs/README.md`.
12. Commit + push + PR.

## Verificación
- `test:unit`: 2296/2296.
- `arch:check` VERDE completo (7 gates).
- `tokens:check` piso 1079.
- Post-deploy: profesional pide registro → aparece en solicitudes → admin reenvía (con o sin correo) → cuenta se crea → aparece en cuentas → admin puede desactivar/reactivar/restablecer contraseña con la clave en pantalla si el correo no sale.

## Fuera de scope
- Creación desde admin (Jelkin descartó).
- Editar nombre/email desde admin.
- Purga automática de solicitudes vencidas.
