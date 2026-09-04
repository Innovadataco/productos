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

## Tests de este PR (post veredicto CEO 23:1x — «sin pruebas no hay merge»)

- [x] `precio-primera-cita.test.ts`: helper devuelve entero, EXPLOTA sin parámetro, EXPLOTA con valor inválido (0/negativo/no numérico/vacío), redondea decimal positivo.
- [x] `cita.service.test.ts`: (b) `crearSolicitudCita` con override cobra precio ESTÁNDAR (no la tarifa) · sin override cae a tarifa; (c) `reasignarPorPadre` hereda montos + `pagoHeredadoDeId` + arranca `pagoAprobadoEn` · rechaza reasignar al MISMO profesional.
- [x] `api/padre/citas/[id]/route.test.ts`: (a) sin sesión → 401; otro padre → 404; el padre dueño → 200 con DTO CitaParaPadre y `contactoProfesional === undefined` (candado H-2).
- [x] `api/publico/profesionales/precio-primera-cita/route.test.ts`: (e) sin sesión → 200; sin parámetro → 500 con AppError.

## Seguimiento (fuera de este PR)

- [ ] Tests unitarios `SolicitarCitaPanel` — happy path + rama reasignación.
- [ ] Test unitario del hook `useCountdown` (borde de vencido).
- [ ] E2E Playwright de los momentos 1 → 7 con seed determinístico.
- [ ] Consumir el endpoint público `precio-primera-cita` en la landing (si aparece la necesidad).
