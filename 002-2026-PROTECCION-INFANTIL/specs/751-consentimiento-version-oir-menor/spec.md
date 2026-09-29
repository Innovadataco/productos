# Feature Specification: Consentimiento por versión + «oír al menor» per-menor

**Feature Branch**: `work/pi-SPEC-751-consentimiento-version-oir-menor`
**SPEC**: 751
**Created**: 2026-09-29
**Status**: PLANEADO
**Input**: Cola A-79 (§6 fila 3) · encargo CEO 29-09 · anclajes SPEC-241 (mecanismo de consentimiento) + `src/app/consentimiento/page.tsx` · Decreto 1377/2013 art. 12 · Ley 1581/2012 art. 7

Impacto en arquitectura: **aditivo, per-menor.** Agrega a `Hijo` los campos denormalizados de audiencia (`oidoEn DateTime?`, `oidoVersion String?`) y crea la tabla inmutable nueva `AudienciaMenor` (registro probatorio por acto de audiencia: `hijoId`, `usuarioId` del representante, `version`, `declaradoEn`, `ip`, `userAgent`, y el texto de declaración) con FK `hijoId`/`usuarioId` `onDelete: Cascade` e índices `(hijoId, declaradoEn)` y `(version)` — MISMO patrón que `AuditConsentimiento`/`Usuario` (§SPEC-241), pero por MENOR en vez de por usuario. Extiende el predicado de la puerta de consentimiento con una dimensión per-menor (el titular queda «al día» solo si su consentimiento de cuenta está vigente **y** cada menor ACTIVO fue oído para la versión vigente). NO toca el motor, el proxy ni la navegación. El TEXTO de la declaración de audiencia es **[ABOGADO]** (ver `[NEEDS CLARIFICATION]`).

---

## Hallazgo previo (mecanismo primero — instrucción CEO #1)

**«Consentimiento por versión nueva» YA EXISTE.** El mecanismo de SPEC-241 (002-PI-144, `IMPLEMENTADO`) ya vuelve a pedir el consentimiento cuando cambia la versión:

- `consentimiento.version_actual` es un `ParametroSistema` sembrado y editable por el admin (`prisma/seed.ts:219`).
- `ConsentimientoService.versionEstaActual(usuarioId)` = `usuario.consentimientoVersion === version_actual` (`src/lib/dal/services/consentimiento.ts:69`).
- La guardia server-side de `/dashboard/**` (`src/lib/consentimiento/guard.ts` → `requiereConsentimientoActual`) y la página (`src/app/consentimiento/page.tsx:67`) redirigen a `/consentimiento` ante el mismatch.
- **SPEC-241 · US1 · escenario 4** lo dice literal: «cuando el CEO cambió `consentimiento.version_actual`, el middleware detecta el mismatch y fuerza re-aceptación».
- `AuditConsentimiento` (`prisma/schema.prisma:1026`) guarda inmutable CADA aceptación con su `version` (índice por `version`).

Por lo tanto **no se reconstruye la re-aceptación por versión.** Lo que le FALTA al mecanismo es una **dimensión**: hoy tiene UNA sola marca por usuario (`Usuario.consentimientoVersion`). No conoce a los menores. Esta SPEC agrega esa dimensión — es la corrección de la pregunta (el encargo era la hipótesis; el mecanismo ya existía, así que la SPEC pasa a ser «agregar el eje per-menor a un gate que ya versiona»).

> Registro de prod SANO al 29-09 (auditor: 120 titulares, 0 sospechosos). Esto **agrega** un eje; **no** arregla un desastre. Regla: no romper la puerta de cuenta que ya funciona.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El representante legal declara haber oído a CADA menor (Priority: P1)

Decreto 1377/2013 art. 12: el representante legal autoriza el tratamiento de datos del menor **y** se debe oír la opinión del menor (según su madurez, autonomía y capacidad). Hoy el sistema solo captura la autorización de cuenta (una marca por usuario); no hay registro, por menor, de que el menor fue oído.

**Why this priority**: es el vacío legal concreto que motiva la SPEC. Sin registro per-menor, la plataforma no puede evidenciar el art. 12 para cada niño.

**Independent Test**: un PARENT con un menor ACTIVO sin audiencia registrada para la versión vigente es llevado a declarar la audiencia de ESE menor; tras declararla, la puerta lo deja pasar. Un segundo menor sin audiencia vuelve a detenerlo (per-menor, no global).

**Acceptance Scenarios**:

1. **Given** un PARENT con consentimiento de cuenta vigente y un menor ACTIVO **sin** `oidoVersion == version_actual`, **When** entra al dashboard, **Then** la puerta lo detiene en el paso de audiencia de ESE menor (no en el consentimiento de cuenta, que ya está al día).
2. **Given** un PARENT con dos menores ACTIVOS, uno oído y uno no, **When** entra, **Then** solo se le exige el menor faltante (per-menor: oír a uno no cubre al otro).
3. **Given** un PARENT que declara la audiencia de un menor, **When** se registra, **Then** se crea una fila inmutable en `AudienciaMenor` con la `version` vigente y se sella `Hijo.oidoEn/oidoVersion`.
4. **Given** un menor INACTIVO/pausado, **When** el PARENT entra, **Then** ese menor NO exige audiencia (el eje sigue a los ACTIVOS, igual que el tope de cupo de SPEC-361/363).

### User Story 2 — Menor NUEVO exige su audiencia antes de operar sobre él (Priority: P1)

**Independent Test**: al agregar un menor, queda `oidoVersion == null`; la puerta exige su audiencia antes de dejar operar la cuenta.

**Acceptance Scenarios**:

1. **Given** un PARENT al día, **When** agrega un menor nuevo, **Then** ese menor nace sin audiencia y la puerta la exige antes de continuar.

### User Story 3 — Cambio de versión y su efecto per-menor (Priority: P2 · **[ABOGADO]**)

**[NEEDS CLARIFICATION — ABOGADO]**: cuando el admin sube `consentimiento.version_actual`, ¿se debe **re-oír a cada menor** (audiencia versionada, simétrica con el consentimiento de cuenta) o la nueva versión solo re-exige el consentimiento de CUENTA y la audiencia del menor se conserva? La FORMA por defecto de esta SPEC versiona la audiencia (re-oír en cada bump) por simetría con `AuditConsentimiento`, pero la obligación legal de re-oír en cada cambio de política es una decisión de abogado. Se implementa detrás de un parámetro para no fijar la política en código.

---

## Requirements *(mandatory)*

- **FR-001**: El sistema DEBE registrar, POR MENOR, un acto de audiencia («el menor fue oído») en una tabla inmutable `AudienciaMenor`, con la `version` de consentimiento vigente al momento, el `usuarioId` del representante que declara, `declaradoEn`, `ip` y `userAgent` — mismo valor probatorio que `AuditConsentimiento`.
- **FR-002**: El sistema DEBE denormalizar en `Hijo` la audiencia vigente (`oidoEn`, `oidoVersion`) para que la puerta la evalúe sin recorrer el log, igual que `Usuario.consentimientoVersion` respecto de `AuditConsentimiento`.
- **FR-003**: La puerta de consentimiento DEBE considerar a un titular «al día» solo si su consentimiento de cuenta está vigente **y** cada uno de sus menores ACTIVOS tiene `oidoVersion == version_actual`. El eje de cuenta EXISTENTE no se debilita (no romper lo que ya está bien).
- **FR-004**: La exigencia de audiencia DEBE ser PER-MENOR: oír a un menor NO marca a los demás. Un menor nuevo o inactivo→activo entra sin audiencia y la exige.
- **FR-005**: La audiencia DEBE aplicar solo a roles TITULARES del dato con menores a cargo (hoy `PARENT`), reusando la fuente única `esTitularDelDato` (`src/lib/routing/roles-titulares.ts`) — un rol interno/prestador nunca declara audiencia.
- **FR-006**: El registro `AudienciaMenor` DEBE ser inmutable (solo se inserta; nunca se edita ni borra salvo `onDelete: Cascade` al borrar el menor o el usuario) y sobrevivir a las purgas de datos de prueba como evidencia (clasificar en `PRESERVADOS`/orden de borrado según D-121).
- **FR-007**: El TEXTO de la declaración de audiencia DEBE venir de documento/parámetro legal, NO redactado por Dev ni Diseño. **[NEEDS CLARIFICATION — ABOGADO]** (ver Decisiones D-3).
- **FR-008**: El acoplamiento audiencia↔versión (re-oír en bump vs. conservar) DEBE ser parametrizable, no cableado. **[NEEDS CLARIFICATION — ABOGADO]** (ver US3 y D-4).
- **FR-009**: La declaración de que «el menor fue oído» es una DECLARACIÓN del representante que el servidor no puede verificar; se guarda como declaración (mismo criterio que `esRepresentanteLegal` en `AuditConsentimiento`), sin derivarla — derivarla destruiría su valor probatorio.

## Decisiones (§4)

- **D-1**: «Versión nueva» NO se construye — ya existe (SPEC-241). Esta SPEC agrega el eje per-menor a un gate que ya versiona. (Corrección del encargo-hipótesis.)
- **D-2**: La audiencia vive en tabla APARTE (`AudienciaMenor`) + campos denormalizados en `Hijo`, NO como una columna suelta ni una casilla global de cuenta. Espeja el par `AuditConsentimiento` (inmutable) ↔ `Usuario.consentimientoVersion` (denormalizado). Motivo: el menor es el TITULAR del dato; su audiencia es evidencia propia, no un atributo del padre.
- **D-3 [ABOGADO]**: el TEXTO de la declaración (y si «oír» a un menor de corta edad aplica «teniendo en cuenta su madurez, autonomía y capacidad» — art. 12) es de abogado. Se marca `[NEEDS CLARIFICATION]`, el paquete va a Jelkin, y se sigue con el resto del §4 sin inventar copy.
- **D-4 [ABOGADO]**: re-oír en cada cambio de versión vs. conservar la audiencia. FORMA por defecto: versionar (simetría con el consentimiento de cuenta), detrás de parámetro. Decisión final = abogado.
- **D-5**: el eje sigue a los menores ACTIVOS (consistente con el cupo por menores activos, SPEC-361/363): inactivar un menor no exige oírlo; reactivarlo sí, si le falta la versión vigente.

## Candados propuestos (conducta, no palabras)

- **C-puerta (per-menor)**: con el consentimiento de cuenta forzado a VIGENTE, un menor ACTIVO con `oidoVersion != version_actual` DEBE hacer que la puerta pida audiencia; con audiencia vigente, DEBE dejar pasar. Control positivo: mismo escenario, menor oído → pasa. (Espeja el candado de la puerta de cuenta; prueba el EJE nuevo, no el existente.)
- **C-per-menor-no-global**: dos menores ACTIVOS, uno oído y uno no → la puerta sigue deteniendo por el faltante. Oír a uno NO marca al otro (control positivo por remoción del discriminador: quitar `hijoId` de la audiencia no debe cerrar al otro menor).
- **C-inmutable/versión**: `AudienciaMenor` sella la `version` vigente al insertar; una audiencia con `version` distinta de la vigente NO cuenta como al día.
- **C-activos**: un menor INACTIVO no exige audiencia; reactivado sin la versión vigente, sí.
- **C-no-romper-cuenta**: la puerta de consentimiento de CUENTA existente sigue verde donde ya lo estaba (regresión: los tests de SPEC-241 no cambian de veredicto).

## Success Criteria *(mandatory)*

- **SC-001**: 100% de los menores ACTIVOS de un titular al día tienen `oidoVersion == version_actual`; ninguno queda operable sin audiencia.
- **SC-002**: Oír a un menor no altera el estado de audiencia de ningún otro menor del mismo titular (per-menor verificado por candado).
- **SC-003**: Cero cambios de veredicto en la suite de SPEC-241 (la puerta de cuenta no se debilita).
- **SC-004**: El texto de la declaración proviene de documento/parámetro legal aprobado; ningún copy inventado por Dev/Diseño llega a producción.

## Assumptions

- El eje aplica hoy solo a `PARENT` (único titular con menores a cargo). Si otro rol titular gana menores, reusa el mismo predicado.
- El «tope de menores» y el estado activo/inactivo del menor ya existen (SPEC-339/361/363); esta SPEC se apoya en ellos, no los redefine.
- La ubicación exacta de la UI (paso del camino guiado de SPEC-339 vs. modal per-menor) se fija en `plan.md`; el §4 fija el CONTRATO de datos y de puerta, no la pantalla.
- El texto legal y la política de re-audiencia por versión vuelven de Jelkin/abogado antes de implementar FR-007/FR-008.
