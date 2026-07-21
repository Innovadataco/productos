# Contracts: Colegios · Fase 4 — Alertas y Consulta anonimizada

## Base URL

Todas las rutas bajo `/api/colegio/alertas/*` requieren autenticación con rol `SCHOOL_ADMIN` y colegio vigente.

## Listar alertas

### `GET /api/colegio/alertas`

Query opcional: `?estado=nueva|vista|gestionada`.

Respuesta 200:
```json
{
  "alertas": [
    {
      "id": "...",
      "identificador": "+573001234567",
      "relacion": "alumno",
      "categoria": "CONTACTO_INSISTENTE",
      "estadoReporte": "CLASIFICADO",
      "estadoAlerta": "nueva",
      "creadoEn": "2026-07-21T00:00:00.000Z"
    }
  ]
}
```

Campos **NO** incluidos: texto del reporte, ciudad, país, edad, plataforma, identificador del denunciante.

## Cambiar estado de alerta

### `PATCH /api/colegio/alertas/[id]/estado`

Body: `{ "estado": "vista" }` o `{ "estado": "gestionada" }`.

Respuesta 200:
```json
{
  "alerta": {
    "id": "...",
    "estado": "vista"
  }
}
```

## Errores comunes

- `400`: estado inválido.
- `401`: no autenticado.
- `403`: rol no SCHOOL_ADMIN o colegio no vigente, o alerta no pertenece al colegio.
- `404`: alerta no existe.
