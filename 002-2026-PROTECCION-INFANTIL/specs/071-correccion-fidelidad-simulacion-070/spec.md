# Feature Specification: Corrección de fidelidad de la simulación (Spec 071)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: Corrección al Spec 070 (simulación de carga y comparación de modelos). Implementación completada: el parser y executor ahora replican fielmente un reporte anónimo real, validando los mismos campos de entrada y ejecutando el pipeline completo sin inventar valores.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Entrada idéntica a la de un reporte anónimo (Priority: P1)

El administrador necesita que los casos de simulación usen exactamente los mismos campos que llenaría un usuario anónimo en el formulario público. Hoy el parser solo acepta `texto`, `plataforma`, `identificador` y una `categoriaEsperada` opcional, pero el formulario anónimo exige también `fechaIncidente`, `ciudad` y `pais`, y acepta opcionalmente `edadVictima`. La simulación debe cargar y validar esos campos con las mismas reglas que `crearReporteSchema`.

**Why this priority**: Si los casos de prueba no incluyen los campos reales, el pipeline de clasificación, embeddings y RAG se ejercita con datos incompletos; los resultados de latencia y acierto no son representativos de la producción.

**Independent Test**: Un revisor carga un archivo CSV/JSON con los nuevos campos y el sistema lo valida con las mismas reglas que un reporte anónimo; un archivo con `fechaIncidente` futura, ciudad vacía o plataforma inválida se rechaza por línea.

**Acceptance Scenarios**:

1. **Given** un archivo CSV con columnas `texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada`, **When** se carga, **Then** el sistema valida `texto` (20-5000 chars), `plataforma` válida, `identificador` (3-100 chars), `fechaIncidente` (ISO datetime no futura), `ciudad` (1-100 chars), `pais` (1-100 chars) y `edadVictima` (0-120, opcional).
2. **Given** un archivo JSON con un array de objetos, **When** se carga, **Then** se valida la misma estructura y rangos del CSV.
3. **Given** un archivo con 5 filas válidas y 2 filas inválidas (una con fecha futura y otra sin ciudad), **When** se carga, **Then** se muestra el error por línea y no se habilita el botón "Lanzar".
4. **Given** un caso válido sin `categoriaEsperada`, **When** se acepta, **Then** se procesa normalmente y se omite en el cálculo de acierto.
5. **Given** un caso válido sin `edadVictima`, **When** se acepta, **Then** se crea el reporte con `edadVictima` nulo sin error.

**Edge Cases**:
- ¿Qué ocurre si `fechaIncidente` es una fecha futura? Se rechaza con el mismo mensaje que el formulario anónimo: "La fecha del incidente no puede ser futura".
- ¿Qué ocurre si `ciudad` o `pais` contienen solo espacios? Se rechazan como campos vacíos.
- ¿Qué pasa si `edadVictima` es 0? Se acepta como edad válida (0-120).
- ¿Qué ocurre si `categoriaEsperada` no es una categoría canónica? Se guarda tal cual en `SimulacionReporte` para el cálculo de acierto; no se valida contra el enum (permite comparar sinónimos o categorías futuras).
- ¿Qué pasa si el archivo usa nombres de país/ciudad que no coinciden con la base de datos geográfica? Se aceptan como texto libre, igual que el formulario anónimo; no se exige `paisId`/`ciudadId` en la simulación.

---

### User Story 2 — Pipeline real completo, sin atajos ni omisiones (Priority: P1)

Cada caso de simulación debe recorrer el pipeline completo de un reporte anónimo: creación en BD, encolamiento en pg-boss, procesamiento por el worker, anonimización, clasificación IA, embeddings/RAG, deduplicación y decisión de estado. Ningún paso puede saltarse ni simularse por ser una corrida de prueba. Si un caso falla, se registra el error pero la corrida continúa con el resto.

**Why this priority**: El objetivo de la simulación es medir el comportamiento real del sistema. Atajos o datos inventados invalidan las métricas de latencia, acierto y estados finales.

**Independent Test**: Tras lanzar una simulación, se verifica en la base de datos que cada reporte anónimo tiene los campos `fechaIncidente`, `ciudad`, `pais` y `edadVictima` poblados exactamente como los del archivo cargado, y que pasa por las mismas transiciones que un reporte creado desde el formulario público.

**Acceptance Scenarios**:

1. **Given** un set de casos cargado con todos los campos reales, **When** se lanza la simulación, **Then** cada caso se inserta en `Reporte` con `fechaIncidente`, `ciudad`, `pais` y `edadVictima` iguales a los del archivo, sin valores inventados.
2. **Given** un caso con `ciudad = "Bogotá"` y `pais = "Colombia"`, **When** se procesa, **Then** el reporte almacenado contiene exactamente esos valores, no "Simulación".
3. **Given** un caso con `fechaIncidente = "2026-01-15T10:00:00Z"`, **When** se crea el reporte, **Then** la fecha se persiste tal cual, no como `new Date()` del momento de la ejecución.
4. **Given** un caso con `edadVictima = 14`, **When** se crea el reporte, **Then** el campo se persiste con valor 14.
5. **Given** un set de N casos, **When** uno falla durante el pipeline, **Then** se registra el error, la corrida continúa con los restantes y al final se reporta cuántos fallaron.
6. **Given** el pipeline real, **When** se procesa un caso, **Then** el override de modelo viaja por el job de pg-boss sin modificar `ParametroSistema` ni el modelo de producción.

**Edge Cases**:
- ¿Qué pasa si un caso genera duplicado? El pipeline real de deduplicación actúa normalmente; el reporte queda con estado `DUPLICADO` y se registra en los resultados.
- ¿Qué ocurre si Ollama no responde? El caso cae a `REVISION_MANUAL` vía fallback, igual que un reporte real; la corrida continúa.
- ¿Qué pasa si el worker se reinicia durante la corrida? Los jobs en cola se reintentan; los reportes ya creados conservan sus datos originales.
- ¿Qué ocurre si un caso excede el tope de reintentos? Se marca como `FALLIDA` la transición correspondiente y se refleja en los resultados.

---

### User Story 3 — Verificación de fidelidad (Priority: P1)

El administrador necesita una forma documentada y reproducible de confirmar que un reporte creado por simulación es equivalente a uno creado por el formulario anónimo con los mismos datos. Esto incluye mismos campos poblados, mismo tipo de transiciones y mismo tratamiento en el pipeline.

**Why this priority**: Sin una verificación explícita, la fidelidad es una suposición. El quickstart debe convertirse en una prueba de equivalencia que cualquier revisor pueda ejecutar.

**Independent Test**: Un revisor crea un reporte por el formulario anónimo y otro por simulación con datos idénticos; al comparar ambos en BD, los campos de entrada y las transiciones son equivalentes (salvo el origen `SIMULACION` y el identificador con prefijo `SIM-`).

**Acceptance Scenarios**:

1. **Given** el `quickstart.md` del 071, **When** se ejecuta la verificación de fidelidad, **Then** se comparan los campos `texto`, `plataforma`, `identificador`, `fechaIncidente`, `ciudad`, `pais`, `edadVictima` y las transiciones de ambos reportes.
2. **Given** la comparación, **When** se revisan los reportes, **Then** ambos tienen `esAnonimo = true`, `usuarioId = null` y la misma secuencia de transiciones (`PENDIENTE` → `CLASIFICADO`/`REVISION_MANUAL`/etc.).
3. **Given** la verificación, **When** se revisa el origen, **Then** el reporte de simulación se identifica por `FuenteReporte.origen = "SIMULACION"` o por el prefijo `SIM-` en el identificador, mientras que el reporte real se identifica por `origen = "FORMULARIO"` o similar.
4. **Given** la verificación completada, **When** se documenta el resultado, **Then** queda registro en el `quickstart.md` de cómo comprobarlo en BD.

**Edge Cases**:
- ¿Qué pasa si el reporte real y el de simulación reciben categorías diferentes por fluctuación del modelo? La fidelidad se mide sobre los campos de entrada y el pipeline, no sobre la salida del modelo; las categorías pueden diferir legítimamente.
- ¿Qué ocurre si el reporte real cae en duplicado? Se documenta que la comparación debe hacerse con un identificador único en ambos lados.

---

## Edge Cases generales

- ¿Qué pasa si un caso tiene `categoriaEsperada` pero el modelo no devuelve ninguna categoría? Se marca como fallo y se muestra `DESCONOCIDA` en los resultados.
- ¿Qué ocurre si el archivo de simulación incluye campos que no están en `crearReporteSchema` (por ejemplo, `notas`, `autor`)? Se ignoran silenciosamente; solo se validan los campos esperados.
- ¿Cómo se mantiene la compatibilidad con archivos antiguos del 070 (solo `texto,plataforma,identificador`)? El plan debe decidir si se rompe el formato o se acepta un modo legacy. **Propuesta**: no se soporta legacy; el 071 es una corrección de fidelidad y los archivos del 070 deben actualizarse añadiendo las columnas obligatorias.
- ¿Qué pasa si la simulación se corre con `DISABLE_RATE_LIMIT=false`? Se documenta que en desarrollo debe estar `true` para simulaciones; no se cambia el comportamiento del anti-abuso.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE aceptar en el set de simulación exactamente los campos de entrada de un reporte anónimo real: `texto` (obligatorio, 20-5000 caracteres), `plataforma` (obligatorio, clave válida), `identificador` (obligatorio, 3-100 caracteres), `fechaIncidente` (obligatorio, ISO datetime, no futura), `ciudad` (obligatorio, 1-100 caracteres), `pais` (obligatorio, 1-100 caracteres) y `edadVictima` (opcional, entero 0-120).
- **FR-002**: El sistema DEBE validar cada caso con las mismas reglas que `crearReporteSchema` y reportar errores por línea/índice antes de permitir lanzar.
- **FR-003**: El sistema DEBE guardar `categoriaEsperada` únicamente en `SimulacionReporte` para medir aciertos; NO debe pasarse al pipeline de clasificación ni al modelo.
- **FR-004**: El sistema DEBE crear cada reporte de simulación con los campos `fechaIncidente`, `ciudad`, `pais` y `edadVictima` exactamente como vienen del archivo cargado, sin inventar valores.
- **FR-005**: El sistema DEBE ejecutar cada caso por el pipeline real completo de reportes anónimos; NINGÚN paso puede omitirse o simularse.
- **FR-006**: El sistema DEBE continuar la corrida si un caso falla, registrando el error y procesando el resto; al final se debe reportar cuántos casos fallaron.
- **FR-007**: El sistema DEBE mantener el override de modelo por job de pg-boss (Opción A) sin modificar `ParametroSistema` ni el modelo de producción.
- **FR-008**: El sistema DEBE permitir verificar en el `quickstart.md` que un reporte de simulación es equivalente a uno creado por el formulario anónimo con los mismos datos.
- **FR-009**: El sistema NO DEBE modificar el modelo `Reporte` ni el modelo `ClasificacionIA` para esta corrección.
- **FR-010**: El sistema DEBE actualizar los tests del parser y del executor para cubrir los nuevos campos, los casos de error por línea y la continuidad de la corrida ante fallos.

### Key Entities

- **CasoSimulacion (ampliado)**: caso del archivo cargado. Atributos: `texto`, `plataforma`, `identificador`, `fechaIncidente`, `ciudad`, `pais`, `edadVictima` (opcional), `categoriaEsperada` (opcional).
- **Reporte**: mismo modelo existente; la corrección solo cambia qué valores se le pasan desde la simulación.
- **SimulacionRun / SimulacionReporte**: mismo modelo existente; `SimulacionReporte` ya almacena `categoriaEsperada` y el índice.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los casos de un archivo válido pasan la validación de `crearReporteSchema` y se reportan errores por línea cuando fallan.
- **SC-002**: El 100% de los reportes creados por simulación tienen los campos `fechaIncidente`, `ciudad`, `pais` y `edadVictima` iguales a los del archivo cargado.
- **SC-003**: El pipeline real se invoca para cada caso; ningún paso se salta ni se simula.
- **SC-004**: Si un caso falla, la corrida continúa con los demás y al final se reporta el conteo de fallos.
- **SC-005**: El `quickstart.md` incluye una verificación de fidelidad reproducible que compara un reporte real y uno de simulación.
- **SC-006**: Los tests del parser y del executor pasan y cubren los nuevos campos, errores por línea y continuidad ante fallos.
- **SC-007**: El modelo `Reporte` no se modifica; la migración, si se requiere, es aditiva y no destructiva.
- **SC-008**: El override de modelo sigue viajando por job de pg-boss sin tocar `ParametroSistema`.

---

## Assumptions

- El pipeline real de reportes anónimos es accesible a través de `POST /api/reportes` y `sendReporte()`; el override de modelo ya está implementado (Spec 070, Opción A).
- `DISABLE_RATE_LIMIT=true` en desarrollo para permitir la inyección de volumen; en producción el submódulo de simulación no se usará o se deshabilitará rate limit explícitamente para el admin.
- Los datos de simulación son descartables; no hay retención legal.
- El formulario anónimo actual (`crearReporteSchema`) es la fuente de verdad de los campos de entrada; si cambia en el futuro, la simulación debe actualizarse para mantener la fidelidad.
- No se toca el modelo `Reporte` ni el flujo de clasificación de producción.
- El plan se aprueba antes de implementar código.
- El bloque de specs 070-080 está reservado para simulaciones; el 071 es una corrección del 070.

---

## Implementación

Implementación completada el 2026-07-20.

- **US1 — Entrada idéntica a la de un anónimo**: se redefinió `casoSimulacionSchema` en `src/lib/schemas/simulacion.ts` como `crearReporteSchema` sin `paisId`, `ciudadId` ni `otraPlataforma`, extendido con `categoriaEsperada` opcional. Se actualizó `src/lib/simulacion/parser.ts` para leer y validar `fechaIncidente`, `ciudad`, `pais` y `edadVictima` (convertida a número desde CSV), reportando errores por línea. El formato legacy del 070 (solo `texto,plataforma,identificador`) se rechaza con mensaje claro.
- **US2 — Executor con valores reales y pipeline completo**: se modificó `src/lib/simulacion/executor.ts` para crear `Reporte` con `fechaIncidente`, `ciudad`, `pais` y `edadVictima` exactamente como vienen del caso, eliminando los valores inventados. Se mantuvo `categoriaEsperada` únicamente en `SimulacionReporte`. Un caso fallido ya no detiene la corrida: se registra, se continúa con los demás, y al final se reporta `casosFallidos` en `metricasJson`.
- **US3 — Verificación de fidelidad**: el `quickstart.md` incluye pasos para crear un reporte real y otro de simulación con datos idénticos, y comparar ambos en BD. Se añadió un ejemplo del formato esperado en `NuevaSimulacionForm.tsx`.
- **Tests**: se actualizó `src/lib/simulacion/parser.test.ts` (15 tests) y se creó `src/lib/simulacion/executor.test.ts` (10 tests). Se corrigió `src/app/api/admin/ia/simulaciones/route.test.ts` para usar el nuevo formato de entrada. Total de tests: 595, todos en verde.
- **Validación**: `npx tsc --noEmit`, `npm run lint`, `npm run test` y `npm run build` pasaron sin errores. No se modificó el modelo `Reporte` ni `ClasificacionIA`; no se requirió migración destructiva. El override de modelo sigue viajando por job de `pg-boss` sin tocar `ParametroSistema`.

## Status

CERRADA
