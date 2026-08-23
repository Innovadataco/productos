# Checklist de requisitos — SPEC-206

## Funcionales

- [ ] FR-001: Modelo `SesionLog` creado con todos los campos.
- [ ] FR-002: Login crea sesión e incluye `sesionLogId` en JWT.
- [ ] FR-003: Endpoint `POST /api/session/ping` actualiza actividad.
- [ ] FR-004: Hook `useSessionPing()` respeta Page Visibility.
- [ ] FR-005: Worker cierra sesiones inactivas según parámetro.
- [ ] FR-006: Vista admin lista sesiones activas.
- [ ] FR-007: Endpoint de forzar cierre funciona y audita.
- [ ] FR-008: Parámetros `sesion.*` sembrados.
- [ ] FR-009: `verifyAuth` valida sesión cerrada cuando aplica.
- [ ] FR-010: IP hasheada; UI muestra solo últimos 4 caracteres.
- [ ] FR-011: No tocar motor ni rate-limit de reportes.

## No funcionales

- [ ] NFR-001: Ping < 100 ms.
- [ ] NFR-002: Cero PII de reportes.
- [ ] NFR-003: Cumplimiento Ley 1581 (IP hasheada).
- [ ] NFR-004: Migración aditiva sin DROP.
- [ ] NFR-005: Tests de integración cubren los escenarios críticos.
- [ ] NFR-006: Gate local completo verde.

## Criterios de éxito

- [ ] SC-001: Login crea sesión.
- [ ] SC-002: Ping actualiza y respeta visibilidad.
- [ ] SC-003: Worker cierra inactivas.
- [ ] SC-004: Forzar cierre invalida JWT.
- [ ] SC-005: Gate local verde.
- [ ] SC-006: CI 6/6 verde.

## Revisión de seguridad

- [ ] No se expone IP en claro.
- [ ] No se expone texto de reporte.
- [ ] Solo ADMIN con `sesiones_admin` accede a la vista.
- [ ] Tokens previos sin `sesionLogId` siguen funcionando.
