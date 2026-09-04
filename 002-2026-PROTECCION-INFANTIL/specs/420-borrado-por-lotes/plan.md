# Plan · SPEC-420 — El borrado por lotes

## El defecto, en una línea

`where: { id: { in: [...] } }` gasta un parámetro por id. PostgreSQL admite 32.767 por sentencia preparada. La limpieza del marcador junta las 18 entidades: 37.176 en producción.

## Por qué el ensayo no lo vio

La corrida de prueba escribió 30.254 marcas — **por debajo** del techo. No fue una prueba mal hecha: fue una prueba a otra escala. Por eso la verificación de esta spec siembra 40.000 a propósito.

## Barrido, no parche

El CEO fue explícito: revisar las 18 entidades, no solo la que reventó. Se recorrió `_borrado-marcado.ts` entero — `deleteMany`, `updateMany`, `findMany` y **también los `count` del reporte previo**, que corren en dry-run y gastan parámetros igual.

## Dos casos que no se resuelven con lotes

| Caso | Por qué | Qué se hizo |
|---|---|---|
| `count({ where: { id: { notIn: ids } } })` | Partir un `notIn` en tandas no da el mismo resultado (cada tanda excluye solo su parte) | `LEFT JOIN demo_marcado` — cero parámetros |
| INTOCABLES de `Usuario` | Preguntaba por N ids para cruzar contra 2 correos | Se pregunta por los 2 correos y se cruza en memoria |

## La convención

Dentro de `_borrado-marcado.ts`, la única variable admitida en un `in:` es `t`. Se eligió un nombre corto y uniforme **para que un test estático pueda verificar la regla leyendo**, sin analizar el flujo.
