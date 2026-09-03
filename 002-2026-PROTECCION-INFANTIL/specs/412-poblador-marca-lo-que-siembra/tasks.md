# Tareas · SPEC-412 — El poblador que marca lo que siembra

- [x] T001 `scripts/demo/_marcado.ts`: `marcar()` por lotes de 1.000 con `skipDuplicates`, `contarPorEntidad()`, `idsMarcados()`, `ENTIDADES_ORDEN_BORRADO` FK-safe, `CORRIDA_V5`.
- [x] T002 `scripts/demo/_common-v5.ts`: volúmenes, serie de NIT y documentos disjunta de v1/v2, catálogos reusados de `_common`/`_common-v2`/`_common-v4`, generador de `SOL-XXXXXXXX` con la forma real.
- [x] T003 `scripts/demo/poblar-demo-v5.ts`: CLI (dry-run por defecto, `--motivo`, `--confirm`, `--semilla`), guardia de corrida contra `demo_marcado`, chequeo de INTOCABLES, y siembra de colegios · aula · expedientes del padre. Sin un solo `id:` literal.
- [x] T004 `scripts/demo/_poblar-v5-casos.ts`: reportes + `ClasificacionIA` + `AlertaColegio` + `TransicionReporte` + `SolicitudComite`, por lotes, todo marcado en la misma transacción. Incluye reincidencia con cadena, asignación desigual por colegio y geografía completa.
- [x] T004-bis `scripts/demo/_poblar-v5-pagos.ts` (CEO 03-09 16:1x): capa comercial — reusar los `Plan` configurados y crear solo los que falten, `Suscripcion` de colegio y de padre, `Pago` con estados variados, y cuadre `montoRealPagado` = suma de los AUTORIZADO. Con la nota de que producción NO escribe `Pago`.
- [x] T005 `scripts/demo/_borrado-marcado.ts`: `planDeBorrado()` (reporte previo, con el conteo de lo real que no se toca) y `ejecutarBorrado()` en orden FK-safe, exclusivamente por `demo_marcado`, con `AuditLog`.
- [x] T006 `scripts/demo/borrar-demo-marcado.ts`: CLI dry-run por defecto, `--motivo` obligatorio, `--confirm` para escribir. Borra todo lo marcado, del v5 y del retroactivo.
- [x] T007 `scripts/demo/marcar-retroactivo.ts`: inventario tabla por tabla con el prefijo `demo` (cubre las cuatro generaciones de una; un `cuid()` siempre empieza por `c`), contraste contra `modeloUsado LIKE 'demo-seed%'`, escritura en `demo_marcado`. No borra ni modifica producto.
- [x] T008 `scripts/limpieza/reset-piloto.ts`: bandera `--solo-sembrado` que desvía al borrado por marcado. Sin bandera, comportamiento idéntico al de hoy.
- [x] T009 `scripts/demo/demo-v5.test.ts`: candados sin BD — (a) el poblador no contiene `id:` literales; (b) los ids de v1…v4 son **inválidos a propósito** contra `cuidIdSchema`; (c) un `cuid()` real pasa; (d) el orden de borrado cubre toda entidad que el poblador marca; (e) NIT/documentos disjuntos de v1 y v2; (f) `SOL-` con la forma real; (g) sin fechas futuras.
- [x] T010 Gate: `npx tsc --noEmit`, `eslint` de lo tocado, `npm run test:unit` de la spec y de `specs-discipline`.
- [x] T011 Prueba de verdad contra una base propia de desarrollo (`pi_spec412`, creada y destruida para esto — **nunca** producción ni la base de pruebas compartida): sembrar → 30.254 marcas → **abrir un caso del comité por el servicio real** → marcar retroactivo con contraste → borrar → testigos reales intactos. Evidencia en la spec.
- [x] T012 Fila en `specs/README.md` y PR.

## Fuera de esta spec, anotado

- Profesionales de la Red de Apoyo (brief §5): **no se siembran**, orden de Jelkin del 03-09.
- Interruptor de datos de prueba en el Inicio del administrador y separación CARGA/SALUD (brief §3.1, §3.2): spec aparte.
- Ejecutar el borrado en producción: lo dispara el CEO cuando Jelkin autorice y Kimi libere los 9.000 reportes del ejercicio de BI.
