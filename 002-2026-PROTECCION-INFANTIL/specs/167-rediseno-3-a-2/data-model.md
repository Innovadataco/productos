# Data Model: SPEC-167 — Rediseño 3→2: Inicio + Estadísticas, eliminar Tablero

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

Esta feature no crea ni modifica tablas de base de datos. Las "entidades activas" son los DTOs de lectura que se amplían o reubican para alimentar las dos pantallas resultantes.

---

### `HomeRector` (DTO ampliado)

Salida de `ColegioResumenRepository.homeRector(colegioId)`. Hereda todos los campos de SPEC-143 y añade el embudo de estado.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `colegio` | `{ nombre: string; vigenciaFin: Date \| null }` | obligatorio | Ficha mínima del colegio |
| `kpis` | `{ estudiantes, cursos, profesores, reportesMes, reportesSemana, deltaSemana }` | obligatorio | Solo activos del colegio |
| `cobertura` | `{ vigilancia, reaccion, sinRedes, sinContacto }` | obligatorio | Porcentajes y huecos en personas |
| `semaforo` | `{ alertasNuevas, alertas72h }` | obligatorio | Fuente del héroe de estado |
| `ultimaSenal` | `Date \| null` | obligatorio | `max(AlertaColegio.creadoEn)` |
| `latidoSistema` | `Date \| null` | obligatorio | Heartbeat del worker |
| `tendencia` | `{ semanal, mensual, anual }` | obligatorio | Serie de `PuntoTendencia` |
| `cursosMirada` | `CursoMirada[]` | obligatorio | Top 3 cursos por reportes 30 días |
| `embudo` | `EmbudoTablero` | **nuevo** | Recibidos / cerrados / en revisión / te esperan |

**Validation Rules**:
- `embudo` debe cumplir `recibidos === cerrados + enRevision + teEsperan`.
- Los conteos son reportes DISTINTOS (métrica D2), no alertas individuales.
- Cero datos de otro colegio: todo filtrado por `colegioId`.

---

### `EmbudoTablero` (DTO reubicado)

Campos heredados de SPEC-158.

| Field | Type | Notes |
|-------|------|-------|
| `recibidos` | `number` | Total de reportes distintos del colegio |
| `cerrados` | `number` | Reportes con todas sus alertas `gestionada` |
| `enRevision` | `number` | Reportes con al menos una alerta `vista` y ninguna `nueva` |
| `teEsperan` | `number` | Reportes con al menos una alerta `nueva` |

**Validation Rules**:
- Cada reporte cuenta UNA vez en el bucket de su estado más pendiente (`nueva > vista > gestionada`).
- Sin solapes entre buckets.

---

### `EstadisticasInteligenciaColegio` (DTO nuevo)

Salida ampliada de `GET /api/colegio/estadisticas`. Reúne agregados existentes en una sola respuesta para evitar múltiples round-trips al cliente.

| Field | Type | Notes |
|-------|------|-------|
| `colegioId` | `string` | Identificador del colegio |
| `colegioNombre` | `string` | Nombre del colegio |
| `totales` | `{ cursos, estudiantes, identificadores, alertas, profesores }` | Conteos generales; `profesores` es **nuevo** |
| `porCurso` | `EstadisticasCurso[]` | Desglose por curso (heredado de SPEC-078) |
| `tendencia` | `{ semanal, mensual, anual }` | Series de `PuntoTendencia` (reusadas de SPEC-143) |
| `reloj24h` | `number[]` | 24 posiciones, hora Colombia (reubicado de SPEC-158) |
| `patrones` | `PatronesColegioDto` | Agregado del trimestre actual (reusa SPEC-142) |
| `comparativa` | `ComparativaCursos` | Comparativa por grado (default; reusa SPEC-153) |

**Validation Rules**:
- `porCurso` no expone PII: solo nombre de curso, grado, año lectivo y conteos.
- `patrones` aplica k-anonimato k=3 en lectura; el backend no reimplementa la regla.
- `comparativa` se calcula a partir de `porCurso` y respeta el criterio solicitado.
- `reloj24h` tiene exactamente 24 posiciones con ceros rellenos.

---

### `EstadisticasCurso` (DTO sin cambios)

Heredado de `src/lib/colegio/estadisticas.ts` (SPEC-078).

| Field | Type | Notes |
|-------|------|-------|
| `cursoId` | `string` | |
| `nombre` | `string` | |
| `grado` | `string \| null` | |
| `anioLectivo` | `string \| null` | |
| `alumnos` | `number` | Estudiantes activos del curso |
| `identificadores` | `number` | Identificadores activos del curso |
| `alertas` | `number` | Alertas visibles del curso |

---

## Unchanged Entities

### `Colegio`

**NO se modifica**. Sigue siendo la raíz del tenant; `colegioId` acota todas las lecturas.

### `Curso`

**NO se modifica**. `Estudiante.cursoId` se mantiene intacto. La relación curso-materia-profesor vive en `CursoMateria` (SPEC-162) sin alterar este modelo.

### `Estudiante`

**NO se modifica**. Los estudiantes siguen colgando directamente de `Curso`.

### `Profesor`

**NO se modifica**. Se reusa `ProfesorRepository.contar(colegioId)` para el KPI y la sección de profesores.

### `AlertaColegio`

**NO se modifica**. Fuente de todos los agregados de reportes del colegio. Se reusan `embudoPorReporte`, `reloj24h`, `serieReportesPorPeriodo`, `topCursosPorReportes` y `conteosSemaforo`.

### `PatronInstitucional`

**NO se modifica**. La entidad ya existe (SPEC-142); solo se consume desde la nueva pantalla de estadísticas.

### `CursoMateria`

**NO se modifica**. Heredado de SPEC-162; puede usarse en el futuro para mostrar profesores por curso, pero no es requisito de esta fase.

---

## Relationships

```text
Colegio 1──< Curso
Colegio 1──< Estudiante
Colegio 1──< Profesor
Colegio 1──< AlertaColegio
Colegio 1──< PatronInstitucional
Colegio 1──< CursoMateria (heredado SPEC-162)

Curso 1──< Estudiante
Curso 1──< CursoMateria (heredado SPEC-162)

Estudiante 1──< IdentificadorEstudiante
Estudiante 1──< AcudienteEstudiante

AlertaColegio N──1 Reporte
AlertaColegio N──1 IdentificadorEstudiante

PatronInstitucional N──1 Colegio
PatronInstitucional N──1 Plataforma
```

---

## Migration Strategy

No hay migración de base de datos. El rediseño es puramente reorganización de UI, DTOs y navegación. Los datos agregados ya existen en los repositorios correspondientes.

> **Nota sobre compatibilidad**: la ruta `/dashboard/colegio/tablero` se conserva como redirección para no romper enlaces guardados. No se elimina físicamente hasta una fase de limpieza posterior decidida por ZEUS.
