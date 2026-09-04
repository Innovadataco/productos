# SPEC-437 · El profesional trabaja con menú lateral, como el operador

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: Jelkin en vivo, entrando como psicólogo tras aprobar su verificación

**Impacto en arquitectura:** seis módulos nuevos en el catálogo (categoría `profesional`) y dos layouts. `AdminNav` pasa a servir también al rol PROFESIONAL — **el mismo componente, no uno paralelo**. Sin migración: los módulos son filas de catálogo que siembra el seed.

---

## La contradicción del radicado, y cómo se resolvió

El radicado pide **seis ítems** de menú y, en la misma sección, prohíbe **«ningún ítem que lleve a una pantalla que no existe»** (candado I-299).

Al leer la fuente antes de construir, solo existían **tres** pantallas del profesional: `/dashboard/profesional`, `/perfil-profesional/completar` y `/perfil-profesional/verificacion`. «Citaciones» y «Casos» vivían como bloques dentro del panel; «Calendario» **no existía en ninguna parte**.

**Manda el candado, no la lista de seis** (veredicto del CEO, 04-09 14:12 · opción B):

| Ítem | Qué se hizo |
|---|---|
| **Inicio** | Ya existía. |
| **Citaciones** | **Pantalla nueva**, reusando los bloques del Inicio. |
| **Casos** | **Pantalla nueva**, reusando los bloques del Inicio. |
| **Calendario** | **No se pinta.** Su pantalla la construye SPEC-447; su **módulo sí queda sembrado**. |
| **Mi ficha** | Ya existía. |
| **Verificación** | Ya existía. |

> **Módulo y pantalla son cosas distintas.** `profesional_calendario` se siembra para que el permiso se pueda conceder; el menú pinta solo lo que además tiene `page.tsx`. Tener el permiso sin pantalla no pinta nada, y tener la pantalla sin permiso tampoco. Los dos hacen falta.

---

## 1 · La barra lateral, con la mecánica del operador

Jelkin, textual: *«debe aparecer sus módulos, debemos utilizar la misma lógica de operador»*.

Se reusa **`AdminNav`** —el mismo componente— con su doble portón de siempre (D-41): **módulo concedido en BD ∧ predicado del proxy**. No hay un menú paralelo hecho aparte.

El layout va en **dos** sitios: `/dashboard/profesional` y `/perfil-profesional`. Estas dos últimas pantallas viven fuera del área por historia (SPEC-391), pero son del mismo actor y aparecen en su menú: sin el segundo layout, el profesional **perdía la barra justo al entrar a dos de sus cinco ítems**, y media queja resuelta es una queja viva.

## 2 · Un tercer export muerto

`PROFESIONAL_NAV_ITEMS` **no tenía un solo consumidor**. `NavHeader` llevaba los dos enlaces del profesional **quemados aparte**, y ni siquiera coincidían con esa constante: la lista declaraba un «Panel» que el encabezado nunca pintó.

Ahora es la **fuente única** de la barra lateral y del desplegable: dos menús del mismo actor ya no pueden decir cosas distintas. Y con módulos por ítem, el menú del profesional **entra por primera vez a la auditoría menú↔catálogo** (`nav-items.test.ts`), que no lo cubría precisamente porque no tenía módulos.

## 3 · Menos prosa · 4 · Sin voseo · 5 · El saludo

- **Cada estado vacío pasa a una línea corta.** La explicación se **elimina**; no se muda a un tooltip ni a un pie, como pidió Jelkin.
- **Fuera el voseo del panel**, que había quedado afuera de SPEC-434: «No tenés», «Vos ponés», «Podés cambiarla», «cuando confirmes», «sepas cuáles te faltan», «Te avisamos», «Volvé a enviarlo».
- **«Hola, ¡Hola!» arreglado en su causa.** El panel hacía `nombreVisible.split(" ")[0]`, y ese campo se pide con la etiqueta «Cómo querés que te vean», que induce a escribir una presentación: el valor real empezaba con «¡Hola!». Ahora el saludo sale del **nombre de la cuenta** y solo cae al campo libre si **parece un nombre** (sin signos de frase, sin dígitos, ≤4 palabras, ≤40 caracteres). Si nada sirve, saluda **«Hola»** a secas: equivocarse hacia eso no cuesta nada; hacia «Hola, ¡Hola!» cuesta la credibilidad de la pantalla.

> **Renombrar el campo en la ficha queda para SPEC-434**, que ya toca esa pantalla (Dev 01). Este PR sostiene el panel aunque el campo siga trayendo prosa — que es lo que debe hacer un arreglo del lado del servidor.

---

## Candados · probados muriendo

| Mutación | Rojos |
|---|---|
| Pintar «Calendario» sin su pantalla + colar un ítem del admin | **4** — pantalla inexistente, puerta, ítem ajeno y área |
| Devolver un «Tenés» al panel o alargar un estado vacío | **2** — el bloque de voz y largo |
| Quitar el filtro de signos de frase del saludo | **3** — los de «qué cuenta como nombre» |

El candado del menú verifica **`page.tsx` en disco**, no una lista de rutas: una promesa de pantalla solo vale si la pantalla está. También afirma que la puerta **deja entrar** al profesional a cada ítem (pintar lo que se le niega es el rebote de I-25), que ninguna ruta del admin, del colegio o del padre se cuela, y que la barra y el desplegable salen de la **misma** lista.

`tsc` limpio · lint 0 errores · **`arch:check` VERDE** (artefactos regenerados) · **`tokens:check` en el piso** · unit 284/284 (2405) · integración de lo tocado verde.

---

## Anotado

- **`profesional_calendario` queda declarado en `SIN_PANTALLA_PROPIA`** con la instrucción escrita de **borrar esa línea cuando SPEC-447 entre a main**. El test se pone rojo si la justificación sobra, así que no se puede olvidar.
- **El padre alcanza `/dashboard/profesional/*`** en la puerta —preexistente, igual que antes de esta spec—. El dato está protegido por `verifyAuth`, pero el padre recibe error en vez de redirect limpio. El CEO lo radicó como **I-312** y lo colgó de SPEC-426; no es de acá.

> **Verde en CI ≠ funciona.** Cierra cuando el CEO entre como profesional en producción y vea **barra lateral con sus módulos, cero ítems ajenos, cero pantallas muertas, textos cortos, sin voseo y el saludo con el nombre.**
