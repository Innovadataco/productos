# Feature Specification: El padre (y el profesional) ven el enlace de la reunión

**Feature Branch**: `work/pi-SPEC-778-ver-enlace-cita`
**SPEC**: 778
**Created**: 2026-09-29
**Status**: PLANEADO
**Input**: Radicado CEO `e73e693` · 29-09 · bloquea SPEC-754 · orden nuevo 778 → 752 → 754 · anclajes SPEC-750 (`enlaceVisibleParaCita`, publicación del operador) + SPEC-758 (columnas de enlace) · enlace = acceso a sesión de un MENOR

Impacto en arquitectura: **aditivo, DERIVADO y GATEADO, fuente única.** Expone el enlace de la reunión a las pantallas del PADRE y del PROFESIONAL a través de sus DTOs, no por un camino crudo. Agrega una derivación única `derivarEnlaceParaCita(cita, now) → { estado, url? }` (reusa `enlaceVisibleParaCita` de SPEC-750) consumida por `toCitaParaPadre`, `toCitaParaProfesional` y `BloqueCalendario` (`calendarioDelProfesional`). El DTO gana la clave derivada `enlace` (`estado` + `url?` presente SOLO cuando el enlace es visible); las columnas CRUDAS `enlaceReunion`/`enlaceOperadorId`/`enlacePublicadoEn` SIGUEN reservadas y NUNCA salen por su nombre (`CAMPOS_INTERNOS_CITA` + `dto-reserva.candado`). NO toca schema, motor, proxy ni navegación. El enlace NUNCA va a `AuditLog.metadatos` (se replica a BI), NUNCA por correo, NUNCA interpretado como HTML. El TEXTO de los estados es **[DISEÑO]**.

---

## Hallazgo previo (mecanismo primero)

- **La visibilidad YA está resuelta en SPEC-750**: `enlaceVisibleParaCita(publicado, franjaFin, now)` (`src/lib/operadores/enlace-validacion.ts`) devuelve `true` solo si el enlace está publicado **y** la cita no pasó. Su propio doc dice: «Lo consumen las pantallas de padre/profesional (FUERA de alcance de SPEC-750)». 778 es esa pieza.
- **El operador YA tiene un discriminador de estado**: `calendario-operador.service.ts:75` → `enlaceEstado: c.enlacePublicadoEn ? "publicado" : "sin-enlace"`. 778 reusa ese vocabulario y agrega el 3.º estado (pasada la hora).
- **Alcance DOBLE (medido en main, punto 3 del radicado)**: NI el padre NI el profesional ven el enlace hoy.
  - Padre: `toCitaParaPadre` no expone enlace; sus superficies (`/api/padre/citas/[id]` GET, list, reasignar, reprogramar) ya pasan por el DTO y son fail-closed (nunca el modelo crudo — SPEC-750).
  - Profesional: `toCitaParaProfesional` (usado por `/api/profesional/solicitudes`) y `BloqueCalendario` (`calendarioDelProfesional`, usado por `/dashboard/profesional/calendario`) tampoco lo exponen.
  - Operador: único que lo ve/publica.
- **Cómo se cayó entre SPECs**: 750 puso la pantalla del padre explícitamente fuera de alcance esperando el cierre de FR-2 (#739). FR-2 cerró y nadie recogió la pieza. Una pregunta de dependencia de Diseño (cerrando 754) lo destapó.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El padre entra a su reunión (Priority: P1)

Hoy el padre solo tiene el correo del profesional como vía; 754 va a cerrar ese correo. Sin esta SPEC, cerrar el contacto lo deja **peor que antes**.

**Independent Test**: un PARENT con una cita CONFIRMADA cuyo operador publicó el enlace, antes de la hora, ve el enlace en su pantalla de cita; pasada la hora, ya no.

**Acceptance Scenarios**:

1. **Given** una cita con enlace publicado y la hora aún no pasada, **When** el padre abre su cita, **Then** ve el enlace (estado PUBLICADO, `url` presente) y puede entrar.
2. **Given** una cita SIN enlace publicado, **When** el padre abre su cita, **Then** ve el estado SIN_PUBLICAR (sin `url`), con la explicación de que el operador aún no lo publicó (copy = Diseño).
3. **Given** una cita con enlace publicado pero la hora YA pasada, **When** el padre abre su cita, **Then** el enlace está OCULTO (estado CERRADO_POR_HORA, sin `url`) — decisión de SPEC-750.

### User Story 2 — El profesional entra a su reunión (Priority: P1 · alcance DOBLE)

**Independent Test**: mismo comportamiento en las superficies del profesional (`/api/profesional/solicitudes` y el calendario).

**Acceptance Scenarios**:

1. **Given** una cita confirmada con enlace visible, **When** el profesional la ve en su calendario o en solicitudes, **Then** ve el enlace (mismo `derivarEnlaceParaCita`, misma regla que el padre).
2. **Given** enlace no publicado o pasada la hora, **When** el profesional la ve, **Then** el estado correspondiente sin `url`.

## Requirements *(mandatory)*

- **FR-001**: El sistema DEBE exponer el enlace al PADRE y al PROFESIONAL únicamente a través de sus DTOs (`toCitaParaPadre`, `toCitaParaProfesional`, `BloqueCalendario`), nunca por el modelo crudo.
- **FR-002**: La visibilidad DEBE derivarse por una FUENTE ÚNICA `derivarEnlaceParaCita(cita, now)` que reusa `enlaceVisibleParaCita` (SPEC-750): la `url` aparece SOLO si el enlace está publicado **y** la hora no pasó. Misma decisión para las tres superficies (patrón `contacto-visible`).
- **FR-003**: El DTO DEBE llevar un discriminador de estado `enlace.estado` ∈ {SIN_PUBLICAR, PUBLICADO, CERRADO_POR_HORA} (nombres/textos = Diseño), con `enlace.url` presente SOLO en PUBLICADO. Reusa el vocabulario del operador (`publicado`/`sin-enlace`) + el 3.º estado.
- **FR-004**: Las columnas CRUDAS `enlaceReunion`/`enlaceOperadorId`/`enlacePublicadoEn` DEBEN seguir sin salir por su NOMBRE en ningún DTO (`CAMPOS_INTERNOS_CITA` + `dto-reserva.candado`); el `enlaceOperadorId` y `enlacePublicadoEn` NO se exponen ni derivados (son operativos, no del titular). Solo el VALOR de `enlaceReunion` se expone, gateado, bajo `enlace.url`.
- **FR-005**: El enlace NUNCA DEBE ir a `AuditLog.metadatos` (se replica a BI), NUNCA por correo, NUNCA interpretarse como HTML (el valor ya se valida `https:`/sin `<>` al publicar — SPEC-750; el render escapa).
- **FR-006**: La derivación DEBE ser fail-closed: si falta `now` o `franjaFin`, o hay duda, `url` ausente (no se muestra un enlace que no se pudo verificar como visible).
- **FR-007**: Ninguna superficie del padre/profesional DEBE devolver el modelo crudo (se conserva el patrón fail-closed de reasignar/reprogramar/GET de SPEC-750: recargar por DTO, 404 si falla, nunca `: nueva` crudo).

## Decisiones (§4)

- **D-1**: La visibilidad NO se reinventa — se reusa `enlaceVisibleParaCita` (SPEC-750). 778 agrega el CONSUMO (padre + profesional) y el 3.º estado en el discriminador.
- **D-2**: Alcance DOBLE confirmado (punto 3): padre **y** profesional. El profesional se sirve por sus DOS superficies (`toCitaParaProfesional` para `/api/profesional/solicitudes`, `BloqueCalendario` para el calendario).
- **D-3**: El enlace se expone como VALOR derivado bajo `enlace.url`, no reexponiendo la columna cruda: la reserva por-nombre (`dto-reserva.candado`) sigue intacta y se agrega un candado de CONDUCTA para la exposición gateada.
- **D-4 [DISEÑO]**: los textos de los tres estados (incl. el «aún no publicado» y el «ya pasó la hora») los da Diseño con este radicado. No se inventa copy.
- **D-5**: `enlaceOperadorId` y `enlacePublicadoEn` NO se exponen (ni el operador que publicó, ni la marca de tiempo): al titular le importa el estado y el enlace, no la operativa interna.

## Candados propuestos (conducta, no palabras)

- **C-visible (por superficie)**: con enlace publicado + hora futura, `enlace.url` DEBE estar presente en `toCitaParaPadre`, `toCitaParaProfesional` y `BloqueCalendario`; publicado + hora pasada → `url` AUSENTE, estado CERRADO_POR_HORA; no publicado → `url` AUSENTE, estado SIN_PUBLICAR. URL real plantada en el escenario (si la fixture no trae url, «ausente» no probaría nada — mismo criterio que el candado de no-fuga del contacto). Control positivo y negativo por cruce del vivo (now antes/después de `franjaFin`).
- **C-fuente-única**: las tres superficies derivan de `derivarEnlaceParaCita`; un cuarto punto que decida la visibilidad por su cuenta → rojo (barrido de decisores, como `contacto-fuente-unica`).
- **C-reserva (mantener)**: `enlaceReunion`/`enlaceOperadorId`/`enlacePublicadoEn` no aparecen por su NOMBRE en ningún DTO; `enlaceOperadorId`/`enlacePublicadoEn` no aparecen ni por valor.
- **C-no-crudo**: reasignar/reprogramar/GET del padre siguen fail-closed (nunca el modelo crudo). Control: al poblar el enlace, ninguna superficie lo saca sin gate.
- **C-no-BI / no-HTML**: el enlace no viaja en `AuditLog.metadatos`; el valor publicado es `https:` sin `<>` (SPEC-750) y el render lo escapa.

## Success Criteria *(mandatory)*

- **SC-001**: Un padre y un profesional con cita confirmada y enlace publicado, antes de la hora, ven el enlace en TODAS sus superficies de cita.
- **SC-002**: Pasada la hora o sin publicar, ninguna superficie entrega la `url`; el estado explica por qué (copy de Diseño).
- **SC-003**: Cero exposición de `enlaceOperadorId`/`enlacePublicadoEn` y cero enlace en BI/correo (candados verdes).
- **SC-004**: SPEC-754 puede desplegarse DESPUÉS sin dejar al padre sin vía (778 provee la vía; orden 778 → 752 → 754).

## Assumptions

- El operador ya publica el enlace (SPEC-750); 778 solo lo CONSUME. Si no hay enlace, el estado es SIN_PUBLICAR (no un error).
- El copy de los estados vuelve de Diseño (radicado con este §4).
- La superficie exacta del profesional (solicitudes vs. calendario vs. ambas) se cubre en las dos (medido: ambas gobiernan vistas de cita); el `plan.md` fija dónde se pinta.
- Sin cambios de schema (las columnas existen desde SPEC-758).
