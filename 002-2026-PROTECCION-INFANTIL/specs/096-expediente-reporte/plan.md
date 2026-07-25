# Implementation Plan: Spec 096 — Expediente del reporte: traza del modelo (rol Admin)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Botón "Ver proceso" en la Bandeja de reportes que abre el expediente de UN reporte: 10 etapas en 4 fases (definidas por el parámetro `admin.expediente.etapas`, ADR_004), votación de la rúbrica pregunta por pregunta leída solo de `ClasificacionRubricaVoto` con textos EN VIVO de `ia.rubrica.preguntas`, instrumentación nueva de pipeline (`PasoProcesamiento`, Capa 2) con degradación elegante, privacidad gated por el módulo `revelar-original` + AuditLog (cierra I-12), y dos síntesis deterministas al cierre: análisis interno objetivo (gravedad interna, D-13) y mensaje al padre por plantillas (sin score, canales parametrizables). Solo lectura.

## Diseño

1. **Setup**: migración aditiva `PasoProcesamiento` (tabla `pasos_procesamiento`); seed upsert de `admin.expediente.etapas` y `mensaje.padre.canales` (JSON, SYSTEM, no públicos); módulo `expediente_revelar_original` (submódulo de `bandeja_reportes`, esCritico) en `src/lib/permisos-catalogo.ts` + backfill del seed (ADMIN lo recibe por el backfill "todos los módulos"; OPERADOR no).
2. **US3 — Instrumentación**: helper `registrarPaso` (best-effort, fail-open con log) en `src/lib/expediente/pasos.ts`; llamadas desde los helpers del pipeline (`src/app/api/reportes/procesar/helpers/`: guardas-previas, rafagas, duplicados, clasificacion RAG, guardas) que hoy NO persisten nada.
3. **US1/US2 — Backend expediente**: `src/lib/expediente/expediente.ts` ensambla las 10 etapas leyendo el parámetro (Capa 1 desde modelos Prisma existentes; Capa 2 desde PasoProcesamiento, `sinInstrumentar` si vacío); `src/lib/expediente/votacion.ts` arma matriz + detalle por pregunta cruzando `ClasificacionRubricaVoto.preguntasJson` con el parámetro vivo `ia.rubrica.preguntas` (tipo decisiva/contexto desde el parámetro).
4. **US6/US7 — Síntesis**: builders puros deterministas en `src/lib/expediente/` (`analisis-interno.ts`, `mensaje-padre.ts`); plantillas por conducta + canales desde `mensaje.padre.canales`; sin LLM; sin score ni nivel de riesgo en el mensaje al padre.
5. **US5 — Endpoint y privacidad**: `GET /api/admin/reportes/[id]/expediente?revelar=true` siguiendo el patrón de `src/app/api/admin/reportes-revision/[id]/route.ts` (verifyAuth → assertModulo "bandeja_reportes" → rate limit `admin_read` → Zod → AppError). Gated: sin `puedeAccederAModulo(rol,"expediente_revelar_original")` los campos gated se omiten (`revelado:false`); con permiso + `revelar=true` se incluyen y se registra `TEXTO_ORIGINAL_REVELADO`. Migrar `revelar-original/route.ts` del rol duro a `assertModulo` (ajustando su test).
6. **UI**: modal `AdminReporteExpediente` (`src/components/modules/`), botón "Ver proceso" en la celda de acciones de `AdminReportesTable.tsx`; timeline vertical estilo Stage de `IaTraceTimeline.tsx` (Modal + GlassCard + Badge); sección de votación por categoría/pregunta; dos síntesis al final; toggle "Revelar original" solo si `puedeRevelar`. Sin acciones de edición.

## Contratos / datos

- `contracts/expediente.md`: `GET /api/admin/reportes/[id]/expediente` (shape + errores 401/403/404/429).
- Migración aditiva: modelo `PasoProcesamiento`.
- Parámetros nuevos: `admin.expediente.etapas`, `mensaje.padre.canales` (seed + doc maestro).
- Módulo nuevo: `expediente_revelar_original` (catálogo + seed).
- Deuda: `ClasificacionIA.votos` redundante (no usar); métricas por modelo de rúbrica no persistidas.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Instrumentar rompa el pipeline (Capa 2) | Escritura best-effort fail-open con log; tests de integración del procesamiento como regresión |
| Fuga de PII por el expediente (I-12) | Default anonimizado; gated por módulo + AuditLog; test que prueba ambos caminos; en duda se restringe |
| Etapas quemadas en código (viola ADR_004) | Todo nombre/orden/ícono/campos desde `admin.expediente.etapas`; el componente renderiza lo que llega |
| Texto libre de un modelo en el mensaje al padre | Plantillas deterministas ensambladas por builder puro; tests unitarios de las plantillas |
