# SPEC-428 · Plan

## Fases

1. **Datos + helper de parámetro** — seed idempotente, helper puro con `AppError` si falta.
2. **API** — GET `/api/padre/citas/[id]`, GET público del precio, campo opcional `montoConsultaOverride` en el service.
3. **UI M1 (expediente)** — botones «Llamar» + «Recibir apoyo».
4. **UI M4 (perfil)** — precio estándar por delante + `SolicitarCitaPanel` con franjas + modal.
5. **Cadena de propagación** — `expedienteId` y `heredarDe` de la puerta al panel.
6. **UI M6-M7 (espera)** — página + panel con reloj y botón «Elegir otro».
7. **spec / plan / tasks + arch:check + tokens:check + lint**.

## Reutilización

- **Motor SPEC-395**: cita.service.ts + repos + DTO. Cambio mínimo (un campo opcional).
- **DTO H-2**: contacto sólo si `debeExponerContacto` (SPEC-388a).
- **PresentacionUrgenciaForm / DirectorioProfesionales**: se les pasa un prop nuevo, no se reescriben.
- **CanalesOficiales**: reusado en el panel de perfil (donde ya vivía).

## Riesgos y candados

- Precio estándar sin sembrar → SSR de perfil rompe con AppError. Aceptable — evita cobrar tarifa del profesional por accidente. La migración/seed garantiza el parámetro.
- Reasignación desde la UI: reusa endpoint del motor; el service impone estados válidos (VENCIDA_SIN_RESPUESTA / NO_ASISTIO_PROFESIONAL). El panel esconde/muestra según `esReasignacion`.
- El toggle de compartir expediente parte en `true` cuando el padre entró desde el expediente — decisión explícita del brief (M5) para bajar la fricción del caso común.
