# Data Model — Panel de Administración

**Contexto**: El panel admin opera sobre el modelo de datos existente del sistema de reportes. No se crean nuevas tablas para esta feature; se reutilizan y documentan las entidades relevantes desde la perspectiva administrativa.

---

## Entidades principales (admin view)

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

### AuditLog

| Campo | Tipo | Visibilidad admin | Notas |
|-------|------|-------------------|-------|
| id | CUID | ✅ | Identificador |
| accion | AccionAudit | ✅ | Tipo de acción |
| tipoRecurso | string | ✅ | "reporte", "clasificacion", etc. |
| recursoId | string | ✅ | ID del recurso afectado |
| usuarioId | FK | ✅ | Quién ejecutó |
| valorAnterior | string | ✅ | Estado previo |
| valorNuevo | string | ✅ | Estado nuevo |
| ipAddress | string | ✅ | IP del cliente |
| creadoEn | DateTime | ✅ | Timestamp |

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
</content>
<write_to_file>
<path>specs/004-panel-admin/contracts/admin-api.md</path>
<content># Admin API Contracts

**Base URL**: `/api/admin/**`

**Autenticación**: Cookie `token` httpOnly + rol ADMIN (`verifyAuth` retorna 403 si rol ≠ ADMIN)

---

## GET /api/admin/reportes-revision

**Descripción**: Lista paginada de reportes con filtros. Existente.

**Query params**:
- `page` (int, default 1)
- `pageSize` (int, default 25, max 100)
- `estado` (EstadoReporte, opcional)
- `plataforma` (string, clave de plataforma, opcional)
- `categoria` (CategoriaConducta, opcional)
- `fechaDesde` (ISO date, opcional)
- `fechaHasta` (ISO date, opcional)
- `contienePii` (boolean, opcional)
- `orderBy` (string: `creadoEn` | `actualizadoEn`, default `creadoEn`)
- `orderDir` (string: `asc` | `desc`, default `desc`)

**Response 200**:
```json
{
  "items": [
    {
      "id": "cmr...",
      "identificador": "+573001234567",
      "plataforma": { "clave": "whatsapp", "nombre": "WhatsApp" },
      "estado": "REQUIERE_ANONIMIZACION",
      "esAnonimo": true,
      "numeroSeguimiento": "RPT-ABCD12",
      "creadoEn": "2026-07-14T10:00:00Z",
      "actualizadoEn": "2026-07-14T10:05:00Z",
      "clasificacion": {
        "categoria": "CONTACTO_INSISTENTE",
        "confianza": 0.94,
        "contienePii": true
      }
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 150, "totalPages": 6 }
}
```

**Nota**: `texto` y `textoOriginal` se omiten en la lista; se cargan en el detalle.

---

## GET /api/admin/reportes-revision/[id]

**Descripción**: Detalle completo de un reporte (incluye PII).

**Response 200**:
```json
{
  "id": "cmr...",
  "identificador": "+573001234567",
  "plataforma": { "clave": "whatsapp", "nombre": "WhatsApp" },
  "texto": "Me contactó por WhatsApp diciendo...",
  "textoOriginal": "Me contactó Juan Pérez por WhatsApp...",
  "estado": "REQUIERE_ANONIMIZACION",
  "ciudad": "Bogotá",
  "pais": "Colombia",
  "fechaIncidente": "2026-07-10",
  "esAnonimo": true,
  "numeroSeguimiento": "RPT-ABCD12",
  "creadoEn": "2026-07-14T10:00:00Z",
  "clasificacion": {
    "categoria": "CONTACTO_INSISTENTE",
    "confianza": 0.94,
    "contienePii": true,
    "piiDetectada": ["nombre_menor", "colegio"],
    "modeloUsado": "ornith:9b",
    "latenciaMs": 1200
  },
  "correccion": null
}
```

---

## POST /api/admin/correcciones

**Descripción**: Crear corrección de clasificación. Existente.

**Body**:
```json
{
  "clasificacionId": "cmr...",
  "categoriaCorregida": "SOLICITUD_MATERIAL",
  "motivo": "El contexto indica solicitud explícita de fotos"
}
```

**Response 201**:
```json
{
  "correccion": {
    "id": "cmr...",
    "categoriaOriginal": "CONTACTO_INSISTENTE",
    "categoriaCorregida": "SOLICITUD_MATERIAL",
    "adminId": "cmr...",
    "motivo": "El contexto indica solicitud explícita de fotos",
    "creadoEn": "2026-07-14T12:00:00Z"
  }
}
```

---

## PATCH /api/admin/reportes/[id]/anonimizar

**Descripción**: Anonimizar reporte en estado REQUIERE_ANONIMIZACION. Existente.

**Body**:
```json
{
  "textoAnonimizado": "Me contactó por WhatsApp diciendo que tenía regalos para mí."
}
```

**Validation**: 20 ≤ length ≤ 5000

**Response 200**:
```json
{
  "reporte": {
    "id": "cmr...",
    "estado": "CLASIFICADO",
    "texto": "Me contactó por WhatsApp...",
    "textoOriginal": "Me contactó Juan Pérez..."
  }
}
```

**Error 400**: Si estado ≠ REQUIERE_ANONIMIZACION → `"El reporte no requiere anonimización"`

---

## GET /api/admin/estadisticas

**Descripción**: Métricas agregadas para el dashboard. **NUEVO**.

**Query params**: Ninguno.

**Response 200**:
```json
{
  "totales": {
    "reportes": 1250,
    "reportesHoy": 12,
    "pendientesRevision": 3,
    "pendientesAnonimizacion": 8,
    "reportesAnonimos": 890,
    "reportesAutenticados": 360
  },
  "porEstado": [
    { "estado": "CLASIFICADO", "count": 800 },
    { "estado": "REQUIERE_ANONIMIZACION", "count": 8 },
    { "estado": "PENDIENTE", "count": 15 }
  ],
  "porCategoria": [
    { "categoria": "CONTACTO_INSISTENTE", "count": 320 },
    { "categoria": "SOLICITUD_MATERIAL", "count": 180 }
  ],
  "porPlataforma": [
    { "plataforma": "WhatsApp", "count": 450 },
    { "plataforma": "Instagram", "count": 280 }
  ],
  "porCiudad": [
    { "ciudad": "Bogotá", "count": 350 },
    { "ciudad": "Medellín", "count": 210 }
  ],
  "tendencia": [
    { "fecha": "2026-06-15", "count": 5 },
    { "fecha": "2026-06-16", "count": 8 }
  ]
}
```

**Reglas**:
- `tendencia` devuelve últimos 30 días
- `porCiudad` usa el campo `ciudad` (string), no `ciudadId`
- Nunca incluye `texto`, `textoOriginal`, `identificador`
- Queries agregadas con `Prisma.count` y `Prisma.groupBy`

---

## GET /api/admin/audit-logs

**Descripción**: Logs de auditoría paginados. **NUEVO**.

**Query params**:
- `page`, `pageSize` (estándar)
- `accion` (AccionAudit, opcional)
- `usuarioId` (string, opcional)
- `fechaDesde`, `fechaHasta` (opcional)

**Response 200**: Lista paginada de AuditLog.

---

## Errores comunes

| Código | Cuándo |
|--------|--------|
| 401 | Cookie ausente o token inválido |
| 403 | Usuario autenticado pero rol ≠ ADMIN |
| 404 | Reporte no encontrado |
| 400 | Validación fallida (textoAnonimizado fuera de rango, estado incorrecto) |
| 409 | Corrección ya existe para esta clasificación |
</content>
<write_to_file>
<path>specs/004-panel-admin/quickstart.md</path>
<content># Quickstart — Panel de Administración

## Escenario A: Acceder al panel como admin

**Prerrequisitos**: Usuario con rol ADMIN existe y está autenticado.

1. Navegar a `/dashboard/admin`
2. Verificar redirección automática si no es ADMIN
3. Confirmar que se muestra la bandeja de reportes por defecto

**Validación**: `GET /api/me` retorna `rol: "ADMIN"`; layout no redirige.

---

## Escenario B: Filtrar reportes pendientes de anonimización

1. En la bandeja, seleccionar filtro `estado = REQUIERE_ANONIMIZACION`
2. Verificar que la lista solo muestra reportes en ese estado
3. Hacer clic en "Ver detalle" del primero
4. Confirmar que se muestra `textoOriginal` con PII

**Validación**: `GET /api/admin/reportes-revision?estado=REQUIERE_ANONIMIZACION` retorna items con ese estado.

---

## Escenario C: Corregir clasificación de un reporte

1. Abrir detalle de un reporte clasificado
2. Seleccionar categoría diferente en el dropdown
3. Opcional: escribir motivo
4. Confirmar corrección
5. Verificar que el detalle ahora muestra la categoría corregida

**Validación**: `POST /api/admin/correcciones` retorna 201; `GET /api/admin/reportes-revision/[id]` muestra `correccion` no nulo.

---

## Escenario D: Anonimizar reporte con PII

1. Filtrar por `REQUIERE_ANONIMIZACION`
2. Abrir detalle de un reporte
3. Ver `textoOriginal` con PII (nombre de menor, colegio)
4. Escribir texto anonimizado (eliminar nombres propios)
5. Confirmar anonimización
6. Verificar estado cambia a `CLASIFICADO`

**Validación**: `PATCH /api/admin/reportes/[id]/anonimizar` retorna 200; BD: `estado=CLASIFICADO`, `textoOriginal` preservado, `texto` = versión anonimizada.

---

## Escenario E: Verificar que PII no se expone públicamente

1. Anonimizar un reporte (Escenario D)
2. Consultar `GET /api/consulta?identificador=...&plataforma=...`
3. Verificar que el conteo aumentó pero no se expone `textoOriginal`

**Validación**: Respuesta de consulta pública no incluye campo `textoOriginal`.

---

## Escenario F: Dashboard con métricas reales

1. Abrir `/dashboard/admin/estadisticas`
2. Verificar tarjetas de totales (reportes, hoy, pendientes)
3. Confirmar gráficos de distribución por estado, categoría, plataforma
4. Verificar tendencia de últimos 30 días

**Validación**: `GET /api/admin/estadisticas` retorna objeto consolidado; suma de `porEstado.count` = `totales.reportes`.

---

## Escenario G: Acceso denegado a no-admin

1. Iniciar sesión como usuario con rol PARENT
2. Intentar navegar a `/dashboard/admin`
3. Verificar redirección a `/` o mensaje de acceso denegado
4. Intentar `GET /api/admin/estadisticas` directamente
5. Verificar 403

**Validación**: Todas las rutas `/api/admin/**` retornan 403 para non-ADMIN.