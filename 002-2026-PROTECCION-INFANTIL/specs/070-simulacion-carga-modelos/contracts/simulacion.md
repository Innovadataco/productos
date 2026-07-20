# Contracts: Simulación de carga y comparación de modelos (Spec 070)

## Endpoints propuestos

Todos bajo `/api/admin/ia/simulaciones`. Requieren rol `ADMIN`.

---

### GET /api/admin/ia/simulaciones

**Descripción**: listar corridas de simulación paginadas, ordenadas por fecha de inicio descendente.

**Query params**:
- `page` (number, default 1)
- `pageSize` (number, default 25, max 100)
- `estado` (optional): `PENDIENTE`, `EN_PROGRESO`, `COMPLETADA`, `FALLIDA`, `CANCELADA`

**Response 200**:
```json
{
  "items": [
    {
      "id": "cuid",
      "modelo": "ornith:9b",
      "totalCasos": 50,
      "progreso": 50,
      "estado": "COMPLETADA",
      "fechaInicio": "2026-07-20T10:00:00Z",
      "fechaFin": "2026-07-20T10:15:00Z",
      "creadoPor": { "id": "...", "email": "admin@..." }
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 10, "totalPages": 1 }
}
```

---

### POST /api/admin/ia/simulaciones

**Descripción**: crear una nueva simulación (valida archivo, crea `SimulacionRun`, inicia batch creator).

**Body multipart/form-data**:
- `archivo`: archivo CSV o JSON
- `modelo`: string (nombre del modelo Ollama)
- `notas`: string (opcional, max 2000)

**Response 201**:
```json
{
  "simulacion": {
    "id": "cuid",
    "modelo": "ornith:9b",
    "totalCasos": 50,
    "progreso": 0,
    "estado": "PENDIENTE",
    "fechaInicio": "2026-07-20T10:00:00Z"
  }
}
```

**Response 400** (errores de validación):
```json
{
  "error": {
    "message": "El archivo contiene errores de validación",
    "code": "VALIDATION_ERROR",
    "details": [
      { "fila": 3, "indice": 2, "campo": "texto", "mensaje": "Debe tener al menos 20 caracteres" }
    ]
  }
}
```

**Response 409** (corrida en progreso):
```json
{
  "error": {
    "message": "Ya existe una simulación en progreso. Cancele o espere a que finalice.",
    "code": "SIMULATION_IN_PROGRESS"
  }
}
```

---

### GET /api/admin/ia/simulaciones/[id]

**Descripción**: detalle de una corrida, incluyendo progreso y métricas si está finalizada.

**Response 200**:
```json
{
  "id": "cuid",
  "modelo": "ornith:9b",
  "totalCasos": 50,
  "progreso": 50,
  "estado": "COMPLETADA",
  "fechaInicio": "2026-07-20T10:00:00Z",
  "fechaFin": "2026-07-20T10:15:00Z",
  "notas": "Prueba de carga con modelo ornith:9b",
  "metricas": { ... }
}
```

---

### POST /api/admin/ia/simulaciones/[id]/cancelar

**Descripción**: cancelar una corrida en progreso. Detiene la creación de nuevos reportes; los ya encolados siguen su curso.

**Response 200**:
```json
{ "simulacion": { "id": "cuid", "estado": "CANCELADA", "progreso": 12 } }
```

**Response 400** (si no está en progreso):
```json
{ "error": { "message": "Solo se pueden cancelar simulaciones en progreso", "code": "INVALID_STATE" } }
```

---

### GET /api/admin/ia/simulaciones/[id]/resultados

**Descripción**: resultados por caso de una corrida finalizada o cancelada.

**Query params**:
- `page` (number, default 1)
- `pageSize` (number, default 25, max 100)
- `soloFallos` (boolean, optional): filtrar casos con fallo vs. categoría esperada

**Response 200**:
```json
{
  "items": [
    {
      "indice": 0,
      "identificador": "SIM-abc123-000",
      "categoriaEsperada": "CIBERBULLYING",
      "categoriaAsignada": "ACOSO",
      "confianza": 0.82,
      "estado": "CLASIFICADO",
      "latenciaMs": 1240,
      "acierto": false
    }
  ],
  "pagination": { ... }
}
```

---

### GET /api/admin/ia/simulaciones/[id]/analisis

**Descripción**: métricas agregadas de una corrida.

**Response 200**:
```json
{
  "totalCasos": 50,
  "casosConCategoriaEsperada": 50,
  "aciertos": 38,
  "porcentajeAciertos": 0.76,
  "precisionRecall": [
    { "categoria": "CIBERBULLYING", "precision": 0.8, "recall": 0.75, "f1": 0.77 }
  ],
  "matrizConfusion": [
    { "esperada": "CIBERBULLYING", "asignada": "ACOSO", "conteo": 3 }
  ],
  "falsosNegativosCriticos": [
    { "indice": 5, "identificador": "SIM-abc123-005", "categoriaEsperada": "GROOMING", "categoriaAsignada": "BAJO_RIESGO" }
  ],
  "latencia": { "p50": 1100, "p95": 2450, "promedio": 1200 },
  "estados": { "CLASIFICADO": 40, "REVISION_MANUAL": 5, "POSIBLE_SPAM": 5 }
}
```

---

### POST /api/admin/ia/simulaciones/comparar

**Descripción**: comparar dos corridas completadas (o canceladas) por índice de caso.

**Body**:
```json
{ "ids": ["cuid1", "cuid2"] }
```

**Response 200**:
```json
{
  "corridaA": { "id": "cuid1", "modelo": "ornith:9b", ... },
  "corridaB": { "id": "cuid2", "modelo": "llama3.1:8b", ... },
  "comunes": 50,
  "comparacion": [
    {
      "indice": 0,
      "identificador": "SIM-abc123-000",
      "categoriaEsperada": "CIBERBULLYING",
      "categoriaA": "CIBERBULLYING",
      "categoriaB": "ACOSO",
      "aciertoA": true,
      "aciertoB": false,
      "latenciaA": 1200,
      "latenciaB": 900
    }
  ],
  "resumen": {
    "aciertosA": 38,
    "aciertosB": 35,
    "latenciaA": { "p50": 1100, "p95": 2450 },
    "latenciaB": { "p50": 950, "p95": 2100 }
  }
}
```

---

### GET /api/admin/ia/simulaciones/[id]/export

**Descripción**: exportar resultados de una corrida a CSV o JSON.

**Query params**:
- `formato`: `csv` | `json`

**Response 200**:
- `Content-Type: text/csv` o `application/json`
- `Content-Disposition: attachment; filename="simulacion-{id}.csv"` (o `.json`)

