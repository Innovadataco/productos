# Tasks · SPEC-858

- [x] T001 `nav-items.ts`: `labelCorto: "Comité"` en `/dashboard/admin/comite` (hijo del grupo Comité de Convivencia).
- [x] T002 `nav-items.ts`: `labelCorto: "Cifras"` en `/dashboard/admin/estadisticas/operacion`.
- [x] T003 `para-rol.test.ts`: candado — etiqueta móvil mostrada (`labelCorto ?? label`) distinta por rol + control positivo ADMIN («Inicio · Bandeja · Comité · Cifras»); muere por mutación.
- [x] T004 `para-rol.test.ts`: actualizar aserción del principal de Estadísticas (antes labelCorto undefined, ahora «Cifras»).
- [x] T005 Verificación: candados de render (nav-lateral/nav-movil/role-visibility/nav-iconos) verdes → escritorio intacto.
- [ ] T006 Gate completo (tsc/lint/test:unit/build/arch:check) + CI verde.
- [ ] T007 Diseño re-certifica el móvil contra el commit nuevo.
