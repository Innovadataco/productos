# SPEC-408 · Tasks

## Estado: CERRADO — PR pendiente de abrir

- [x] Worktree fresco `.worktrees/pi-SPEC-408` desde `origin/main d832ec3db`.
- [x] Cherry-pick de SPEC-389 (vigencia + cron + módulo + spec base).
- [x] Enum `RolUsuario.VERIFICADOR` + migración `ADD VALUE IF NOT EXISTS` (I-277).
- [x] Un solo módulo `admin_verificacion_profesionales` para ambas colas (I-278). Grants.
- [x] Seed `verificacion.requisitos` (JSON) con 4 defaults, idempotente.
- [x] Reader `requisitos.ts` + tests.
- [x] Service `verificador/service.ts` — `listarSolicitudesEnRevision`, `abrirFicha`, `decidir` (aprobar/rechazar según checklist), `listarIncidentesCitas`.
- [x] Vista del profesional `verificador/vista-profesional.ts` — expone solo observación por ítem + test candado H-2.
- [x] Endpoints admin: `route.ts`, `[id]/route.ts`, `[id]/decidir/route.ts`, `incidentes/route.ts`.
- [x] Endpoints profesional: `verificacion/route.ts`, `verificacion/reenviar/route.ts`.
- [x] Pantalla admin cola 1 + ficha + cola 2, con Instrument Serif + DM Mono + motion.
- [x] Pantalla profesional `/perfil-profesional/verificacion`.
- [x] Landing por rol: `proxy.ts` (`INTERNAL_ROLES`, `homeForRole`), `home-para-rol.ts`, `consentimiento`, `perfil/notificaciones`, `e2e/helpers`, `e2e/journeys/*`.
- [x] Nav-items: dos entradas nuevas.
- [x] Regenerados los 5 artefactos de `docs/architecture/*.md`.
- [x] `spec.md`, `plan.md`, `tasks.md` + fila en `specs/README.md`.
- [x] `test:unit` completo VERDE.
- [x] `tsc` + `arch:check` (7 gates) VERDES.
- [x] `eslint` limpio en archivos tocados.
- [ ] Commit + push + PR.
- [ ] Post-deploy: recorrido completo por VERIFICADOR (aprobar / devolver / reenviar / segunda cola).
- [ ] Coordinación con SPEC-410 (Calidad · candados de reserva legal H-2) y SPEC-411 (admin espeja al comité, futuro).

## Notas para el siguiente Dev
- **Un rol, un módulo**: no separar `admin_verificacion_incidentes` sin razón fuerte (I-278).
- **Reserva legal H-2**: cualquier campo nuevo en la vista del profesional pasa por `vista-profesional.test.ts` (lo caza).
- **Los 4 requisitos son parámetro**: renombrar o agregar no requiere despliegue — se edita en ConfigPanel.
- **Los códigos de cita/expediente** (brief §9 momento 6) cablean `trazaCodigos: null` en la cola 2; cuando el spec de códigos aterrice, el campo se puebla y la UI ya está preparada.
