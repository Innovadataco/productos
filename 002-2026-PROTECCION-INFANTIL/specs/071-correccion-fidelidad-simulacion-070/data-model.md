# Data Model: Corrección de fidelidad de la simulación (Spec 071)

**Date**: 2026-07-20
**Feature**: specs/071-correccion-fidelidad-simulacion-070/spec.md

---

## Active Entities (sin cambios de schema)

### `Reporte`

No se modifica. La corrección solo cambia qué valores se escriben en los campos existentes.

| Field | Type | Notes |
|-------|------|-------|
| `identificador` | String | Prefijo `SIM-{runIdShort}-{indice}` |
| `plataformaId` | String | FK a `Plataforma` por clave de plataforma del caso |
| `texto` | String | Texto del caso |
| `textoOriginal` | String | Cifrado con `encryptParameter` |
| `fechaIncidente` | DateTime | Valor real del caso, no `new Date()` |
| `ciudad` | String | Valor real del caso, no `"Simulación"` |
| `pais` | String | Valor real del caso, no `"Simulación"` |
| `paisId` | String? | Null en simulación (texto libre) |
| `ciudadId` | String? | Null en simulación (texto libre) |
| `esAnonimo` | Boolean | `true` |
| `edadVictima` | Int? | Valor real del caso si viene, null si no |
| `estado` | EstadoReporte | Resultado del pipeline real |
| `numeroSeguimiento` | String? | Generado por `generarNumeroSeguimiento` |

---

### `SimulacionRun`

No se modifica. El campo `casosJson` almacena ahora el set de casos con la estructura ampliada.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | PK |
| `modelo` | String | Modelo Ollama elegido |
| `totalCasos` | Int | Número de casos cargados |
| `progreso` | Int | Casos creados y/o procesados |
| `estado` | String | PENDIENTE / EN_PROGRESO / COMPLETADA / FALLIDA / CANCELADA |
| `fechaInicio` | DateTime | |
| `fechaFin` | DateTime? | |
| `metricasJson` | Json? | Métricas agregadas incluyendo conteo de fallos |
| `casosJson` | Json? | Set de casos con estructura ampliada |
| `creadoPorId` | String | FK a `Usuario` (ADMIN) |

---

### `SimulacionReporte`

No se modifica. `categoriaEsperada` sigue guardando la categoría esperada para medir aciertos.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | PK |
| `simulacionRunId` | String | FK a `SimulacionRun` |
| `reporteId` | String | FK única a `Reporte` |
| `indice` | Int | Índice del caso en el set |
| `categoriaEsperada` | String? | Solo para medir aciertos; no se pasa al modelo |
| `createdAt` | DateTime | |

---

## Input Entity (ampliada)

### `CasoSimulacion` (nueva definición)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `texto` | String | 20-5000 chars | Igual que `crearReporteSchema` |
| `plataforma` | String | min 1 | Clave de plataforma existente |
| `identificador` | String | 3-100 chars | Identificador del caso dentro del set |
| `fechaIncidente` | String | ISO datetime, no futura | Se convierte a `Date` al crear el reporte |
| `ciudad` | String | 1-100 chars | Texto libre |
| `pais` | String | 1-100 chars | Texto libre |
| `edadVictima` | Int? | 0-120 | Opcional |
| `categoriaEsperada` | String? | max 100 | Solo para medir aciertos; no se pasa al pipeline |

**Schema Zod**:
```typescript
import { crearReporteSchema } from "@/lib/validators";

export const casoSimulacionSchema = crearReporteSchema
    .omit({ paisId: true, ciudadId: true, otraPlataforma: true })
    .extend({
        categoriaEsperada: z.string().max(100).optional(),
    });
```

---

## Entity Relationships

```
SimulacionRun ||--o{ SimulacionReporte : "agrupa"
SimulacionReporte ||--|| Reporte : "vincula"
Reporte ||--o{ TransicionReporte : "transita"
Reporte ||--o| ClasificacionIA : "clasifica"
```

---

## Indexes

Sin cambios. Los índices existentes en `SimulacionRun` y `SimulacionReporte` son suficientes.

---

## Migration Notes

**No se requiere migración de base de datos** para esta corrección. Los modelos `SimulacionRun`, `SimulacionReporte` y `Reporte` ya contienen todos los campos necesarios. Si durante la implementación se decide contar fallos de caso en una nueva columna de `SimulacionRun`, la migración será aditiva y no destructiva.

---

## Data Flow

1. El usuario sube un archivo CSV/JSON con casos ampliados.
2. El parser valida cada caso contra `casoSimulacionSchema` (que extiende `crearReporteSchema`).
3. Los casos válidos se almacenan en `SimulacionRun.casosJson`.
4. El executor lee cada caso y crea un `Reporte` con los campos reales del caso.
5. Cada reporte se encola en pg-boss con `modeloClasificacion` override.
6. El worker procesa cada reporte por el pipeline real completo.
7. Si un caso falla, se registra el error y se continúa con los demás.
8. Al finalizar, se calculan métricas incluyendo casos procesados, fallidos, aciertos, latencias, etc.
