# Checklist de calidad de requisitos — 001-auth-despacho-doble-token

> Validación del `spec.md` antes de implementar. Marcar `[x]` cuando se cumpla.

## Cobertura de las User Stories
- [x] US1 (auth real) tiene Priority, Independent Test y Acceptance Scenarios Given/When/Then.
- [x] US2 (despacho doble token) tiene Priority, Independent Test y Acceptance Scenarios.
- [x] US3 (infra aislada) tiene Priority y escenarios verificables.
- [x] Cada bug del demo (1–5) está cubierto por al menos un escenario o FR.

## Requisitos funcionales
- [x] FR sin ambigüedad ("El sistema DEBE…"), numerados y testables.
- [x] Doble token: 3 cabeceras especificadas (FR-010), refresh de token (FR-011), herencia rol 3 (FR-005).
- [x] Guardarraíl de stub explícito (FR-013) — sin consumo productivo.
- [x] Cola con worker independiente (FR-017), reintentos correctos (FR-019), un solo procesamiento (FR-020).
- [x] Migraciones aditivas (FR-023) y secretos por env (FR-024).

## Consistencia con el sistema real (paridad)
- [x] Roles = 1/2/3 (verificado contra legacy; rol 9 descartado, opción A).
- [x] Esquema `sicov` con columnas reales (data-model verificado contra migraciones).
- [x] `usn_administrador` = identificación del admin (join lógico), no FK a `usn_id`.
- [x] Login único (sin Vigía); política de contraseña = regex confirmada del legacy.
- [x] Worker table-driven sobre `tbl_despachos_solicitudes` (no pg-boss), fiel al legacy.

## Criterios de éxito
- [x] Success Criteria medibles (SC-001…SC-007) y verificables en quickstart.
- [x] SC-003/SC-004 cubren integridad del doble token y cache del token de proveedor.

## Riesgos y supuestos
- [x] Assumptions documentadas (stack, stub, cola, seed demo).
- [x] `[NEEDS CLARIFICATION]` restantes listados (payloads reales, endpoints, umbral de bloqueo) — no bloquean el stub.
- [x] Alcance P1 delimitado (un despacho; llegadas/mantenimientos/novedades a fases siguientes).

## Constitución
- [x] Cumple aislamiento Docker, migraciones aditivas, secretos por env, doble token, 5 reglas de oro.
- [x] No toca 001/002. Guardarraíl de APIs productivas activo.
