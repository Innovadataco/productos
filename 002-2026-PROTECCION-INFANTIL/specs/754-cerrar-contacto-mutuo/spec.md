# SPEC-754 · Cerrar el contacto mutuo (padre ↔ profesional)

**Feature Branch**: `work/pi-SPEC-754-cerrar-contacto-mutuo`
**Created**: 2026-09-29
**Status**: DESARROLLO (compuerta §4 pendiente de aprobación del CEO)
**Base medida**: `main` (con SPEC-395/#715 — la fuente única — y SPEC-750 motor+superficie adentro)

**Radicado**: cola A-79 §6 fila 6. Vinculante: BRIEF A-79 §2/§5/§7 · FORMA-FLUJO-REUNION-OPERADOR-ENLACE §4/§7.

## Contexto

Hoy, tras `CONFIRMADA`, el padre ve el contacto del profesional y el profesional ve el correo del
padre. El modelo A-79 dice que **el canal de la reunión es el ENLACE de la cita** (SPEC-750), no el
correo, y que el recurso posterior va por el **canal de continuidad / PQR** (SPEC-752). Esta SPEC
**cierra el contacto mutuo**: voltea el valor en la fuente única `contactoVisiblePorSesion` (#715).

## Impacto en arquitectura

**Impacto en arquitectura:** cambio de UNA sola función (`contactoVisiblePorSesion` → `false`), que
los TRES consumidores ya comparten (SPEC-395): `debeExponerContacto` (padre→profesional),
`toCitaParaProfesional` (profesional→padre) y `calendario.service` (calendario del profesional →
correo del padre). Además se **retira** la excepción de reembolso de `debeExponerContacto` (migra al
canal, ver Decisión D-1). Sin cambio de schema. Las superficies que hoy pintan el contacto
(`EsperaCitaPanel`, `Paneles`) dejan de recibirlo; su copy del nuevo estado la define Diseño.

## 🚨 Dependencia de ORDEN (no de código)

**754 NO se despliega antes que 752.** Cerrar el contacto mutuo antes de que exista el canal de
continuidad/PQR deja al padre **sin ninguna vía** (hoy el correo es su única salida real). El brief
pone 754 dependiendo de **750 y 752**. La secuencia la controla el CEO y se exige en el cierre.

## User Scenarios & Testing

### User Story 1 — Tras confirmar, ninguna parte ve el contacto de la otra (Priority: P1)

Con la cita `CONFIRMADA`, el padre ya no ve el correo/teléfono del profesional, ni el profesional el
correo del padre (ni en el DTO del padre, ni en el del profesional, ni en el calendario del
profesional). Se reúnen por el **enlace** (SPEC-750); el recurso va por el **canal** (SPEC-752).

**Independent Test**: sembrar correo/teléfono de las DOS partes; con el valor cerrado, ninguno
aparece en la superficie de la otra. Control positivo: con el valor abierto (antes de voltear), SÍ.

**Acceptance Scenarios**:
1. **Given** una cita CONFIRMADA con contacto de ambas partes poblado, **When** el padre consulta su cita, **Then** no aparece el contacto del profesional.
2. **Given** lo mismo, **When** el profesional consulta la cita / su calendario, **Then** no aparece el correo del padre.
3. **Given** el valor forzado a abierto (control positivo), **When** se consultan, **Then** el contacto SÍ aparece (prueba que la superficie lo llevaría si el gate lo permitiera).

### Edge Cases

- **Reembolso** (`VENCIDA_SIN_RESPUESTA` + 48 h): hoy `debeExponerContacto` abría el contacto del profesional al padre para reclamar. **Se retira** (Decisión D-1) — el recurso pasa por el canal.
- **Perfil VENCIDO/SUSPENDIDO**: el guard de `debeExponerContacto` que ya cerraba el contacto de un profesional inhabilitado queda **subsumido** (el contacto se cierra siempre); se conserva o se simplifica — ver plan.

## Requirements

### Functional Requirements

- **FR-001**: `contactoVisiblePorSesion` DEBE devolver `false` (el contacto no se expone por estado de sesión). El canal es el enlace.
- **FR-002**: El cierre DEBE aplicar en las DOS direcciones y en las TRES superficies (padre DTO, profesional DTO, calendario del profesional) — todas pasan por la fuente única.
- **FR-003**: DEBE existir UNA sola fuente de la decisión; si el barrido encuentra otro punto que decide la visibilidad del contacto, es **hallazgo**.
- **FR-004**: La excepción de reembolso (`VENCIDA_SIN_RESPUESTA`+48h) DEBE retirarse de `debeExponerContacto` (migra al canal — D-1).
- **FR-005**: Las superficies (`EsperaCitaPanel`, `Paneles`) NO DEBEN renderizar el contacto. Si el estado resultante deja la pantalla afirmando algo falso, se PARA y se pide copy a Diseño (ninguna palabra visible nueva sin Diseño).
- **FR-006 (orden)**: 754 NO se despliega antes que 752.

### Candados

- **C-mutuo (conducta, dato real)**: sembrar correo/teléfono de ambas partes; **con el gate cerrado**, ninguno aparece en ninguna de las tres superficies; **con el gate abierto** (control positivo), aparecen. Extiende `contacto-fuente-unica.candado.test.ts` (SPEC-395), que ya fuerza ambos lados con el dato plantado.
- **C-fuente (complemento)**: el barrido de «decisores» sigue verde — nadie decide el contacto por su cuenta.

## Success Criteria

- **SC-001**: 0 apariciones del contacto de una parte en la superficie de la otra, con el dato de ambas poblado (medido en las 3 superficies).
- **SC-002**: la fuente sigue siendo una sola (el complemento de decisores no crece).

## Decisiones

- **D-1 · El reembolso MIGRA al canal, no se borra.** Un reembolso no es asunto padre↔profesional: la
  plata la tiene PI. Y la razón que decide es LEGAL: la reversión corre con plazos contados **desde el
  reclamo** (padre: 5 días hábiles desde la cita para reclamar; PI: 15 hábiles para reversar desde el
  reclamo). Un correo directo al profesional **no deja constancia de CUÁNDO** reclamó; sin esa fecha el
  plazo no se puede contar. La puerta de PQR (SPEC-752, **motivo 2 «Un pago o un cobro»**) registra
  quién, qué y cuándo. Por eso la excepción **se muda** al canal, no sobra. Mismo orden: no antes de 752.

## Assumptions / [NEEDS CLARIFICATION]

- **[NEEDS CLARIFICATION · Diseño]** Copy del nuevo estado de `EsperaCitaPanel` (padre) y `Paneles`
  (profesional) cuando ya no hay contacto: qué dice la pantalla (p. ej. «se reúnen por el enlace» /
  «para un pago o cobro, escríbenos»). Desarrollo no inventa copy.
- **Assumption**: `debeExponerContacto` colapsa a `false` (contactoVisiblePorSesion false + reembolso
  retirado); el guard de perfil VENCIDO/SUSPENDIDO queda subsumido. Ver plan para conservar vs simplificar.

## FUERA de alcance

El canal de continuidad / PQR (SPEC-752) en sí. La pantalla del operador (SPEC-750). El copy nuevo
(Diseño). Esta SPEC solo **cierra** el contacto y migra el recurso al canal que 752 provee.
