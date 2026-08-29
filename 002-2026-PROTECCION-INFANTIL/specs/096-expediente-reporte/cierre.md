# Cierre — Spec 096: Expediente del reporte — traza del modelo (rol Admin)

**Fecha**: 2026-07-25
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/096-expediente-reporte/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS

## Resumen por US

| US | Resultado |
|---|---|
| US1 Traza de 10 etapas | Botón "Ver proceso" en la Bandeja (`AdminReportesTable.tsx:314`) abre el modal `AdminReporteExpediente` con las 10 etapas en 4 fases (A Ingesta / B Preparación / C Evaluación / D Cierre), solo lectura. Endpoint `GET /api/admin/reportes/[id]/expediente` ensambla Capa 1 (modelos Prisma) + Capa 2 (`PasoProcesamiento`). |
| US2 Votación pregunta por pregunta | Etapa 7 con matriz modelos×categorías + detalle por pregunta (texto y tipo decisiva/contexto EN VIVO de `ia.rubrica.preguntas`, 0/1 por modelo) desde `ClasificacionRubricaVoto`; confianza, cascada, latencia y tokens. `ClasificacionIA.votos` no se usa. |
| US3 Instrumentación Capa 2 | Tabla `pasos_procesamiento` (migración aditiva) + helper `registrarPaso` fail-open. Pipeline instrumentado: guardas con veredicto, score de deduplicación, RAG (casos/categorías) y razón de decisión. Reportes viejos degradan a "sin instrumentar" sin romper. |
| US4 Parametrizable (ADR_004) | Etapas (orden/fase/nombre/ícono/campos/camposGated/capa) desde `admin.expediente.etapas` (JSON); canales desde `mensaje.padre.canales` (JSON). Ambos leídos en vivo por petición. Documentados en `docs/configuracion/parametros-sistema.md` (§3.9). |
| US5 Privacidad | Default anonimizado (`revelado:false`, campos gated omitidos). Módulo nuevo `expediente_revelar_original` (default solo ADMIN) integrado a `PermisoModulo`; `revelar-original/route.ts` migrado de rol duro a `assertModulo`. `?revelar=true` con permiso incluye textoOriginal/ipHash/fingerprintHash/rawResponse y registra AuditLog `TEXTO_ORIGINAL_REVELADO` (sin texto, solo metadatos). Sin permiso: 200 con campos omitidos, nunca 403. Fuga I-12 cerrada. |
| US6 Análisis interno | Builder determinista puro: consenso X/N, gravedad interna (D-13), señales decisivas, disparador, confianza, peso de fuente, conclusión neutral sin afirmar responsabilidad. Sin LLM. |
| US7 Mensaje al padre | Plantillas deterministas por conducta; SIN score ni nivel de riesgo; canales desde `mensaje.padre.canales`; borrador visible, sin botón de enviar/publicar. |

## Validación

**Gate (T041)**: `tsc --noEmit` OK · lint 0 errores (1 warning heredado en `IaModelSelector.tsx`) · **882/882 tests** (149 archivos) · build limpio · `./scripts/dev-restart.sh` con healthcheck `{"status":"ok","workerAlive":true,"dbOk":true}`.

**Quickstart (T042), sección por sección, contra localhost:5005**:

- **A**: login admin → endpoint 200 con 10 etapas y 4 fases; botón "Ver proceso" presente en `AdminReportesTable.tsx:314`; render del modal cubierto por `AdminReporteExpediente.test.tsx` (7 tests). No se hizo click-through manual en navegador (validación por API + tests de componente).
- **B**: edición en vivo del texto de una pregunta en `ia.rubrica.preguntas` → el expediente la muestra sin redeploy; valor restaurado.
- **C**: reporte nuevo (`RPT-BK9HQH`) procesado por el worker con Ollama real → 6 pasos en `pasos_procesamiento` (deduplicación `sin_duplicado`, guardas, RAG, decisión `CLASIFICADO` con latencia); su expediente muestra todas las etapas Capa 2 instrumentadas. Reporte viejo (anterior a la spec) → 4 etapas Capa 2 con `sinInstrumentar:true`, 200 OK.
- **D**: los 2 parámetros existen (JSON, `esPublico:false`); renombrar la etapa 1 en `admin.expediente.etapas` se refleja en la respuesta sin redeploy; valor restaurado.
- **E**: default omite textoOriginal/ipHash/fingerprintHash/rawResponse (`revelado:false`); con el módulo desactivado para ADMIN (toggle temporal en `PermisoModulo`) `?revelar=true` devuelve 200 con campos omitidos y `puedeRevelar:false` (restaurado después); con permiso + `?revelar=true` incluye los campos y deja AuditLog `TEXTO_ORIGINAL_REVELADO` verificado en BD.
- **F**: mensaje al padre sin score/riesgo/puntos; edición en vivo de `mensaje.padre.canales` reflejada en el borrador; valor restaurado.
- **US6**: análisis interno en vivo: "Consenso 3/3 en SOLICITUD_MATERIAL (gravedad interna: alta)… este análisis no determina la responsabilidad de ninguna persona."
- **G**: gate + healthcheck (arriba).

Sin pendientes de validación.

## Qué quedó en Capa 2 / pendientes

- `PasoProcesamiento` registra: deduplicación (score + veredicto), guardas (ráfaga/doxing/keyword con veredicto), contexto RAG (casos y categorías vecinas) y decisión (razón explícita + latencia). Embedding y clasificación ya tenían persistencia Capa 1.
- Nada pendiente dentro del alcance de la spec.

## Deuda técnica registrada

1. `ClasificacionIA.votos` (Json) redundante: la fuente de verdad es `ClasificacionRubricaVoto`; candidato a retiro en migración futura (FR-011).
2. Métricas por modelo de rúbrica (precisión por modelo) no persistidas; hoy solo se derivan de los votos individuales.
3. Clase fantasma `text-warning` en `src/components/modules/ia/IaTraceTimeline.tsx:126` (preexistente, no definida en el sistema de estilos).
4. Campo `icono` del parámetro `admin.expediente.etapas` no se renderiza en la UI (el modal usa el punto del timeline, patrón de `IaTraceTimeline`).
5. Flag `gated` del JSON de etapas sin uso: la fuente de verdad para gating es `camposGated`.

## Commits

Uno por US + uno de docs, staging explícito solo de `002-2026-PROTECCION-INFANTIL/`, push a `feature/001-scaffolding`. Hashes en el reporte de handoff (git log).
