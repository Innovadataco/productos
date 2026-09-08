# SPEC-601 · Plan

## Enfoque

Revert acotado por variante, no por git revert: `MisHijos` se parametriza con `varianteAlta` (default wizard) y el formulario inline pre-599 se recupera de `git show e74e1a44a^` como componente nuevo `FormularioAltaHijo`. El dueño fue explícito: el wizard molesta SOLO en el Paso 3 del camino; en `/dashboard/padre/hijos` fue aprobado y se queda.

## Decisiones

1. **Variante por prop** y no dos componentes de página: `MisHijos` comparte carga de datos, cupo (`maximoActivos`), catálogo de plataformas y acciones de tarjetas entre las dos rutas.
2. **Payload compartido** (`registro-hijo/payload.ts`): una sola función arma el body del POST; wizard y formulario la usan. El contrato SPEC-589 no cambia.
3. **Sin documento**: la versión pre-599 recuperada es ya post-SPEC-589 (e74e1a44a^ incluye el drop de columnas), así que el formulario restaurado no trae campos de documento.
4. **Tests**: un test nuevo cubre la variante formulario (render inline + POST); los tests del wizard y el candado SPEC-555 quedan como están (default wizard).

## Riesgos

- Bajo: superficie acotada a dos archivos de UI y uno de wiring.
