# Checklist de requisitos — Spec 079

## Parte 1 — Fix de vigencia

- [ ] `verificarVigenciaColegio` usa `hoyNormalizado()` y `normalizarFechaServicio()`.
- [ ] Colegio con `inicioServicio` hoy → `vigente`.
- [ ] Colegio con `inicioServicio` mañana → `no_iniciado`.
- [ ] Colegio con `finServicio` ayer → `vencido`.
- [ ] Colegio con `finServicio` hoy → `vigente`.
- [ ] Tests unitarios en `src/lib/colegio/vigencia.test.ts`.

## Parte 2 — Gestión de acceso

- [ ] Endpoint `POST /api/admin/colegios/[id]/regenerar-password` solo ADMIN.
- [ ] Genera contraseña temporal aleatoria y marca `debeCambiarPassword: true`.
- [ ] Registra `COLEGIO_PASSWORD_REGENERADA` en `AuditLog`.
- [ ] Endpoint `POST /api/admin/colegios/[id]/reenviar-email` solo ADMIN.
- [ ] Envía email de bienvenida y registra `COLEGIO_EMAIL_REENVIADO`.
- [ ] Si falla el envío, devuelve contraseña temporal.
- [ ] UI muestra contraseña temporal una sola vez al crear/restablecer.
- [ ] Tests de endpoints con ADMIN, no ADMIN, colegio sin admin.

## Parte 3 — Auditoría del colegio

- [ ] Decisión de aislamiento aprobada (Opción B recomendada: `colegioId` en `AuditLog`).
- [ ] Migración aditiva `AuditLog.colegioId`.
- [ ] Acciones `COLEGIO_*` existentes y nuevas registran `colegioId`.
- [ ] Endpoint `GET /api/colegio/auditoria` solo SCHOOL_ADMIN.
- [ ] Endpoint filtra por `colegioId` del usuario y acciones `COLEGIO_*`.
- [ ] Vista `/dashboard/colegio/auditoria` reutiliza `AuditLogViewer`.
- [ ] Tests de aislamiento: un SCHOOL_ADMIN no ve auditoría de otro colegio.
- [ ] Tests de ADMIN: la vista de auditoría general no se rompe.

## Reglas transversales

- [ ] Migraciones aditivas, nunca destructivas.
- [ ] No se toca el modelo `Reporte` ni el clasificador.
- [ ] Un solo worker; no se modifica el worker.
- [ ] Tono neutral sin voseo en UI y documentación.
