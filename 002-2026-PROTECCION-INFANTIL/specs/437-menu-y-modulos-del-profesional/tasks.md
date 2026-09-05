# Tareas · SPEC-437 — El profesional trabaja con menú lateral

- [x] T001 Leer en fuente y escalar la contradicción del radicado (6 ítems vs. prohibición de pintar pantallas muertas; solo existían 3). El CEO fijó **opción B**.
- [x] T002 Seis módulos `profesional_*` en `CATALOGO_MODULOS` + grants al rol PROFESIONAL en el seed.
- [x] T003 `PROFESIONAL_NAV_ITEMS` pasa a `NavItem[]` con módulo por ítem y se vuelve **fuente única** de la barra y del desplegable (era un export muerto).
- [x] T004 `AdminNav` sirve también a PROFESIONAL, con el mismo filtrado por módulo. Iconos y título propios; la raíz no activa con sus subrutas.
- [x] T005 Layout con barra lateral en `/dashboard/profesional` **y** en `/perfil-profesional`.
- [x] T006 «Citaciones» y «Casos» como pantallas propias, reusando los bloques exportados del panel y `panel.service`.
- [x] T007 El menú del profesional entra a la auditoría menú↔catálogo, que no lo cubría.
- [x] T008 Punto 3: cada estado vacío en una línea corta; los párrafos se eliminan.
- [x] T009 Punto 4: fuera el voseo del panel (los siete que lista el radicado) + candado de voz junto a los de SPEC-425.
- [x] T010 Punto 5: el saludo sale del nombre de la cuenta; `nombreVisible` solo si **parece un nombre**; si no, «Hola» a secas.
- [x] T011 Probar los candados muriendo: pintar Calendario sin pantalla + ítem ajeno → 4 rojos; devolver un «Tenés» o alargar un vacío → 2; quitar el filtro de signos de frase → 3.
- [x] T012 Gate: `tsc`, lint, `arch:check`, `tokens:check`, unit, integración de lo tocado, artefactos de arquitectura y `specs/README.md`.
- [ ] T013 **Cuando SPEC-447 entre a main:** agregar «Calendario» a `PROFESIONAL_NAV_ITEMS` y **borrar** `profesional_calendario` de `SIN_PANTALLA_PROPIA` en `nav-items.test.ts`. El test se pone rojo si la justificación sobra, así que avisa solo.

## Anotado

- **Renombrar y acotar «Cómo querés que te vean» es de SPEC-434** (Dev 01), que ya toca esa pantalla. Este PR sostiene el panel aunque el campo siga trayendo prosa.
- **El padre alcanza `/dashboard/profesional/*`** en la puerta: preexistente, radicado por el CEO como **I-312** sobre SPEC-426. No es de acá.
