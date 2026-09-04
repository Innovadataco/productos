# SPEC-423 · Plan

## Alcance
Fix cirujano en 4 endpoints + split de padres/profesionales en dos acciones + candado permanente.

## Pasos
1. Worktree `.worktrees/pi-SPEC-423` desde `origin/main f57eb7033`.
2. Auditar `admin/colegios/[id]/regenerar-password:88` (patrón correcto que se replica).
3. Padres:
   - Reescribir `restablecer-password/route.ts` → solo genera + devuelve password siempre. Sin email.
   - NUEVO `reenviar-email/route.ts` → regenera + encola + password siempre + encolado.
4. Profesionales (SPEC-421):
   - Reescribir `restablecer-password/route.ts` (mismo criterio que padres).
   - NUEVO `reenviar-email/route.ts` con `enviarBienvenidaProfesional`.
5. Operadores:
   - Fix `[id]/reenviar-email/route.ts:62` → borra `emailEnviado ? undefined : password`. Password siempre.
6. Colegios:
   - Fix `[id]/reenviar-email/route.ts:96` → mismo tratamiento.
7. Solicitudes de registro:
   - Fix `profesionales/solicitudes/reenviar/route.ts:96` → `enlace` siempre.
8. Clients:
   - `ProfesionalesGestionClient.tsx` → botón "Reenviar por correo" adicional.
   - `PadresPageClient.tsx` → nueva función `reenviarPorCorreo` + botón.
9. Candado permanente `credencial-siempre-visible.candado.test.ts` (scan + regex + regresión probada con sed).
10. Regenerar `docs/architecture/*.md`.
11. `spec.md`, `plan.md`, `tasks.md` + fila en `specs/README.md`.
12. Verificar: `test:unit` + `tsc` + `arch:check` + `tokens:check` + eslint.
13. Commit + push + PR.

## Verificación
- 2319/2319 unit tests.
- 7 gates arch:check verdes. tokens piso 1079.
- Regresión: `sed` de un endpoint reintroduce el bug → candado ROJO listando la fuga.
- Post-deploy: CEO reactiva las dos reglas del motor (`auth.registro_enlace_profesional`, `auth.bienvenida_profesional`).

## Fuera de scope
- Chequeo asíncrono del estado del correo (otro SPEC).
- Modificar `regenerar-password` de operadores/colegios (ya correcto).
