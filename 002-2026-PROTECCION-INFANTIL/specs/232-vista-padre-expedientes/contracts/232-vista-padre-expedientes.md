# Contratos — SPEC-232

## Endpoints API

### `POST /api/padre/expedientes/[id]/eventos`

**Auth:** PARENT autenticado.

**Body:**
```json
{
  "texto": "Nueva situación ocurrida hoy...",
  "plataforma": "Instagram",
  "fechaEvento": "2026-08-24T10:00:00.000Z"
}
```

**Respuestas:**

| Código | Condición |
|---|---|
| 201 | Evento creado exitosamente. Retorna el `EventoExpediente` creado. |
| 400 | Texto vacío o supera 2000 caracteres. |
| 401 | No autenticado. |
| 403 | Usuario no es PARENT. |
| 404 | Expediente no existe o no pertenece al padre. |
| 409 | Expediente está `CERRADO`. |

**Efectos:**
- Crea `EventoExpediente` con `ordenSecuencial` siguiente.
- Crea `Reporte` asociado con datos del expediente.
- Actualiza `Expediente.numEventos` y `Expediente.ultimoEventoEn`.
- Registra `AuditLog`.

## Rutas de página

| Ruta | Método | Rol | Descripción |
|---|---|---|---|
| `/dashboard/padre/expedientes` | GET | PARENT | Lista de expedientes propios con filtros y AutoSuggest. |
| `/dashboard/padre/expedientes/[id]` | GET | PARENT | Detalle del expediente con cronología y botón agregar evento. |

## Componentes

### `ExpedientesListClient`
- Props: `expedientes`, `filtroInicial`.
- Renderiza cards y barra de filtros.

### `ExpedienteDetalleClient`
- Props: `expediente`, `eventos`.
- Renderiza cabecera, timeline y formulario de agregar evento.

### `AutoSuggestExpediente`
- Props: `expediente`.
- Card destacada si `ultimoEventoEn` > 3 días.
