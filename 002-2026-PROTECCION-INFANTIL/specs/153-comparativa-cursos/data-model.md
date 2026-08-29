# Modelo de datos: SPEC-153 — Comparativa entre cursos

No se realizan cambios en el esquema Prisma.

## Entradas/Salidas

### Entrada

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `agruparPor` | `"grado" \| "anioLectivo"` | Criterio de agrupación. Default `"grado"`. |

### Salida JSON

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `colegioId` | `string` | ID del colegio del usuario. |
| `colegioNombre` | `string` | Nombre del colegio. |
| `agruparPor` | `string` | Criterio usado. |
| `grupos` | `ComparativaGrupo[]` | Grupos ordenados alfabéticamente. |
| `totales` | `{ cursos, estudiantes, identificadores, alertas }` | Totales del colegio. |

### ComparativaGrupo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `grupo` | `string` | Valor del grado o año lectivo. |
| `cursos` | `number` | Cantidad de cursos en el grupo. |
| `estudiantes` | `number` | Total de estudiantes activos. |
| `identificadores` | `number` | Total de identificadores activos. |
| `alertas` | `number` | Alertas visibles. |
| `promedioEstudiantes` | `number` | Estudiantes / cursos, redondeado a 1 decimal. |

## Excel

Hoja única con encabezados:

1. Grupo
2. Cursos
3. Estudiantes
4. Identificadores
5. Alertas
6. Promedio estudiantes/curso
