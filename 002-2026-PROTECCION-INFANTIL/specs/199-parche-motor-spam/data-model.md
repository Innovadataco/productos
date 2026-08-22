# Modelo de datos: SPEC-199

No hay cambios de schema. Se reutiliza `ParametroSistema` para dos nuevos parámetros:

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `spam.dominancia_umbral` | FLOAT | 0.66 | Score mínimo de SPAM entre categorías secundarias para disparar guarda de dominancia |
| `spam.dominancia_categoria_grave_severidad_min` | INTEGER | 75 | Severidad mínima que bloquea la dominancia SPAM |

El parámetro existente `ia.rubrica.preguntas` (JSON) se actualiza forzadamente desde el seed para incluir la categoría SPAM.
