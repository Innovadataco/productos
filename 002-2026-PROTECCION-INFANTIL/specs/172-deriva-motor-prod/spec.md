# Feature Specification: SPEC-172 — Pilar D.5 · Deriva del motor en producción

**Feature Branch**: `work/002-pi-nocturno-20260817`

**Created**: 2026-08-17

**Status**: PLANEADO

Impacto en arquitectura: sin migraciones (reusa `CorreccionAdmin`, `SimulacionRun`, `ClasificacionIA`). Añade 6 parámetros `motor.deriva.*`, endpoints `/api/admin/motor/deriva*`, job semanal programado (patrón `boss.schedule` existente), email de deriva alta, tablero nuevo `/dashboard/admin/estadisticas/motor` y sección "Motor › Deriva" en ConfigPanel.

**Input**: Tarea nocturna 2026-08-17, Bloque 4 (Pilar D.5, ACTA_ARQ_07). Contexto: el motor se afina contra el banco curado en Simulación, pero nadie mide si en producción real sigue acertando: la señal existe (cada corrección humana queda en `CorreccionAdmin`) pero no se consolida ni se compara contra la accuracy del banco. Esta spec construye el termómetro: tasa de corrección humana semanal por categoría vs accuracy del banco curado, con alerta por email cuando la deriva supera el umbral y puente directo a Simulación para afinar.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El admin ve la deriva real del motor por categoría (Priority: P1)

Como admin quiero ver, por categoría, cuántas clasificaciones de producción corrigió un humano esta semana frente a lo que la accuracy del banco predice, para saber si el motor se está degradando en la realidad.

**Why this priority**: sin este termómetro, la degradación del motor solo se nota cuando los usuarios se quejan.

**Independent Test**: abrir `/dashboard/admin/estadisticas/motor` y verificar la tabla por categoría con: clasificaciones de la semana, correcciones, tasa de corrección, accuracy del banco y brecha.

**Acceptance Scenarios**:

1. **Given** el tablero motor, **Then** muestra el bloque "Deriva prod" con una fila por categoría: total de clasificaciones (semana móvil de 7 días), correcciones humanas confirmadas, tasa de corrección %, accuracy del banco (última simulación completada) y brecha en puntos porcentuales.
2. **Given** una categoría cuya brecha supera el umbral configurado, **Then** su fila se marca visualmente (semáforo ámbar/rojo según magnitud).
3. **Given** el bloque, **Then** incluye un enlace directo a Simulación (`/dashboard/admin/ia?tab=simulacion`) como puente para afinar la rúbrica.
4. **Given** que no hay simulación completada todavía, **Then** el bloque muestra "sin baseline del banco — corre una simulación" en lugar de números inventados.
5. **Given** una semana con pocas clasificaciones en una categoría (< `motor.deriva.min_muestra`), **Then** esa categoría se marca "muestra insuficiente" y NO entra al cálculo de alerta.

---

### User Story 2 — Alerta semanal por email si la deriva supera el umbral (Priority: P1)

Como admin quiero recibir un email los lunes si la deriva de alguna categoría superó el umbral la semana anterior, para afinar la rúbrica antes de que la degradación se acumule.

**Why this priority**: el termómetro sin alarma exige disciplina de mirar el tablero; la alarma lo hace a prueba de olvidos.

**Independent Test**: ejecutar el job semanal manualmente (o con fecha simulada) con una deriva artificial por encima del umbral y verificar el email con el detalle por categoría.

**Acceptance Scenarios**:

1. **Given** el job programado, **Then** corre los lunes 07:00 (America/Bogota) calculando la semana anterior (lunes-domingo).
2. **Given** una o más categorías con brecha > `motor.deriva.umbral_pp` (puntos porcentuales), **Then** se envía un email a `motor.deriva.email.destinatarios` con la tabla de categorías desviadas y enlace a Simulación.
3. **Given** ninguna categoría por encima del umbral, **Then** no se envía email (salvo que `motor.deriva.email.siempre` esté activo, que envía resumen semanal igual).
4. **Given** el cálculo semanal, **Then** queda persistido (snapshot reutilizable por el tablero: la semana ya calculada no se recalcula en cada carga).
5. **Given** el email, **Then** no incluye textos de reportes ni datos de personas: solo categorías, conteos y porcentajes.

---

### User Story 3 — Configuración de la deriva desde ConfigPanel (Priority: P2)

Como admin quiero ajustar el umbral, la ventana, la muestra mínima y los destinatarios sin tocar código, para calibrar la sensibilidad de la alarma con la operación real.

**Why this priority**: los umbrales de deriva son una decisión operativa que cambia con el volumen; deben ser configurables.

**Independent Test**: cambiar `motor.deriva.umbral_pp` en ConfigPanel y verificar que el tablero y la alerta lo respetan.

**Acceptance Scenarios**:

1. **Given** ConfigPanel, **Then** existe la sección "Motor › Deriva" con los 6 parámetros, labels en criollo y validación por tipo.
2. **Given** el seed, **Then** crea los 6 parámetros `motor.deriva.*` de forma idempotente con defaults seguros.

---

### Edge Cases

- Categoría con cero clasificaciones en la semana: no aparece o aparece en 0 con "sin actividad".
- Simulación baseline muy vieja (> 30 días): el tablero avisa "baseline desactualizada — corre Simulación".
- Correcciones sin confirmar (`confirmada = false`): no cuentan para la tasa (solo correcciones confirmadas).
- Semana del despliegue (sin datos previos): primera corrida calcula lo disponible, sin inventar historia.
- Email caído: se loguea; el snapshot del cálculo queda guardado igual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE calcular por categoría y semana: total de clasificaciones (`ClasificacionIA`), correcciones humanas confirmadas (`CorreccionAdmin.confirmada = true`), tasa de corrección y brecha vs accuracy del banco (última `SimulacionRun` COMPLETADA, `metricasJson`).
- **FR-002**: El cálculo semanal DEBE persistirse como snapshot (tabla nueva `DerivaMotorSnapshot` — ver nota de alcance — o persistencia equivalente documentada) para no recalcular en cada carga del tablero.
- **FR-003**: El sistema DEBE programar el cálculo semanal los lunes 07:00 America/Bogota con el patrón existente `boss.schedule` del worker.
- **FR-004**: Si alguna categoría supera `motor.deriva.umbral_pp` de brecha, el sistema DEBE enviar email con el detalle (sin textos de reportes ni datos de personas).
- **FR-005**: El tablero `/dashboard/admin/estadisticas/motor` DEBE mostrar el bloque "Deriva prod" con la tabla por categoría, semáforos por brecha, estado del baseline y enlace a Simulación.
- **FR-006**: El sistema DEBE declarar 6 parámetros en seed y mostrarlos en ConfigPanel bajo "Motor › Deriva": `motor.deriva.enabled` (true), `motor.deriva.umbral_pp` (15), `motor.deriva.min_muestra` (20), `motor.deriva.ventana_dias` (7), `motor.deriva.email.destinatarios` (soporte), `motor.deriva.email.siempre` (false).
- **FR-007**: Los endpoints `/api/admin/motor/deriva` (snapshot actual + recalcular bajo demanda) DEBEN exigir rol ADMIN y módulo `estadisticas`.
- **FR-008**: El endpoint de recálculo bajo demanda DEBE auditar en `AuditLog`.

### Key Entities

- **CorreccionAdmin** (existente): corrección humana confirmada de una clasificación (categoriaOriginal → categoriaCorregida).
- **SimulacionRun** (existente): corrida del banco curado; `metricasJson` contiene accuracy por categoría (baseline).
- **ClasificacionIA** (existente): clasificación de producción con categoría y fecha.
- **DerivaMotorSnapshot** (nueva, aditiva — ver nota de alcance): resultado semanal persistido por categoría.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El tablero carga el bloque Deriva prod con datos reales en < 2 s usando el snapshot persistido.
- **SC-002**: Con una deriva artificial > umbral, el job semanal envía exactamente 1 email con las categorías desviadas correctas.
- **SC-003**: Categorías con menos de `min_muestra` clasificaciones jamás disparan alerta.
- **SC-004**: Los 6 parámetros son editables en ConfigPanel y se reflejan en el siguiente cálculo sin redespliegue.
- **SC-005**: Gate local completo verde y CI del PR consolidado verde.

## Assumptions

- **Nota de alcance (a compuerta)**: el brief dice "cero migración", pero persistir el snapshot semanal evita recalcular groupBys pesados en cada carga del tablero. Se propone UNA tabla aditiva `DerivaMotorSnapshot` (compatible con "cero migración destructiva"); si ZEUS prefiere cero tablas, el cálculo se hace on-demand cacheado en parámetro `motor.deriva.ultimo_snapshot` (JSON en ParametroSistema). Decisión a compuerta.
- La accuracy del banco por categoría vive en `SimulacionRun.metricasJson` de la última corrida COMPLETADA; si el formato del JSON difiere, el parser se adapta al formato real verificado en implementación.
- Solo cuentan correcciones `confirmada = true` (las no confirmadas son ruido en revisión).
- El cron vive en el worker existente (`scripts/worker-reportes.mjs`, patrón `boss.schedule` con `tz: "America/Bogota"`) — no requiere proceso nuevo.
- El tablero motor es página nueva bajo el módulo `estadisticas` existente (sin claves nuevas).
