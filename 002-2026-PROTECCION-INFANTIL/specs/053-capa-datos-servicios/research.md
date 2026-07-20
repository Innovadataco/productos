# Research: Capa de datos / servicios (DAL)

**Date**: 2026-07-20
**Feature**: specs/053-capa-datos-servicios/spec.md

---

## 1. Resumen ejecutivo

La base de código ya muestra una tendencia a separar responsabilidades: varios archivos en `src/lib/` actúan como servicios de dominio. Sin embargo, las rutas API (`src/app/api/**`) contienen todavía una gran cantidad de lógica de acceso a datos y transacciones directas con Prisma. El objetivo de este spec es formalizar una capa de datos (DAL) con repositorios, servicios de flujo y DTOs, comenzando por el módulo Reporte.

---

## 2. Uso directo de Prisma en rutas

| Área | Archivos principales | Observaciones |
|------|----------------------|---------------|
| **Reporte** | `src/app/api/reportes/route.ts`, `src/app/api/reportes/procesar/route.ts` y helpers, `src/app/api/reportes/mis-reportes/route.ts`, `src/app/api/reportes/seguimiento/[numero]/route.ts`, `src/app/api/reportes/fallback/route.ts` | ~122 llamadas. Incluye creación, deduplicación, cifrado, encolado, pipeline de IA, detección de ráfagas, embeddings (`pgvector`), transiciones de estado y scoring. |
| **Consulta pública** | `src/app/api/consulta/route.ts`, `src/app/api/consulta/detalle/route.ts` | ~31 llamadas. Agregación en memoria de plataformas, ubicaciones, timeline, cálculo de riesgo y reglas de visibilidad. |
| **Autenticación** | `src/app/api/auth/**` | ~32 llamadas. Flujos de login, registro, códigos de verificación, tokens de recuperación y cambio de contraseña. |
| **Configuración** | `src/app/api/config/parametros/**` | ~16 llamadas. CRUD de parámetros, encriptación de secretos, caché y auditoría. `src/lib/parametros.ts` ya es una abstracción parcial. |
| **Admin / Reportes** | `src/app/api/admin/reportes/**`, `src/app/api/admin/reportes-revision/**`, `src/app/api/admin/correcciones/**`, `src/app/api/admin/spam/**` | ~346 llamadas. El área con mayor acoplamiento directo: CRUD de reportes, clasificaciones, correcciones, comité, spam, escalamiento, transiciones. |
| **Admin / Comité** | `src/app/api/admin/comite/**` | Gestión de solicitudes, asignación, reasignación, resolución e integrantes. |
| **Apelaciones** | `src/app/api/apelaciones/**`, `src/app/api/admin/apelaciones/**`, `src/lib/apelaciones.ts` | Flujos públicos y de admin. La lógica central ya está en `src/lib/apelaciones.ts`, buen candidato a servicio. |
| **Círculo de confianza** | `src/app/api/circulo-confianza/**`, `src/lib/circulo-confianza.ts` | Las rutas ya delegan en `src/lib/circulo-confianza.ts`; es un buen candidato a servicio formal. |
| **Alertas** | `src/app/api/alertas/**`, `src/lib/email.ts` | CRUD de suscripciones y envío de alertas. |
| **Operadores** | `src/app/api/admin/operadores/**`, `src/lib/operadores/asignador.ts` | CRUD de usuarios con perfil de operador, asignación y configuración de modelo. |
| **IA / Evaluación** | `src/app/api/admin/ia/**`, `src/app/api/admin/dataset-entrenamiento/route.ts`, `src/lib/ai/**` | Uso intensivo de raw queries para vectores (`pgvector`), evaluaciones y dataset. |
| **Estadísticas** | `src/app/api/admin/estadisticas/**`, `src/app/api/estadisticas-publicas/route.ts` | Consultas agregadas con `count`, `groupBy` y `$queryRaw`. |
| **Infraestructura** | `src/lib/queue.ts`, `src/lib/rate-limit.ts` | Raw queries sobre PostgreSQL para pg-boss y rate-limit. No son dominio de negocio, pero dependen de Prisma. |

**Cifras globales**: aproximadamente **173 archivos** importan `prisma` y se detectan **~796 ocurrencias** de `prisma.` en `src/`. La mayoría están en rutas API.

---

## 3. Abstracciones existentes

El proyecto ya cuenta con servicios de dominio que reducen el código en las rutas, aunque aún dependen de Prisma y devuelven modelos de Prisma:

| Archivo | Rol actual | Notas |
|---------|------------|-------|
| `src/lib/parametros.ts` | Servicio de lectura de parámetros | Usa `client: ParametroClient = prisma`; buen punto de partida para `ParametroRepository`. |
| `src/lib/audit.ts` | Escritura de `AuditLog` | Acepta `tx ?? prisma`; se reutiliza sin cambios. |
| `src/lib/reporte-lifecycle.ts` | Baja y reactivación de reportes | Múltiples operaciones transaccionales cruzadas; núcleo del futuro `ReporteLifecycleService`. |
| `src/lib/reporte-transiciones.ts` | Registro de transiciones | Acepta `tx ?? prisma`; puede convertirse en `TransicionReporteRepository`. |
| `src/lib/scoring.ts` | Cálculo y persistencia de score | Acepta `tx ?? prisma`; puede integrarse en el DAL. |
| `src/lib/visibility.ts` | Reglas de visibilidad pública | Acepta `tx ?? prisma`; puede convertirse en `IdentificadorReportadoRepository`. |
| `src/lib/apelaciones.ts` | Creación, verificación y resolución de apelaciones | Buen candidato a servicio formal. |
| `src/lib/circulo-confianza.ts` | Gestión de contactos y agregados | Ya centraliza operaciones; candidato a `CirculoConfianzaService`. |
| `src/lib/operadores/asignador.ts` | Asignación de operadores | Candidato a `OperadorService` / `AsignacionService`. |
| `src/lib/anti-abuso/fuente-reporte.ts` | Registro y peso de fuente | Candidato a repositorio/servicio. |
| `src/lib/ai/dataset-retrieval.ts`, `similarity.ts` | Búsqueda RAG por similitud | Raw queries `pgvector`; deben quedar en repositorios especializados. |
| `src/lib/queue.ts`, `src/lib/rate-limit.ts` | Infraestructura sobre PostgreSQL | No son dominio; se mantienen como adaptadores de infraestructura. |

---

## 4. Análisis del módulo Reporte (candidato inicial)

### 4.1 Operaciones y complejidad

| Archivo | Operaciones principales | Complejidad de extracción |
|---------|------------------------|---------------------------|
| `src/app/api/reportes/route.ts` | `plataforma.findUnique`, `reporte.findFirst/Unique/create`, `identificadorReportado.upsert` | Media: mezcla HTTP, validación, rate-limit, cifrado y persistencia. |
| `src/app/api/reportes/mis-reportes/route.ts` | `reporte.findMany`, `reporte.count`, `identificadorReportado.findMany` | Baja: lecturas puras. |
| `src/app/api/reportes/seguimiento/[numero]/route.ts` | `reporte.findUnique`, `identificadorReportado.findUnique` | Baja: lecturas puras. |
| `src/app/api/reportes/fallback/route.ts` | `reporte.findUnique`, `$transaction` con update + transición | Media: flujo de fallback a revisión manual. |
| `src/app/api/reportes/procesar/route.ts` y helpers | `clasificacionIA.findUnique`, `$transaction`, `embeddingReporte.findUnique`, `$executeRaw`, `reporte.updateMany`, `reporte.count`, `actualizarVisibilidadPublica`, `recalcularYGuardarScore` | Alta: pipeline de IA con raw queries, transacciones y efectos secundarios. |
| `src/lib/reporte-lifecycle.ts` | `reporte.findUnique/update`, `embeddingReporte.delete`, `datasetEntrenamiento.delete`, `embeddingDataset.delete`, `$transaction`, `$executeRaw`, `logAudit`, `registrarTransicion`, `recalcularYGuardarScore`, `actualizarVisibilidadPublica` | Alta: núcleo del ciclo de vida. |
| `src/lib/reporte-transiciones.ts` | `reporte.findUnique`, `transicionReporte.create` | Baja: casi puro repositorio. |
| `src/lib/reporte-reintentos.ts` | `reintentoReporte.findFirst/create/update/count/findMany` | Baja: CRUD simple. |
| `src/lib/scoring.ts` | `reporte.findMany`, `identificadorReportado.upsert` | Media: lógica de cálculo + persistencia. |
| `src/lib/visibility.ts` | `identificadorReportado.findUnique/update` | Baja: regla de umbral. |

### 4.2 ¿Por qué empezar por Reporte?

1. **Mayor impacto**: concentra la mayor superficie de acceso a datos y transacciones complejas.
2. **Centralidad de negocio**: el ciclo de vida del reporte es el eje del producto.
3. **Base de servicios previa**: `reporte-lifecycle.ts`, `reporte-transiciones.ts`, `scoring.ts`, `visibility.ts` demuestran la intención de separación; solo falta formalizar repositorios y DTOs.
4. **Patrón transaccional reutilizable**: resolver el paso de `tx` entre repositorios en Reporte simplifica el resto de módulos.

---

## 5. Riesgos identificados

1. **Transacciones cruzadas**: muchos flujos usan `prisma.$transaction` sobre Reporte, Clasificación, Embedding, Dataset, IdentificadorReportado, Audit y Transición. La abstracción debe permitir compartir un `tx` común.
2. **Raw queries**: `pgvector`, `pg-boss` y rate-limit usan `$queryRaw` / `$executeRaw`. Deben quedar en repositorios/infraestructura especializados.
3. **Tipos de Prisma en rutas**: los enums (`EstadoReporte`, `CategoriaConducta`, `RolUsuario`) y los tipos de filtro (`Prisma.*`) se importan en rutas. La estrategia es permitir importar enums, pero ocultar `PrismaClient` y filtros.
4. **Tests con fixtures directas**: muchos tests crean datos con `prisma.*`. La migración de tests se hará opcionalmente; los tests existentes deben seguir pasando.
5. **Servicios que llaman a servicios dentro de transacciones**: `reporte-lifecycle.ts` invoca `recalcularYGuardarScore`, `actualizarVisibilidadPublica`, `logAudit` y `registrarTransicion`. Se debe asegurar que todos acepten el mismo `tx`.
6. **Campos `Unsupported("vector")`**: Prisma no modela vectores nativamente; los embeddings siempre requerirán un `EmbeddingRepository` con raw queries.
7. **Acoplamiento a `pg-boss`**: `src/lib/queue.ts` usa raw queries y Prisma. Se mantiene como adaptador de infraestructura, no como repositorio de dominio.

---

## 6. Propuesta de enfoque

### 6.1 Secuencia recomendada

| Fase | Módulo | Objetivo |
|------|--------|----------|
| 1 | **Reporte** | Crear repositorios (`Reporte`, `IdentificadorReportado`, `ClasificacionIA`, `Embedding`, `Transicion`, `Reintento`) y servicios (`ReporteCreationService`, `ReporteProcessingService`, `ReporteLifecycleService`, `ReporteQueryService`). |
| 2 | **Consulta pública** | Crear `ConsultaPublicaService` y `RiesgoConsultaService`; refactorizar `src/app/api/consulta/**`. |
| 3 | **Configuración** | Crear `ParametroRepository` sin alterar `src/lib/parametros.ts` como servicio de lectura. |
| 4 | **Autenticación** | Crear `UsuarioRepository`, `CodigoVerificacionRepository`, `TokenRecuperacionRepository` y `AuthService`. |
| 5 | **Apelaciones, Alertas, Círculo de confianza, Operadores** | Aplicar el patrón repositorio + servicio; reutilizar servicios existentes. |
| 6 | **IA / Estadísticas** | Encapsular raw queries en `EmbeddingRepository`, `EvalRunRepository`, `CasoEvalRepository`, `EstadisticasRepository`. |

### 6.2 Principios de diseño

- **Un solo punto de importación de Prisma**: los repositorios son los únicos que importan `prisma` (y los tipos necesarios de `@prisma/client`). Las rutas importan solo servicios y DTOs.
- **Cliente transaccional inyectable**: todos los repositorios aceptan `tx?: Prisma.TransactionClient`.
- **DTOs de dominio**: las rutas reciben y devuelven DTOs, no modelos crudos de Prisma.
- **No abstraer de más**: endpoints de lectura simple pueden conservar el repositorio directo si usan DTOs; el objetivo es sacar la lógica de negocio y transacciones de las rutas.
- **Infraestructura separada**: raw queries, colas y rate-limit viven en adaptadores dedicados, no en rutas.

---

## 7. Alternativas consideradas

| Alternativa | Por qué se descarta |
|-------------|---------------------|
| Big-bang de todo el código base | Riesgo alto de regresión; dificulta la revisión y el rollback. |
| Reemplazar Prisma por otro ORM | Fuera de scope y prohibido por constitución §2.1 (stack heredado). |
| Dejar los repositorios en `src/lib/` sin directorio `dal` | Aumenta la dispersión y dificulta detectar acoplamiento residual. |
| Migrar todos los tests de una sola vez | Añade esfuerzo innecesario; los tests se pueden adaptar progresivamente. |

---

## 8. Open Questions (0 remaining)

Todas las dudas de alcance se resuelven con la constitución y el programa de saneamiento:
- La migración es incremental y no toca SPEC-050 ni SPEC-060.
- No hay cambios de esquema ni datos.
- Prisma sigue siendo el ORM; el DAL es una capa delgada.
