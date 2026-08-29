# Data Model — SPEC-104

**Date**: 2026-07-27 · Sin migración (el shape persistido no cambia).

## Contrato del voto (transporte, NUEVO)

Por categoría plausible, el modelo devuelve:

```jsonc
{
  "categoria": "SOLICITUD_MATERIAL",
  "cumple": true,                    // 0/1 del modelo, como hoy
  "preguntasCumplidas": [1, 3]       // NUEVO: índices 1-based del set de la categoría
}
```

- Índice = posición (1-based) de la pregunta en el set de `ia.rubrica.preguntas` para esa
  categoría, en el orden leído en la llamada.
- Válido: entero 1..N (N = preguntas activas del set). Duplicados y fuera de rango:
  descartados.
- El prompt numera explícitamente: `1. [DECISIVA] ¿…?`, `2. [contexto] ¿…?`.

## Persistencia (sin cambios de schema)

`ClasificacionRubricaVoto.preguntasJson` (Json, ya existente): array de TEXTOS CANÓNICOS
de las preguntas cumplidas (traducidos desde índice en el momento del voto). Idéntico shape
a los votos históricos → `src/lib/expediente/votacion.ts` los consume sin cambios.

## Reglas de consistencia

| Regla | Garantía |
|-------|----------|
| Índice estable dentro de la llamada | `cargarConfigRubrica` se lee una vez por clasificación; prompt y agregación usan el mismo set |
| Índice estable entre corridas | No se requiere: los índices no se persisten |
| Edición/reorden del parámetro | La siguiente clasificación numera con el nuevo orden; lo persistido histórico degrada como hoy |
| Categoría sin decisivas | Comportamiento actual intacto (basta el 0/1 del modelo) |
