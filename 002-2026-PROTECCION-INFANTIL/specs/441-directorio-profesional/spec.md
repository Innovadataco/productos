# SPEC-441 · La tarjeta del profesional presenta a la persona, y el precio deja de estar mal

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: Jelkin en vivo + **corrección del CEO tras refutar el radicado premisa por premisa**

**Impacto en arquitectura:** el DTO público gana el país de la ciudad (tres cambios coordinados: interfaz, `select` y mapeo). Sin migración.

---

## Cinco de seis premisas del radicado eran falsas o parciales

Se leyó la fuente antes de codificar y se refutó cada premisa; **el CEO verificó en `origin/main` y corrigió el radicado**. Lo que se creía y lo que había:

| Premisa | Realidad |
|---|---|
| «El precio es lo primero y más grande» | Es el **segundo** bloque. Y el problema **no era el tamaño** |
| «Hay un bloque de ESPECIALIDADES con el nombre técnico» | Eran **dos cosas distintas**, separadas por 18 líneas |
| «No muestra foto» | **Sí la muestra** — mandar a agregarla era editar el único archivo que estaba bien |
| «Dice Bogotá D.C. suelto» | **Nunca dice eso**: imprime lo que traiga la base |
| «El directorio es una lista estática» | Ya es una **grilla** responsive |
| «Falta el botón volver» | **VIGENTE** — lo único que sobrevivió intacto |

## El defecto real, que es peor que el que decía el radicado

**La tarjeta mostraba el número equivocado.** Pintaba `tarifaConsultaCOP` —la tarifa **informativa** del profesional, de la 2ª cita en adelante— mientras la ficha mostraba el **precio estándar de la primera cita**. **El padre veía un número en la tarjeta y otro distinto al entrar.** SPEC-428 corrigió la ficha; la tarjeta quedó en la versión vieja.

Ahora las dos leen **el mismo helper** (`leerPrecioEstandarPrimeraCita`), la tarjeta lo recibe del servidor —una lectura, sin fetch extra— y **un candado falla si vuelven a separarse**.

Y el precio **está, claro y sin letra chica, pero deja de ser el protagonista**: un padre que busca ayuda para su hijo no está comprando, está eligiendo en quién confiar. La foto y el nombre crecen; el precio pasa a una línea.

## La calificación de familias sale del alcance

El radicado decía que sale de las encuestas de SPEC-429. **Falso en fuente:** `EncuestaPrimeraCita` está huérfana y la migración de 429 **la borra**; el modelo nuevo guarda opciones como texto, **sin puntaje y sin estrellas** — su propio código dice que el valor está en detectar la contradicción, no en calificar. **No se reserva el espacio «para cuando entre 429»: eso no viene.**

## Lo demás

- **Ubicación completa y atribuida:** «Atiende desde Bogotá, Colombia». El DTO solo llevaba `{id, nombre}` de ciudad. **Si no hay país, no se inventa**; y si la ciudad viene sin nombre **no se pinta un pin vacío** — el guard era `p.ciudad &&`, y el fallback del DAL es un objeto, que siempre es verdadero.
- **Fuera el nombre técnico del título** de la tarjeta («el padre eso no lo entiende»). En su lugar, las especialidades, que ya están en lenguaje de familia, con `+N` cuando hay más de tres — un dato **real**, no un truncado silencioso. El título sigue en la ficha, donde hay espacio.
- **Botón volver** al directorio que **conserva los filtros** con los que el padre llegó. Uno que los pierde obliga a rehacer el camino y es peor que no tenerlo.

## Candados, probados muriendo

| Mutación | Rojos |
|---|---|
| Devolver `tarifaConsultaCOP` a la tarjeta | **2** — el precio correcto y el que prohíbe dos números de plata |

Más: la ubicación con país · sin país no se inventa · sin nombre no hay pin vacío · el título técnico fuera. **El barrido H-2 del archivo quedó intacto**: la tarjeta sigue sin poder filtrar contacto ni campos internos.

`tsc` limpio · **`arch:check` VERDE** · **`tokens:check` en el piso** · unit **286/286 (2396)** · integración H-2 **10/10**.

> **Un test ajeno cambiado de intención, y dicho en voz alta.** Afirmaba `/120\.000/` — la tarifa informativa. Ese assert **defendía el defecto**: ahora afirma el número que se cobra, y se sumó otro que prohíbe que la tarifa reaparezca.

> **Verde en CI ≠ funciona.** Cierra cuando el CEO recorra el directorio en producción: la tarjeta presenta a la persona antes que al precio, el número coincide con el de la ficha, hay vuelta atrás y **no aparece un solo dato de contacto**.
