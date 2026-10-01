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
- [ ] **T4** · Compuerta REPS en las 4 lecturas + creación de cita. **Espera rebasar el modelo a esta rama.** Plan:
  - Post-filtro Node `idsRepsElegibles(perfilIds, modalidadRequerida, now, config, db)` (análogo a `idsConVigenciaAutoritativa`): última fila por profesional (`orderBy verificadoEn desc`), map→`HechoReps`, `repsElegible`. El gate vive en el carril del builder para que lo hereden las 4 lecturas.
  - **CUIDADO (medido por el CEO): hoy SIN_VERIFICAR es el universo** (51 colegios TODOS sembrados, 0 profesionales con REPS). Un pre-filtro SQL grueso `some(VIGENTE)` VACIARÍA el directorio al arrancar → el gate debe ser cutover-aware: con `EXIGIR_REPS_VERIFICADO=false`, SIN_VERIFICAR PASA. Ships `false`.
  - Candado de PARIDAD mirror↔enum Prisma (`ESTADOS_REPS`/`MODALIDADES_REPS` ≡ `EstadoReps`/`ModalidadReps`), o importar el type y soltar el mirror.
  - Barrido de rutas de booking (D-8 árbol): reasignar/reprogramar/reubicación pasan por la elegibilidad.
- [ ] **T5** · Recorredor periódico idempotente + candado C-4 (hecho con fecha).
- [ ] **T6** · INACTIVO → reubicar (reasignar las confirmadas a un habilitado; el asignador con el eje de
  HABILITACIÓN, no carga/hora) + sube al admin a QUIÉN; candado C-3. (Retroactividad: solo registrar la
  causal, no modelarla como resuelta — D-6.)
- [ ] **T7** · Gate: `tsc` · `lint` · candados · `arch:check` · `specs-discipline`.

## Fuera de alcance
A vs B (Jelkin+abogado, Paso 0) · consentimiento de sesión (P-3) · historia clínica (P-2) · empaquetado
de planes (791) · las SUPERFICIES (aviso al profesional = Diseño; vista de la familia = Estrategia).
