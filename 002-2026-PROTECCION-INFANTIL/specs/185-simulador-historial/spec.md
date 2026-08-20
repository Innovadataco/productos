# Feature Specification: SPEC-185 — Historial y sugerencias del simulador de abusos

**Feature Branch**: `work/002-pi-080`

**Created**: 2026-08-20

**Status**: IMPLEMENTADO

**Input**: Extensión de SPEC-184 (002-PI-079). El CEO probó los 5 escenarios en prod y encontró tres problemas: (1) no hay dónde ver corridas pasadas, (2) los defaults compartidos hicieron colisionar escenarios por IP, (3) el worker `pi-simulador-abuso` intenta escribir `fechaFin` inexistente y marca las corridas `FALLIDA` aunque ejecutaron bien.

**Impacto esperado**: añade historial paginado de simulaciones, endpoint de sugerencias frescas por escenario, detalle de corrida con descripción en criollo, y corrige I-64 sin migraciones. No toca el motor ni el rate-limit real.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Historial de simulaciones con filtros (Priority: P1)

Como administrador quiero ver todas las corridas del simulador en una lista paginada, filtrar por estado y escenario, y acceder al detalle de cada una, para entender qué he probado y cuándo.

**Why this priority**: el CEO no encontró dónde ver corridas anteriores; la UI solo tenía el form. El historial es necesario para operar el simulador como herramienta de pruebas.

**Independent Test**: abrir el tab "Historial" dentro de `/dashboard/admin/anti-abuso`, verificar que carga las corridas ordenadas por fecha, que la paginación funciona y que los filtros por estado/escenario reducen los resultados.

**Acceptance Scenarios**:

1. **Given** el tab Simulador → "Historial", **Then** se muestra una tabla con escenario, estado, progreso, total de reportes, conteos agregados (pasaron, bloqueados, spam) y fecha de creación.
2. **Given** el historial, **When** el admin selecciona un filtro `estado=COMPLETADA`, **Then** solo se muestran las corridas completadas.
3. **Given** el historial, **When** el admin selecciona un filtro `escenario=robot_inundando`, **Then** solo se muestran corridas de ese escenario.
4. **Given** una fila del historial, **When** el admin hace clic, **Then** abre el detalle con la descripción del escenario, configuración usada y resultados agregados.
5. **Given** el historial, **Then** no se expone texto de reportes, IPs en claro ni identidades de denunciantes reales.

---

### User Story 2 — Sugerencias frescas que evitan colisiones (Priority: P1)

Como administrador quiero que el sistema me proponga configuraciones por escenario con IPs e identificadores que no hayan sido usados recientemente, para poder lanzar varios escenarios seguidos sin que el rate-limit de uno opaque al siguiente.

**Why this priority**: el CEO lanzó 5 escenarios con el mismo IP default (`192.0.2.10`); el primero agotó la cuota y los demás rebotaron desde el primer intento.

**Independent Test**: llamar dos veces seguidas al endpoint de sugerencias para el mismo escenario y verificar que devuelve IPs distintas; una IP usada en las últimas 2 horas no debe reaparecer.

**Acceptance Scenarios**:

1. **Given** el escenario "Robot inundando", **When** se pide sugerencia, **Then** devuelve una IP de `192.0.2.0/24` que no haya sido usada en las últimas 2 horas, un identificador aleatorio, `N=50` y `plataforma=whatsapp`.
2. **Given** el escenario "Ataque coordinado", **When** se pide sugerencia, **Then** devuelve un rango de 30 IPs consecutivas de `192.0.2.0/24`, el mismo identificador objetivo, `N=30` y `plataforma=whatsapp`.
3. **Given** el escenario "Bot IPs rotativas", **When** se pide sugerencia, **Then** devuelve IPs de `198.51.100.0/24`, identificadores distintos, `N=20` y `plataforma=telegram`.
4. **Given** el escenario "Denunciante spam", **When** se pide sugerencia, **Then** devuelve `N=15`, `plataforma=instagram` y un `usuarioId` de PARENT de prueba si el parámetro `simulacion.spam.usuario_id` está configurado; si no está configurado, la sugerencia incluye `usuarioId: null`.
5. **Given** el escenario "Personalizado", **When** se pide sugerencia, **Then** no devuelve autocompletado (campos vacíos/null).
6. **Given** dos llamadas seguidas al mismo escenario, **Then** las IPs propuestas son distintas (sin colisión con uso reciente).
7. **Given** el escenario "Denunciante spam" sin `simulacion.spam.usuario_id` configurado, **When** el admin intenta lanzar la simulación, **Then** el endpoint responde HTTP 400 con mensaje: "Falta configurar simulacion.spam.usuario_id en Configuración → Sistema. Debe apuntar al id de un usuario PARENT de prueba."

---

### User Story 3 — Autofill inteligente del form "Nueva corrida" (Priority: P1)

Como administrador quiero que al cambiar de escenario el formulario se llene automáticamente con la sugerencia fresca, para no tener que pensar qué IP o identificador usar.

**Why this priority**: la UX actual obliga al CEO a decidir IP, identificador y plataforma manualmente; eso genera colisiones y fricción.

**Independent Test**: seleccionar cada escenario en el dropdown y verificar que todos los campos editables se rellenan con la sugerencia correspondiente.

**Acceptance Scenarios**:

1. **Given** el dropdown de escenario, **When** se elige "Robot inundando", **Then** el form se rellena con IP, identificador, N y plataforma sugeridos, y aparece el hint "El sistema propuso esta configuración. Puedes cambiar cualquier campo o dejarlo así.".
2. **Given** el form relleno, **When** el admin hace clic en "Refrescar sugerencia", **Then** se pide una nueva sugerencia y los campos se actualizan (IP/identificador distintos si aplica).
3. **Given** que se cambia de escenario, **When** se elige otro, **Then** se descarta la sugerencia anterior y se rellena con la nueva.
4. **Given** el escenario "Personalizado", **When** se selecciona, **Then** los campos quedan vacíos y no hay autofill.
5. **Given** un campo rellenado por sugerencia, **When** el admin lo edita manualmente, **Then** el valor editado se respeta al lanzar.

---

### User Story 4 — Detalle de corrida con explicación en criollo (Priority: P2)

Como administrador quiero abrir una corrida terminada y entender qué estaba probando, qué configuración usó y cuál fue el resultado, sin interpretar JSON técnico.

**Why this priority**: el CEO necesita explicarle al equipo qué hizo cada prueba; los JSON crudos no sirven.

**Independent Test**: abrir el detalle de una corrida y verificar que muestra la descripción del escenario, la configuración y los conteos con frases comprensibles.

**Acceptance Scenarios**:

1. **Given** el detalle de una corrida, **Then** se muestra el bloque "¿Qué probó este escenario?" con texto en criollo según el escenario.
2. **Given** el detalle, **Then** se muestra el bloque "Configuración usada" con la configuración verbatim.
3. **Given** el detalle, **Then** se muestra el bloque "Resultado" con: total intentados, enviados (201), bloqueados (429), posible spam, latencia p50 y p95.
4. **Given** el detalle, **When** la corrida está en progreso, **Then** se muestra progreso en vivo y botón "Cancelar".
5. **Given** el detalle de una corrida finalizada, **When** el admin pulsa "Repetir con nueva sugerencia", **Then** se pide una sugerencia fresca del mismo escenario y se lanza una nueva corrida.

---

### User Story 5 — Bugfix I-64: worker no marque FALLIDA por `fechaFin` inexistente (Priority: P1)

Como sistema quiero que el worker `pi-simulador-abuso` termine las corridas exitosas como `COMPLETADA`, no como `FALLIDA`, para que el CEO pueda confiar en el estado de las simulaciones.

**Why this priority**: el bug hizo que 4 corridas del CEO quedaran `FALLIDA` con progreso 50/50; es confuso y bloquea el historial útil.

**Independent Test**: lanzar una simulación y verificar que al terminar el estado es `COMPLETADA` (no `FALLIDA`), incluso cuando todos los reportes fueron 429.

**Acceptance Scenarios**:

1. **Given** una corrida que procesa todos sus reportes, **When** el worker termina, **Then** actualiza el estado a `COMPLETADA` sin intentar escribir `fechaFin`.
2. **Given** corridas previas afectadas por el bug (estado `FALLIDA`, `progreso == totalReportes`, creadas después del deploy de SPEC-184), **When** se corre el script de backfill, **Then** pasan a `COMPLETADA`.
3. **Given** una corrida realmente interrumpida (proceso muerto, no cancelación), **Then** puede quedar como está; el backfill solo toca el caso conocido del bug.

---

### Edge Cases

- **No hay corridas**: el historial muestra empty state con CTA a "Nueva corrida".
- **Sugerencia agota IPs disponibles**: si todos los IPs del rango están usados en las últimas 2h, el endpoint devuelve error 503 claro y el form no se autocompleta.
- **Usuario PARENT de prueba inactivo**: la sugerencia lo excluye y devuelve `null`; el UI exige seleccionar otro.
- **Corrida cancelada antes de empezar**: aparece en historial como `CANCELADA` con progreso 0.
- **Latencia p50/p95 con menos de 2 muestras**: se devuelve `null` para percentiles no calculables y se muestra "—".
- **Detalle de corrida con datos parciales**: si el worker murió sin guardar detalles, la tabla por reporte muestra mensaje "Detalle parcial".
- **Repetir una corrida personalizada**: como no hay sugerencia, el botón "Repetir" copia la config anterior y permite editarla antes de lanzar.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/admin/anti-abuso/simular` paginado (25/pag, `creadoEn desc`) con filtros opcionales `estado` y `escenario`, y DTO que incluya conteos agregados de `resultadosJson`.
- **FR-002**: El repositorio `SimulacionAbusoRepository` DEBE tener `listar(filtros, page, pageSize)` siguiendo la frontera DAL.
- **FR-003**: El sistema DEBE exponer `GET /api/admin/anti-abuso/simular/sugerencias?escenario=<clave>` que devuelva configuración fresca según el escenario.
- **FR-004**: Las sugerencias DEBEN evitar IPs usadas en las últimas 2 horas consultando `SimulacionAbusoRun.configJson` y `RateLimit` (scope `report`).
- **FR-005**: El escenario "Robot inundando" DEBE sugerir IP de `192.0.2.0/24`, identificador aleatorio, `N=50`, `plataforma=whatsapp`.
- **FR-006**: El escenario "Ataque coordinado" DEBE sugerir rango de 30 IPs de `192.0.2.0/24`, mismo identificador, `N=30`, `plataforma=whatsapp`.
- **FR-007**: El escenario "Bot IPs rotativas" DEBE sugerir IPs de `198.51.100.0/24`, identificadores distintos, `N=20`, `plataforma=telegram`.
- **FR-008**: El escenario "Denunciante spam" DEBE sugerir `N=15`, `plataforma=instagram` y un `usuarioId` de PARENT de prueba si está configurado; de lo contrario `null`.
- **FR-009**: El escenario "Personalizado" NO DEBE autocompletar.
- **FR-009b**: Si el escenario es "Denunciante spam" y `simulacion.spam.usuario_id` no está configurado, el sistema DEBE responder HTTP 400 con el mensaje exacto "Falta configurar simulacion.spam.usuario_id en Configuración → Sistema. Debe apuntar al id de un usuario PARENT de prueba." antes de crear la corrida.
- **FR-010**: El UI DEBE tener sub-tabs dentro del tab "Simulador": "Nueva corrida" e "Historial".
- **FR-011**: El form "Nueva corrida" DEBE llamar al endpoint de sugerencias al cambiar de escenario y rellenar los campos editables.
- **FR-012**: El form DEBE mostrar hint de sugerencia y botón "Refrescar sugerencia".
- **FR-013**: El UI DEBE tener vista de detalle (modal recomendado) con descripción en criollo del escenario, configuración usada y resultados agregados.
- **FR-014**: El detalle DEBE mostrar latencia p50 y p95 además del promedio.
- **FR-015**: El detalle DEBE tener tabla colapsable por reporte con status, latencia y motivo si fue 429.
- **FR-016**: El detalle DEBE tener botón "Repetir con nueva sugerencia" para escenarios predefinidos y "Repetir" para personalizado.
- **FR-017**: El worker `scripts/simulador-abuso.mjs` NO DEBE intentar escribir `fechaFin` (campo inexistente).
- **FR-018**: El sistema DEBE incluir script de backfill `scripts/reparar-simulaciones-fechafin.mjs` idempotente que corrige corridas marcadas `FALLIDA` por el bug.
- **FR-019**: El worker DEBE guardar detalles por reporte (`status`, `latencia`, `motivo`) dentro de `resultadosJson.detalles` para la tabla de detalle.
- **FR-020**: El worker DEBE calcular y guardar latencia p50 y p95 al finalizar.
- **FR-021**: No se DEBE añadir migración de base de datos (se reutiliza `SimulacionAbusoRun` y JSON existente).

### Key Entities

- **SimulacionAbusoRun**: existente; se extiende el uso de `resultadosJson` para incluir `detalles`, `latenciaP50Ms`, `latenciaP95Ms` y percentiles. No cambia el schema.
- **RateLimit**: existente; solo lectura para detectar IPs usadas recientemente.
- **Usuario**: existente; se lee para encontrar PARENT de prueba configurable.
- **ParametroSistema**: existente; se añade (si no existe) `simulacion.spam.usuario_id` opcional en seed.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dos llamadas seguidas a `GET /api/admin/anti-abuso/simular/sugerencias?escenario=robot_inundando` devuelven IPs distintas.
- **SC-002**: Una IP usada en el último escenario "Robot inundando" no reaparece en sugerencias durante 2 horas.
- **SC-003**: El historial carga en menos de 2 segundos con 100 corridas.
- **SC-004**: Una corrida que termina todos sus reportes queda en estado `COMPLETADA` (no `FALLIDA`).
- **SC-005**: El backfill corrige al menos el 95% de las corridas afectadas por I-64.
- **SC-006**: El detalle muestra descripción en criollo y resultados agregados sin exponer PII.

---

## Assumptions

- El bug I-64 afecta corridas creadas después del deploy de SPEC-184; el backfill usa `creadoEn > '2026-08-20 15:00:00'` como ventana conservadora.
- No se añade `fechaFin` al modelo; el estado `COMPLETADA` + `actualizadoEn` es suficiente para saber que terminó. Si en el futuro se necesita precisión de "cuándo terminó", se evaluará una migración aditiva.
- Los detalles por reporte se guardan en `resultadosJson.detalles` (array) para evitar migración. El tamaño máximo es 200 entradas por corrida.
- El usuario PARENT de prueba para "Denunciante spam" se configura vía parámetro `simulacion.spam.usuario_id` (sembrado vacío por defecto). Si no está configurado, el admin debe elegir uno manualmente.
- El candado RFC 5737 se mantiene: cualquier IP inyectable (sugerida o manual) debe estar en `192.0.2.0/24`, `198.51.100.0/24` o `203.0.113.0/24`.
- No se toca el motor (`src/lib/ai/**`) ni la lógica de rate-limit; solo se lee `RateLimit` para evitar colisiones.
- La vista de detalle se implementa como modal dentro del tab "Simulador" para no crear nueva ruta de página; si ZEUS prefiere página dedicada, se ajusta en compuerta.
- El historial no muestra texto de reportes ni IPs en claro; solo `ipHash`, identificadores de prueba y conteos agregados.

---

## Implementación *(closed loop)*

### Decisiones de compuerta §4 aplicadas

1. **Vista de detalle**: modal dentro del tab "Simulador". Componente `AdminAntiAbusoSimuladorDetalleModal.tsx`.
2. **Campo `fechaFin`**: se eliminó la referencia del worker y del repositorio; se usa `actualizadoEn` + estado `COMPLETADA`. Sin migración.
3. **Usuario PARENT de prueba**: se configura por parámetro `simulacion.spam.usuario_id` (sembrado vacío en seed). Fail-loud 400 si falta.
4. **IPs rotativas para escenario 3**: rango `198.51.100.0/24`; el escenario se renombró a "Bot con IPs rotativas" sin promesa de mismo fingerprint (ver Assumptions).

### Archivos modificados / creados

- `src/lib/dal/repositories/simulacion-abuso.ts` — `actualizarEstado` sin `fechaFin`; `listar`, `contar`, `buscarIpsUsadas`.
- `src/lib/dal/repositories/rate-limit.ts` — `buscarIpsBloqueadasRecientemente`.
- `src/lib/anti-abuso/sugerencias-simulador.ts` — generación de sugerencias frescas RFC 5737 con ventana 2h.
- `src/lib/anti-abuso/descripcion-escenario.ts` — textos en criollo por escenario.
- `src/lib/anti-abuso/simulador.ts` — tipos y validación fail-loud para `denunciante_spam`.
- `src/app/api/admin/anti-abuso/simular/route.ts` — `GET` listado paginado + agregados.
- `src/app/api/admin/anti-abuso/simular/sugerencias/route.ts` — `GET` sugerencias por escenario.
- `src/app/api/admin/anti-abuso/simular/[id]/route.ts` — detalle con descripción, percentiles y detalles.
- `scripts/simulador-abuso.mjs` — fix I-64, guarda `detalles`, `latenciaP50Ms`, `latenciaP95Ms`.
- `scripts/reparar-simulaciones-fechafin.mjs` — backfill idempotente.
- `prisma/seed.ts` — parámetro `simulacion.spam.usuario_id`.
- `src/components/modules/AdminAntiAbusoSimulador.tsx` — sub-tabs, autofill, integración historial.
- `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx` — tabla con filtros y paginación.
- `src/components/modules/AdminAntiAbusoSimuladorDetalleModal.tsx` — modal de detalle.
- `src/lib/schemas/index.ts` — schema Zod para sugerencias.

### Tests nuevos / ampliados

- `src/lib/anti-abuso/simulador.test.ts` — corrida termina en `COMPLETADA` (I-64).
- `src/lib/anti-abuso/reparar-simulaciones-fechafin.test.ts` — backfill idempotente.
- `src/lib/anti-abuso/sugerencias-simulador.test.ts` — IPs distintas, ventana 2h, rango RFC 5737.
- `src/app/api/admin/anti-abuso/simular/route.test.ts` — listado + filtros.
- `src/app/api/admin/anti-abuso/simular/sugerencias/route.test.ts` — sugerencias + fail-loud spam.

### Gate local

- `npx tsc --noEmit` ✅
- `npm run lint -- --no-cache` ✅ (0 errores; 40 warnings preexistentes)
- `npm run build` ✅
- Tests específicos de SPEC-185 ✅ (35 tests en 5 archivos)
- `npm run test` completa: timeout en background; se reintentará/validará antes del push final.

### Deuda técnica / notas

- Ninguna migración. Detalles y percentiles viven en `resultadosJson`.
- El test completo `npm run test` tardó más de 10 min en la Mac; se recomienda correrla con timeout mayor o en CI.

## Decisiones para compuerta §4

Todas las decisiones fueron aprobadas por ZEUS en compuerta §4. Ver sección Implementación arriba.
