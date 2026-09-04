# SPEC-431 · La franja horaria le mentía al modelo — cierra I-247 b

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-247 b**

**Impacto en arquitectura:** ninguno. Una función pura corregida y una exportada para poder contrastarla. Sin migración, sin endpoints, sin cambios de contrato.

---

## El defecto

`src/lib/expediente/analisis/armar-payload.ts` arma lo que ve el modelo de IA sobre un expediente. Una de las señales es la **franja horaria dominante** de los hechos — a qué hora del día ocurren. La calculaba así:

```ts
const h = fecha.getUTCHours();
```

Colombia va **cinco horas atrás de UTC**. Un hecho de las **21:00 en Bogotá** es la **02:00 UTC** del día siguiente. Con `getUTCHours()`, ese hecho —de noche— se le presentaba al modelo como **madrugada**. La noche entera del país caía corrida un bloque.

No es un detalle de formato. La franja horaria es **una de las señales que el modelo pesa** para leer un patrón de riesgo: «contacto insistente de madrugada» y «contacto insistente de noche» no son la misma historia. El modelo estaba leyendo la historia equivocada, y nada avisaba.

En la base de desarrollo, el corrimiento mueve **~1.000 hechos** entre bloques (974 vs 1.007 solo en el bloque de noche). Es degradación silenciosa pura: el número salía, era plausible, y era falso.

---

## El arreglo

El mismo criterio que ya usaban los dos módulos que sí lo hacían bien:

- `lectura-capa1.ts:57-59` — resta un offset fijo de UTC-5.
- `caso/hechos-caso.ts:51` — usa `Intl` con `timeZone: "America/Bogota"`.

`franjaDe` ahora resta el offset de Bogotá antes de leer la hora. Colombia no tiene horario de verano, así que el offset fijo es exacto (mismo supuesto documentado en `lectura-capa1.ts`).

**No se tocó `ejecutar-analisis.ts:176`**: ahí el `timeStyle` es a propósito (SPEC-349), no es este defecto.

---

## El test afirmaba el bug

`armar-payload.test.ts` tenía el fixture escrito en UTC crudo y el assert `franjaHorariaDominante === "18-24"` pasaba **por casualidad**: dos hechos a las 22:30 y 21:15 UTC caen de verdad en 18-24 UTC. El test no probaba Bogotá; probaba UTC, y por eso le daba la razón al defecto.

Se reescribió (candado 24 v2):

- El fixture ahora está en UTC pero **pensado en Bogotá**, con el comentario de la hora local al lado de cada fecha.
- Assert fuerte y renombrado: **«la franja dominante es la NOCHE de Bogotá, no la madrugada UTC»**, con la negación explícita de `"0-6"`.
- Cada hecho se verifica **uno por uno**, no solo el dominante — un empate de conteos no puede tapar un error.
- **Los bordes del día** (00:00, 05:59, 06:00, 18:00, 23:59 Bogotá), que es donde un offset mal aplicado se rompe primero.
- **Contraste con `franjaBogota`** de `hechos-caso.ts` sobre las 24 horas: dos implementaciones que respondan lo mismo tienen que responder igual, y ahora se prueba. Para eso se exportó esa función.

---

## Verificación

**11 tests verdes.** Probado muriendo: al reintroducir `getUTCHours()`, **4 caen** —el dominante, el hecho a hecho, los bordes y el contraste—; con el arreglo, los 11 pasan.

`tsc` limpio · `lint` 0 errores.

> **Los textos ya generados no se regeneran.** Decisión pendiente de Jelkin. Este PR corrige el cálculo de acá en adelante; los análisis viejos escritos con la franja corrida quedan como están hasta que él decida.
