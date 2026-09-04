# Plan · SPEC-422 — «Soy profesional» era un enlace muerto

## Análisis en fuente

| Archivo | Qué se sacó |
|---|---|
| `src/lib/routing/guardias.ts:18-22` | `publicas` tiene `/registro` y `/registro-colegio`; falta `/registro-profesional`. |
| `src/lib/routing/guardias.ts:439` | `matcheaRuta` es prefijo **por segmento**: `/registro` no cubre `/registro-colegio` ni `/registro-profesional`. Es la causa de la suposición equivocada. |
| `src/app/registro-profesional/` | La página existe, y su `crear-clave/[token]` también. No hay nada que construir. |
| `src/lib/routing/middleware.test.ts:216` | El patrón de test de SPEC-402 (I-289) para afirmar «el middleware no corta». Se copia. |

## La decisión que importa

El CEO pidió un candado para las **tres** puertas. Un candado con las tres escritas a mano protege lo que ya se rompió, no lo que va a romperse: **la cuarta puerta repetiría el defecto**, que es justo lo que él quiere evitar.

Por eso el candado **descubre las puertas leyendo `src/app/registro*`**. Es la diferencia entre registrar el incidente y cerrarle la puerta a la clase entera.

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| Un candado que pase siempre | Contraprueba explícita: `esRutaPublica("/registro-inventado")` debe ser `false`. |
| Que alguien borre una entrada creyendo que `/registro` la cubre | Test que fija `matcheaRuta("/registro-profesional", "/registro") === false`, y el comentario en la allowlist. |
| Abrir de más | Solo se agrega la ruta de una página que YA existe y está diseñada sin sesión. |
