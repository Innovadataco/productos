# Tareas · SPEC-420 — El borrado por lotes

- [x] T001 `enLotes` / `borrarEnLotes` / `contarEnLotes` en `_marcado.ts`, con el techo de PostgreSQL documentado y la lección de la escala.
- [x] T002 Barrido de las 18 entidades: lotear `deleteMany`, `updateMany` y `findMany` del camino de borrado.
- [x] T003 Lotear también los `count` del reporte previo — corre en dry-run y gasta parámetros igual.
- [x] T004 Sacar el `notIn` del conteo de lo real → `LEFT JOIN demo_marcado`, cero parámetros.
- [x] T005 INTOCABLES de `Usuario`: preguntar por los 2 correos, no por los N ids.
- [x] T006 Convención `t` + candado estático con contraprueba.
- [x] T007 `scripts/demo/lotes.test.ts` (13): lote vs techo real, reparto, suma, orden, vacío, candado.
- [x] T008 **Prueba a escala**: 40.000 marcas (>32.767) → plan y borrado OK; segunda corrida a 80.000.
- [x] T009 **Prueba negativa**: revertir el lote → error idéntico al de producción, y otra vez sin borrar nada.
- [x] T010 Gate + fila en `specs/README.md` + PR.

## Anotado

- El marcado retroactivo NO se toca: ya iba por lotes y funcionó. Estado actual «marcado, sin borrar».
- `scripts/demo/borrar-demo.ts` (v1, por prefijo) tiene la misma clase de riesgo en `alertaIds`. Fuera de alcance.
