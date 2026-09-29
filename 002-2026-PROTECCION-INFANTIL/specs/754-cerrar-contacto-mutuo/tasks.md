# Tasks — SPEC-754

> Compuerta §4 primero: PARO tras spec+plan para aprobación del CEO. Implementación DESPUÉS.
> Deploy: NO antes que SPEC-752 (dependencia de orden).

## Fase §4 — DISEÑO (este entregable)
- [x] T001 spec.md (contexto, FR, candados, decisión D-1, dependencia de orden).
- [x] T002 plan.md (voltear la fuente + retirar reembolso + superficies + candado + orden).
- [ ] T003 **PARO** · aprobación del CEO + copy de Diseño para las superficies.

## Fase implementación (tras aprobación)
- [ ] T004 `contactoVisiblePorSesion` → `false` + doc actualizado (destino llegó; canal = enlace + PQR).
- [ ] T005 `debeExponerContacto`: retirar la rama de reembolso con comentario de DECISIÓN (D-1, migra a 752 · motivo 2).
- [ ] T006 Superficies `EsperaCitaPanel` / `Paneles`: quitar el bloque de contacto muerto; copy nuevo = Diseño (si algo queda falso, PARO).
- [ ] T007 Actualizar tests a la conducta CERRADA (`contacto-visible.test.ts`, `dto.test.ts`) + confirmar candado `contacto-fuente-unica` (3 superficies, dato real, ambos controles).
- [ ] T008 Gates: `test:unit` completo + tsc + eslint + arch:check.

## Cierre (lo exige el CEO)
- [ ] T009 Deploy SOLO después de 752 (dependencia de orden).
