# Plan · SPEC-365 · I-263 fuente-reporte prisma no definido

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisión

**Borrar** las 3 líneas `const db = tx ?? prisma;` en lugar de importar `prisma`,
porque `db` es variable muerta (verificado por grep: solo aparece en las 3
asignaciones, nunca se usa). Importar el singleton "arreglaría" el ReferenceError
pero dejaría una variable inútil. Borrar es la reparación mínima y honesta.

Alternativa considerada y descartada: `import { prisma }` + usar `db` en las
queries. Innecesario: los repositorios (`FuenteReporteRepository`,
`ParametroRepository`) ya reciben `tx` y hacen su propio `tx ?? prisma` con el
singleton importado.

## Cómo se reprodujo el fallo de prod en un test

El bug solo aparece cuando `globalThis.prisma` no existe (prod,
`NODE_ENV=production`). El test de regresión borra `globalThis.prisma`
(`Reflect.deleteProperty`) alrededor de la llamada y lo restaura en `finally`.
Con el bug presente lanza `ReferenceError: prisma is not defined` (verificado
reintroduciendo la línea); con el arreglo, persiste la fila.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Que el arreglo cambie el comportamiento | `db` era muerta; las queries no la usaban. Tests de `crearFuenteReporte` verdes sin cambios. |
| Que exista el MISMO patrón en otro archivo | Barrido candado 22v5 en todo `src/`: único archivo = este. |
| Regresión futura (que vuelva a romperse en prod) | Test que simula prod (sin `globalThis.prisma`) + assert de la fila en el test del POST. |

## Impacto en arquitectura: no

Eliminación de una referencia muerta. Sin modelo, ruta ni contrato nuevos.
