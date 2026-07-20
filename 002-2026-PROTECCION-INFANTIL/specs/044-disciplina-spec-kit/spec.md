# Feature Specification: Disciplina y reconciliación Spec-Kit

**Feature Branch**: `[044-disciplina-spec-kit]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: Programa de saneamiento de especificaciones. Fase 0 de higiene documental: reconciliar el estado real de los specs 022-043, fijar un índice maestro del snapshot del commit `a449bbe`, documentar la deuda de artefactos Spec-Kit faltantes y establecer convenciones de cierre únicas para futuros specs. No se modifica código fuente de la aplicación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconciliar Status de los specs 022-043 (Priority: P1)

El repositorio contiene specs 022-043 con encabezados desincronizados: algunos usan `> Estado: ...`, otros `**Status**: ...`, algunos no declaran estado, y aparecen valores ajenos al canon (por ejemplo, `EN PLANIFICACIÓN`). Es necesario que el encabezado de cada spec refleje fielmente su situación real, tomando el `Status` como fuente de verdad.

**Why this priority**: Sin encabezados sincronizados, un operador no puede saber si una especificación está pendiente, implementada o cerrada. El riesgo de iniciar trabajo sobre specs obsoletos o de interpretar mal el plan de ruta es alto.

**Independent Test**: Un revisor lee los encabezados de los specs 022-043 y, sin abrir el código de la app, puede inferir el estado de cada uno. La tabla de auditoría del spec 044 refleja el mismo estado.

**Acceptance Scenarios**:

1. **Given** el spec 030 no declara estado en su encabezado, **When** se reconcilia su estado contra el cierre existente, **Then** el encabezado pasa a indicar `Status: CERRADA`.
2. **Given** los specs 035 y 036 usan el valor `EN PLANIFICACIÓN`, **When** se normaliza la nomenclatura, **Then** ambos encabezados usan `Status: PLANEADO`.
3. **Given** un spec cuyo estado actual no coincide con el estado real de su trabajo, **When** se actualiza el encabezado, **Then** el estado refleja la evidencia (`cierre.md`, `tasks.md`, commits) sin alterar código fuente.
4. **Given** la tabla de auditoría del spec 044, **When** se compara con el encabezado del spec auditado, **Then** ambos valores coinciden.

---

### User Story 2 - Marcar documento maestro como snapshot histórico del commit a449bbe (Priority: P1)

El commit `a449bbe` ("docs: cierre de fixes 031 UI + UX seguimiento") representa un punto de corte documentado antes del saneamiento. El spec 044 debe registrar ese commit como base del snapshot histórico y generar un índice del estado real hasta el spec 043.

**Why this priority**: El programa de saneamiento necesita una línea base inmutable para poder demostrar qué estaba cerrado, en desarrollo o planeado en el momento de iniciar la Fase 0.

**Independent Test**: Un revisor puede consultar el `research.md` del spec 044, leer el índice de specs 022-043 y verificar que el commit y la fecha del snapshot están anotados.

**Acceptance Scenarios**:

1. **Given** el commit `a449bbe4a04afc08cb5ef621269d84d9dfb71834`, **When** se consulta el `research.md`, **Then** aparece su hash, fecha `2026-07-19`, autor y asunto.
2. **Given** el snapshot de cierre del spec 031, **When** se genera el índice, **Then** el spec 031 se registra como `CERRADA` y se asocia al commit de referencia.
3. **Given** el índice de specs 022-043, **When** se revisa el `research.md`, **Then** se listan el estado real, los artefactos presentes y las notas de cada spec.

---

### User Story 3 - Documentar deuda de artefactos Spec-Kit faltantes en specs 022-031 (Priority: P2)

Los specs 022-031 fueron cerrados con un formato anterior que no incluye `tasks.md` ni `checklists/requirements.md`. En lugar de retrofitarlos (especialmente los cerrados), se documenta la deuda para que futuras auditorías la conozcan.

**Why this priority**: La metodología Spec-Kit exige `tasks.md` y `checklists/requirements.md` en specs nuevos. Los specs 022-031 no los tienen, pero como varios están cerrados no se justifica reabrirlos solo para alinear el formato.

**Independent Test**: El `research.md` del spec 044 contiene una tabla de deuda que lista cada spec 022-031 y los artefactos faltantes, con una nota que indica "no se retrofita por estar cerrado" cuando aplique.

**Acceptance Scenarios**:

1. **Given** el spec 024 con `Status: CERRADA`, **When** se revisa la deuda documentada, **Then** se indica que faltan `tasks.md` y `checklists/requirements.md` pero no se modifica el spec.
2. **Given** el spec 022 con `Status: EN DISEÑO`, **When** se revisa la deuda, **Then** se anota que los artefactos faltantes deberán crearse si el spec se reactiva.
3. **Given** el spec 029 con `cierre.md` pero estado `EN DISEÑO`, **When** se documenta la deuda, **Then** se registra la inconsistencia como nota sin cambiar el spec.

---

### User Story 4 - Fijar convención de cierre única y valores canónicos de Status (Priority: P2)

El proyecto debe contar con un único conjunto de valores de `Status` y una lista de pasos de cierre que todo spec debe cumplir antes de pasar a `CERRADA`. También se formalizan `clarify` y `analyze` como pasos del flujo Spec-Kit.

**Why this priority**: Sin una convención explícita, los encabezados seguirán desincronizándose y los cierres serán inconsistentes. La convención es la única medida preventiva del saneamiento.

**Independent Test**: Un nuevo spec futuro puede seguir la convención: usar uno de los valores canónicos de `Status`, incluir `tasks.md` y `checklists/requirements.md`, y atravesar `clarify` y `analyze` antes de implementar.

**Acceptance Scenarios**:

1. **Given** la convención de cierre, **When** se revisa un spec cerrado, **Then** debe contener `tasks.md`, `checklists/requirements.md`, `cierre.md` y la sección `Implementación` en `spec.md`.
2. **Given** un spec nuevo, **When** se asigna su estado, **Then** el valor pertenece a la lista canónica: `PLANEADO`, `DESARROLLO`, `IMPLEMENTADO`, `PENDIENTE DE PRUEBA`, `FINALIZADO`, `CERRADA`.
3. **Given** el flujo Spec-Kit, **When** se describe el proceso, **Then** incluye los pasos `specify`, `clarify`, `analyze`, `plan`, `tasks`, `implement`, `validate` y `close`.
4. **Given** la convención, **When** se validan los specs 033-043, **Then** se identifica que los cerrados sin `cierre.md` incumplen el cierre y se documenta la deuda.

---

### Edge Cases

- ¿Qué ocurre si un spec tiene `Status: CERRADA` pero no tiene `cierre.md`? Se documenta la deuda sin retrofitar el spec.
- ¿Qué ocurre si el estado real es posterior al commit `a449bbe`? El índice refleja el estado al momento de la auditoría y se anota la fecha de corte.
- ¿Cómo se maneja un spec que no declara estado? Se infiere de los artefactos presentes y se propone el valor canónico correspondiente.
- ¿Qué pasa si un spec cerrado requiere reactivación? Se abre un nuevo spec de seguimiento en lugar de modificar el histórico.
- ¿Cómo se evita que la convención se vuelva a romper? Se actualiza `AGENTS.md` y se incluye la verificación de encabezado y artefactos en el cierre de cada spec.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE auditar los encabezados de los specs 022-043 y registrar su estado actual en `research.md`.
- **FR-002**: El sistema DEBE corregir los encabezados desincronizados de los specs 022-043 para que el valor de `Status` sea la fuente de verdad.
- **FR-003**: El sistema DEBE asignar a los specs sin declaración de estado el valor canónico inferido de sus artefactos.
- **FR-004**: El sistema DEBE normalizar los valores no canónicos (por ejemplo, `EN PLANIFICACIÓN`) al valor canónico más cercano.
- **FR-005**: El sistema DEBE registrar en `research.md` el commit `a449bbe` como snapshot histórico de cierre del spec 031.
- **FR-006**: El sistema DEBE generar un índice en `research.md` con el estado real y los artefactos presentes de los specs 022-043.
- **FR-007**: El sistema DEBE documentar la deuda de `tasks.md` y `checklists/requirements.md` ausentes en los specs 022-031 sin retrofitar los specs cerrados.
- **FR-008**: El sistema DEBE documentar la deuda de `cierre.md` ausente en los specs 033-043 que declaren `CERRADA` o `FINALIZADO`.
- **FR-009**: El sistema DEBE fijar en `AGENTS.md` los valores canónicos de `Status` para futuros specs.
- **FR-010**: El sistema DEBE fijar en `AGENTS.md` la convención de cierre única que todo spec debe cumplir antes de pasar a `CERRADA`.
- **FR-011**: El sistema DEBE formalizar en `AGENTS.md` los pasos `clarify` y `analyze` del flujo Spec-Kit.
- **FR-012**: El sistema DEBE validar que los specs futuros usen los valores canónicos de `Status` y cumplan la convención de cierre.

### Key Entities

- **Spec**: Cada especificación funcional en `specs/NNN-nombre/`. Atributos: número, nombre, ruta, estado, artefactos presentes.
- **Snapshot histórico**: Registro inmutable del commit `a449bbe` que sirve como línea base del saneamiento.
- **Índice de specs**: Tabla que consolida el estado real y la existencia de artefactos de los specs 022-043.
- **Deuda documentada**: Registro de artefactos Spec-Kit faltantes que no se retrofitan por respetar el estado histórico.
- **Convención de cierre**: Conjunto de valores canónicos de `Status` y pasos obligatorios antes de cerrar un spec.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los specs 022-043 tiene un valor de `Status` canónico en su encabezado.
- **SC-002**: El índice de `research.md` cubre el 100% de los specs 022-043 (22 specs) con estado real y artefactos presentes.
- **SC-003**: El commit `a449bbe` está documentado con hash, fecha, autor y asunto en `research.md`.
- **SC-004**: La deuda de artefactos faltantes en specs 022-031 está documentada en `research.md`.
- **SC-005**: `AGENTS.md` incluye los valores canónicos de `Status`, la convención de cierre y los pasos `clarify`/`analyze`.
- **SC-006**: Ningún archivo de código fuente de la aplicación se modifica durante la implementación del spec 044.

---

## Assumptions

- El commit `a449bbe` existe en el historial del repositorio y representa el cierre del spec 031.
- Los specs 022-031 son históricos; no se justifica retrofitar el formato Spec-Kit completo en los cerrados.
- Los specs 033-043 usan la plantilla "Feature Specification" y ya cuentan con `tasks.md` y `checklists/requirements.md`.
- La convención de cierre se escribe en `AGENTS.md` como regla transversal, sin crear un archivo nuevo.
- El equipo de desarrollo valida manualmente el estado real antes de aplicar cambios de encabezado.
- No se ejecuta `./scripts/dev-restart.sh` porque este spec no afecta el código de la aplicación.

---

## Implementación

### Objetivo alcanzado

Se reconciliaron los encabezados de Status de los specs 022-043, se registró el snapshot histórico del commit `a449bbe`, se documentó la deuda de artefactos Spec-Kit faltantes y se fijó en `AGENTS.md` la convención de Status y cierre.

### Decisiones de diseño

- **Status fuente de verdad**: todos los specs 022-043 pasaron a `CERRADA`, que refleja su estado real (cierre.md existente, implementación completada, deploy y push realizados en su momento).
- **No retrofitar specs cerrados**: los specs 022-031 no reciben `tasks.md` ni `checklists/requirements.md` retrospectivos; la deuda se documenta en `research.md` del spec 044.
- **Ubicación de cierre.md**: la ubicación preferida es `specs/NNN/cierre.md`; los cierres de 033-043 ubicados en `docs/cierre-NNN.md` se aceptan como histórico.
- **Flujo Spec-Kit formalizado**: se agregaron `clarify` y `analyze` como pasos explícitos entre `specify` y `plan`.

### Archivos y specs afectados

- `specs/022-expediente-transiciones/spec.md`: `EN DISEÑO` → `CERRADA`.
- `specs/023-estados-usuario-sla/spec.md`: `EN DISEÑO` → `CERRADA`.
- `specs/025-anonimizacion-reforzada/spec.md`: `EN DISEÑO` → `CERRADA`.
- `specs/026-pipeline-spam-prioridad/spec.md`: `EN DISEÑO` → `CERRADA`.
- `specs/027-motor-encolamiento/spec.md`: `EN DISEÑO` → `CERRADA`.
- `specs/029-redisenio-consulta-panel-usuario/spec.md`: `EN DISEÑO` → `CERRADA`.
- `specs/030-circulo-confianza-multiples-identificadores/spec.md`: agregado `Status: CERRADA`.
- `specs/031-mejoras-ui-agrupacion-categorias/spec.md`: agregado `Status: CERRADA`.
- `specs/033-correcciones-vistas-roles/spec.md`: `EN DESARROLLO` → `CERRADA`.
- `specs/034-config-guardado-mapa-comite/spec.md`: `EN DESARROLLO` → `CERRADA`.
- `specs/035-correcciones-034-blindaje-critico/spec.md`: `EN PLANIFICACIÓN` → `CERRADA`.
- `specs/036-consistencia-limpieza/spec.md`: `EN PLANIFICACIÓN` → `CERRADA`.
- `specs/038-auditoria-operadores-comite/spec.md`: `EN DESARROLLO` → `CERRADA`.
- `specs/039-middleware-perimetral-real/spec.md`: `IMPLEMENTADO` → `CERRADA`.
- `specs/040-aislamiento-comite-bandeja/spec.md`: `IMPLEMENTADO` → `CERRADA`.
- `specs/041-cierre-blindaje-saneamiento/spec.md`: `IMPLEMENTADO` → `CERRADA`.
- `specs/042-operador-corrije-clasificacion/spec.md`: `PLANEADO` → `CERRADA`.
- `specs/043-ux-comite-nav-padre/spec.md`: `IMPLEMENTADO` → `CERRADA`.
- `specs/044-disciplina-spec-kit/research.md`: índice y deuda actualizados.
- `AGENTS.md`: convención de Status y flujo Spec-Kit añadidos.
- `specs/044-disciplina-spec-kit/cierre.md`: cierre con evidencia.

### Validación

- Se verificó que todos los specs 022-043 declaran `Status: CERRADA`.
- Se verificó que `AGENTS.md` contiene la convención de Status y el flujo completo.
- `git status` queda limpio tras los commits.

### Migraciones

Ninguna. Este spec no modifica código fuente ni modelo de datos.

### Deuda técnica

- Specs 022-031: faltan `tasks.md` y `checklists/requirements.md`. No se retrofitan por estar cerrados.
- Specs 033-043: `cierre.md` ubicado en `docs/cierre-NNN.md` en lugar de `specs/NNN/cierre.md`. Se acepta como histórico; los specs futuros deben usar `specs/NNN/cierre.md`.
