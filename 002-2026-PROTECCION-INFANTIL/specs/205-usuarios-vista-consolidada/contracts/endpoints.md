# Contratos de API — SPEC-205

## Autenticación y permisos

Todos los endpoints requieren:
- Cookie `token` con JWT válido de usuario con `rol=ADMIN`.
- Permiso de módulo `usuarios_admin` (`assertModulo`).
- Rate-limit `admin_read`.

## GET /api/admin/usuarios/dashboard

Devuelve los KPI del dashboard consolidado.

### Response 200
```json
{
  "kpi": [
    {
      "rol": "padres",
      "label": "Padres",
      "total": 120,
      "activos": 110,
      "inactivos": 5,
      "bloqueados": 5,
      "alerta": null
    },
    {
      "rol": "rectores",
      "label": "Rectores",
      "total": 8,
      "activos": 7,
      "inactivos": 0,
      "bloqueados": 1,
      "alerta": "Colegios sin rector"
    },
    {
      "rol": "operadores",
      "label": "Operadores",
      "total": 6,
      "activos": 5,
      "inactivos": 1,
      "bloqueados": 0,
      "alerta": "Operadores sobrecargados"
    },
    {
      "rol": "comite",
      "label": "Comité",
      "total": 10,
      "activos": 9,
      "inactivos": 1,
      "bloqueados": 0,
      "alerta": "Comités sin miembros"
    },
    {
      "rol": "admins",
      "label": "Admins",
      "total": 3,
      "activos": 3,
      "inactivos": 0,
      "bloqueados": 0,
      "alerta": null
    }
  ],
  "alertas": [
    { "tipo": "sobrecarga", "mensaje": "2 operadores al 100% de cupo" },
    { "tipo": "colegio_sin_rector", "mensaje": "1 colegio sin rector asignado" }
  ]
}
```

## GET /api/admin/usuarios

Listado paginado por rol. El DTO varía según `rol`.

### Query params
- `rol`: `PARENT` | `SCHOOL_ADMIN` | `OPERADOR` | `COMITE_CONVIVENCIA` | `COMITE_VALIDACION` | `ADMIN`
- `page`: número (default 1)
- `pageSize`: número (default 25, máx 100)
- `q`: búsqueda por nombre/email
- `estado`: `activo` | `inactivo` | `bloqueado`

### Response 200 — rol=PARENT
```json
{
  "items": [
    {
      "id": "...",
      "nombre": "María López",
      "email": "maria@example.com",
      "reportesEnviados": 3,
      "reportesUltimos30d": 1,
      "colegiosAsociados": [{ "id": "...", "nombre": "Colegio Andino" }],
      "estado": "activo",
      "ultimoAcceso": "2026-08-20T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 120, "totalPages": 5 }
}
```

### Response 200 — rol=OPERADOR
```json
{
  "items": [
    {
      "id": "...",
      "nombre": "Mateo Domínguez",
      "email": "mateo@example.com",
      "cupoMaximo": 10,
      "casosAbiertos": 7,
      "enProceso": 2,
      "cerrados30d": 12,
      "tiempoMedioResolucionMin": 45,
      "estado": "activo"
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 6, "totalPages": 1 }
}
```

## GET /api/admin/usuarios/[id]

Detalle consolidado por rol.

### Response 200 — rol=OPERADOR
```json
{
  "id": "...",
  "rol": "OPERADOR",
  "nombre": "Mateo Domínguez",
  "email": "mateo@example.com",
  "estado": "activo",
  "cupoMaximo": 10,
  "casosAbiertos": 7,
  "casosEnProceso": 2,
  "casosCerrados30d": 12,
  "tiempoMedioResolucionMs": 2700000,
  "tasaEscalamientoComite": 0.08,
  "historialReasignaciones": [
    { "fecha": "2026-08-15T09:00:00Z", "reporteId": "...", "reasignadoPor": "admin@example.com" }
  ],
  "linkBandeja": "/dashboard/admin?operadorId=..."
}
```

### Response 200 — rol=SCHOOL_ADMIN
```json
{
  "id": "...",
  "rol": "SCHOOL_ADMIN",
  "nombre": "Carlos Ruiz",
  "email": "carlos@example.com",
  "estado": "activo",
  "colegios": [
    {
      "id": "...",
      "nombre": "Colegio Andino",
      "alumnos": 340,
      "profesores": 28,
      "cursos": 15,
      "reportes": 42
    }
  ],
  "ultimoAcceso": "2026-08-21T14:00:00Z",
  "linkColegio": "/dashboard/admin/estadisticas/operacion/colegios/..."
}
```

### Response 404
```json
{ "error": { "message": "Usuario no encontrado", "code": "NOT_FOUND" } }
```
