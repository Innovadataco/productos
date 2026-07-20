# Feature Specification: Simulación de carga y comparación de modelos (Spec 070)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: PROGRAMA DE SANEAMIENTO — bloque 070-080 reservado para simulaciones. Submódulo "Simulación" dentro del Centro de Control IA (`/dashboard/admin/ia?tab=eval`) para validar el sistema bajo carga y comparar modelos IA locales. Solo accesible para `ADMIN`. Datos descartables. Plan a entregar; no se implementa código hasta aprobación humana.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cargar set de casos (Priority: P1)

El administrador necesita cargar un conjunto de casos de prueba para la simulación. Cada caso contiene al menos texto, plataforma e identificador; opcionalmente incluye categoría esperada para medir acierto. El sistema valida el archivo y reporta errores por línea antes de permitir lanzar la corrida.

**Why this priority**: Sin un set de casos validado no se puede ejecutar una simulación controlada. La validación previa evita lanzar corridas con datos malformados que consuman recursos del worker.

**Independent Test**: Un revisor puede cargar un archivo CSV/JSON con casos válidos y ver que el sistema lo acepta; y un archivo con errores para ver que se listan por línea antes de lanzar.

**Acceptance Scenarios**:

1. **Given** un archivo CSV con columnas `texto,plataforma,identificador,categoriaEsperada`, **When** se carga, **Then** el sistema valida que cada fila tenga `texto` (20-5000 chars), `plataforma` válida y `identificador` (3-100 chars).
2. **Given** un archivo JSON con un array de objetos de caso, **When** se carga, **Then** el sistema valida la misma estructura y rangos del CSV.
3. **Given** un archivo con 5 filas válidas y 2 filas inválidas, **When** se carga, **Then** se muestra el error por línea (fila 3: texto corto; fila 5: plataforma inexistente) y no se habilita el botón "Lanzar".
4. **Given** un archivo válido, **When** se acepta, **Then** se muestra el total de casos y se habilita la selección de modelo y el lanzamiento.
5. **Given** un archivo que excede el tope máximo de casos por corrida, **When** se carga, **Then** se informa el límite y se rechaza el archivo.

**Edge Cases**:
- ¿Qué ocurre si el archivo está vacío? Se muestra error claro: "El archivo no contiene casos".
- ¿Qué ocurre si hay filas duplicadas? Se permiten; cada caso es un reporte anónimo independiente.
- ¿Qué pasa si `categoriaEsperada` está vacía? Se omite en el cálculo de acierto; el caso aún se procesa y se reporta.
- ¿Qué ocurre si la codificación del archivo no es UTF-8? Se intenta detectar UTF-8; si falla, se pide re-codificar.

---

### User Story 2 — Ejecutar simulación (Priority: P1)

El administrador elige un modelo Ollama local y lanza la simulación. Cada caso del set se inserta como reporte anónimo real en el pipeline (`/api/reportes` → `pg-boss` → worker). El sistema controla el tope máximo de casos y el comportamiento ante una corrida en curso (rechazo o encolamiento secuencial) dado que hay un solo worker.

**Why this priority**: La simulación debe ejercitar el pipeline real para que las métricas de latencia, estados y acierto sean representativas. La gestión del worker único evita que dos corridas se pisen.

**Independent Test**: Tras lanzar una simulación, se puede verificar en la base de datos que los reportes anónimos fueron creados y encolados, y que el worker los procesa con el modelo seleccionado.

**Acceptance Scenarios**:

1. **Given** un set de casos cargado y un modelo seleccionado, **When** se presiona "Lanzar", **Then** se crea un `SimulacionRun` con estado `PENDIENTE`/`EN_PROGRESO` y se empiezan a crear los reportes anónimos.
2. **Given** el lanzamiento de una simulación, **When** se procesa un caso, **Then** se invoca el pipeline real con `modeloClasificacion` sobreescrito por el modelo elegido (no el modelo de producción).
3. **Given** una corrida en curso, **When** se intenta lanzar otra simulación, **Then** el sistema rechaza o encola la segunda según la decisión de diseño documentada.
4. **Given** un set con más casos que el tope máximo, **When** se carga, **Then** se informa el límite y no se permite lanzar.
5. **Given** el worker ocupado con otras tareas, **When** se lanza la simulación, **Then** los casos quedan en la cola o en estado `PENDIENTE` y se procesan conforme el worker avance.

**Edge Cases**:
- ¿Qué pasa si Ollama no responde durante la simulación? Los casos fallan y pasan a `REVISION_MANUAL` vía fallback; la corrida continúa con el resto.
- ¿Qué ocurre si el worker se reinicia? Los jobs en cola se reintentan; el `SimulacionRun` sigue en `EN_PROGRESO` hasta que se terminen o fallen.
- ¿Qué pasa si un caso genera duplicado? Se usa un identificador único por corrida (prefijo `SIM-`) para evitar colisiones con datos reales.
- ¿Qué ocurre si `DISABLE_RATE_LIMIT=false`? La corrida puede topar con rate limits; se documenta el requisito de deshabilitar rate limit en dev para simulaciones.

**[NEEDS CLARIFICATION]**: Decidir si ante una corrida en curso se rechaza la nueva o se encola detrás. Esto afecta el modelo de estado y la UX. Se propone en el plan rechazo simple (“hay una corrida en progreso; espere o cancele”) por simplicidad y visibilidad.

---

### User Story 3 — Monitorear en vivo (Priority: P1)

Durante la ejecución, el administrador necesita ver el progreso en tiempo real: cuántos casos se han procesado, cuántos faltan, tiempo transcurrido, estado de la corrida y opción de cancelar.

**Why this priority**: El pipeline real puede tardar minutos u horas dependiendo de N, Ollama y votos. Sin monitoreo, el usuario no sabe si la simulación avanza o se atascó.

**Independent Test**: Al lanzar una simulación, el usuario ve un indicador de progreso que se actualiza sin refrescar la página.

**Acceptance Scenarios**:

1. **Given** una simulación en progreso, **When** se abre la vista de detalle, **Then** se muestra `X de N` casos procesados, hora de inicio, tiempo transcurrido y estado `EN_PROGRESO`.
2. **Given** la simulación en progreso, **When** pasa el tiempo, **Then** el progreso y el tiempo transcurrido se actualizan automáticamente (polling cada 3-5 segundos).
3. **Given** una simulación finalizada, **When** se abre el detalle, **Then** el estado muestra `COMPLETADA` o `FALLIDA` y se ve la fecha de fin.
4. **Given** una simulación en progreso, **When** se presiona "Cancelar", **Then** se detiene la creación de nuevos reportes y se marca la corrida como `CANCELADA` (los jobs ya encolados siguen su curso).
5. **Given** el estado `CANCELADA`, **When** se revisa el detalle, **Then** se indica cuántos casos se alcanzaron a procesar y cuántos quedaron pendientes.

**Edge Cases**:
- ¿Qué pasa si el worker se detiene? La corrida queda en `EN_PROGRESO` hasta que el usuario cancele o el worker se recupere; el polling debe mostrar esto.
- ¿Qué ocurre si un caso tarda más de lo esperado? Se muestra el tiempo transcurrido real y el promedio por caso.
- ¿Qué pasa si se cancela justo cuando un caso se estaba procesando? Ese caso queda con el estado que resulte del pipeline; no se revierte.

---

### User Story 4 — Resultados por reporte (Priority: P1)

Al finalizar, el administrador ve una tabla con cada caso del set: categoría asignada por el modelo, confianza, estado final, latencia del modelo y acierto versus categoría esperada.

**Why this priority**: El detalle por caso permite identificar errores específicos del modelo y del pipeline (ej. falsos positivos, falsos negativos, caídas en `REVISION_MANUAL`).

**Independent Test**: Tras una simulación con categorías esperadas, la tabla muestra “Acierto” o “Fallo” por cada caso y estadísticas agregadas.

**Acceptance Scenarios**:

1. **Given** una simulación completada, **When** se abre la pestaña de resultados por caso, **Then** se listan todos los casos con índice, identificador, categoría asignada, confianza, estado final y latencia.
2. **Given** un caso con `categoriaEsperada` cargada, **When** se compara con la categoría asignada, **Then** se muestra si fue acierto o fallo.
3. **Given** un caso sin `categoriaEsperada`, **When** se muestra la tabla, **Then** la columna de acierto aparece vacía o “N/A”.
4. **Given** un caso que terminó en `REVISION_MANUAL`, **When** se lista, **Then** se muestra el estado y no se cuenta como acierto ni fallo.
5. **Given** un caso con latencia anómala, **When** se ordena por latencia, **Then** se destacan los casos más lentos.

**Edge Cases**:
- ¿Qué pasa si el modelo devuelve una categoría desconocida? Se muestra como `DESCONOCIDA` y se marca fallo si hay categoría esperada.
- ¿Qué ocurre si un caso no se pudo clasificar (timeout)? Se muestra estado `REVISION_MANUAL` y latencia vacía.
- ¿Qué pasa si la categoría esperada es un sinónimo? Se mapea al canon de categorías antes de comparar.

---

### User Story 5 — Análisis agregado (Priority: P1)

El administrador necesita métricas de calidad del modelo y del sistema: porcentaje de aciertos global, precisión/recall por categoría, matriz de confusión, falsos negativos destacados y latencia p50/p95.

**Why this priority**: Las métricas agregadas permiten decidir si un modelo mejora o empeora respecto al baseline y detectar sesgos por categoría.

**Independent Test**: Tras una simulación con categorías esperadas, se muestra un dashboard con exactitud, precisión/recall por categoría, matriz de confusión y percentiles de latencia.

**Acceptance Scenarios**:

1. **Given** una simulación con categorías esperadas, **When** finaliza, **Then** se muestra el % de aciertos global y por categoría.
2. **Given** los resultados por categoría, **When** se calcula, **Then** se muestran precisión y recall por categoría, con badges de estado.
3. **Given** una simulación finalizada, **When** se abre análisis, **Then** se muestra una matriz de confusión (categoría esperada vs. asignada).
4. **Given** casos de categoría grave clasificados como leve o no detectados, **When** se analiza, **Then** se destacan como falsos negativos críticos.
5. **Given** las latencias de cada caso, **When** se calcula, **Then** se muestran p50 y p95 (no solo promedio).
6. **Given** la simulación, **When** se analiza, **Then** se muestra la distribución de estados finales (`CLASIFICADO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `FALLIDA`, etc.).

**Edge Cases**:
- ¿Qué pasa si no hay categorías esperadas? Se omite precisión/recall/matriz; solo se muestran estados y latencias.
- ¿Qué ocurre si una categoría no tiene casos? Se omite del análisis para evitar división por cero.
- ¿Qué pasa si todos los casos fallan? Se muestra 0% acierto sin romper las métricas.

---

### User Story 6 — Comparar corridas (Priority: P1)

El administrador puede lanzar otra simulación con el mismo set pero otro modelo, y comparar ambas corridas lado a lado por índice de caso. Se replica el patrón de `ComparadorExperimentos` del Laboratorio.

**Why this priority**: Comparar modelos es el objetivo central de la simulación. Ver caso a caso permite detectar diferencias de comportamiento y regresiones.

**Independent Test**: El usuario puede seleccionar dos corridas completadas y ver una tabla comparativa por caso más un resumen de métricas.

**Acceptance Scenarios**:

1. **Given** dos corridas completadas sobre el mismo set de casos, **When** se seleccionan para comparar, **Then** se muestra una tabla con índice de caso, identificador, categoría esperada, categoría del modelo A, categoría del modelo B, acierto de A y acierto de B.
2. **Given** la comparación, **When** se observa el resumen, **Then** se muestran totales de aciertos, latencias p50/p95 y totales por estado para ambos modelos.
3. **Given** la misma corrida y otro modelo, **When** se lanza con un clic desde la vista de comparación ("Repetir con otro modelo"), **Then** se pre-carga el mismo set y se abre el formulario de nueva simulación.
4. **Given** la comparación de dos corridas, **When** se filtra por acierto/fallo, **Then** se resaltan los casos donde difieren los modelos.
5. **Given** la comparación, **Then** el diseño deja abierta la posibilidad de comparar más de dos corridas en el futuro.

**Edge Cases**:
- ¿Qué pasa si las dos corridas usaron sets diferentes? Se compara solo por índice si coincide; se muestra advertencia si los tamaños difieren.
- ¿Qué ocurre si una corrida fue cancelada? Se compara hasta el índice procesado; se indica el resto como pendiente.
- ¿Qué pasa si los modelos tienen el mismo nombre? Se compara por ID de corrida, no por nombre.

---

### User Story 7 — Exportar resultados (Priority: P2)

El administrador puede exportar los resultados de una corrida a CSV o JSON para análisis externo.

**Why this priority**: Permite compartir métricas con stakeholders o analizar con herramientas externas. No es crítico para el flujo interno.

**Independent Test**: El usuario descarga un archivo CSV/JSON con los resultados por caso y las métricas agregadas.

**Acceptance Scenarios**:

1. **Given** una simulación completada, **When** se presiona "Exportar CSV", **Then** se descarga un archivo con una fila por caso incluyendo índice, identificador, categoría esperada, asignada, confianza, estado, latencia y acierto.
2. **Given** una simulación completada, **When** se presiona "Exportar JSON", **Then** se descarga un archivo con el array de casos y el objeto de métricas agregadas.
3. **Given** una simulación en progreso, **Then** la opción de exportar está deshabilitada hasta que finalice.
4. **Given** la exportación, **Then** el archivo no incluye datos personales reales (solo identificadores de prueba). No se tocan SPEC-050/SPEC-060.

**Edge Cases**:
- ¿Qué pasa si el archivo es muy grande? Se limita el CSV a los datos de la corrida; si es masivo, se documenta la opción de paginar.
- ¿Qué pasa si se exporta una corrida cancelada? Se exporta el subset procesado con la nota de cancelación.

---

## Edge Cases generales

- ¿Qué pasa si un admin borra una simulación? Se borran `SimulacionRun` y `SimulacionReporte`; los reportes anónimos asociados quedan como datos históricos descartables (no se borran para no romper integridad referencial). Ver `quickstart.md` para limpieza manual.
- ¿Qué ocurre si se cambia el modelo de Ollama durante una corrida? La corrida usa el modelo almacenado en `SimulacionRun`; no se ve afectada por cambios posteriores.
- ¿Qué pasa si el set de casos es muy grande y el worker no puede procesarlo en un tiempo razonable? Se aplica el tope máximo por corrida y se documenta que simulaciones masivas pueden dividirse.
- ¿Cómo se evita que las simulaciones contaminen métricas de producción? Los reportes anónimos se identifican con fuente `SIMULACION` y se excluyen de dashboards de producción si es necesario. En el plan se propone `FuenteReporte` como ya cubre esto; si no, se usa un prefijo en el identificador.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir cargar un archivo CSV o JSON con casos de simulación, validando cada caso antes de permitir el lanzamiento.
- **FR-002**: El sistema DEBE soportar `texto` (20-5000 chars), `plataforma` (existente), `identificador` (3-100 chars) y `categoriaEsperada` (opcional, categoría canónica) por caso.
- **FR-003**: El sistema DEBE rechazar archivos que excedan el tope máximo de casos por corrida (valor por definir en el plan; se propone 200).
- **FR-004**: El sistema DEBE mostrar errores de validación por línea/índice con mensaje claro.
- **FR-005**: El sistema DEBE permitir seleccionar un modelo Ollama local de la lista de `/api/admin/ia/modelos` que no sea de embeddings.
- **FR-006**: El sistema DEBE lanzar cada caso al pipeline real de reportes anónimos (`POST /api/reportes`), forzando el modelo de clasificación elegido sin alterar el modelo de producción.
- **FR-007**: El sistema DEBE gestionar el estado de la corrida (`PENDIENTE`, `EN_PROGRESO`, `COMPLETADA`, `FALLIDA`, `CANCELADA`) y evitar que dos corridas se ejecuten simultáneamente (rechazo o encolamiento; se propone rechazo).
- **FR-008**: El sistema DEBE monitorear el progreso de la corrida en tiempo real (X de N, tiempo transcurrido, estado) con actualización automática.
- **FR-009**: El sistema DEBE permitir cancelar una corrida en progreso, deteniendo la creación de nuevos reportes.
- **FR-010**: El sistema DEBE mostrar resultados por caso: categoría asignada, confianza, estado final, latencia y acierto vs. categoría esperada.
- **FR-011**: El sistema DEBE calcular métricas agregadas: % aciertos global, precisión/recall por categoría, matriz de confusión, falsos negativos destacados y latencia p50/p95.
- **FR-012**: El sistema DEBE permitir comparar dos corridas lado a lado por índice de caso, con resumen de métricas.
- **FR-013**: El sistema DEBE exportar resultados a CSV y JSON.
- **FR-014**: El sistema DEBE persistir el modelo, el progreso, las métricas y los reportes creados en `SimulacionRun` y `SimulacionReporte` sin modificar el modelo `Reporte`.
- **FR-015**: El sistema DEBE reutilizar el patrón visual y componentes del Laboratorio (`IaEvalManager`, `LaboratorioTab`, `ComparadorExperimentos`, `Badge`, `GlassCard`, etc.).

### Key Entities

- **SimulacionRun**: corrida de simulación con modelo, totalCasos, progreso, estado, fechas, métricas y creador.
- **SimulacionReporte**: relación entre una corrida y un reporte anónimo, con índice del caso en el set.
- **CasoSimulacion**: un caso del archivo cargado (texto, plataforma, identificador, categoriaEsperada opcional).
- **MetricasSimulacion**: aciertos, precisión/recall, matriz de confusión, latencia p50/p95, distribución de estados.
- **ComparacionSimulacion**: par de corridas comparadas por índice de caso.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los casos de un archivo válido se cargan y se validan en menos de 5 segundos para 200 casos.
- **SC-002**: El 100% de los errores de validación se reportan por línea/índice con mensaje claro.
- **SC-003**: El pipeline real de reportes se invoca para cada caso; cada reporte anónimo se encola y procesa.
- **SC-004**: El progreso de la corrida se actualiza en vivo y refleja correctamente el estado del worker.
- **SC-005**: El % de aciertos y las métricas por categoría se calculan correctamente cuando hay `categoriaEsperada`.
- **SC-006**: La comparación de corridas muestra resultados por índice de caso y resumen de métricas.
- **SC-007**: La exportación a CSV y JSON contiene todos los casos y métricas agregadas.
- **SC-008**: El submódulo usa el mismo patrón visual y componentes del Laboratorio.
- **SC-009**: Todos los endpoints nuevos tienen tests de integración Vitest.
- **SC-010**: El modelo `Reporte` no se modifica.

---

## Assumptions

- El submódulo es accesible solo para `ADMIN`; no se implementan permisos de `SCHOOL_ADMIN` u operadores.
- Los datos de simulación son descartables; no hay necesidad de retención legal.
- `DISABLE_RATE_LIMIT=true` en desarrollo para permitir la inyección de volumen; en producción el submódulo no se usará o se ejecutará con rate limit deshabilitado explícitamente para el admin.
- El worker único y la concurrencia de Ollama son el cuello de botello; el tope de casos debe respetar esto.
- Las métricas de latencia (`ClasificacionIA.latenciaMs`, `OllamaMetrics`) ya se capturan; solo se exponen y agregan.
- No se toca el modelo `Reporte` ni el flujo de visibilidad pública.
- El plan se aprueba antes de implementar código.
- El bloque de specs 070-080 está reservado para simulaciones.

---

## Implementación

**Nota de corrección (2026-07-20)**: se detectó que la simulación implementada no replica fielmente un reporte anónimo real. El parser y executor del 070 omiten `fechaIncidente`, `ciudad`, `pais` y `edadVictima`, y rellenan valores fijos. La corrección está documentada en `specs/071-correccion-fidelidad-simulacion-070/` y debe aprobarse antes de implementarse. No se modifica código hasta entonces.

La implementación se completó siguiendo el plan aprobado. Resumen:

- **Migración aditiva**: se crearon `SimulacionRun` y `SimulacionReporte` y se añadió la relación `Usuario.simulaciones`. Se agregó `casosJson` a `SimulacionRun` para permitir repetir una simulación con otro modelo. No se modificó el modelo `Reporte`.
- **Override de modelo por job**: se extendió `sendReporte` para aceptar `modeloClasificacion`, el worker lo propaga en el body de `POST /api/reportes/procesar` y el helper `cargarParametrosClasificacion` lo aplica sin tocar `ParametroSistema`.
- **Endpoints**: list, create, get, cancel, resultados, análisis, comparar y export, todos con tests de integración Vitest.
- **UI**: 4ª pestaña "Simulación" en `IaEvalManager` replicando el patrón list/new/detail/compare del Laboratorio, con componentes reutilizados (`GlassCard`, `Badge`, `Button`, `Select`, `MetricCard`, etc.).
- **Validación**: `tsc --noEmit`, `lint`, `test` (577 tests) y `build` pasaron. Deploy limpio con `./scripts/dev-restart.sh`.

Ver `cierre.md` para evidencia completa.

## Status

CERRADA

