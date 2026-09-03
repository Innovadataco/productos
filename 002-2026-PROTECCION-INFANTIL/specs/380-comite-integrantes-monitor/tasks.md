# SPEC-380 (PR B) · Tasks

- [X] T001 Enumerar los 16 consumidores de `tipoSujeto` (archivo:línea).
- [X] T002 Verificar BI (`grep -rn tipoSujeto` en 005-BI): vacío.
- [X] T003 Reportar la enumeración al CEO antes de codificar (aprobado).
- [X] T004 Migración `20260902233000_spec_380b_integrantes_monitor` (tabla + FK + unique parcial).
- [X] T005 Ampliar `TipoSujeto` union + `TIPOS_SUJETO_VALIDOS`.
- [X] T006 `Record<TipoSujeto, X>` completos + `switch` con `never` default en repo.
- [X] T007 `IdentificadorIntegranteComiteRepository`.
- [X] T008 4ª fuente en `notificarColegioSiCorresponde`.
- [X] T009 Rama de integrante en `seguimiento.ts` + `alertas.ts` (×2) + include del repo.
- [X] T010 UI: labels/variants exhaustivos (quitados fallbacks `??`).
- [X] T011 Schema Zod ampliado.
- [X] T012 Mapa PDF `pdf-informe-caso` (no `integrante_comite` crudo).
- [X] T013 API CRUD identificadores del integrante (GET/POST + PATCH).
- [X] T014 UI nueva página + link "Vigilar identificadores" en `IntegrantesList`.
- [X] T015 Test integration del endpoint (5 casos, todos verdes).
- [X] T016 Gate: tsc limpio.
- [X] T017 Regenerar línea base de arquitectura + verificar diff mínimo.
- [ ] T018 [Post-merge, CEO] verificación en vivo: crear identificador para un integrante, generar reporte con ese valor, ver alerta INTEGRANTE_COMITE en la bandeja del colegio.
