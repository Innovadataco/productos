# Research — 096-expediente-reporte

**Fecha**: 2026-07-24 · **Autor**: ODIN

## R1 — PasoProcesamiento: tabla de pasos del pipeline (Capa 2)

**Decisión**: modelo nuevo `PasoProcesamiento { id, reporteId FK cascade, etapa String, veredicto String?, detalle Json?, latenciaMs Int?, creadoEn }`, tabla `pasos_procesamiento`, índice `(reporteId, creadoEn)`. Migración aditiva.

**Justificación**: el pipeline (`src/app/api/reportes/procesar/route.ts` + `helpers/`) no persiste hoy: latencia por etapa, ejemplos RAG recuperados, score de deduplicación cuando NO es duplicado, veredicto por guarda (ráfaga/doxing/keyword) ni métricas por modelo de rúbrica. Sin una tabla de pasos, las etapas 4/5/6/9 no tendrían detalle ni hora.

**Alternativas descartadas**: (a) ampliar `TransicionReporte` — mezcla transiciones de estado con telemetría de pipeline; (b) meter todo en un Json del Reporte — sin índice, sin tipado, difícil de consultar; (c) no instrumentar y mostrar "sin datos" siempre — mata la Capa 2, que es la mitad del valor del expediente.

**Fail-open**: la escritura es best-effort (try/catch + `console.error` con formato `[Expediente] ...`); un fallo de instrumentación NUNCA rompe el procesamiento del reporte. Cascade en `reporteId` para no dejar huérfanos si un reporte se elimina (flujo de disputas Ley 1581).

## R2 — Endpoint único con ensamblado parametrizado y gating por omisión

**Decisión**: `GET /api/admin/reportes/[id]/expediente?revelar=true` ensambla las 10 etapas leyendo `admin.expediente.etapas` (JSON: orden/fase/nombre/icono/campos/camposGated/capa por etapa). Los campos gated solo se incluyen si `revelar=true` AND `puedeAccederAModulo(rol,"expediente_revelar_original")` AND se registra AuditLog (`TEXTO_ORIGINAL_REVELADO`). Sin permiso: campos omitidos + `revelado:false` (no 403).

**Justificación**: omitir campos es más REST-friendly que 403 — el recurso (expediente) existe y es legítimo para el operador; lo restringido son subcampos sensibles. El flag `revelado` + `puedeRevelar` deja a la UI decidir si muestra el toggle "Revelar original". Un solo endpoint evita N llamadas por etapa y garantiza consistencia de la traza (misma foto del caso).

**Alternativas descartadas**: (a) endpoint por etapa — chatty, inconsistente; (b) 403 sin permiso de revelación — niega todo el expediente por 3 campos; (c) dos endpoints (normal/revelado) — duplica lógica de ensamblado.

## R3 — Degradación elegante "sin instrumentar"

**Decisión**: etapa Capa 2 sin filas en `PasoProcesamiento` → la etapa aparece con `sinInstrumentar:true` (y lo de Capa 1 que sí exista, p. ej. `esRafaga` del Reporte), nunca error ni etapa ausente.

**Justificación**: los reportes históricos no tienen pasos persistidos; el expediente debe funcionar para TODO reporte, viejo o nuevo. La marca es honesta: el operador distingue "la guarda no disparó" de "no se sabe, no estaba instrumentado".

**Alternativas descartadas**: ocultar la etapa (rompe la promesa de 10 etapas y confunde) o backfill masivo (inventa datos que no existen).

## R4 — Votación US2: ClasificacionRubricaVoto × parámetro vivo

**Decisión**: matriz modelo×categoría desde `ClasificacionRubricaVoto` (campos: modelo, categoria, cumple Boolean, preguntasJson string[]). Detalle por pregunta: para cada categoría, cruzar `preguntasJson` (preguntas cumplidas verbatim por modelo) con el texto EN VIVO de `ia.rubrica.preguntas` (`SetsRubrica = Record<string, PreguntaRubrica[]>`, `PreguntaRubrica { texto, activo, tipo? }`); pregunta no listada por el modelo = 0. Tipo (decisiva/contexto) desde el parámetro vivo.

**Justificación**: `ia.rubrica.preguntas` es editable por expertos sin desplegar; si el expediente guardara copias de los textos, mentiría al cambiar la rúbrica. La votación persistida es por texto verbatim, así que el cruce es estable. `ClasificacionIA.votos` (Json) quedó redundante con la tabla — NO se usa (deuda registrada).

**Alternativas descartadas**: leer `ClasificacionIA.votos` (redundante, sin garantía de formato) o persistir el texto de cada pregunta en el voto (duplica la fuente de verdad de la rúbrica).

## R5 — Síntesis deterministas (US6/US7), cero LLM

**Decisión**: builders puros en `src/lib/expediente/` (`analisis-interno.ts`, `mensaje-padre.ts`).

- **Análisis interno**: conductas con consenso X/N (de ClasificacionRubricaVoto), gravedad interna (D-13 la permite por ser interna), señales deterministas (preguntas decisivas cumplidas), disparador de la revisión, confianza y peso de fuente, conclusión neutral que NO afirma responsabilidad.
- **Mensaje al padre**: plantillas por conducta ensambladas según categorías detectadas, tono tranquilo pero firme, SIN score ni nivel de riesgo (constitución §1.3/§1.5), canales desde `mensaje.padre.canales` (JSON, revisable por legal).

**Justificación**: un LLM redactando al padre es ingobernable (tono, afirmaciones, alucinaciones) y viola la regla dura del brief. Las plantillas son testeables al 100% y legal las puede revisar palabra por palabra.

**Alternativas descartadas**: generación con Ollama (prohibido por el brief y riesgo constitucional) o plantillas quemadas en código sin parámetro de canales (legal no podría ajustar canales sin desplegar).

## R6 — UI: modal propio, timeline estilo IaTraceTimeline

**Decisión**: botón "Ver proceso" en la celda de acciones junto a "Ver detalle" (`AdminReportesTable.tsx`), abre modal propio `AdminReporteExpediente` (patrón del modal existente por estado local `selectedReporteId`), timeline vertical con el lenguaje visual del subcomponente Stage de `IaTraceTimeline.tsx` (punto + línea vertical + GlassCard + Badge), sección de votación por categoría/pregunta, dos síntesis al final. Sin acciones de edición; toggle "Revelar original" solo si `puedeRevelar`.

**Justificación**: reusa el patrón visual ya aprobado para trazas de IA en lugar de inventar un Timeline genérico (no existe en `ui/`); el modal propio mantiene aislada una vista grande sin tocar el modal de detalle.

**Alternativas descartadas**: página dedicada (pierde el contexto de la bandeja) o meter el expediente dentro del modal de detalle (acopla dos vistas grandes).

## R7 — Permiso revelar-original como módulo (I-12)

**Decisión**: nuevo módulo `expediente_revelar_original` en `CATALOGO_MODULOS` (`src/lib/permisos-catalogo.ts`), submódulo de `bandeja_reportes`, `esCritico:true`. El seed lo siembra por el upsert del catálogo y el backfill actual lo otorga SOLO a ADMIN (`ADMIN: modulosSeed.map(...)`; OPERADOR solo recibe `bandeja_reportes`, sin el submódulo). `revelar-original/route.ts` y el endpoint del expediente reemplazan el chequeo `rol !== "ADMIN"` por `assertModulo(user, "expediente_revelar_original")`.

**Justificación**: hoy la revelación está atada a rol duro — innombrable, ineditable y sin revocación fina. Integrarla al sistema de módulos (spec 019/086) la hace gobernable desde Configuración → Permisos por rol, con la jerarquía AND (padre `bandeja_reportes` activo + submódulo activo) y denegar-por-defecto. Default conservador: solo ADMIN, igual que hoy; OPERADOR no lo gana por accidente porque el backfill de OPERADOR nombra sus claves explícitamente.

**Alternativas descartadas**: parámetro `seguridad.revelar_roles` (paralelo al sistema de módulos, dos gobernanzas) o dejar el rol duro (no cierra la gobernabilidad de I-12).
