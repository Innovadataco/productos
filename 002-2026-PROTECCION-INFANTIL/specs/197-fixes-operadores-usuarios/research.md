# Research — SPEC-197

## Código relevante

- `src/app/dashboard/admin/operadores/asignar/page.tsx`: listado de asignación con botón "Reasignar caso".
- `src/components/modules/operadores/ReasignarModal.tsx`: modal de reasignación; carga `/api/admin/operadores`.
- `src/app/api/admin/operadores/route.ts`: devuelve `OperadorListItemDto` con `casosAbiertos` y `perfil.cupoMaximo`.
- `src/app/dashboard/admin/usuarios/UsuariosAdminClient.tsx`: listado de usuarios; lee `?rol` de query string.
- `src/components/modules/admin/UsuariosSubNav.tsx`: tabs con hrefs a `/dashboard/admin/usuarios/{rectores,operadores,comite,admins}`.
- `src/app/api/admin/usuarios/route.ts`: soporta `rol` en query string.

## Decisiones

- No se crean endpoints nuevos; se reutilizan los existentes.
- Para el sub-tab Comité se envían dos roles separados por coma y el backend usa `in`; alternativa: crear un alias `COMITE`. Se opta por enviar lista para no tocar schema.
