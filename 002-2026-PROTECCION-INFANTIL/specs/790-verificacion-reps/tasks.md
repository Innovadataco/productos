# Tasks · SPEC-790 · Verificar el REPS (MOTOR)

> **PARÁ en §4.** La implementación espera aprobación del CEO (D-1..D-5). El modelo de datos espera el
> veredicto de D-1 (¿yo o Datos?). Nada marcado salvo el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: barrido del «habilitado» interno (falso amigo), modelo propuesto
  (`VerificacionReps`), derivación `repsAlDia`, compuerta, revisión periódica, INACTIVO, candados, D-1..D-5. **PARÁ.**

## Prerrequisito (hallazgo del CEO 30-09 — cerrado)
- [x] **T0b** · `facetas()` pasa por `whereDirectorioPublico` + filtro autoritativo (era el 4º consumidor y
  copiaba el predicado a mano, sin vigencia → ya filtraba hoy). Candado estructural D-8
  (`perfil-profesional-activo-solo-en-builder`: `"ACTIVO"` propiedad del builder) + vigencia extendida a las
  CUATRO lecturas. `4162883d9`. Así el gate REPS que entre al builder lo hereda sin tocar `facetas`.

## Modelo (Datos · #781 `work/pi-SPEC-790-modelo-verificacion-reps`) — LEÍDO, aún no en mi rama
`VerificacionReps` append-only · `verificadoEn` TIMESTAMPTZ NOT NULL inmutable por TRIGGER · FK
`profesionalId` **RESTRICT** (la fila-prueba sobrevive a la baja) · actor durable en `verificadoPorSnapshot`
(no solo el FK SetNull) · `@@index([profesionalId, verificadoEn DESC])` (consulta caliente) · CHECK
`VIGENTE ⟹ vigenteHasta NOT NULL`. Enums: `EstadoReps`{VIGENTE·VENCIDA·NO_ENCONTRADA·SIN_VERIFICAR} ·
**`ModalidadReps`{PRESENCIAL·TELEMEDICINA}** (eje de la AUTORIDAD; TELEMEDICINA≡VIRTUAL de la cita) ·
`FuenteVerificacionReps`{API·ARCHIVO·MANUAL_ADMIN}. Estado DERIVADO de la última fila (sin columna mutable).

## Tras aprobación §4
- [x] **T1** · Modelo `VerificacionReps` + enums + migración — **CARRIL DE DATOS, HECHO** (#781, `7bb97d902`; candado 10/10 BD fresca). Rebaso cuando entre a main.
- [x] **T2** · `repsElegible` (pura) + candado C-1/C-2/D-5/D-7 (dos relojes, cutover, modalidad; control positivo). `d2d97d7bf` · eje de modalidad corregido a `ModalidadReps` `b5792c24d`.
- [x] **T3** · Adaptador `consultarReps`/`ingestarDatasetReps` (interfaz + stub NUNCA-VIGENTE) + candado (D-2). `ec853e6bd`. hueco-funcional.
- [x] **T4** · Gate REPS en las 4 lecturas (hereda el booking por el chokepoint `obtenerPublicoPorId`). `1dce2a5f5` (sobre el merge `f8a1077cc`).
  - [x] Traducción cita→REPS (`modalidad-cita-a-reps.ts`), fail-closed + registrado. `6b7dac828`.
  - [x] Barrido D-8 de booking + `it.fails`→`it` al cablear (vitest lo exigió). `6b7dac828`→`1dce2a5f5`.
  - [x] Post-filtro Node `idsHabilitadosVigenciaYReps`→`idsRepsElegibles` (última fila por profesional, map→`HechoReps`, `repsElegible`); reemplaza la llamada directa a `idsConVigenciaAutoritativa` en las 4 lecturas. NO cláusula SQL (vaciaría el directorio).
  - [x] Cutover-aware: `SIN_VERIFICAR` PASA con `reps.exigir_reps_verificado=false` (sembrado); `VENCIDA`/`NO_ENCONTRADA` cierran siempre. `ventana=365` param. Candado de conducta (gate) + paridad mirror↔enum Prisma.
  - [ ] **T4b (follow-up, hoy LATENTE)**: la modalidad concreta al RESERVAR (D-5). El directorio usa `modalidad=null` (vigencia manda); crearSolicitudCita aún NO exige que el REPS cubra la modalidad de la cita. Sin filas VIGENTE con modalidad restringida (universo SIN_VERIFICAR) no muerde; entra cuando T6 permita cargar VIGENTE con modalidades. Usa `modalidadRepsRequerida` (ya hecho) en crearSolicitudCita.
- [ ] **T6 · Superficie de verificación MANUAL_ADMIN** (NUEVO · decisión CEO 30-09 21:1x). **Por qué entró:**
  con solo el stub (siempre `SIN_VERIFICAR`), ningún profesional llega a «caducada» (necesita
  `VENCIDA`/`NO_ENCONTRADA`) NI puede re-habilitarse (necesita una `VIGENTE` fresca) → 790 entregaría motor +
  compuerta + aviso + pantalla admin y **ninguna forma de producir el dato**: no es `hueco-funcional`, es una
  SPEC que no funciona. Es la ÚNICA fuente que no depende del formato del dataset (que Estrategia no fijó).
  Un formulario de admin que registra una verificación con `resultado` + `vigenteHasta` + `modalidades`
  (`fuente=MANUAL_ADMIN`). DOS condiciones DURAS:
  - **(1) Actor durable:** quién cargó la verificación va al SNAPSHOT (`verificadoPorSnapshot`), no solo al FK
    (SetNull se vacía). Datos ya lo modeló así — respetarlo. Es la pantalla que ENCIENDE la compuerta de todo
    el producto: el registro del hecho pesa más que la comodidad.
  - **(2) Sin atajos · compuerta de código ANTES del CHECK:** nada de «marcar vigente» sin `vigenteHasta` —
    el CHECK `VIGENTE⟹vigenteHasta NOT NULL` lo rechaza y el usuario recibiría el error CRUDO de la base.
    Validar en el servicio antes de insertar (Prisma es ciego al CHECK). Modalidades = `ModalidadReps` directo
    (el admin elige el eje de la autoridad; NO pasa por el mapeo cita→REPS).
  - Espera el modelo en mi rama (escribe `VerificacionReps`). ¿FORMA de Diseño para el visual, o form funcional? — pregunto al CEO al llegar.
- [ ] **T7** · INACTIVO → reubicar (reasignar las confirmadas a un habilitado; el eje es HABILITACIÓN —
  REPS al día + ACTIVO—, no carga/hora) + sube al admin a QUIÉN; empty-state («sin candidatos») de PRIMERA
  CLASE (es el caso normal hoy); candado C-3. (Retroactividad: solo registrar la causal — D-6.) Reusa el
  chokepoint + el mapeo de ejes (contraste de formas, 30-09).
- [ ] **T5** · Recorredor periódico idempotente + candado C-4 (hecho con fecha). **FUTURO** — depende del
  formato del dataset del Estado (Estrategia). La carga MANUAL (T6) es lo que vuelve ejercitable el presente.
- [ ] **T8** · Gate: `tsc` · `lint` · candados · `arch:check` · `specs-discipline`.

## Condición del INGESTOR real (T5 · no construir ahora, dejar escrito — pedido del CEO)
Hoy el no-mapeo de modalidad (cita→REPS) se registra con un `warn` ruidoso. **Un warn en logs nadie lo
mira.** Cuando se cablee el ingestor real del dataset del Estado, la modalidad que NO mapeamos tiene que
quedar EN LA FILA del hecho (`VerificacionReps`), no solo en el log — un profesional habilitado bajo un
nombre que no traducimos cae del directorio EN SILENCIO y el log no se lo cuenta a nadie. El `warn` sirve
para el gate (entrada puntual), no para la ingesta en bloque.

## Fuera de alcance
A vs B (Jelkin+abogado, Paso 0) · consentimiento de sesión (P-3) · historia clínica (P-2) · empaquetado
de planes (791) · el **aviso al profesional** (copy/forma = Diseño; FORMA-SPEC790 ya radicada) · la **vista
de la familia** (Estrategia, decisión de Jelkin sin tomar). **DENTRO (nuevo 30-09):** la superficie de
verificación MANUAL_ADMIN (T6) y la pantalla admin de reubicación (T7) — su FORMA la da Diseño
(FORMA-SPEC790 reubicar ya radicada); el MECANISMO + la compuerta de datos los construyo yo.
