> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Checklist de requisitos: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101)

- [ ] Plantilla `colegio.bienvenida.email` en seed.
- [ ] Regla `colegio.bienvenida` obligatoria en seed.
- [ ] `POST /api/admin/colegios` usa `motor.programar`.
- [ ] `POST /api/admin/colegios/:id/reenviar-email` usa `motor.programar`.
- [ ] Tests actualizados para el motor.
- [ ] `enviarEmailBienvenidaColegio` marcada `@deprecated` o eliminada.
- [ ] Contenido del email equivalente al anterior.
- [ ] No se tocó `src/lib/ai/**`.
- [ ] CI verde 6/6.
