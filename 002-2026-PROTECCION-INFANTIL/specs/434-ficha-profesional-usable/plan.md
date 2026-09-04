# SPEC-434 · Plan

## Fases

1. Blindar el endpoint `PUT /api/profesional/perfil`: si `ciudadId` no existe, 400 (no 500).
2. Extender `PerfilProfesionalPropioDto.ciudad` con `paisId` (solo vista propia).
3. Reescribir `perfil-profesional/completar/page.tsx` con voz neutra + país/ciudad + selector años + modal EN_REVISION.
4. Retirar checkbox «Emito factura» del formulario.
5. Candados:
   - `route.test.ts` (2 casos + regresión probada).
   - `voz.candado.test.ts` (ratchet de voseo, comentarios excluidos).
6. arch:check + tokens + lint + specs + PR.

## Reutilización

- `CiudadSearchSelect` (SPEC-115) sin cambios.
- `Select` para años (opciones generadas por comprensión).
- Patrón de modal simple con `role="dialog"` y overlay.

## Riesgos

- El DTO propio agrega `paisId` — el DTO PÚBLICO no cambia; test H-2 preexistente sigue verde.
- El campo «Emito factura» sigue en el modelo — no se pregunta pero no se borra (nada se borra).
