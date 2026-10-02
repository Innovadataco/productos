# Tasks · SPEC-857

## Fase 1 · Dato
- [x] T001 `nav-items.ts`: `NavItem.modulo` opcional + `encabezado?`; `aplanarNavItems`.
- [x] T002 `nav-items.ts`: reescribir `ADMIN_NAV_ITEMS` al árbol de 2 niveles (9 módulos + 2 encabezados + hojas; Pagos=9, Estadísticas=4, 3 drops).
- [x] T003 `nav-items.ts`: `PRINCIPALES_MOVIL.ADMIN` → `/dashboard/admin/estadisticas/operacion`.

## Fase 2 · Resolver
- [x] T004 `nav/para-rol.ts`: `NavEntry.esEncabezado`; `desnudar` pasa encabezado.
- [x] T005 `porModuloYProxy`: compuerta de grupo por HIJOS; paso de encabezados con supresión de huérfanos; guardas de módulo opcional.
- [x] T006 `aplanar` + `navMovilParaRol.resto`: omiten encabezados; default móvil dedupe por ícono.

## Fase 3 · Lateral
- [x] T007 `NavLateral.tsx`: `EncabezadoLateral` (no clicable).
- [x] T008 `GrupoLateral`: colapso por familia (admin colapsado + abrir-en-activo) + ámbar de Pagos (grupo + hijos).
- [x] T009 `NavLateral`: activo por prefijo-más-largo (hojas anidadas).

## Fase 4 · Íconos
- [x] T010 `IconoNav.tsx`: 8 claves de grupo (reusan componentes); retiro de entradas de ex-raíces/hijos; borrado de 5 componentes sin uso.

## Fase 5 · Consumidores + arch
- [x] T011 `admin/page.tsx`: redirect con `aplanarNavItems`.
- [x] T012 `scripts/arch/lib/nav-fuentes.ts`: `arraysNav` aplana ADMIN; guardas de módulo opcional en aserción B y generador.
- [x] T013 `ComiteSubNav.tsx`: guarda de módulo opcional.

## Fase 6 · Candados
- [x] T014 `nav-items.test.ts`: excluir encabezados; sacar `audit_logs`+`guias_accion_admin`+`estadisticas_salud_motor` de SIN_PANTALLA_PROPIA.
- [x] T015 `nav-iconos.candado`: excluir encabezados de hojas/barra.
- [x] T016 `nav-lateral.candado`: Comité subruta (hijo «Gestión») + Pagos ámbar (hijo activo).
- [x] T017 `nav/para-rol.test.ts`: estructura 2 niveles + default móvil dedupe + principal `/operacion`.
- [x] T017b `nav/para-rol.test.ts`: CANDADO inverso (revisión adversarial CEO) — un grupo pinta un hijo divergente aunque el rol no tenga el módulo representativo del grupo (gate por hijos; muere por mutación).

## Fase 7 · Gate
- [x] T018 `tsc`, `lint`, candados nav (unit + integración), `arch:check` verdes.
- [ ] T019 `test:unit` (job completo) + `build` verdes.
- [ ] T020 Recorrido en vivo + certificación de Diseño contra ec4910a.
