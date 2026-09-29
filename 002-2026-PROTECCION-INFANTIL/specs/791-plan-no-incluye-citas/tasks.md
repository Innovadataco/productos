# Tasks · SPEC-791 · Ningún plan puede incluir citas

- [x] **T0** · Barrido medido: sin campo/relación/camino de citas en `Plan`/`Suscripcion`;
  `usosMaximosPorCliente` = freemium (falso amigo verificado); prod medido 29-09-2026 (CEO/SSH): 11
  planes, ninguno menciona consultas/citas/sesiones.
- [x] **T1** · Candado `plan-sin-citas-incluidas.candado.test.ts` (morfología sobre el schema real,
  control positivo por mutación + negativo), registrado en el manifiesto unit.
- [x] **T2** · El porqué escrito junto al candado y como comentario `//` en el modelo `Plan`.
- [x] **T3** · Frontera declarada en spec §4: el texto libre `nombre`/`descripcion` NO se cubre acá
  (autoría + detector blando del CEO, no validación de código).
- [x] **T4** · Gate: `tsc` + `lint` + candado + `arch:check` + `specs-discipline` verdes.
- [ ] **T5** · Merge (lo hace el CEO cuando pase la compuerta).

## Fuera de alcance
REPS (SPEC-790) · precios/planes comerciales (Jelkin) · pago de la cita · detector blando de texto (CEO)
· los 5 planes `activo=false` con «(precio placeholder)» en descripción (lo anota el CEO; no es de esta spec).
