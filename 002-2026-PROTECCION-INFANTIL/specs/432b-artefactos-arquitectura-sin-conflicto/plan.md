# Plan · SPEC-432b — Los artefactos de arquitectura sin conflicto

## Punto de partida

SPEC-432 lo dejó declarado como límite conocido, con la evidencia de que el choque venía: **SPEC-447 y SPEC-437 tocan los dos artefactos**. El CEO lo aprobó con tres condiciones no negociables, y el plan es cumplirlas en orden.

## Análisis en fuente

| Archivo | Qué se sacó |
|---|---|
| `scripts/arch/arch-check.ts:49-65` | `verificarDrift` compara `commiteado !== regenerado` — byte a byte para los cinco artefactos. |
| `scripts/arch/artefactos.ts` | Lista declarativa: el sitio natural para marcar **cuáles** toleran orden, en vez de esconder la excepción en el comparador. |
| `docs/architecture/03-pantallas.md` | Varias tablas por documento, separadas por títulos. El separador `\| --- \|` corta el encabezado del cuerpo: cada uno queda en su bloque, y eso es útil. |

## Decisiones

- **Marca declarativa `toleraOrdenDeFilas` en la lista de artefactos**, no una condición enterrada: quien lea la lista ve qué tolera qué y por qué.
- **Comparación por BLOQUES, no por conjunto global.** Un conjunto global dejaría pasar una fila que salta de tabla — probado con una mutación que pone eso en rojo.
- **El armazón se compara en orden y byte a byte**, con una marca de posición por bloque para que un bloque que aparece o desaparece se note.
- **Solo los dos artefactos de tabla.** Los otros tres siguen byte a byte, con candado que lo afirma.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que aflojar el orden afloje también el contenido | La matriz de ocho casos sobre el artefacto real, incluida la fila que salta de tabla. |
| Que el diseño por bloques sea decorativo | Mutación que lo reemplaza por un conjunto global → rojo. |
| Que el arreglo no sea lo que resuelve el choque | Contraprueba de merge sin `.gitattributes` → tiene que chocar. |
| Que alguien afloje un artefacto que no es tabla | Candado que afirma que solo 02 y 03 están en el `.gitattributes` y en la marca. |
