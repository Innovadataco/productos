# SPEC-463 · Plan

## Enfoque
Solo texto. Barrer el tuteo (posesivos + verbos 2ª persona) en `dashboard/colegio/**` y `components/modules/colegio/**`, migrar a usted. El padre no se toca.

## Orden
1. Barrer posesivos (tu/tus/tú) → su/sus + verbos imperativos/presente → usted.
2. Actualizar los tests de componentes que afirman el copy viejo.
3. Candado de voz: colegio sin tuteo + contraprueba de que el padre conserva «tú». Verificado por mutación.

## Límite
Solo colegio. El PARENT sigue en tú. No cambia conducta ni color (color/firma = SPEC-462).
