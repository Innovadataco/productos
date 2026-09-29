# SPEC-784 · Rescatar las pantallas de la encuesta (#341) sobre el modelo tipado de 753

> **Status**: `DESARROLLO` · §4 aprobado (veredictos CEO 29-09, D-1..D-7). Implementación T1–T4 hecha; SIN gate (D-7: Diseño eligió tarjeta) → no depende de SPEC-751. Cierre en curso.
> **Rama:** `work/pi-SPEC-784-encuesta-cita-tipada` (base `main` = `fd3507f85`).
> **Radicado:** `RADICADO-SPEC-784-2026-09-29.md` (repo de Gestión).
> **Forma (Diseño, autoridad de copy):** `FORMA-SPEC784-FORMULARIO-ENCUESTA-CITA-2026-09-29.md` · commit `d682cdb`.
> **Cierra** el `hueco-funcional` de SPEC-753 (el service del cruce) · **retira #341 (SPEC-429)** al entrar.

## 1 · Qué es y por qué

La encuesta de servicio de la cita ya tiene, en `main` (de SPEC-753 / #755), **todo menos las
pantallas y el endpoint de envío**:

- El **modelo tipado** `EncuestaCita` (enums por pregunta, dos CHECK VALIDADOS, `@@unique`, FK `Cascade`).
- Las **preguntas cerradas** con sus `key`s atadas a los enums (`encuestas-preguntas.ts`, texto legal v0.1).
- El **service del cruce** `cruzarEncuestasCita` / `detectarContradicciones` — declarado `hueco-funcional`
  porque *«lo llama el endpoint de ENVÍO, pieza posterior»*.

Esa **pieza posterior** se construyó hace 22 días en **#341 (SPEC-429)** — la página `/encuesta`,
el formulario, el panel del profesional, `api/encuesta/route.ts`, el disparador y el ajuste de
navegación — pero **sobre el modelo equivocado**: cinco `String` de texto libre (`r1..r5`), sobre los
que **el cruce padre↔profesional es imposible** (no se puede comparar texto libre). El modelo de #341
no puede sostener la función para la que existía la SPEC.

**784 trasplanta la ESTRUCTURA de #341 al modelo tipado de 753.** Lo reusable es la forma (ruta, dónde
vive el panel, el patrón de render); lo que **cambia** es que el formulario pasa de texto libre a
**opciones cerradas**, y el endpoint deja de guardar `r1..r5` para persistir la fila tipada y **llamar
al service del cruce** — con lo que el `hueco-funcional` de 753 se cierra.

## 2 · Alcance

**DENTRO:**
1. **Ruta `/encuesta`** (shell): `verifyAuth`, deriva las citas con encuesta pendiente del usuario,
   monta el formulario. Redirige fuera si no hay ninguna pendiente.
2. **`EncuestaFormulario`**: consume las preguntas/opciones cerradas; implementa el **flujo condicional
   de la P1** (imposibilidad estructural del CHECK, §FR-3); copy y voz de Diseño (`d682cdb`).
3. **Panel del profesional** (`EncuestaProfesionalPendiente`): monta el formulario para el lado
   `PROFESIONAL` cuando tiene pendiente.
4. **`POST /api/encuesta`**: valida contra las `key`s cerradas, deriva el `origen` (PADRE/PROFESIONAL)
   del rol del usuario en esa cita, persiste `EncuestaCita`, **llama `cruzarEncuestasCita`**, y responde
   **409** en el segundo envío del mismo lado (`@@unique`).
5. **Derivación única `citasConEncuestaPendiente`** (FR-2): la ÚNICA fuente de «pendiente», consumida por
   el gate, el panel y el shell. Núcleo PURO + envoltura que lee la BD.
6. **Gate de página `encuestaGateDetiene`** (FR-4): regla PURA que redirige a `/encuesta` desde la
   navegación normal del padre/profesional **excepto** las `SUPERFICIES_PROTECCION`. Se **cablea en la
   PÁGINA (servidor)**, nunca en el middleware Edge (§Decisión D-1). **Espera SPEC-751 en `main`.**
7. **Cierre del `hueco-funcional`** en la allowlist de huérfanos — en el **mismo commit** del cableado
   (salida autoexigida).

**FUERA (de 753, o de otra entidad):**
- El **cruce y los plazos** del incidente (ya son de 753; `cruzarEncuestasCita` se **llama**, no se toca).
- El **modelo** `EncuestaCita` y sus enums: se **LEEN, no se tocan**. Falta un campo → se pide, no se agrega.
- `estado-efectivo-incidente.ts` (derivación del estado del INCIDENTE): 784 no lo cablea (§D-4).
- `EncuestaPrimeraCita` (otra entidad, otra SPEC).
- **Cualquier pregunta de CONTENIDO** de la sesión: prohibida por producto (§FR-5).

## 3 · Historias de usuario

- **US-1 (P1) · El padre responde qué pasó con su cita.** Tras la hora de una cita confirmada, al
  navegar su tablero el padre es llevado a `/encuesta`; responde 6 preguntas de opción cerrada; si dice
  «no se realizó», recibe acuse + salida («no perdiste tu cupo», pedir otra cita). *Nunca* se le pregunta
  qué se habló.
- **US-2 (P1) · El profesional registra la sesión.** Igual, con voz de usted y desenlace de registro
  neutro; sus respuestas cruzan contra las del padre (mismas preguntas = misma vara).
- **US-3 (P1) · Reportar nunca se bloquea.** Un padre con encuesta pendiente que va a **reportar** llega
  a reportar. Satisfecha POR CONSTRUCCIÓN: no se construye ninguna compuerta (Diseño eligió tarjeta); la
  tarjeta va DEBAJO del reporte y el candado de orden lo vigila.
- **US-4 (P2) · El cruce se registra al cerrar el segundo lado.** Cuando ambos lados respondieron,
  `cruzarEncuestasCita` registra los incidentes de contradicción (ya implementado en 753; 784 solo lo
  invoca).

## 4 · Requisitos funcionales

- **FR-1 · Trasplante sobre el modelo tipado.** El endpoint persiste una fila `EncuestaCita` con los
  enums de 753 (`seRealizo`, `razonNoRealizo?`, `operador`, `inicio`, `enlace`, `duracion?`), nunca
  `r1..r5`. Las respuestas se validan contra las `key`s cerradas de `encuestas-preguntas.ts`
  (`opcionesValidas`); una `key` fuera del enum se rechaza 400.
- **FR-2 · «Pendiente» se DERIVA, no se marca (fuente única).** No existe `Usuario.encuestaPendiente`.
  Una cita tiene encuesta pendiente **para un lado** cuando su **estado efectivo** ∈ {`PASADA`,
  `CUMPLIDA`, `NO_ASISTIO_PADRE`, `NO_ASISTIO_PROFESIONAL`} (vía `estadoEfectivoDeCita`, ya en `main`)
  **y** no existe fila `EncuestaCita` de ese `origen`. **Los `NO_ASISTIO_*` SÍ se encuestan** (veredicto
  CEO, D-2): el sistema **no tiene dato objetivo de asistencia** (SPEC-750: sin marcas de presencia); un
  `NO_ASISTIO_*` es la **afirmación de una parte** (casi siempre el profesional), y sin encuestar al otro
  lado la familia que **pagó** no tiene canal para contradecirlo — es exactamente
  `NO_PRESTACION_DICHA_PROFESIONAL` de 753, la entrada principal del motor de cruce. La MISMA función
  exportada alimenta el gate, el panel y el shell (una sola noción de «pendiente»; si el gate deriva
  distinto que el panel, el usuario queda en bucle). Núcleo PURO
  (`esEncuestaPendientePara(estadoEfectivo, yaRespondidaEsteLado): boolean`) + envoltura que lee la BD.
  *Falla conservador:* la propia `estadoEfectivoDeCita` cae a `PASADA` ante tiempo inválido — la encuesta
  se pide de más, nunca de menos.
- **FR-3 · El CHECK se ejercita DESDE la pantalla (imposibilidad estructural).** La P1 gobierna la forma:
  `seRealizo = Sí` → aparece **duración**, **no** aparece razón (`razonNoRealizo` = null, `duracion`
  presente); `seRealizo = No` → aparece **razón**, **no** aparece duración. Las P3/P4/P5 aparecen siempre
  (sus valores «no hubo / no comenzó / no funcionó» son respuestas). La duración **desaparece**, nunca se
  ofrece un rango con `seRealizo=false` (ningún rango puede decir honestamente «no hubo sesión»). La UI
  **nunca construye** la combinación que el CHECK rechaza; el CHECK es la red, no el mecanismo.
- **FR-4 · [REEMPLAZADA por Diseño — NO hay gate] El punto de entrada es una TARJETA/BLOQUE, no una
  compuerta.** Diseño (`439d1c3`) decidió una **tarjeta** para el padre (en `DashboardUsuarioClient`,
  DEBAJO del encabezado de reporte y ENCIMA de «Mis reportes»; la misma en `EsperaCitaPanel`) y un
  **`Bloque`** «Sesiones por registrar ({n})» para el profesional (en `PanelProfesional`). Ambos → 
  `/encuesta`. NO hay redirect, NO hay modal, NO hay toast. La invariante «**nunca sobre el reporte**»
  no se sostiene con una exención de compuerta (que ya no existe) sino con un **candado de ORDEN**
  derivado del árbol de render: en el panel del padre «Reportar un riesgo» PRECEDE a la tarjeta (control
  positivo por mutación). **784 dejó de depender de SPEC-751.** La tarjeta es persistente + descartable
  («Ahora no» de igual peso), no mendiga (desaparece sin pendientes), y su copy es ABIERTA (no presume
  que la cita salió bien).
- **FR-5 · Cero contenido, cero texto libre.** Ninguna de las 6 preguntas pide qué se habló, cómo está el
  menor, ni un relato. «Otra razón» es una **opción cerrada**, no abre campo. No hay ningún `textarea` ni
  input de texto en el formulario.
- **FR-6 · 409 en el segundo envío del mismo lado.** `@@unique([solicitudId, origen])`; el endpoint
  traduce la colisión a **409** (no 500), sin duplicar.
- **FR-7 · Voz y desenlace por audiencia, preguntas idénticas.** Preguntas y opciones idénticas en
  significado (el cruce lo exige); cambia la voz (tú/usted), el label role-relative de
  `OTRA_PARTE_NO_CONECTO`, la intro y el **desenlace del «no se realizó»** (padre: acuse + salida;
  profesional: registro neutro). Copy exacto = `d682cdb`.

## 5 · Criterios de éxito

- Un padre y un profesional pueden completar la encuesta de una cita `PASADA`; al cerrar el segundo lado,
  el cruce registra las contradicciones (recorrido caminado, no solo verde).
- Es **imposible desde la UI** enviar (razón ∧ duración) o (∅ razón ∧ ∅ duración) — candado estructural.
- Un padre con encuesta pendiente **llega a `/reportar`, `/mis-reportes`, `/api/reportes` y
  `/dashboard/padre/reportar`** sin ser redirigido a la encuesta.
- El `hueco-funcional` del service de 753 desaparece de la allowlist en el commit del cableado;
  `arch:check` queda verde (no rojo por huérfano ni por huérfano-ya-cubierto).
- `#341` se cierra con el motivo en el PR **al entrar 784**, no antes.

## 6 · Candados (todos control-positivo por MUTACIÓN)

| # | Qué vigila | Control positivo |
|---|---|---|
| C-1 | **FR-2** · derivación de «pendiente» (núcleo puro) | estado ∈ {`PASADA`,`CUMPLIDA`,`NO_ASISTIO_PADRE`,`NO_ASISTIO_PROFESIONAL`} sin fila → pendiente; `PROXIMA`/`EN_CURSO`/`PAGADA_PENDIENTE`/`SIN_CONFIRMAR`/`REEMBOLSADA`/`REPROGRAMADA`/`VENCIDA_SIN_RESPUESTA`, o ya respondida ese lado → NO pendiente |
| C-2 | **FR-6** · 409 desde la SUPERFICIE (endpoint), no solo el modelo | 2º POST del mismo `origen` → 409; 1er POST → 201 |
| C-3 | **FR-3** · el formulario no puede construir la combinación incoherente | árbol de render: con `seRealizo=Sí` NO monta razón; con `No` NO monta duración; sin texto libre |
| C-4 | **FR-4** · «nunca sobre el reporte» (árbol de render de `DashboardUsuarioClient`) | «Reportar un riesgo» PRECEDE a la tarjeta de encuesta; invertir el orden hace caer el candado; sin pendientes la tarjeta no aparece |
| C-5 | **FR-5** · cero texto libre / cero contenido | no hay `textarea`/input de texto; «Otra» no abre campo; ninguna pregunta de contenido |

**NO reconciliar:** si un test de 753 se pone rojo al cablear, **es hallazgo** (puede ser un test mal
escrito de los 37 rojos de la línea base e2e sobre `main`), no una licencia para tocar 753 ni el candado.

## 7 · Supuestos

- El estado efectivo de la cita se lee con `estadoEfectivoDeCita` (SPEC-746, `main`) — `PASADA` ya está
  documentado como el instante que «dispara la encuesta».
- 427 (transición explícita a `CUMPLIDA`) **no está en `main`**; la derivación no lo necesita: dispara con
  `PASADA` (CONFIRMADA + tiempo). Cuando 427 entre, `CUMPLIDA` ya está contemplado.
- ~~SPEC-751 como dependencia~~ — **ya NO aplica**: Diseño eligió tarjeta en vez de compuerta, así que no
  hay gate que exima `SUPERFICIES_PROTECCION`. 784 no depende de 751.
- La copy visible la manda Diseño (`d682cdb`); las `key`s (enums) las manda el modelo de 753.

## 8 · Decisiones para el CEO (compuerta §4)

- **D-1 · El gate va en la PÁGINA, no en el middleware.** *(Medición aceptada por el CEO.)* El middleware
  corre en **Edge** por diseño (SPEC-287/572): no importa Prisma (solo `import type`), lo dice tres veces
  en su cuerpo, y corre en cada request. No puede derivar «pendiente» de la BD. El `+16` de #341 asumía un
  middleware que lee la BD — **suposición vencida, no se cherry-pickea**. `encuestaGateDetiene` es puro;
  el consumo (leer la BD + redirigir) va server-side. → **Confirmar.**
- **D-2 · [VEREDICTO CEO] DERIVAR (sin flag); `NO_ASISTIO_*` SÍ se encuesta.** El disparador `al-cumplir`
  de #341 (subía `Usuario.encuestaPendiente`) **desaparece** — la derivación lo subsume. **Conjunto
  confirmado: `PASADA` · `CUMPLIDA` · `NO_ASISTIO_PADRE` · `NO_ASISTIO_PROFESIONAL`.** *(Mi recomendación
  de excluir los `NO_ASISTIO_*` fue REVERTIDA: el sistema no mide asistencia (SPEC-750), así que
  `NO_ASISTIO_*` es la afirmación de una parte; excluirlo deja al motor de cruce sin su entrada principal
  y a la familia que pagó sin voz. Si aparece un estado donde encuestar no tiene sentido, se pregunta al
  CEO — no se excluye por criterio propio.)*
- **D-3 (HALLAZGO) · [VEREDICTO CEO] Fuente ÚNICA = Diseño; eje de audiencia, sin capa nueva.** Medido:
  (1) `encuestas-preguntas.ts` **sin consumidor** de producción (solo sus candados); (2) el texto legal
  `ENCUESTA-SERVICIO-SESION-v0.1` es **BORRADOR ([ABOGADO] pendiente)**; los `[NORMA]` son de conducta
  (servicio-no-clínico; «Otra» sin texto libre), respetados por Diseño; el módulo declara los labels
  changeables. → Se **actualizan los enunciados+labels del módulo de 753 a Diseño (`d682cdb`)**, con
  **eje de audiencia** en `OpcionPregunta` para el único role-relative (`OTRA_PARTE_NO_CONECTO`). NO se
  agrega segunda capa de copy por-enum (dos juegos de palabras sobre la misma key se separan). La intro y
  el desenlace por voz (no son copy por-enum) viven en el form. *Co-cambio avisado:* el candado
  `encuestas-preguntas.candado.test.ts` (que pinea el texto exacto de v0.1) se actualiza a la redacción de
  Diseño en el MISMO commit, preservando sus invariantes (orden · keys · «Otra» sin campo · fallback).
- **D-4 · [VEREDICTO CEO] 784 cierra 2 de los 3 huecos de 753.** `encuestas-preguntas.ts` (lo importa el
  form) y `encuestas-cita-cruce.service.ts` (lo importa el endpoint) salen de la allowlist en el commit
  del cableado. `estado-efectivo-incidente.ts` **queda** — su consumidor es la lectura del incidente,
  fuera del alcance de 784. **Confirmado.**
- **D-5 · `al-cumplir.ts` y el middleware `+16` de #341 NO se rescatan.** No hay ningún caller en `main`
  (verificado); nada se rompe. → informativo.
- **D-6 · Orden de entrada.** ~~784 dependía de SPEC-751~~ → **anulada por D-7.**
- **D-7 · [Diseño, `439d1c3`] El punto de entrada es una TARJETA/BLOQUE, NO una compuerta.** Cierra el
  riesgo del FR-4 no construyendo la cosa peligrosa: sin gate, no hay exención de protección que mantener.
  La invariante «nunca sobre el reporte» pasa a un **candado de ORDEN** del árbol de render (C-4). **784
  se desacopla de SPEC-751.** La medición del middleware (D-1) mantiene su valor: probó que el gate no
  podía vivir en el Edge, lo que empujó la decisión hacia la página y de ahí a «mejor ninguna compuerta».

---
> **Impacto en arquitectura:** nuevas rutas de UI y un endpoint API (capa 1/2), una derivación pura +
> envoltura de lectura (capa 3), y una regla de gate server-side. No toca el schema (el modelo se lee).
> Cierra dos módulos `hueco-funcional`. Regenerar artefactos de `docs/architecture/` si el barrido lo
> exige y dejar `arch:check` verde en el mismo PR.
