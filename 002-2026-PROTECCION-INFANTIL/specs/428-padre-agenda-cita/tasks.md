# SPEC-428 · Tasks

## Hecho (este PR)

- [x] Seed idempotente `profesional.cita.precio_estandar_primera_cita_cop`.
- [x] Helper `leerPrecioEstandarPrimeraCita()` + endpoint público.
- [x] `montoConsultaOverride` en `cita.service.ts` (sin tocar herencia de pago).
- [x] `SolicitarCitaPanel.tsx` (nuevo) — franjas + modal + rama de reasignación.
- [x] `ProfesionalPerfil.tsx` — precio estándar por delante + integra el panel.
- [x] `ExpedienteVivo.tsx` — CTAs «Llamar 141» + «Recibir apoyo».
- [x] Cadena de propagación `expedienteId` + `heredarDe`.
- [x] `GET /api/padre/citas/[id]` (PARENT).
- [x] `/dashboard/padre/citas/[id]/page.tsx` + `EsperaCitaPanel.tsx` (reloj 48 h, refresco al foco, botón «Elegir otro»).
- [x] `arch:check` VERDE (regenerados 02-roles-capacidades y 03-pantallas).
- [x] `tokens:check` piso 1079.
- [x] `npm run lint` 0 errors.
- [x] spec / plan / tasks.

## Seguimiento (fuera de este PR)

- [ ] Tests unitarios `SolicitarCitaPanel` — happy path + rama reasignación.
- [ ] Test integración GET `/api/padre/citas/[id]` — PARENT ve la suya, 404 en otra.
- [ ] Test unitario del hook `useCountdown` (borde de vencido).
- [ ] E2E Playwright de los momentos 1 → 7 con seed determinístico.
- [ ] Endpoint público `precio-primera-cita` en la landing (si aparece la necesidad).
