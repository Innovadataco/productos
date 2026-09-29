# Tasks — SPEC-754

> Compuerta §4 primero: PARO tras spec+plan para aprobación del CEO. Implementación DESPUÉS.
> Deploy: NO antes que SPEC-752 (dependencia de orden).

## Fase §4 — DISEÑO (este entregable)
- [x] T001 spec.md (contexto, FR, candados, decisión D-1, dependencia de orden).
- [x] T002 plan.md (voltear la fuente + retirar reembolso + superficies + candado + orden).
- [x] T003 §4 APROBADO por el CEO (con la corrección del candado de VALOR + guard EJERCITADO). Copy de Diseño para las superficies = PENDIENTE (ver T006).

## Fase implementación (tras aprobación)
- [x] T004 `contactoVisiblePorSesion` → `false` + doc actualizado (destino llegó; canal = enlace + PQR).
- [x] T005 `debeExponerContacto`: retirar la rama de reembolso con comentario de DECISIÓN (D-1, migra a 752 · motivo 2); `now`→`_now`.
- [~] T006 Superficies `EsperaCitaPanel` / `Paneles`: bloque de contacto muerto RETIRADO + comentarios stale corregidos + MARCADOR dejado. **Copy nuevo = Diseño (commit al sistema de diseño) — PENDIENTE; no se inventa texto.**
- [x] T007 Tests a la conducta CERRADA: `contacto-visible.test.ts` (VALOR: `false` en todo estado) + `dto.test.ts` (cerrado) + candado `contacto-fuente-unica` con el GUARD SUBSUMIDO EJERCITADO (fuente `true` + perfil VENCIDO ⇒ ausente; verificado por mutación: quitar el guard rompe SOLO ese caso).
- [x] T008 Gates: `test:unit` completo (419 archivos / 3224 tests) + tsc + eslint (0 errores) + arch:check (VERDE).

## Cierre (lo exige el CEO)
- [ ] T009 Deploy SOLO después de 752 (dependencia de orden).
