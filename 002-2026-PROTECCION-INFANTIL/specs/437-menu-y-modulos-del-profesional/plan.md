# Plan · SPEC-437 — El profesional trabaja con menú lateral

## Análisis en fuente (antes de construir)

| Archivo | Qué se sacó |
|---|---|
| `find src/app -path "*profesional*" -name page.tsx` | **Solo 3 pantallas del profesional existen.** El radicado pide 6 ítems y prohíbe pintar pantallas muertas: contradicción real, escalada al CEO con tres opciones. |
| `AdminNav.tsx:29-35` | La mecánica del operador: `permitidos.has(l.modulo) && esDestinoPermitidoPorRol(rol, l.href)` — doble portón D-41. Es lo que hay que reusar, no imitar. |
| `dashboard/admin/layout.tsx` | El patrón de layout: UI pura, **sin `redirect`** (SPEC-287); los guardianes viven en `middleware.ts`. |
| `nav-items.ts:133` | `PROFESIONAL_NAV_ITEMS` **sin consumidores**, y sin `modulo`. |
| `NavHeader.tsx:271` | Los dos enlaces del profesional **quemados**, y sin el «Panel» que la constante declaraba. |
| `nav-items.test.ts:80` | La auditoría menú↔catálogo **no cubría** el menú del profesional. |
| `PanelProfesional.tsx` | Los bloques `Solicitudes`, `CasosPorCerrar`, `CitasConfirmadas`, `PorCobrar` ya existen: «Citaciones» y «Casos» los **reusan**, no los copian. |
| `panel.service.ts:145` | `nombreVisible` es el campo libre que produce «Hola, ¡Hola!». `Usuario.nombre` es el dato de identidad. |

## Decisiones

- **Manda el candado I-299 sobre la lista de seis.** «Calendario» no se pinta hasta que SPEC-447 exista; su módulo sí se siembra.
- **Reusar `AdminNav`**, no clonarlo: un menú paralelo se desincroniza el día que alguien cambie el filtrado en uno solo.
- **Layout también en `/perfil-profesional`**: dos de los cinco ítems viven ahí.
- **`PROFESIONAL_NAV_ITEMS` como fuente única** de barra y desplegable, en vez de arreglar el header por su lado.
- **Exportar los bloques del panel** en vez de duplicar su marcado en las pantallas nuevas.
- **No tocar la ficha** (`nombreVisible`, su etiqueta y su tope): es la pantalla de SPEC-434, de Dev 01, y todavía fuera de main. Extender su candado de voz desde acá era conflicto garantizado en la ola de rebase.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que un ítem prometa una pantalla que no existe | Candado que verifica `page.tsx` **en disco** por cada ítem. Probado muriendo. |
| Que se cuele un ítem de otro actor (I-299) | Candado contra los menús de admin, colegio y padre + verificación de prefijo de área. |
| Que la barra y el desplegable vuelvan a divergir | Los dos leen la misma constante, y hay candado de que el header **no** tenga hrefs del profesional quemados. |
| Que se olvide pintar «Calendario» cuando 447 entre | `profesional_calendario` está en `SIN_PANTALLA_PROPIA` y el test se pone **rojo si la justificación sobra**. |
| Que el saludo vuelva a repetir «Hola» | Función pura con candados sobre el valor REAL que reportó Jelkin, no uno inventado. |
