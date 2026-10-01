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

## Tras aprobación §4
- [ ] **T1** · Modelo `VerificacionReps` + `enum EstadoReps` + migración aditiva (D-1; CARRIL DE DATOS; construyo contra el contrato).
- [x] **T2** · `repsElegible` (pura) + candado C-1/C-2/D-5/D-7 (dos relojes, cutover, modalidad; control positivo). `d2d97d7bf`.
- [x] **T3** · Adaptador `consultarReps`/`ingestarDatasetReps` (interfaz + stub NUNCA-VIGENTE) + candado (D-2). `ec853e6bd`. hueco-funcional.
- [ ] **T4** · Compuerta en `whereDirectorioPublico` (`estado` y `repsAlDia` SEPARADOS) — la heredan las 4 lecturas + creación de cita. Candado C-1 ya puesto; barrido de rutas de booking. **Espera el modelo de Datos (T1).**
- [ ] **T5** · Recorredor periódico idempotente + candado C-4 (hecho con fecha).
- [ ] **T6** · INACTIVO → reubicar (reasignar las confirmadas a un habilitado; el asignador con el eje de
  HABILITACIÓN, no carga/hora) + sube al admin a QUIÉN; candado C-3. (Retroactividad: solo registrar la
  causal, no modelarla como resuelta — D-6.)
- [ ] **T7** · Gate: `tsc` · `lint` · candados · `arch:check` · `specs-discipline`.

## Fuera de alcance
A vs B (Jelkin+abogado, Paso 0) · consentimiento de sesión (P-3) · historia clínica (P-2) · empaquetado
de planes (791) · las SUPERFICIES (aviso al profesional = Diseño; vista de la familia = Estrategia).
