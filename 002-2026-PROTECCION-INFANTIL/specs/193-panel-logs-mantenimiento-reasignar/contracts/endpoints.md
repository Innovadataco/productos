# Contracts — Panel de Logs + Mantenimiento + Reasignar Operador

**Base Path**: `/api/admin`

---

## Endpoints de monitoreo de logs

### GET `/api/admin/monitoreo/logs`

Listar logs de workers. Acceso exclusivo para rol `ADMIN`; rate-limit `admin_read`.

**Query params**:

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `servicio` | string | no | - | Filtrar por nombre de servicio (`pi-app`, `pi-worker`, `pi-monitor`, `pi-simulador-abuso`) |
| `nivel` | string | no | - | Nivel mínimo (`DEBUG`, `INFO`, `WARN`, `ERROR`). Si se envía `WARN`, incluye `WARN` y `ERROR`. |
| `desde` | ISO 8601 | no | - | Inicio del rango (inclusive) |
| `hasta` | ISO 8601 | no | - | Fin del rango (inclusive) |
| `q` | string | no | - | Subcadena a buscar en `mensaje` (case-insensitive) |
| `limit` | int | no | 100 | Cantidad máxima de resultados; mínimo 1, máximo 500 (o `monitoreo.logs.max_muestras_ui` si aplica) |
| `offset` | int | no | 0 | Desplazamiento para paginación; mínimo 0 |

**Respuesta 200 OK**:

```json
{
  "items": [
    {
      "id": "cm0abc...",
      "servicio": "pi-worker",
      "nivel": "ERROR",
      "mensaje": "[Worker] Clasificación fallida: timeout al contactar Ollama",
      "contextoJson": { "reporteId": "cm0xyz...", "latenciaMs": 30000 },
      "creadoEn": "2026-08-21T03:45:00.000Z"
    }
  ],
  "total": 1240
}
```

**Códigos de error**:

- `400`: parámetros inválidos (rango invertido, `limit` fuera de rango, `offset` negativo, nivel desconocido).
- `401`: no autenticado.
- `403`: usuario autenticado pero sin rol `ADMIN`.
- `429`: rate-limit excedido.
- `500`: error interno.

---

### DELETE `/api/admin/monitoreo/logs`

Ejecutar purga manual de logs antiguos. Acceso exclusivo para rol `ADMIN`; rate-limit `admin_write`.

**Body**:

```json
{
  "hasta": "2026-08-20T23:59:59.999Z",
  "servicio": "pi-worker",
  "nivel": "INFO",
  "motivo": "Limpieza mensual de logs de INFO previos para reducir tamaño de BD"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `hasta` | ISO 8601 | sí | Fecha/hora límite (inclusive). Debe ser anterior al día actual. |
| `servicio` | string | no | Filtrar por servicio antes de borrar. |
| `nivel` | string | no | Filtrar por nivel exacto antes de borrar. |
| `motivo` | string | sí | Motivo de la purga; mínimo 20 caracteres, máximo 500. |

**Respuesta 200 OK**:

```json
{
  "filasBorradas": 1240
}
```

**Códigos de error**:

- `400`: `hasta` es hoy o futuro; `motivo` fuera de rango; filtros inválidos.
- `401`: no autenticado.
- `403`: sin rol `ADMIN`.
- `429`: rate-limit excedido.
- `500`: error interno.

**Notas**:

- El endpoint es idempotente: si los filtros no coinciden con ninguna fila, retorna `filasBorradas=0`.
- Siempre inserta un `AuditLog` con `accion='LOGS_MANTENIMIENTO_PURGA'`.

---

## Endpoints de operadores

### PATCH `/api/admin/operadores/reasignar`

Reasignar un reporte de un operador a otro. Acceso exclusivo para rol `ADMIN`; rate-limit `admin_write`.

**Body**:

```json
{
  "reporteId": "cm0xyz...",
  "operadorDestinoId": "cm0op2...",
  "motivo": "El operador destino tiene experiencia en casos de esta categoría y menor carga actual"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `reporteId` | string | sí | ID del reporte a reasignar |
| `operadorDestinoId` | string | sí | ID del operador destino (debe tener rol `OPERADOR` y estar activo) |
| `motivo` | string | sí | Motivo de la reasignación; mínimo 20 caracteres, máximo 500 |

**Respuesta 200 OK**:

```json
{
  "id": "cm0xyz...",
  "operadorId": "cm0op2...",
  "estado": "REVISION_MANUAL",
  "actualizadoEn": "2026-08-21T03:50:00.000Z"
}
```

**Códigos de error**:

- `400`: reporte no está en `REVISION_MANUAL` ni `PROCESADO`; reporte sin `operadorId`; operador destino inválido; motivo fuera de rango; `reporteId` igual a `operadorDestinoId`.
- `401`: no autenticado.
- `403`: sin rol `ADMIN`.
- `404`: reporte no encontrado o operador destino no encontrado.
- `409`: conflicto de concurrencia (el `operadorId` del reporte cambió entre la lectura y la escritura).
- `429`: rate-limit excedido.
- `500`: error interno.

**Notas**:

- El endpoint inserta una fila en `TransicionReporte` con `responsableTipo=ADMIN` y metadatos del cambio.
- Genera un `AuditLog` con `accion='REPORTE_REASIGNADO_MANUAL'`.
- No modifica el estado del reporte.
