# Feature Specification: SPEC-192 — UX del simulador anti-abuso (002-PI-086)

**Feature Branch**: `work/002-pi-086`

**Created**: 2026-08-20

**Status**: IMPLEMENTADO

**Input**: 002-PI-086. El simulador `/dashboard/admin/anti-abuso` (SPEC-184/185) tiene 6 defectos de UX y 1 de fingerprint rate-limit cazados por el CEO en pruebas post-deploy `abdaf208` (2026-08-20 noche). Este SPEC los cierra todos en 1 PR. Diseño y detalle: [BRIEF-SIMULADOR-ANTI-ABUSO-UX](../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-SIMULADOR-ANTI-ABUSO-UX.md) (v1.1, corrección honesta ZEUS en F2). Cero riesgo al motor (`src/lib/ai/**`).

**Impacto en arquitectura:** cambios localizados en el módulo anti-abuso: componentes React (`AdminAntiAbusoSimulador`, `AdminAntiAbusoSimuladorHistorial`, modal de detalle), endpoint público `POST /api/reportes` (bypass condicional de `report_fingerprint` mediante header `x-simulacion-secret` validado con `crypto.timingSafeEqual` contra `process.env.SIMULADOR_ABUSO_SECRET`), worker `scripts/simulador-abuso.mjs` (envío del header; fail-loud si falta el secret), configuración de despliegue (`.env.production.example`) y migración aditiva opcional `simulacion_abuso_runs.nota VARCHAR(200)`. No se toca `src/lib/ai/**`, ni se modifican scopes ni límites de `src/lib/rate-limit.ts`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reset limpio al cambiar de escenario (Priority: P1)

Como administrador quiero que al cambiar de escenario desaparezca el detalle de la corrida anterior, para no confundirme entre una prueba y otra.

**Why this priority**: I-70. El CEO cambió de escenario y el panel seguía mostrando la corrida anterior.

**Independent Test**: lanzar una simulación, cambiar de escenario y verificar que `run`, `runId`, error y sugerencia vuelven a estado limpio.

**Acceptance Scenarios**:

1. **Given** una corrida completada visible en pantalla, **When** el admin cambia el dropdown de escenario, **Then** el detalle de la corrida anterior desaparece.
2. **Given** un error previo, **When** se cambia de escenario, **Then** el mensaje de error desaparece.
3. **Given** una sugerencia cargada, **When** se elige "Personalizado", **Then** los campos y la sugerencia se limpian.

### User Story 2 — Bypass seguro del fingerprint rate-limit para simulaciones (Priority: P1)

Como administrador quiero poder lanzar múltiples escenarios de simulación sin que el rate-limit por fingerprint (`/24`) los trunque, mientras se mantienen los límites reales para el público.

**Why this priority**: I-71. El fingerprint trunca a /24 y satura el bucket `report_fingerprint` con las IPs RFC 5737 del simulador.

**Independent Test**: lanzar dos escenarios seguidos desde el simulador y verificar que el segundo no es bloqueado por `report_fingerprint`; un request público sin header sigue respetando el límite.

**Acceptance Scenarios**:

1. **Given** un request a `POST /api/reportes` con header `x-simulacion-secret` igual al valor de `SIMULADOR_ABUSO_SECRET`, **When** se evalúa `report_fingerprint`, **Then** el bucket se salta y no incrementa contador.
2. **Given** un request público sin header `x-simulacion-secret`, **When** se evalúa `report_fingerprint`, **Then** aplica el límite normal de 5/hora.
3. **Given** un request con header `x-simulacion-secret` incorrecto, **When** se evalúa, **Then** se ignora el header y aplica el límite normal (no se expone bypass al público).
4. **Given** el env `SIMULADOR_ABUSO_SECRET` no definido, **Then** el worker `simulador-abuso.mjs` no arranca (fail-loud).
5. **Given** una simulación, **Then** los scopes `report` (IP) y `report_identificador` siguen activos y se cuentan normalmente.

### User Story 3 — Campo Plataforma como dropdown (Priority: P1)

Como administrador quiero elegir la plataforma desde un dropdown con las plataformas reales del sistema, para no escribir claves a mano ni cometer errores.

**Why this priority**: I-74. El campo Plataforma es texto libre y genera fricción.

**Independent Test**: abrir el form de nueva corrida y verificar que el dropdown carga las plataformas activas de `Plataforma`.

**Acceptance Scenarios**:

1. **Given** plataformas en BD, **When** se abre el form, **Then** el dropdown muestra `nombre` de cada plataforma y usa `clave` como valor.
2. **Given** BD vacía o sin respuesta, **When** se abre el form, **Then** el dropdown muestra fallback `whatsapp, telegram, instagram, facebook`.
3. **Given** el escenario cambia, **Then** el dropdown conserva o actualiza la plataforma según la sugerencia.

### User Story 4 — Priorizar array sobre campo único (Priority: P1)

Como administrador quiero que el formulario use el array de IPs/identificadores cuando tenga contenido, en vez de preferir silenciosamente el campo único.

**Why this priority**: I-75. El form prioriza campos únicos sobre arrays, haciendo que escenarios como `denunciante_spam` envíen contra una sola víctima.

**Independent Test**: llenar ambos campos (único y array) y verificar que el payload envía el array.

**Acceptance Scenarios**:

1. **Given** `identificadores` lleno e `identificador` lleno, **When** se inicia, **Then** `configJson.identificadores` es array y `configJson.identificador` es null.
2. **Given** `ips` lleno e `ip` lleno, **When** se inicia, **Then** se usa el array de `ips` y `ip` es null.
3. **Given** solo el campo único lleno, **When** se inicia, **Then** se usa el campo único.
4. **Given** el array tiene contenido, **Then** el campo único se deshabilita visualmente con leyenda "Se usa el array de arriba".

### User Story 5 — Historial con escenario legible y nota opcional (Priority: P1)

Como administrador quiero ver en el historial el nombre legible del escenario y, opcionalmente, una nota interna propia.

**Why this priority**: I-76. El historial solo muestra la clave técnica del escenario y no permite anotar contexto.

**Independent Test**: crear una corrida con nota y verificar que el historial muestra el label del escenario y la nota.

**Acceptance Scenarios**:

1. **Given** el historial de simulaciones, **Then** la primera columna muestra el label legible del escenario (reusando `ESCENARIO_OPCIONES`).
2. **Given** una corrida con `nota`, **Then** el historial muestra la nota (truncada con tooltip).
3. **Given** el form de nueva corrida, **Then** existe input opcional "Nota (interna)" de máximo 200 caracteres.
4. **Given** el campo `nota` vacío, **Then** la corrida se guarda sin nota.

### User Story 6 — Botón Iniciar re-habilitado tras corrida (Priority: P1)

Como administrador quiero poder lanzar otra simulación inmediatamente después de que termine una, sin cambiar de módulo.

**Why this priority**: I-77. El botón "Iniciar simulación" queda deshabilitado tras la primera corrida.

**Independent Test**: completar una corrida y verificar que el botón vuelve a estar habilitado.

**Acceptance Scenarios**:

1. **Given** una corrida en progreso, **Then** el botón está deshabilitado (`enviando`).
2. **Given** una corrida completada/fallida/cancelada, **Then** el botón está habilitado.
3. **Given** el botón habilitado tras finalizar, **When** se pulsa, **Then** inicia una nueva corrida limpia.

---

## Edge Cases

- **Cambio de escenario durante progreso**: si hay una corrida en progreso y el usuario cambia de escenario, el polling continúa pero el detalle visible se limpia; no se cancela la corrida automáticamente.
- **Header x-simulacion-secret manipulado**: `POST /api/reportes` compara con `crypto.timingSafeEqual`; un valor incorrecto no activa el bypass.
- **Secret no definido en app**: el bypass nunca se activa; comportamiento público normal.
- **Secret no definido en worker**: el worker falla al arrancar (fail-loud), evitando simulaciones silenciosas sin bypass.
- **Plataforma sugerida no está en BD**: el fallback hardcoded garantiza que el dropdown siempre tenga opciones.
- **Array vacío pero campo único vacío**: la validación Zod del body rechaza el request con error claro.
- **Nota mayor a 200 caracteres**: truncada o validada a 200 en el frontend/backend.
- **Denunciante spam sin usuarioId**: se mantiene el comportamiento existente (400 con mensaje claro) porque no es parte de este SPEC.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `AdminAntiAbusoSimulador.tsx` DEBE resetear `run`, `runId`, `error` y `sugerencia` al cambiar de escenario.
- **FR-002**: Debe existir una variable de entorno `SIMULADOR_ABUSO_SECRET` (string ≥ 32 bytes, generado con `openssl rand -hex 32`) disponible para `pi-app` y `pi-simulador-abuso`.
- **FR-003**: `POST /api/reportes` DEBE saltar el rate-limit `report_fingerprint` cuando el request incluya header `x-simulacion-secret` cuyo valor coincida con `process.env.SIMULADOR_ABUSO_SECRET` usando `crypto.timingSafeEqual`.
- **FR-004**: El bypass de FR-003 DEBE ser estrictamente server-side; no se puede activar sin el secret correcto.
- **FR-005**: Los scopes `report` e `report_identificador` NO DEBEN ser afectados por el bypass; siguen contando normalmente.
- **FR-006**: El worker `scripts/simulador-abuso.mjs` DEBE enviar el header `x-simulacion-secret` en cada request simulado, leyendo el valor de `process.env.SIMULADOR_ABUSO_SECRET`.
- **FR-007**: El worker DEBE fallar al arrancar (fail-loud) si `SIMULADOR_ABUSO_SECRET` no está definido.
- **FR-008**: El campo Plataforma en `AdminAntiAbusoSimulador.tsx` DEBE ser un `<Select>` que cargue `/api/plataformas` y tenga fallback hardcoded si la BD está vacía.
- **FR-009**: La función `iniciar` de `AdminAntiAbusoSimulador.tsx` DEBE priorizar arrays (`ips`, `identificadores`) sobre campos únicos (`ip`, `identificador`) cuando el array tenga contenido.
- **FR-010**: Cuando el array tenga contenido, el campo único correspondiente DEBE deshabilitarse con leyenda "Se usa el array de arriba".
- **FR-011**: `AdminAntiAbusoSimuladorHistorial.tsx` DEBE mostrar el label legible del escenario como primera columna, reusando `ESCENARIO_OPCIONES`.
- **FR-012**: El historial DEBE mostrar la nota interna (si existe) truncada con tooltip del texto completo.
- **FR-013**: El form DEBE incluir input opcional "Nota (interna)" con máximo 200 caracteres.
- **FR-014**: Se DEBE añadir la columna `nota VARCHAR(200)` a `simulacion_abuso_runs` mediante migración aditiva.
- **FR-015**: El botón "Iniciar simulación" DEBE estar habilitado cuando no haya una corrida en progreso (`disabled={enviando || (!!runId && !finalizada)}`).
- **FR-016**: No se DEBE tocar `src/lib/ai/**`.
- **FR-017**: No se DEBEN modificar los scopes ni límites de `src/lib/rate-limit.ts`.

### Key Entities

- **SimulacionAbusoRun**: se extiende con campo opcional `nota` (migración aditiva).
- **Reporte / RateLimit**: solo lectura/escritura existente; `report_fingerprint` se salta condicionalmente mediante secret.
- **Plataforma**: catálogo ya existente; se lee para llenar el dropdown.

---

## Success Criteria *(mandatory)*

- **SC-001**: Al cambiar de escenario, el detalle de la corrida anterior desaparece.
- **SC-002**: Dos simulaciones seguidas desde el simulador no son bloqueadas por `report_fingerprint`.
- **SC-003**: Un request público sin header `x-simulacion-secret` sigue siendo bloqueado por `report_fingerprint` tras 5 intentos.
- **SC-004**: Un request con header `x-simulacion-secret` incorrecto sigue siendo bloqueado por `report_fingerprint` tras 5 intentos.
- **SC-005**: El dropdown de Plataforma muestra las plataformas de BD o el fallback hardcoded.
- **SC-006**: Con ambos campos llenos, el payload envía el array y no el campo único.
- **SC-007**: El historial muestra el label legible del escenario.
- **SC-008**: El historial muestra la nota interna cuando existe.
- **SC-009**: Tras una corrida completada, el botón "Iniciar simulación" está habilitado.
- **SC-010**: Gate local completo verde (tsc, lint --no-cache, test:unit, test:integration, build).

---

## Assumptions

- El bypass de `report_fingerprint` es seguro porque depende de un secret compartido server-only (`SIMULADOR_ABUSO_SECRET`) generado con alta entropía y nunca expuesto al frontend.
- El secret se propaga a `pi-app` y `pi-simulador-abuso` mediante `.env.production` (y `.env` en desarrollo). No se versiona.
- El header `x-simulacion-secret` es de uso exclusivamente interno; no se documenta para usuarios finales.
- Los logs nunca registran el valor del secret.
- El campo `nota` es puramente operativo e interno; no se expone fuera del admin.
- Las plataformas del catálogo usan `clave` como valor a enviar y `nombre` como label visible.
- El worker `scripts/simulador-abuso.mjs` puede leer `process.env.SIMULADOR_ABUSO_SECRET` sin tocar el motor.

---

## Decisiones de compuerta §4 (propuestas)

1. **Bypass fingerprint**: saltar solo `report_fingerprint`, manteniendo `report` e `report_identificador`. La activación usa secret compartido validado con `crypto.timingSafeEqual` en `POST /api/reportes`.
2. **Secret compartido `SIMULADOR_ABUSO_SECRET`**: se genera con `openssl rand -hex 32`, se carga en `process.env`, y se propaga a app y worker. Fail-loud en el worker si falta.
3. **Header `x-simulacion-secret`**: se envía desde el worker; el endpoint público lo valida. No se usa sesión de usuario porque `POST /api/reportes` rechaza roles distintos a PARENT.
4. **Nota interna**: se implementa con migración aditiva `nota VARCHAR(200)` porque cierra I-76 por completo y es un campo seguro (no PII de reportes reales).
5. **Priorización array**: en el frontend se deshabilita el campo único cuando el array tiene contenido; en el backend se aplica la misma lógica al construir `configJson`.
6. **Plataforma dropdown**: se reusa `/api/plataformas` del form público con fallback hardcoded para robustez.

---

## Implementación *(post-aprobación)*

- Pendiente de aprobación de ZEUS. Ver [plan.md](./plan.md), [tasks.md](./tasks.md) y [cierre.md](./cierre.md) tras la implementación.
