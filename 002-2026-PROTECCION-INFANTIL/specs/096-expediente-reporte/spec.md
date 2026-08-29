# Spec 096 — Expediente del reporte: traza del modelo (rol Admin)

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-24
**Origen**: prompt ODIN 010 (spec 096) · decisiones D-13 (gravedad interna permitida), ADR_004 (parametrizable), cierre fuga I-12 (privacidad)

**Input**: un botón "Ver proceso" junto a "Ver detalle" en la Bandeja de reportes (`src/components/modules/AdminReportesTable.tsx:306`) abre el EXPEDIENTE de UN reporte: sus 10 etapas en 4 fases con fase, etapa, actividad, evaluación, fecha y hora; para la clasificación, el voto y la respuesta de cada modelo a cada pregunta; y al cierre dos síntesis del mismo caso: análisis interno objetivo y mensaje al padre (borrador). Solo lectura; no edita ni re-clasifica.

## User Stories

### US1 — Traza de 10 etapas (P1)

El expediente muestra las 10 etapas del pipeline en 4 fases, armado con lo que YA existe (patrón visual de `src/components/modules/ia/IaTraceTimeline.tsx`, no reinventar):

- **Fase A — Ingesta**: (1) Recepción — Reporte: creadoEn, numeroSeguimiento, plataforma, país/ciudad, esAnonimo, edadVictima, estado. (2) Peso de fuente — FuenteReporte: pesoAplicado, cuentaDiasAntiguedad, reportesPrevios/Confirmados/Descartados; ipHash/fingerprintHash = GATED.
- **Fase B — Preparación**: (3) Embedding — EmbeddingReporte: modeloUsado, creadoEn, latencia. (4) Deduplicación — Reporte.reporteOrigenId; score de similitud = Capa 2 (PasoProcesamiento). (5) Guardas baratas — Reporte.esRafaga/keywordsDetectadas/prioridadAlta = resultado; detalle por guarda + hora = Capa 2.
- **Fase C — Evaluación**: (6) Contexto RAG — casos similares, categorías vecinas = Capa 2. (7) Clasificación por rúbrica — ver US2.
- **Fase D — Cierre**: (8) Anonimización PII — ClasificacionIA.contienePii/piiDetectada; Reporte.textoOriginal = cifrado/GATED; anonimizacionValidadaPorId/En. (9) Decisión — TransicionReporte: estados, responsable, motivo, metadatos; razón explícita de la regla = Capa 2. (10) Finalización — Reporte.estado, ReintentoReporte, processingError.

### US2 — Votación completa pregunta por pregunta (P1, el corazón)

En la etapa 7, además de la matriz modelos×categorías, por cada categoría el detalle de cada pregunta: texto de la pregunta, tipo (decisiva/contexto) y el 0/1 de cada modelo. El texto de las preguntas se lee EN VIVO del parámetro `ia.rubrica.preguntas` (si un experto lo edita, el expediente lo refleja sin desplegar). Se muestran confianza, cascada, latencia y tokens. Los votos se leen SOLO de `ClasificacionRubricaVoto`; `ClasificacionIA.votos` (Json) quedó redundante → deuda, NO usarlo.

### US3 — Instrumentación (Capa 2) (P1)

Tabla nueva `PasoProcesamiento` que registra CADA paso del pipeline con su hora: guardas (ráfaga/doxing/keyword con su veredicto), RAG (casos recuperados y categorías) y score de deduplicación. La traza los muestra cuando existen; si un reporte viejo no los tiene, degrada elegante ("sin instrumentar"), no rompe. Escritura best-effort (fail-open con log): nunca rompe el flujo principal del pipeline.

### US4 — Parametrizable (ADR_004) (P1)

Las etapas (orden, nombre, ícono, qué campos muestran, si son gated) se definen en un parámetro nuevo `admin.expediente.etapas` (JSON). NADA de etiquetas de etapa quemadas en código. Parámetro documentado en `docs/configuracion/parametros-sistema.md`.

### US5 — Privacidad (NO negociable) (P1)

Por defecto el expediente muestra la versión anonimizada. textoOriginal, hashes de FuenteReporte (ipHash/fingerprintHash) y rawResponse solo se revelan con el permiso `revelar-original` y SE REGISTRA en AuditLog (acción existente `TEXTO_ORIGINAL_REVELADO`, `src/app/api/admin/reportes/[id]/revelar-original/route.ts`). Sin ese permiso, ni el admin los ve (campos omitidos + `revelado:false`, más REST-friendly que 403). Test que lo pruebe. Cierra la fuga I-12; en duda, se restringe. El permiso se integra al sistema de módulos (`src/lib/permisos-modulos.ts`, `puedeAccederAModulo`/`assertModulo`; módulos sembrados vía `CATALOGO_MODULOS` en `src/lib/permisos-catalogo.ts` + `prisma/seed.ts`), reemplazando el rol duro ADMIN actual; default solo ADMIN.

### US6 — Análisis interno objetivo (P2)

Síntesis factual al cierre (uso interno del operador): conductas detectadas con su consenso (X/N) y GRAVEDAD (permitida por ser interna, D-13), señales deterministas que la sustentan (de la rúbrica), disparador de la revisión, confianza y peso de fuente, conclusión neutral que NO afirma responsabilidad de nadie. Sin tono ni recomendaciones. Builder determinista puro, sin LLM.

### US7 — Mensaje al padre (BORRADOR) (P2)

El mismo caso en lenguaje humano, tono tranquilo pero firme, qué se encontró (SIN score ni nivel de riesgo — constitución §1.3/§1.5) y recomendaciones concretas. REGLAS DURAS: (a) texto por PLANTILLAS DETERMINISTAS ensambladas según conductas detectadas — PROHIBIDO generar con texto libre de un modelo; (b) canales de ayuda (ICBF 141, Te Protejo, CAI 123) en parámetro nuevo `mensaje.padre.canales` (JSON), editable sin desplegar y revisable por legal; (c) NO existe botón de enviar/publicar, solo se ve.

## Requirements

- **FR-001**: El sistema DEBE mostrar un botón "Ver proceso" junto a "Ver detalle" en la Bandeja de reportes que abra el modal del expediente (solo lectura; no edita ni re-clasifica).
- **FR-002**: El sistema DEBE exponer `GET /api/admin/reportes/[id]/expediente` que ensamble las 10 etapas en 4 fases (fase, etapa, actividad, evaluación, fecha y hora) desde los modelos existentes + PasoProcesamiento.
- **FR-003**: El sistema DEBE definir las etapas (orden, fase, nombre, ícono, campos, gated, capa) en el parámetro `admin.expediente.etapas` (JSON), sin etiquetas de etapa quemadas en código, y documentarlo en `docs/configuracion/parametros-sistema.md`.
- **FR-004**: El sistema DEBE persistir cada paso instrumentado del pipeline en `PasoProcesamiento` (guardas con veredicto, RAG con casos/categorías, score de deduplicación), con escritura best-effort fail-open.
- **FR-005**: El sistema DEBE degradar elegante ("sin instrumentar") en etapas Capa 2 sin datos, nunca error.
- **FR-006**: El sistema DEBE mostrar la votación pregunta por pregunta desde `ClasificacionRubricaVoto` cruzada con el texto EN VIVO de `ia.rubrica.preguntas` (texto y tipo decisiva/contexto), más matriz modelos×categorías, confianza, cascada, latencia y tokens.
- **FR-007**: El sistema DEBE servir por defecto la versión anonimizada; textoOriginal, ipHash/fingerprintHash y rawResponse solo con permiso `revelar-original` + AuditLog `TEXTO_ORIGINAL_REVELADO`; sin permiso → campos omitidos y `revelado:false`.
- **FR-008**: El sistema DEBE integrar `revelar-original` al sistema de módulos (catálogo + seed + `assertModulo`), reemplazando el chequeo de rol duro ADMIN en `revelar-original/route.ts`; default solo ADMIN.
- **FR-009**: El sistema DEBE generar el análisis interno con builders deterministas puros (consenso X/N, gravedad interna D-13, señales, disparador, confianza, peso de fuente, conclusión neutral), sin LLM.
- **FR-010**: El sistema DEBE generar el mensaje al padre por plantillas deterministas por conducta, SIN score ni nivel de riesgo, con canales desde `mensaje.padre.canales`, sin botón de enviar/publicar.
- **FR-011**: El sistema NO DEBE usar `ClasificacionIA.votos` (Json redundante); deuda registrada en data-model.md.
- **FR-012**: Migraciones aditivas; tests colocalizados del endpoint y de los builders; no rompe specs previas.

## Success Criteria

- **SC-001**: Test del endpoint: 200 con las 10 etapas (fase, orden, nombre, actividad, evaluación, fechaHora) y resumen del reporte.
- **SC-002**: Test: sin permiso `revelar-original` los campos gated se omiten y `revelado:false`; con permiso + `revelar=true` se incluyen y existe AuditLog `TEXTO_ORIGINAL_REVELADO`.
- **SC-003**: Test: reporte sin pasos instrumentados → etapas Capa 2 con `sinInstrumentar:true`, 200 OK (degradación elegante).
- **SC-004**: Test: editar `ia.rubrica.preguntas` cambia el texto/tipo de las preguntas en el expediente sin desplegar; votos solo desde ClasificacionRubricaVoto.
- **SC-005**: Tests unitarios: mensaje al padre sin score/riesgo y con canales del parámetro; análisis interno con consenso, gravedad y conclusión neutral.
- **SC-006**: Gate completo (`tsc` + lint + test + build) + healthcheck tras `./scripts/dev-restart.sh`; quickstart validado.

## Assumptions

- La rúbrica sigue en desarrollo (D-19): el expediente la muestra cuando hay `ClasificacionRubricaVoto`; reportes clasificados con el motor legacy muestran lo persistido en `ClasificacionIA` y degradan la sección de votos por pregunta.
- La revelación es una acción explícita del usuario (query `revelar=true`), nunca implícita al abrir el expediente.

## Implementación

**Cerrada**: 2026-07-25 · **Estado**: FINALIZADO, pendiente ACTA-VALIDACION de ZEUS. Detalle completo en `cierre.md`.

- Modelo `PasoProcesamiento` + migración aditiva; seed de `admin.expediente.etapas` y `mensaje.padre.canales`; módulo `expediente_revelar_original` (default solo ADMIN) reemplaza el rol duro en `revelar-original`.
- Helper `registrarPaso` fail-open (`src/lib/expediente/pasos.ts`) y pipeline instrumentado (guardas, deduplicación, RAG, decisión).
- Backend: `GET /api/admin/reportes/[id]/expediente` (ensamblador + votación rúbrica en vivo + análisis interno + mensaje al padre, builders deterministas).
- UI: botón "Ver proceso" en `AdminReportesTable.tsx:314` + modal `AdminReporteExpediente`.
- Docs: parámetros documentados en `docs/configuracion/parametros-sistema.md` §3.9.
- Validación: gate verde (tsc, lint 0 errores, 882/882 tests, build) + healthcheck OK tras `dev-restart.sh` + quickstart validado sección por sección en vivo (incluye edición de parámetros sin redeploy, con restauración).
- Deuda técnica: ver `cierre.md` (votos Json redundante, métricas por modelo, `text-warning` fantasma, `icono` no renderizado, flag `gated` sin uso).
