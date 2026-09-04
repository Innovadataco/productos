# Tareas · SPEC-403 — La comisión de la red es un parámetro

- [x] T001 `ParametroSistema` `comision.porcentaje` = 10, INTEGER, **`update: {}`** para no pisar el valor del admin.
- [x] T002 `obtenerPorcentajeServicio()` en `comision.ts`: lee el parámetro, valida entero 0-100 y **falla en cerrado** si no está.
- [x] T003 `api/padre/citas` y el panel del profesional leen de ahí; se elimina la constante.
- [x] T004 El panel sigue prefiriendo el porcentaje **guardado en la solicitud** — lo ya cobrado no se reescribe.
- [x] T005 9 candados estáticos: nadie quema el número (con contraprueba), los dos consumidores leen el mismo parámetro, el seed usa `update: {}`, y el redondeo es el del cobro.
- [x] T006 3 tests de integración: porcentaje vigente, cambio en vivo sin desplegar, y fallo en cerrado sin el parámetro.
- [x] T007 **Seed corrido de verdad**: base limpia → 10; admin lo pone en 12 y re-siembra → sigue en 12.
- [x] T008 Gate + fila en `specs/README.md` + PR.

## Anotado

- **Construida sobre SPEC-425** (#330, ya en `main`): ahí nació `comision.ts`. El PR sale rebasado contra `main`.
- **Cambio de precio al desplegar**: en producción el parámetro no existe; el seed lo crea en 10 y el padre pasa de pagar 15 % a 10 %. Las solicitudes ya creadas conservan el suyo.
