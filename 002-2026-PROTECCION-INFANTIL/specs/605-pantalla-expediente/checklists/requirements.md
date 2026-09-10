# Checklist de requisitos · SPEC-605

- [x] User Stories con prioridad y escenarios de aceptación (US1–US4).
- [x] Edge cases cubiertos: expediente sin ficha de menor (sin chip, no rompe); ficha «sin edad» (chip sin «· N años»); sin clasificación final (semáforo «Sin clasificar todavía» y análisis honesto, sin plantilla falsa); eventos en cola («en proceso de clasificación» en línea de tiempo y pill «En proceso»); expediente CERRADO (al final de la lista, sin «+ Agregar evento» en el detalle); secundarias con shape inesperado (se descartan en silencio, patrón A-70 · F11); anónimo entre las «familias más» (cuenta 1 por reporte, OR explícito para no excluirlo).
- [x] FRs en formato «El sistema DEBE…» (FR-001…FR-009) y trazables a tests (T008/T009).
- [x] «Impacto en arquitectura:» explícito (ratchet FR-008): sin migración; UNA subruta API (`estado`); páginas reescritas en el sitio; arch:check VERDE sin regenerar (SPEC-487).
- [x] Candados del producto: texto jamás en el DTO (test con centinelas propio/ajeno); ajenos como metadatos incluyendo anónimos y DUPLICADOS, excluyendo SPAM/OTRO (SPEC-543); fechas del hecho sin minutos (A-70 · G20); presunción de inocencia en el semáforo («reportes registrados»); canales oficiales visibles; `TextoSensible` sin tocar (SPEC-606 le cambia el step-up); flujo anónimo intacto; secrets solo por entorno.
- [x] Derogaciones/documentaciones: filtros de estado de la lista vieja (fuera, el orden es por urgencia); `ExpedienteVivo` sin ruta (deuda registrada en tasks.md); `GET [id]` sigue borrado (la subruta `estado` no lo viola).
