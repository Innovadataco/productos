# Tasks · SPEC-371 · poblador demo v3

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

- [x] T001 Leer v1/v2 y el modelo (candado 15v5): `comiteColegioId @unique`, `SolicitudComite.reporteId` / `alertaColegioId @unique`, flujo real escalar/resolver, convenciones de `TransicionReporte`
- [x] T002 `_common-v3`: prefijo `demo3-`, ids deterministas, `cadenaParaEstado`, `fechasEscalonadas`, fracciones desiguales (promedio 0.70)
- [x] T003 `poblar-demo-v3`: operarios (top-5 colegios demo × comité v1), transiciones, solicitudes; dry-run por defecto, `--confirm` para escribir
- [x] T004 Foto de alertas reales antes/después con abort si cambia; `where` con marca de id + colegio en cada UPDATE
- [x] T005 `borrar-demo-v3`: `gestionada` → `escalada` por solicitudes propias, borrar `demo3-`, asignaciones a NULL
- [x] T006 Tests unitarios (9) y registro en `vitest.unit.includes.ts`
- [x] T007 Sandbox dev: `--confirm` ×2 (la segunda escribe 0), sin fechas futuras, `borrar` → baseline idéntico, reales intactas
- [x] T008 Docs: spec / plan / tasks + fila en `specs/README.md`
- [ ] T009 Ejecutar en prod cuando el CEO autorice: dry-run → `--confirm` → verificación (CEO)
