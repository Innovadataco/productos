# Plan · SPEC-441 — La tarjeta del profesional

## Análisis en fuente (ocho lectores en paralelo + una pasada de refutación)

| Archivo | Qué se sacó |
|---|---|
| `ProfesionalTarjeta.tsx:76-85` | El precio es `tarifaConsultaCOP` bajo la etiqueta «Consulta» — el número equivocado. |
| `ProfesionalPerfil.tsx:69-83` | La ficha ya muestra el precio estándar y relega la tarifa a letra chica (SPEC-428). |
| `directorio/page.tsx` | 22 líneas; **no leía el precio estándar**. `[id]/page.tsx` sí lo hace. |
| `perfil-profesional.ts:83` | El `select` de ciudad trae solo `{id, nombre}`; el modelo `Ciudad` sí tiene país. |
| `perfil-profesional.ts:106` | Fallback `ciudad: {id, nombre: ""}` — un objeto siempre verdadero, que hacía pasar el guard `p.ciudad &&`. |
| PR #341 (SPEC-429) | Su migración **borra** `EncuestaPrimeraCita`; el modelo nuevo no tiene puntaje. |

## Decisiones

- **El precio se lee en el servidor y se pasa como prop**, no con un fetch extra desde el cliente: una lectura, y la misma fuente que la ficha.
- **La tarifa informativa NO se muestra en la tarjeta.** Dos números de plata en una tarjeta es la confusión que la spec cierra; el desglose vive en la ficha.
- **No se reserva espacio para la calificación**: no viene de 429 ni de ningún lado hoy.
- **El país es opcional en el DTO** y la pantalla no lo inventa.
- **El botón volver conserva los filtros** del padre.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que la tarjeta y la ficha vuelvan a divergir | Candado sobre el número que se cobra + otro que prohíbe que reaparezca la tarifa. |
| Que se pinte un pin vacío | Guard sobre `ciudad?.nombre`, con candado. |
| Que se invente un país | Candado: sin país, solo la ciudad. |
| Que el barrido H-2 se afloje al tocar el archivo | Sus asserts quedaron intactos; la integración H-2 corre verde. |
