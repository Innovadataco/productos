# Feature Specification: El padre (y el profesional) ven el enlace de la reunión

**Feature Branch**: `work/pi-SPEC-778-ver-enlace-cita`
**SPEC**: 778
**Created**: 2026-09-29
**Status**: PLANEADO
**Input**: Radicado CEO `e73e693` · bloquea SPEC-754 · orden 778 → 752 → 754 · anclajes SPEC-750 (publicación del operador) + SPEC-746 (`estadoEfectivoDeCita`, fuente única del reloj) + SPEC-758 (columnas de enlace) · FORMA de Diseño `FORMA-SPEC778-PADRE-ESTADOS-DEL-ENLACE` (commit `160fa5f` padre + `50384ba` §5 profesional) · enlace = acceso a sesión de un MENOR

Impacto en arquitectura: **aditivo, DERIVADO y GATEADO, fuente única.** Expone el enlace al PADRE y al PROFESIONAL vía sus DTOs (`toCitaParaPadre`, `toCitaParaProfesional`, `BloqueCalendario`), nunca por el modelo crudo. Agrega una derivación única `derivarEnlaceParaCita(cita, now) → { estado, url? }` que toma el reloj de `estadoEfectivoDeCita` (SPEC-746) — **NO** hace su propia comparación temporal, para no crear una cuarta frontera de tiempo. El DTO gana la clave derivada `enlace`; las columnas CRUDAS `enlaceReunion`/`enlaceOperadorId`/`enlacePublicadoEn` siguen reservadas por nombre (`CAMPOS_INTERNOS_CITA` + `dto-reserva.candado`); `enlaceOperadorId`/`enlacePublicadoEn` no salen ni por valor. `url` presente SOLO cuando publicado y la cita está en su ventana viva. Enlace NUNCA a `AuditLog.metadatos` (BI), NUNCA por correo, NUNCA como HTML. Sin cambios de schema. Copy = Diseño (`160fa5f`/`50384ba`).

---

## Hallazgo previo (mecanismo primero)

- **El reloj YA tiene fuente única**: `estadoEfectivoDeCita` (SPEC-746) — su doc nombra explícitamente el enlace («PASADA cierra la ventana (esconde el enlace…)») y a `debeExponerContacto` como clienta futura. 778 DERIVA de ahí; no reinventa la comparación `now < franjaFin`.
- **`enlaceVisibleParaCita` (SPEC-750) NO tiene llamadores vivos** (solo un re-export y su test). Era el placeholder de 750 para estas pantallas y duplica la comparación de tiempo. 778 deriva de 746, no de él → queda redundante (se puede retirar/hacer delegar a 746 después; no lo toco en esta SPEC salvo que el CEO lo pida).
- **Alcance DOBLE (medido en main)**: ni el padre ni el profesional ven el enlace hoy (`toCitaParaPadre`, `toCitaParaProfesional`, `BloqueCalendario` no lo exponen; solo el operador). El fallback `: nueva` de reasignar/reprogramar YA está fail-closed (SPEC-750, nunca el modelo crudo).
- **La FORMA de Diseño resuelve AMBOS lados**: `160fa5f` (padre, 3 estados) + `50384ba` (§5 profesional: «casi nada — el botón, y su razón»). Leído el artefacto real por SHA, no el relay.

---

## Los ESTADOS (de la FORMA de Diseño, verbatim el copy)

**Padre (voz «tú»):**
- **SIN_PUBLICAR** (ámbar): «Tu cita está confirmada. El acceso a la reunión aparecerá aquí. Vuelve a esta pantalla el día de tu cita.» — no dice cuándo, no culpa al operador, no dice que algo falló.
- **PUBLICADO** (cielo): «Ya puedes entrar a tu reunión.» + **[ Entrar a la reunión ]** + «Ábrelo a la hora de tu cita. Es tu acceso a la reunión de tu familia — no lo compartas con nadie.» El botón es el enlace SIN adjetivos (nada de «sala segura»/«caduca»/«un solo uso»); «no lo compartas» es indicación al padre, NO garantía del sistema.
- **PASADA_LA_HORA** (tinta neutro): el enlace DESAPARECE; se muestra el «Esta cita ya pasó» de FR-2 (el mismo texto, ahora como 3.er estado del flujo). Es la vista de la CITA (SPEC-746/FR-2), no un estado propio del enlace.

**Profesional (voz «usted», §5 · `50384ba` — «casi nada»):**
- SIN_PUBLICAR: sin botón; un renglón factual «El acceso a la reunión aún no está disponible.» (nada de «aparecerá»/«el operador…»/espera).
- PUBLICADO: **[ Entrar a la reunión ]** y NADA MÁS — ni una palabra sobre el enlace (límite 1 pega más fuerte). NO lleva el «no lo compartas» del padre.
- PASADA: enlace oculto → «Esta cita ya pasó su hora acordada.» — sin acción.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El padre entra a su reunión (Priority: P1)

**Independent Test**: PARENT con cita CONFIRMADA, enlace publicado, antes de la hora → ve **[ Entrar a la reunión ]**; pasada la hora → el enlace desaparece y ve «ya pasó».

**Acceptance Scenarios**:
1. Publicado + hora futura → estado PUBLICADO, `url` presente.
2. No publicado → SIN_PUBLICAR, sin `url`.
3. Publicado + hora pasada (reloj válido) → PASADA (vista de cita), sin `url`.

### User Story 2 — El profesional entra a su reunión (Priority: P1 · alcance DOBLE)

**Independent Test**: mismo `derivarEnlaceParaCita` en `/api/profesional/solicitudes` y el calendario; copy §5 (casi nada).

### User Story 3 — Sin reloj, la pantalla no miente (Priority: P1 · **condición 2 del CEO**)

**Independent Test**: con `now` ausente/basura y enlace publicado, la pantalla NO entrega `url` y NO dice ni «se pasó la hora» ni afirma un tiempo — falla conservador sin culpar a nadie.

**Acceptance Scenarios**:
1. `now` inválido + publicado → estado INDETERMINADO: sin `url`, mensaje que no afirma que la hora pasó ni que el operador no actuó (copy = Diseño; rama defensiva).

## Requirements *(mandatory)*

- **FR-001**: Exponer el enlace SOLO por DTO (padre + profesional), nunca por el modelo crudo.
- **FR-002 (condición 1)**: `derivarEnlaceParaCita(cita, now)` DEBE tomar la noción de «pasó la hora» de `estadoEfectivoDeCita` (SPEC-746), fuente única del reloj. PROHIBIDO una comparación `now < X` nueva o derivar de `enlaceVisibleParaCita` (frontera duplicada, sin llamadores vivos).
- **FR-003 (condición 2)**: el ESTADO del enlace se decide por la PUBLICACIÓN (hecho de datos, sin reloj) — SIN_PUBLICAR/PUBLICADO — y por la fase de 746 (PASADA = vista de cita). El `now` ausente/basura DEBE caer a un estado INDETERMINADO que NO afirme «se pasó la hora» ni «el operador no actuó»; la `url` se retiene (fail-closed). La validez del reloj se detecta reusando el normalizador de 746 (no una frontera nueva).
- **FR-004**: `url` presente SOLO cuando publicado **y** fase ∈ {PROXIMA, EN_CURSO} **y** reloj válido. En PASADA/INDETERMINADO/SIN_PUBLICAR, ausente.
- **FR-005**: Las columnas crudas siguen reservadas por nombre; `enlaceOperadorId`/`enlacePublicadoEn` no salen ni por valor; solo el VALOR de `enlaceReunion` sale, gateado, bajo `enlace.url`.
- **FR-006**: El enlace NUNCA a `AuditLog.metadatos` (BI), NUNCA por correo, NUNCA como HTML (el `href` se escapa; el valor ya se validó `https:`/sin `<>` al publicar — 750).
- **FR-007**: Ninguna superficie del padre/profesional devuelve el modelo crudo (se conserva el patrón fail-closed de reasignar/reprogramar/GET).
- **FR-008 (disciplina de copy — candado)**: en el estado PUBLICADO del padre y del profesional, la cara del usuario NO DEBE contener adjetivos que el sistema no controla: cero «sala», «segura», «caduca», «un solo uso», «espera a que lo admitan». El «no lo compartas» del padre es indicación, no garantía; el profesional no lo lleva.

## Decisiones (§4)

- **D-1**: El reloj NO se reinventa — se deriva de `estadoEfectivoDeCita` (746). `enlaceVisibleParaCita` (750) queda redundante (sin llamadores); no lo toco salvo pedido.
- **D-2 (condición 2)**: el ESTADO se desacopla del reloj (publicación = hecho de datos); solo la `url` y la fase PASADA usan el reloj. El caso «sin reloj» cae a INDETERMINADO — un estado honesto que no miente en ninguna dirección (ni «esperando/aparecerá» como afirmación de tiempo, ni «se pasó»). Es el 4.º estado, defensivo (server-side el `now` siempre es válido; el candado lo exige igual). Su copy = Diseño.
- **D-3**: alcance DOBLE, resuelto por Diseño en §5 (`50384ba`): profesional = el botón cuando está, un renglón factual cuando no, la verdad cuando pasó, y NADA MÁS. Se implementan las TRES superficies del DTO.
- **D-4**: el enlace se expone como VALOR derivado bajo `enlace.url`; la reserva por-nombre queda intacta y se agrega candado de conducta para la exposición gateada.
- **D-5 (interacción)**: `BloqueCalendario` lo tocan 778 (agrega `enlace`) y 754 (quita `contactoEmail`). Orden 778 primero; al llegar a 754 verificar que no se revierte el `enlace` de 778 al editar el mismo tipo.

## Candados propuestos (conducta, no palabras)

- **C-visible (3 superficies)**: publicado + hora futura → `url` presente; publicado + hora pasada → `url` ausente (vista PASADA); no publicado → `url` ausente (SIN_PUBLICAR). URL REAL plantada; **cruzar el vivo** (now antes/después de `franjaFin`) — el cruce prueba la frontera, no una aserción de cada lado.
- **C-sin-reloj (condición 2)**: `now` ausente/basura + publicado → `url` AUSENTE **y** la cara del usuario NO dice «se pasó la hora» NI afirma un tiempo (estado INDETERMINADO). Control: plantar `now` basura.
- **C-fuente-reloj (condición 1)**: la noción de «pasó» viene de `estadoEfectivoDeCita`; un `now < franjaFin` nuevo en la derivación → rojo (barrido).
- **C-copy-sin-adjetivos (FR-008)**: en PUBLICADO (padre y profesional), buscar en la cara del usuario «sala|segura|caduca|un solo uso|admit» → CERO. Control positivo (el texto real está y las palabras prohibidas no).
- **C-fuente-única / C-reserva / C-no-crudo / C-no-BI-no-HTML**: como en la v1 (una derivación para las 3 superficies; nombres crudos no salen; nunca modelo crudo; nunca BI/correo/HTML).

## Success Criteria *(mandatory)*

- **SC-001**: padre y profesional con enlace publicado y hora futura ven el botón en todas sus superficies.
- **SC-002**: pasada la hora, sin publicar o sin reloj válido, ninguna superficie entrega `url`, y el mensaje no miente (ni culpa al operador ni al padre).
- **SC-003**: cero adjetivos no controlados en PUBLICADO; cero exposición de operador/timestamp; cero enlace en BI/correo.
- **SC-004**: 754 puede desplegarse DESPUÉS sin dejar al padre sin vía (orden 778 → 752 → 754).

## Assumptions

- El operador ya publica el enlace (750); 778 lo CONSUME. Sin enlace → SIN_PUBLICAR (no error).
- El reloj es siempre válido server-side; INDETERMINADO es defensivo, exigido por el candado.
- Copy verbatim de la FORMA de Diseño (`160fa5f` padre + `50384ba` profesional); la línea del 4.º estado (INDETERMINADO) se le pide a Diseño si necesita texto propio.
- Sin cambios de schema (columnas desde 758).
