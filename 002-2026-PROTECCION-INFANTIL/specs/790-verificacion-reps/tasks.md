# Tasks · SPEC-790 · Verificar el REPS (MOTOR)

> **PARÁ en §4.** La implementación espera aprobación del CEO (D-1..D-5). El modelo de datos espera el
> veredicto de D-1 (¿yo o Datos?). Nada marcado salvo el diseño.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: barrido del «habilitado» interno (falso amigo), modelo propuesto
  (`VerificacionReps`), derivación `repsAlDia`, compuerta, revisión periódica, INACTIVO, candados, D-1..D-5. **PARÁ.**

## Tras aprobación §4
- [ ] **T1** · Modelo `VerificacionReps` + `enum EstadoReps` + migración aditiva (D-1; revisión D-121 de Datos).
- [ ] **T2** · `repsAlDia` (pura) + candado C-2 (caducidad, control positivo).
- [ ] **T3** · Adaptador `consultarReps`/`ingestarDatasetReps` (interfaz + stub) (D-2).
- [ ] **T4** · Compuerta en directorio + creación de cita (`estado` y `repsAlDia` separados) + candado C-1 (falso amigo).
- [ ] **T5** · Recorredor periódico idempotente + candado C-4 (hecho con fecha).
- [ ] **T6** · INACTIVO no cancela confirmadas + candado C-3.
- [ ] **T7** · Gate: `tsc` · `lint` · candados · `arch:check` · `specs-discipline`.

## Fuera de alcance
A vs B (Jelkin+abogado, Paso 0) · consentimiento de sesión (P-3) · historia clínica (P-2) · empaquetado
de planes (791) · las SUPERFICIES (aviso al profesional = Diseño; vista de la familia = Estrategia).
