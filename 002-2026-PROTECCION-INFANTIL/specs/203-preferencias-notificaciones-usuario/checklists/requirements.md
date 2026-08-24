> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Checklist de requisitos: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100)

- [ ] Ruta `/dashboard/perfil/notificaciones` accesible para usuarios autenticados.
- [ ] `GET /api/notificaciones/preferencias` devuelve reglas aplicables al rol con preferencias.
- [ ] `PATCH /api/notificaciones/preferencias` actualiza solo reglas no obligatorias.
- [ ] Componente `CentroNotificaciones` generalizado multi-rol.
- [ ] Endpoint `/api/notificaciones` para bandeja unificada.
- [ ] Motor consulta preferencias antes de programar no obligatorias.
- [ ] Reglas obligatorias se muestran como no editables.
- [ ] No se tocó `src/lib/ai/**`.
- [ ] CI verde 6/6.
