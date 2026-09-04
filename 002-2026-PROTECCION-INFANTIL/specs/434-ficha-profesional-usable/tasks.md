# SPEC-434 · Tasks

## Hecho (este PR)

- [x] Blindar `PUT /api/profesional/perfil` — ciudad inválida → 400 con mensaje humano.
- [x] `PerfilProfesionalPropioDto.ciudad` gana `paisId` (repo + DTO).
- [x] Reescribir `perfil-profesional/completar/page.tsx`:
  - [x] País + `CiudadSearchSelect` (reusa SPEC-115).
  - [x] Voz neutra (usted, sin voseo).
  - [x] «Emito factura» fuera de la pantalla.
  - [x] Años de experiencia como `Select` 1..50.
  - [x] Modal en la transición a EN_REVISION; jamás muestra el nombre técnico del estado.
- [x] Test integración `route.test.ts` — 201 con ciudad válida, 400 con ciudad inválida; regresión probada.
- [x] Ratchet permanente `voz.candado.test.ts` con patrones exactos de voseo y exclusión de comentarios.
- [x] arch:check VERDE, tokens 1079, lint 0 errors.

## Seguimiento (fuera de este PR)

- [ ] Confirmar el «/api/me → 401 + encabezado Iniciar sesión» del radicado (observación secundaria, Jelkin pidió confirmar antes de radicar aparte).
- [ ] Barrer voz de las otras pantallas del profesional (verificación, panel) si Jelkin lo pide.
- [ ] Ratchet estático que enumere todos los `connect: { id: <valor de body> }` en `/api/**` y exija validación previa de existencia (patrón general del bug I-302).
