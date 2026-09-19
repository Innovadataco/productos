# SPEC-721 · La cuenta del hijo sin plataforma no se puede vigilar

**Status**: DESARROLLO

**Origen:** CEO, cerrando el nulo de I-429 (18-09). **Carril:** Diseño (forma del campo + copy) → Datos (mitad del servidor) · Dev 1 (mitad de la pantalla) · Calidad. **Radicado:** `RADICADO-SPEC-721-2026-09-18.md`. **Forma de Diseño:** `FORMA-SPEC721-PLATAFORMA-OBLIGATORIA-2026-09-18.md`.

## Por qué nace

I-429 se arregla exigiendo el par **(identificador, plataforma)** en el cruce: sin la red, `ruby1` en Discord y `ruby1` en Roblox son dos cuentas distintas y un reporte sobre una no dice nada de la otra. La consecuencia, aceptada: **una cuenta sin plataforma no cruza ningún reporte** — no enciende ámbar, no cuenta, no avisa. Cambiamos un falso positivo por un posible falso negativo, y **solo es inofensivo si esas filas no pueden nacer**. Hoy podían: la API aceptaba `plataformaId` opcional y el formulario dejaba agregar la cuenta con solo el valor. En producción son **0 de 109** — la puerta está abierta pero nadie ha entrado; se cierra antes de que alguien entre.

## Qué se hace

Las **dos mitades entran juntas** (un servidor más estricto que la pantalla es una trampa que el padre no puede resolver desde donde está):

1. **Servidor (Datos):** `plataformaId` deja de ser `optional()`. Fuente única `camposIdentificadorEntrada` para las dos puertas de la API (alta de hijo con cuentas · agregar cuenta a un hijo existente); ambas rechazan (400) una cuenta sin plataforma.
2. **Pantalla (Dev 1):** la plataforma entra en la condición de `disabled` del botón «Agregar otro» (alta, `FormularioAltaHijo`) y «Agregar» (hijo existente, `HijoCard`), igual que el valor. La cuenta escrita-pero-no-agregada ya no se envía suelta al registrar: si falta la red, se pide con el mensaje de Diseño (dice la razón, no regaña). El placeholder pasa a «Elige la red o app». `MisHijos.agregarIdentificador` envía siempre `plataformaId` (deja de omitirlo «si está vacío»).
3. **El porqué, en voz del padre (Diseño):** una línea bajo el selector — «¿En qué red o app está esta cuenta? Sin la red no podemos saber si un reporte es sobre tu hijo o sobre otra persona con el mismo usuario».
4. **Retro de filas (Datos):** hoy 0; no hace falta corrector, sí verificar que siguen en 0 al desplegar. El `NOT NULL` de la columna es decisión aparte del CEO, después de cerrada y medida la puerta.

## Candado

No existe camino —API ni formulario— por el que nazca un identificador de menor **activo** sin plataforma.

- **API (Datos):** `plataforma-obligatoria.candado.test.ts` — las dos rutas rechazan 400; control positivo: volver el esquema a `optional()` lo pone rojo.
- **Pantalla (Dev 1):** `plataforma-obligatoria-pantalla.candado.test.tsx` — el botón queda inactivo sin red en las dos puertas, y la cuenta suelta no se envía al registrar (se pide la red). Control positivo: quitar `|| !…plataformaId` de la condición `disabled` activa el botón sin red → rojo; quitar el guardia del submit envía la cuenta suelta → rojo.

## Impacto en arquitectura: 

Ninguno estructural. Se endurece un contrato de entrada ya existente (`plataformaId` pasa de opcional a obligatorio) en el esquema compartido de la API y su reflejo en la pantalla del padre; no hay tabla, índice ni migración nuevos. El `NOT NULL` de la columna queda como decisión posterior del CEO (con respaldo, sin `NOT VALID`).
