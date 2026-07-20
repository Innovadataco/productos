# Data Model: Capa de datos / servicios (DAL)

**Date**: 2026-07-20
**Feature**: specs/053-capa-datos-servicios/spec.md

---

> **Nota**: Este documento describe las abstracciones de la capa de datos (DAL), no cambios en el esquema de Prisma. El modelo relacional sigue siendo el definido en `prisma/schema.prisma` y en specs previos.

---

## 1. Agregados y repositorios

### 1.1 Agregado `Reporte`

Entidades del agregado: `Reporte`, `IdentificadorReportado`, `ClasificacionIA`, `EmbeddingReporte`, `TransicionReporte`, `ReintentoReporte`.

#### `ReporteRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `create(input: ReporteCreateInput, tx?)` | DTO con datos del reporte | `ReporteDto` | Crea reporte y vincula identificador reportado. |
| `findById(id, tx?)` | ID CUID | `ReporteDto \| null` | Incluye identificador y última clasificación. |
| `findByNumeroSeguimiento(numero, tx?)` | string | `ReporteDto \| null` | Para seguimiento público. |
| `findByIdentificador(input, tx?)` | `{ valor, tipo, tenantId? }` | `ReporteDto[]` | Búsqueda por identificador reportado. |
| `findByAutor(autorId, paginación, tx?)` | `ReporteListQuery` | `{ items, pagination }` | Para "mis reportes". |
| `update(id, input, tx?)` | `ReporteUpdateInput` | `ReporteDto` | Actualiza estado y metadatos. |
| `count(query, tx?)` | `ReporteCountQuery` | `number` | Para paginación y filtros. |

#### `IdentificadorReportadoRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `upsert(input, tx?)` | `IdentificadorInput` | `IdentificadorDto` | Crea o actualiza el identificador. |
| `findByValor(valor, tipo, tx?)` | string, tipo | `IdentificadorDto \| null` | |
| `updateVisibilidad(id, visible, tx?)` | ID, boolean | `IdentificadorDto` | Aplica umbral de visibilidad. |
| `findVisibleByValor(valor, tx?)` | string | `IdentificadorDto \| null` | Solo si es públicamente visible. |

#### `ClasificacionIARepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `findByReporteId(reporteId, tx?)` | ID | `ClasificacionIADto \| null` | |
| `create(input, tx?)` | `ClasificacionIACreateInput` | `ClasificacionIADto` | |
| `update(id, input, tx?)` | ID, `ClasificacionIAUpdateInput` | `ClasificacionIADto` | |

#### `EmbeddingRepository` (adaptador de infraestructura)

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `insertReporteEmbedding(reporteId, vector, tx?)` | ID, vector | void | `$executeRaw` sobre `embeddingReporte`. |
| `findSimilarReportes(reporteId, umbral, tx?)` | ID, número | `SimilarReporteDto[]` | `$queryRaw` con `pgvector`. |
| `deleteByReporteId(reporteId, tx?)` | ID | void | Elimina embeddings del reporte. |
| `insertDatasetEmbedding(datasetId, vector, tx?)` | ID, vector | void | Para dataset de entrenamiento. |

#### `TransicionReporteRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `create(input, tx?)` | `TransicionCreateInput` | `TransicionDto` | Registra cambio de estado. |
| `findByReporteId(reporteId, tx?)` | ID | `TransicionDto[]` | Historial de transiciones. |

#### `ReintentoReporteRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `findFirst(input, tx?)` | `ReintentoQuery` | `ReintentoDto \| null` | |
| `create(input, tx?)` | `ReintentoCreateInput` | `ReintentoDto` | |
| `update(id, input, tx?)` | ID, `ReintentoUpdateInput` | `ReintentoDto` | |
| `count(query, tx?)` | `ReintentoCountQuery` | `number` | |
| `findMany(query, tx?)` | `ReintentoListQuery` | `ReintentoDto[]` | |

---

### 1.2 Agregado `ConsultaPublica`

No es un agregado de persistencia, sino un servicio de lectura que combina `ParametroSistema`, `IdentificadorReportado` y `Reporte`.

#### `ConsultaPublicaService`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `resumen(input, tx?)` | `ConsultaResumenInput` | `ConsultaResumenDto` | Agrega plataformas, ubicaciones, timeline. |
| `detalle(input, tx?)` | `ConsultaDetalleInput` | `ConsultaDetalleDto` | Detalle autenticado con mapeo a DTOs. |
| `esVisible(input, tx?)` | identificador | boolean | Verifica umbral contra `ParametroSistema`. |

#### `RiesgoConsultaService`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `calcularRiesgo(agregados, tx?)` | datos agregados | `NivelRiesgo` | Cálculo puramente funcional; accede a parámetros vía `src/lib/parametros.ts`. |

---

### 1.3 Agregado `Configuracion`

#### `ParametroRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `findAllPublic(tx?)` | — | `ParametroPublicoDto[]` | Valores públicos parseados. |
| `findMany(query, tx?)` | `ParametroListQuery` | `{ items, pagination }` | Para admin. |
| `findByClave(clave, tx?)` | string | `ParametroDto \| null` | |
| `create(input, tx?)` | `ParametroCreateInput` | `ParametroDto` | |
| `update(clave, input, tx?)` | string, `ParametroUpdateInput` | `ParametroDto` | Incluye validación y cifrado de secretos. |
| `delete(clave, tx?)` | string | void | Bloquea parámetros críticos. |

`src/lib/parametros.ts` se conserva como servicio de lectura/caché; puede delegar en `ParametroRepository`.

---

### 1.4 Agregado `Autenticacion`

#### `UsuarioRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `findByEmail(email, tx?)` | string | `UsuarioDto \| null` | |
| `findById(id, tx?)` | ID | `UsuarioDto \| null` | |
| `create(input, tx?)` | `UsuarioCreateInput` | `UsuarioDto` | |
| `update(id, input, tx?)` | ID, `UsuarioUpdateInput` | `UsuarioDto` | |

#### `CodigoVerificacionRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `countActivos(email, tx?)` | string | number | Rate-limit de códigos. |
| `create(input, tx?)` | `CodigoCreateInput` | `CodigoDto` | |
| `findFirstValido(input, tx?)` | email, código | `CodigoDto \| null` | |
| `update(id, input, tx?)` | ID, `CodigoUpdateInput` | `CodigoDto` | Marca como usado o incrementa intentos. |

#### `TokenRecuperacionRepository`

| Método | Entrada | Salida | Notas |
|--------|---------|--------|-------|
| `findManyValidos(email, tx?)` | string | `TokenRecuperacionDto[]` | |
| `create(input, tx?)` | `TokenCreateInput` | `TokenRecuperacionDto` | |
| `invalidateAll(email, tx?)` | string | void | |
| `update(id, input, tx?)` | ID, `TokenUpdateInput` | `TokenRecuperacionDto` | Marca como usado. |

---

## 2. Servicios de flujo (casos de uso)

### 2.1 Módulo Reporte

| Servicio | Responsabilidad | Repositorios usados |
|----------|-----------------|---------------------|
| `ReporteCreationService` | Validación, deduplicación, cifrado de texto, generación de número de seguimiento, creación de reporte, encolado. | `ReporteRepository`, `IdentificadorReportadoRepository`, `PlataformaRepository` (lectura) |
| `ReporteProcessingService` | Orquestación del pipeline de IA: seguridad, duplicados, ráfagas, clasificación, embedding, anonimización, finalización. | `ReporteRepository`, `ClasificacionIARepository`, `EmbeddingRepository`, `TransicionReporteRepository`, `IdentificadorReportadoRepository` |
| `ReporteLifecycleService` | Baja, reactivación, anonimización, fallback, purga de embeddings/dataset, recálculo de score y visibilidad. | `ReporteRepository`, `ClasificacionIARepository`, `EmbeddingRepository`, `TransicionReporteRepository`, `IdentificadorReportadoRepository` |
| `ReporteQueryService` | Listados, detalle, seguimiento y mapeo a DTOs de dominio. | `ReporteRepository`, `IdentificadorReportadoRepository`, `ClasificacionIARepository` |

### 2.2 Otros módulos (fases posteriores)

- `ApelacionService` → reutiliza `ApelacionRepository` y `ReporteLifecycleService`.
- `CirculoConfianzaService` → `ContactoConfianzaRepository`, `IdentificadorContactoRepository`, `ReporteRepository`.
- `AlertaService` → `AlertaSuscripcionRepository`.
- `OperadorService` → `UsuarioRepository`, `PerfilOperadorRepository`.
- `AsignacionService` → `OperadorRepository`, `ReporteRepository`, `SolicitudComiteRepository`.
- `EvalRunService` / `EvalCasoService` → `EvalRunRepository`, `CasoEvalRepository`, `EvalResultadoRepository`.
- `EstadisticasService` → `EstadisticasRepository` (raw queries agregadas).

---

## 3. DTOs de dominio (ejemplos representativos)

### 3.1 `ReporteDto`

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | CUID |
| `numeroSeguimiento` | string | |
| `identificador` | `IdentificadorReportadoDto` | Valor y tipo |
| `plataforma` | string | |
| `texto` | string | Cifrado en reposo; descifrado en el servicio autorizado |
| `textoAnonimizado` | string \| null | |
| `estado` | `EstadoReporte` | Enum importado de dominio |
| `categoria` | `CategoriaConducta` \| null | Última clasificación |
| `confianza` | number \| null | |
| `ciudad` | string \| null | |
| `pais` | string \| null | |
| `tenantId` | string \| null | |
| `creadoEn` | Date | |
| `actualizadoEn` | Date | |

### 3.2 `ReporteCreateInput`

| Campo | Tipo | Notas |
|-------|------|-------|
| `identificadorValor` | string | |
| `identificadorTipo` | string | número, nick, usuario |
| `plataformaKey` | string | |
| `texto` | string | Sin multimedia |
| `ciudad` | string \| null | |
| `pais` | string \| null | |
| `esAnonimo` | boolean | |
| `autorId` | string \| null | |
| `tenantId` | string \| null | |

### 3.3 `ConsultaResumenDto`

| Campo | Tipo | Notas |
|-------|------|-------|
| `identificador` | `IdentificadorReportadoDto` | |
| `totalReportes` | number | |
| `reportesIndependientes` | number | |
| `visiblePublicamente` | boolean | |
| `plataformas` | `{ key, nombre, count }[]` | |
| `ubicaciones` | `{ ciudad, pais, count }[]` | |
| `timeline` | `{ fecha, count }[]` | |
| `nivelRiesgo` | `NivelRiesgo` | |

### 3.4 `ParametroPublicoDto`

| Campo | Tipo | Notas |
|-------|------|-------|
| `clave` | string | |
| `valor` | string \| number \| boolean | Parseado según tipo |
| `tipo` | `TipoParametro` | |
| `descripcion` | string | |

---

## 4. Unit of Work y transacciones

Para mantener la atomicidad de operaciones que involucran varios repositorios, se propone un helper `UnitOfWork`:

```typescript
// Conceptual (a definir en implementación)
await withUnitOfWork(async (tx) => {
  await reporteRepo.update(id, { estado: "CLASIFICADO" }, tx);
  await clasificacionRepo.create({ reporteId: id, ... }, tx);
  await transicionRepo.create({ ... }, tx);
});
```

Alternativa: pasar `tx` explícitamente entre servicios y repositorios, siguiendo el patrón `tx ?? prisma` ya presente en el proyecto.

---

## 5. Convenciones de ubicación

```text
src/lib/dal/
├── types/
│   ├── reporte.ts
│   ├── consulta.ts
│   ├── parametro.ts
│   └── auth.ts
├── repositories/
│   ├── reporte.ts
│   ├── identificador-reportado.ts
│   ├── clasificacion-ia.ts
│   ├── embedding.ts
│   ├── transicion-reporte.ts
│   ├── reintento-reporte.ts
│   ├── parametro.ts
│   ├── usuario.ts
│   └── ...
├── services/
│   ├── reporte-creation.ts
│   ├── reporte-processing.ts
│   ├── reporte-lifecycle.ts
│   ├── reporte-query.ts
│   ├── consulta-publica.ts
│   └── ...
└── unit-of-work.ts
```

---

## 6. Límites y fronteras

- **No se modelan cambios en la base de datos**: todos los DTOs se mapean desde el schema actual.
- **Infraestructura fuera del DAL**: `queue.ts`, `rate-limit.ts`, `email.ts`, `sms.ts` siguen en `src/lib/` como adaptadores.
- **Autorización fuera del DAL**: `verifyAuth`, roles y permisos permanecen en rutas y `src/lib/auth.ts`.
- **Validación de input HTTP fuera del DAL**: las rutas validan formato, longitudes y campos requeridos; los servicios validan reglas de dominio.
