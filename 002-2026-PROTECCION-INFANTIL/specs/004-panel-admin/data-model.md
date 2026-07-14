# Data Model — Panel de Administración

**Contexto**: El panel admin opera sobre el modelo de datos existente del sistema de reportes. La mayoría de las entidades se reutilizan; **AuditLog es la única tabla nueva** requerida para esta feature.

---

## Nueva tabla: AuditLog

AuditLog ya existe como modelo en `prisma/schema.prisma` (definido en la fase inicial del proyecto). Si aún no está aplicada en la base de datos, su migración se crea con:

```bash
npx prisma migrate dev --name add_audit_log
```

Si el shadow database falla por `pgvector` (mismo patrón que `add_pais_ciudad`):

1. Crear `prisma/migrations/YYYYMMDD_HHMMSS_add_audit_log/migration.sql` con el DDL de `AuditLog` según el schema.
2. Aplicar con `psql` directamente contra la BD real.
3. Registrar en `_prisma_migrations` con `gen_random_uuid()`.
4. Ejecutar `npx prisma generate`.

**NUNCA usar `npx prisma db push`**.

### Estructura AuditLog

| Campo | Tipo | Visibilidad admin | Notas |
|-------|------|-------------------|-------|
| id | CUID | ✅ | Identificador |
| accion | AccionAudit | ✅ | Tipo de acción (enum existente) |
| tipoRecurso | string | ✅ | "reporte", "clasificacion", etc. |
| recursoId | string | ✅ | ID del recurso afectado |
| usuarioId | FK | ✅ | Quién ejecutó |
| valorAnterior | string | ✅ | Estado previo (metadata) |
| valorNuevo | string | ✅ | Estado nuevo (metadata) |
| ipAddress | string | ✅ | IP del cliente |
| creadoEn | DateTime | ✅ | Timestamp |

### Restricción dura: valorAnterior / valorNuevo — solo metadata

`valorAnterior` y `valorNuevo` almacenan **únicamente** identificadores, estados o categorías. **NUNCA** almacenan:

- Texto completo de reporte (ni `texto` ni `textoOriginal`)
- Nombres, colegios, direcciones, teléfonos u otra PII
- Respuestas crudas del LLM (`rawResponse`)

**Ejemplos válidos**:
```
valorAnterior: "CONTACTO_INSISTENTE"
valorNuevo: "SOLICITUD_MATERIAL"
```
```
valorAnterior: "REQUIERE_ANONIMIZACION"
valorNuevo: "CLASIFICADO"
```

**Ejemplo de anonimización** (se loguea sin el texto):
```
accion: "ANONIMIZACION"
tipoRecurso: "reporte"
recursoId: "cmr..."
valorAnterior: "REQUIERE_ANONIMIZACION"
valorNuevo: "CLASIFICADO"
```
El log dice *qué* se anonimizó y *quién* lo hizo, pero **nunca incluye el texto original**.

---

## Entidades existentes (admin view)

### Reporte

| Campo | Tipo | Visibilidad admin | Notas |
|-------|------|-------------------|-------|
| id | CUID | ✅ | Identificador único |
| identificador | string | ✅ | Número/nick reportado |
| plataformaId | FK | ✅ | Relación a Plataforma |
| texto | text | ✅ | Texto anonimizado (público) |
| textoOriginal | text | ✅ **SOLO ADMIN** | Texto con PII; nunca en APIs públicas |
| fechaIncidente | DateTime | ✅ | Fecha del incidente |
| ciudad | string | ✅ | Ciudad (texto libre o de catálogo) |
| pais | string | ✅ | País (texto) |
| paisId | FK | ✅ | Relación a Pais (opcional) |
| ciudadId | FK | ✅ | Relación a Ciudad (opcional) |
| otraPlataforma | string | ✅ | Texto libre si plataforma = "otro" |
| estado | EstadoReporte | ✅ | PENDIENTE, PROCESANDO, CLASIFICADO, REVISION_MANUAL, POSIBLE_SPAM, DUPLICADO, REQUIERE_ANONIMIZACION, CORREGIDO |
| esAnonimo | boolean | ✅ | Reporte anónimo vs autenticado |
| usuarioId | FK | ✅ | Quién reportó (null si anónimo) |
| numeroSeguimiento | string | ✅ | RPT-XXXXXX |
| processingError | text | ✅ | Error del worker si aplica |
| creadoEn | DateTime | ✅ | Fecha de creación |
| actualizadoEn | DateTime | ✅ | Última modificación |

**Índices relevantes para filtros admin**: `estado`, `creadoEn`, `plataformaId`, `paisId`, `ciudadId`

### ClasificacionIA

| Campo | Tipo | Visibilidad admin | Notas |
|-------|------|-------------------|-------|
| reporteId | FK (unique) | ✅ | Relación 1:1 con Reporte |
| categoria | CategoriaConducta | ✅ | Categoría asignada por IA |
| confianza | float | ✅ | 0.0 - 1.0 |
| contienePii | boolean | ✅ | IA detectó PII |
| piiDetectada | string[] | ✅ | Lista de entidades PII detectadas |
| modeloUsado | string | ✅ | Nombre del modelo Ollama |
| latenciaMs | int | ✅ | Tiempo de respuesta |
| rawResponse | text | ✅ | Respuesta cruda del LLM |

### CorreccionAdmin

| Campo | Tipo | Visibilidad admin | Notas |
|-------|------|-------------------|-------|
| id | CUID | ✅ | Identificador |
| clasificacionId | FK (unique) | ✅ | Relación a ClasificacionIA |
| categoriaOriginal | CategoriaConducta | ✅ | Categoría antes de corregir |
| categoriaCorregida | CategoriaConducta | ✅ | Categoría después de corregir |
| adminId | FK | ✅ | Usuario ADMIN que corrigió |
| motivo | text | ✅ | Justificación (opcional) |
| creadoEn | DateTime | ✅ | Timestamp |

### DatasetEntrenamiento

| Campo | Tipo | Visibilidad admin | Notas |
|-------|------|-------------------|-------|
| id | CUID | ✅ | Identificador |
| texto | text | ✅ | Texto anonimizado (nunca textoOriginal) |
| clasificacionCorrecta | CategoriaConducta | ✅ | Categoría corregida |
| fuente | string | ✅ | "correccion_manual" o "revision_admin" |
| correccionId | FK | ✅ | Relación a CorreccionAdmin |
| usadoParaEntrenamiento | boolean | ✅ | Flag de consumo |
| creadoEn | DateTime | ✅ | Timestamp |

### Usuario

| Campo | Tipo | Visibilidad admin | Notas |
|-------|------|-------------------|-------|
| id | CUID | ✅ | Identificador |
| email | string | ✅ | Email del usuario |
| nombre | string | ✅ | Nombre |
| rol | RolUsuario | ✅ | ADMIN, SCHOOL_ADMIN, PARENT |
| estado | EstadoUsuario | ✅ | activo, inactivo, bloqueado |

---

## Estado de reporte — flujo administrativo

```
PENDIENTE ──► PROCESANDO ──► CLASIFICADO
                              │
                    (contiene PII) ──► REQUIERE_ANONIMIZACION ──► CLASIFICADO (anonimizado)
                              │
                    (spam detectado) ──► POSIBLE_SPAM
                              │
                    (duplicado) ──► DUPLICADO
                              │
                    (error IA) ──► REVISION_MANUAL ──► CLASIFICADO (corregido)
                              │
                    (corrección admin) ──► CORREGIDO
```

---

## Consideraciones de PII

- `textoOriginal` solo se selecciona en endpoints con `verifyAuth` + rol ADMIN
- El dashboard de estadísticas agrega sobre `texto` (anonimizado), nunca sobre `textoOriginal`
- `DatasetEntrenamiento.texto` usa siempre la versión anonimizada
- `AuditLog.valorAnterior` / `valorNuevo` nunca contienen texto de reporte ni PII — solo metadata (estado, categoría, ID)