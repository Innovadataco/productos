# SPEC-425 · El panel del profesional (A-75 · lote L5)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: [BRIEF A-75](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-A-75-RED-DE-PROFESIONALES.md) §7 lote **L5** + mockup aprobado por Jelkin («Lo que ve el profesional»).

**Impacto en arquitectura:** una pantalla nueva (`/dashboard/profesional`), un endpoint de lectura (`GET /api/profesional/panel`) y un servicio que **solo agrega**. Sin migración y sin lógica de negocio nueva: el motor de citas es de L4 y este lote no lo toca. Cambian los **dos** mapas de aterrizaje por rol para que `PROFESIONAL` llegue a su casa.

---

## Para qué

El motor de citas existe desde SPEC-395 —franjas, solicitud, reloj de 48 h, confirmar, rechazar, reprogramar, reasignar— y **no tenía ni una pantalla**. El profesional no podía ver una solicitud, mucho menos responderla.

Este lote es la cara visible: **reusa, no reescribe**.

---

## Qué trae

### El panel, como lo dibujó el mockup

Su inicio con saludo · **Solicitudes de primera cita** con el plazo de 48 h · **Casos por cerrar** · **Citas confirmadas** · **Por cobrar** con el desglose de tarifa y comisión · **Tu año en la red** · **Tu verificación** con fecha y vencimiento · **Expedientes compartidos**.

### Las dos reglas del brief que se hacen cumplir

**§3 · el marcador NO cuenta las `SIN_CONFIRMAR`.** Ni en familias atendidas ni en lo que se gira. Se muestran aparte, apagadas, como lo que son: solicitudes que todavía no respondió. Es un número que él va a leer como su año de trabajo — contarle solicitudes que ni miró sería mentirle sobre su propio desempeño.

**§9 · los expedientes compartidos son de solo lectura** y se abren con el código que el padre entrega en la sesión. El panel **los lista**; no los abre, no enlaza a su contenido y no pide el código.

### El marcador se cuenta en la base, no sobre la lista

`listarPorProfesional` trae `take: 100`. Contar sobre esa lista habría funcionado hoy y habría empezado a mentir en la solicitud 101, sin avisar. Se agregaron `contarPorProfesional` y `contarFamiliasAtendidas` al repositorio. Además una familia que pidió tres citas **es una familia**, no tres.

### El porcentaje de servicio, en un solo lugar

Vivía como `const PORCENTAJE_SERVICIO_DEFAULT = 15` **dentro de** `api/padre/citas/route.ts`, invisible para cualquier otro consumidor. El panel tiene que mostrarle al profesional exactamente lo que se le cobra, y dos copias del número es la forma más barata de que un día digan cosas distintas. Se movió a `lib/profesional/cita/comision.ts`, con el mismo redondeo que usa el cobro.

> ⚠️ **El mockup dibuja «Servicio de la red (10%)» y el producto cobra 15%.** El panel muestra **15**, que es lo que el padre paga de verdad. La diferencia quedó reportada al CEO: es decisión de negocio, no de código.

---

## Lo que NO se pinta, y por qué

El mockup dibuja **cinco** controles. **Solo dos tienen motor**: `Confirmar` (`confirmarPorProfesional`) y `No puedo` (`rechazarPorProfesional`), los dos de L4. Verificado en fuente:

| Control del mockup | Motor | Dónde nace |
|---|---|---|
| Confirmar · No puedo | ✅ existe (L4) | se pintan |
| Proponer otro horario | ❌ `reprogramarPorPadre` es acción **del padre** | — |
| Se dio, cerrar y cobrar · No se presentó | ❌ **nada en `src/` escribe `CUMPLIDA` ni `NO_ASISTIO_PADRE`** | **L6** |

Y el brief respalda al brief sobre el mockup: el §7 pone **el cierre en L6** y **la plata en L7**; **L5 dice «casos por cerrar» — listarlos, no cerrarlos.**

Donde falta la acción va **una línea honesta de qué falta, no un control apagado**. Un botón deshabilitado sigue prometiendo algo, y hoy cerramos tres defectos de esa clase (I-289, I-290, I-297): pintar el cuarto a sabiendas, en la pantalla que Jelkin va a probar, sería ponerlo nosotros.

---

## El aterrizaje, en los DOS mapas

`PROFESIONAL` no estaba en ninguno de los dos:

- `homeParaRol` (cliente) → caía al default `/mis-reportes`, **que es del padre**.
- `homeForRole` (`proxy.ts`) → caía al default `/dashboard/admin`, **que su propia puerta le niega**: el doble rebote que SPEC-127 ya documentó para el padre.

Los dos apuntan ahora a `/dashboard/profesional`. La cabecera de `home-para-rol.ts` pide explícitamente tocar ambos; hacerlo en un solo lado era dejar el gemelo divergente.

> **Coordinación con SPEC-424** (Dev 01): su PR apunta el aterrizaje a `/perfil-profesional/verificacion` —lo único que existía— para cerrar el rebote sin esperar este lote. Este PR mueve la línea a la casa definitiva. Acordado por mensaje directo.

---

## Verificación

**8 tests de integración verdes** contra una base propia (`pi_425_test`, creada y destruida):

- Panel vacío de un profesional recién verificado: **sin números inventados**.
- **§3**: 2 `SIN_CONFIRMAR` + 1 `CONFIRMADA` → `sinConfirmar: 2`, `solicitudesRecibidas: 3`, **`familiasAtendidas: 1`**.
- Una familia con dos citas cuenta **una** vez.
- Agenda y casos por cerrar se separan por la hora de la cita; el pago de ambas sigue retenido.
- El desglose es exactamente el que se cobra (180.000 / 207.000 / 27.000 / 15 %).
- El plazo de 48 h **solo existe** con el pago aprobado.
- Un profesional **no ve nada** de otro.
- Sin sesión → 401/403.

**Prueba negativa de la regla del brief**: se hizo que `SIN_CONFIRMAR` contara en el marcador y el test cae con *«solo la confirmada: las dos sin responder no son trabajo hecho: expected 3 to be 1»*. Restaurado, los 8 vuelven a verde.

**14 candados estáticos**: que solo existan **dos** `<button>`, que ninguno de los tres textos sin motor aparezca, que no haya un `disabled` fijo (sería el control apagado), que el marcador no se calcule sobre la lista capada, que los expedientes no se enlacen, que el porcentaje salga de un solo lugar y que **los dos mapas** de aterrizaje apunten a la página que existe.

Uno de esos candados es la contraparte del alcance: **si alguien implementa el cierre, el test cae** y obliga a volver acá a pintar los botones. El candado no solo prohíbe — avisa cuándo deja de aplicar.

`tsc` limpio · `lint` 0 errores · `tokens:check` sin subir el piso.

> **Verde en CI ≠ funciona.** Cierra cuando Jelkin entre como psicólogo, vea una solicitud real y la confirme.

## Fuera de alcance

- **L6** (cierre, encuestas, los dos códigos) y **L7** (la plata). Ya radicados como SPEC-427 y siguientes.
- La navegación lateral del profesional: `PROFESIONAL_NAV_ITEMS` es de SPEC-424; cuando entre, se le agrega la entrada del panel.
