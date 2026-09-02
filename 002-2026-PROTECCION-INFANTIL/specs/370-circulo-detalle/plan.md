# Plan · SPEC-370 · círculo, detalle de la persona

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## La lección de I-264

En SPEC-367 verifiqué que la LISTA ya devolvía `nombre`/`parentesco`/`creadoEn`
(usa `include`) y **generalicé al detalle sin comprobarlo**. El detalle arma su
objeto a mano y se habían quedado por fuera. Verificar un endpoint no autoriza a
suponer la forma de su hermano.

## Decisiones

**I-265: el bloque no se condiciona a las coordenadas.** Aparece con que haya
ciudades; el mapa se pinta cuando se puede ubicar y las ciudades se listan
siempre. Es honesto (no finge un mapa vacío) y no vuelve a desaparecer.

**Paleta opcional en vez de tocar el mapa de todos.** El mapa compartido usa una
escala de riesgo con rojo. Se agrega `paleta="padre"` con valor por defecto
`"riesgo"`: el círculo pide la suya y los otros cuatro callsites quedan idénticos
(candado 22v5: se enumeraron antes de tocar).

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Romper el mapa del admin/consulta al agregar la paleta | Valor por defecto `"riesgo"`; los 4 callsites enumerados y sin cambios |
| Que un contacto viejo (solo `etiqueta`) quede sin nombre | Test del respaldo a `etiqueta` |
| Que el bloque "Dónde" vuelva a desaparecer | Test con ciudad SIN coordenadas |
| Rojo en la cara del padre | Paleta ámbar/pino en el círculo |

## Impacto en arquitectura: no
