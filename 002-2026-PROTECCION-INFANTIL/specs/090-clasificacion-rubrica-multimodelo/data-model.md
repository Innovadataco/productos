# Data Model — 090-clasificacion-rubrica-multimodelo

> Migración aditiva `20260724090000_add_rubrica_votos`. Nada destructivo.

## Tabla nueva: `clasificacion_rubrica_votos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | TEXT (cuid) | PK |
| `clasificacionIAId` | TEXT | FK → `ClasificacionIA.id` ON DELETE CASCADE |
| `modelo` | TEXT | Modelo que votó (p. ej. gemma2:27b) |
| `categoria` | TEXT | Categoría evaluada |
| `cumple` | BOOLEAN | 0/1: todas las preguntas activas cumplidas con evidencia clara |
| `preguntasJson` | JSONB | Textos de las preguntas efectivamente cumplidas (auditoría) |
| `creadoEn` | TIMESTAMP(3) | default now() |

Índice: `(clasificacionIAId)`. La matriz completa de un reporte = filas de sus modelos × categorías plausibles.

## `ClasificacionIA` (sin cambios de schema)

- `categoria` = principal (mayor severidad entre presentes). `confianza` = % de la principal.
- `categoriasSecundarias` = restantes presentes (formato existente, compatible con la UI de la 089).
- `modeloUsado` = `rubrica:<modelo1+modelo2+modelo3>`.

## Parámetros nuevos (seed)

| Clave | Default | Notas |
|---|---|---|
| `ia.rubrica.enabled` | true | Motor rúbrica activo (false → legacy `clasificarConVotos`) |
| `ia.rubrica.preguntas` | RUBRICA_SEMILLA (JSON) | Sets por categoría; editables en tab Rúbrica |
| `ia.rubrica.modelos` | ["gemma2:27b","qwen2.5:14b","aya-expanse:32b"] | N modelos diversos, secuencial |
| `ia.rubrica.temperatura` | 0.2 | Baja = determinista |
| `ia.rubrica.umbral_presencia` | 0.6 | % mínimo para que una categoría cuente (≈2/3) |
| `ia.rubrica.modelo_embudo` | qwen2.5:14b | Pase barato |

## Permisos

- Módulo nuevo `ia_rubrica` (hijo de `centro_control_ia`) en el catálogo (spec 086); endpoints `/api/admin/ia/rubrica/*` con `requireModulo`.
