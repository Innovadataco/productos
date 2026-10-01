# Tasks · SPEC-793 · allowlist de proveedores del enlace

- [x] **T0** · Medición: `validarEnlaceReunion` sin allowlist en main; enlaces publicados = 0 (test DB;
  prod 0 por radicado).
- [x] **T1** · `enlace-validacion.ts`: `ProveedorEnlace` + `PROVEEDORES_APROBADOS` (propuesta pendiente,
  todos `aprobado:false`, cada uno con su porqué) + `hostPerteneceADominio` (no «contiene») +
  `esProveedorAprobado` + `validarEnlaceReunion` con allowlist, inyectable.
- [x] **T2** · `publicarEnlaceSesion(params, proveedores?)` pasa la lista a la validación (servidor).
- [x] **T3** · Candado unit content-independent `enlace-proveedor-aprobado.candado.test.ts` (mecanismo,
  look-alike, subdominio, pendiente-no-cuenta, forma de la lista real), registrado en el manifiesto.
- [x] **T4** · Candado integración `enlace-allowlist-servidor.candado.test.ts` (validación de servidor por
  `publicarEnlaceSesion`: fail-closed + control positivo + look-alike).
- [x] **T5** · Hallazgo: 2 tests de 750 (`enlace-sesion.test.ts`, `sesion-operador` C-c) inyectan un
  proveedor de prueba para su host; invariante original preservada.
- [x] **T6** · Gate: `tsc` + `lint` + candados + `arch:check` + `specs-discipline`.
- [ ] **T7** · Merge (CEO, cuando pase la compuerta). El CONTENIDO de la lista lo aprueba Jelkin+abogado
  en un PR posterior.

## Fuera de alcance
Elegir cuáles proveedores (Jelkin+abogado) · grabación/presencia (no los tenemos) · caducidad del enlace (750).
