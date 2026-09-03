# SPEC-408 · Plan

## Diseño fijado por CEO 03-09
- **Rol interno único** `VERIFICADOR` con perfil equivalente al Operador. Un solo módulo (`admin_verificacion_profesionales`) para ambas colas.
- **Contrato de rutas cerrado** (15:35):
  - `/dashboard/admin/verificacion` (cola 1) + `/dashboard/admin/verificacion/incidentes` (cola 2)
  - `GET/api/admin/verificacion-profesionales` (list), `GET .../[id]` (ficha), `POST .../[id]/decidir` (aprobar/devolver), `GET .../incidentes`
  - `GET /api/profesional/verificacion` (estado + observaciones), `POST /api/profesional/verificacion/reenviar`
  - Pantalla profesional: `/perfil-profesional/verificacion`
- **Los 4 requisitos son parametrizables** (`ParametroSistema.verificacion.requisitos` JSON, seed idempotente).
- **Diseño**: tokens de `globals.css`, Instrument Serif titulares, Instrument Sans cuerpo, DM Mono etiquetas. Iconos SVG de trazo. Movimiento con `anim-entrada` escalonado + `hover:scale-[1.005]`.

## Pasos
1. Worktree `.worktrees/pi-SPEC-408` desde `origin/main d832ec3db` + `npm install`.
2. Cherry-pick de SPEC-389 (Dev Infra) — vigencia + cron + módulo + spec base. Preserva autoría original.
3. Enum aditivo `RolUsuario.VERIFICADOR` + migración `20260903140000_spec_408_verificador_rol` (lección I-277).
4. Catálogo: un solo módulo `admin_verificacion_profesionales` cubre ambas colas (lección I-278). Grants por rol.
5. Seed `verificacion.requisitos` con 4 requisitos default (`update: {}` idempotente).
6. Service `verificador/` (requisitos reader + service.decidir + vista-profesional) con candados legales.
7. Endpoints admin: list/ficha/decidir/incidentes. Todos con `assertModulo`.
8. Endpoints profesional: estado + reenviar. Solo la observación escrita.
9. Pantallas admin (cola 1, ficha, cola 2) — clientes con motion + Instrument Serif.
10. Pantalla profesional — misma línea de diseño.
11. Landing (proxy + home-para-rol + consentimiento + perfil/notificaciones + e2e/helpers + e2e/journeys) para el rol nuevo.
12. Nav-items — dos entradas (`Verificación`, `Incidentes de citas`).
13. Tests candado (requisitos + reserva legal H-2 del profesional).
14. Regenerar los 5 artefactos de `docs/architecture/*.md`.
15. `spec.md`, `plan.md`, `tasks.md`, fila en `specs/README.md`.
16. Verificar: `test:unit` completo, `tsc`, `arch:check` (a/b/c/d/d-bis/e/f).
17. Commit + push + PR.

## Verificación

### Automatizada
- `test:unit` completo verde (2165+ tests, 6 nuevos SPEC-408 + 24 heredados SPEC-389).
- `tsc --noEmit` verde.
- `arch:check` verde en 7 gates.
- `eslint` limpio.

### En vivo (post-deploy)
- Loguearse como VERIFICADOR → aterrizaje directo en `/dashboard/admin/verificacion`.
- Ciclo completo: aprobar un perfil (queda ACTIVO), devolver otro con observación (llega correo al profesional), profesional corrige y reenvía (vuelve a EN_REVISION).
- Cola 2 muestra las citas `SIN_CONFIRMAR`.

## Fuera de scope
- Códigos de cita/expediente (brief §9 momento 6, otro SPEC).
- Worker cron real de vencimiento a 4 meses (helpers listos, scheduler futuro).
- UI dedicada de edición de los 4 requisitos (por ahora via ConfigPanel genérico).
