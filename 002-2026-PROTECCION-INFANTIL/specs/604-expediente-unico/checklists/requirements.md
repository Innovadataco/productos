# Checklist de requisitos · SPEC-604

- [x] User Stories con prioridad y escenarios de aceptación (US1–US4).
- [x] Edge cases cubiertos: sin fichas (alta inline forzada), ficha «sin edad» (reporte sin edad), expediente CERRADO (ciclo nuevo), doble clic/concurrencia (advisory lock + idempotencia por `reporteId`), alta de ficha fallida (el reporte no sale), cadena legada sin expediente (se abre al agregar evento o por el endpoint legado).
- [x] FRs en formato «El sistema DEBE…» (FR-001…FR-009) y trazables a tests.
- [x] «Impacto en arquitectura:» explícito (ratchet FR-008): sin migración nueva (la columna ya existe por SPEC-591), sin rutas nuevas; cambio de flujo interno del wizard y de una acción de Mis reportes.
- [x] Candados del producto: anónimo intacto (FR-009), texto jamás en listados (sin cambios en `cadenas-padre.ts` salvo comentario), migraciones aditivas (ninguna nueva), secrets solo por entorno.
- [x] Derogaciones documentadas: creación manual de SPEC-340 (botón) y, parcialmente, SPEC-339 FR-019 (apellidos opcionales en el alta).
