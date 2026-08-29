# Contracts: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT

## Autenticación y autorización

Todos los endpoints requieren:
- Cookie de sesión válida (`verifyAuth`).
- Rol `ADMIN`.
- Módulo permitido (`assertModulo`).

## `GET /api/admin/usuarios`

Listado paginado de usuarios por rol.

### Query params

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `rol` | string | `PARENT` | Rol a listar: `PARENT`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `COMITE_CONVIVENCIA`, `ADMIN` |
| `page` | integer | 1 | Página |
| `pageSize` | integer | 25 | Tamaño de página (máx 100) |
| `q` | string | — | Búsqueda por email o nombre |
| `estado` | string | — | `activo`, `inactivo`, `bloqueado` |
| `desde` | ISO date | — | Fecha mínima de registro |
| `hasta` | ISO date | — | Fecha máxima de registro |
| `conReportes` | boolean | — | `true` / `false` |
| `colegioId` | string | — | Filtrar por colegio asociado |

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "email": "padre@example.com",
      "nombre": "Juan Pérez",
      "estado": "activo",
      "creadoEn": "2026-01-15T10:00:00.000Z",
      "ultimaSesion": "2026-08-20T18:00:00.000Z",
      "reportesEnviados": 7,
      "colegiosAsociados": [
        { "id": "cuid", "nombre": "Colegio ABC" }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 42,
    "totalPages": 2
  }
}
```

### Response 400
Input inválido.

### Response 401/403
No autenticado / sin permisos.

---

## `GET /api/admin/usuarios/[id]`

Detalle de un usuario (metadatos + historial agregado de reportes).

### Response 200

```json
{
  "id": "cuid",
  "email": "padre@example.com",
  "nombre": "Juan Pérez",
  "estado": "activo",
  "creadoEn": "2026-01-15T10:00:00.000Z",
  "ultimaSesion": "2026-08-20T18:00:00.000Z",
  "reportes": {
    "total": 7,
    "ultimos30Dias": 2,
    "porEstado": { "CLASIFICADO": 5, "PENDIENTE": 1, "POSIBLE_SPAM": 1 }
  },
  "historial": [
    {
      "id": "cuid",
      "numeroSeguimiento": "RPT-00001",
      "estado": "CLASIFICADO",
      "categoria": "CONTACTO_INSISTENTE",
      "creadoEn": "2026-08-18T14:00:00.000Z"
    }
  ]
}
```

---

## `GET /api/admin/analytics/colegios`

Resumen analítico de todos los colegios.

### Query params

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | integer | 1 | Página |
| `pageSize` | integer | 25 | Tamaño de página (máx 100) |
| `q` | string | — | Búsqueda por nombre |
| `ciudadId` | string | — | Filtrar por ciudad |
| `estado` | string | — | `activo` / `inactivo` |
| `orden` | string | `reportesTotal` | Campo de orden: `nombre`, `ciudad`, `fechaRegistro`, `alumnos`, `profesores`, `reportesUltimos30Dias`, `reportesTotal`, `alertasEscaladas`, `casosProcesadosPct` |
| `direccion` | string | `desc` | `asc` / `desc` |

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "nombre": "Colegio ABC",
      "ciudad": "Bogotá",
      "departamento": "Cundinamarca",
      "fechaRegistro": "2026-01-10T00:00:00.000Z",
      "estado": "activo",
      "alumnos": 320,
      "profesores": 24,
      "reportesUltimos30Dias": 12,
      "reportesTotal": 145,
      "alertasEscaladas": 3,
      "casosProcesadosPct": 0.82,
      "semaforo": "verde"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 15,
    "totalPages": 1
  }
}
```

---

## `GET /api/admin/analytics/colegios/[id]`

Detalle analítico de un colegio.

### Response 200

```json
{
  "id": "cuid",
  "infoBasica": {
    "nombre": "Colegio ABC",
    "tipoPeriodo": "MENSUAL",
    "direccion": "Calle 123 # 45-67",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "fechaRegistro": "2026-01-10T00:00:00.000Z",
    "contactoRector": "rector@colegioabc.edu.co"
  },
  "metricasTamaño": {
    "alumnos": 320,
    "profesores": 24,
    "cursos": 18,
    "materias": 42
  },
  "actividadReportes": {
    "serie30Dias": [
      { "dia": "2026-07-22", "total": 2, "spam": 0, "procesado": 2, "otro": 0 }
    ],
    "porClasificacion": [
      { "categoria": "CONTACTO_INSISTENTE", "total": 45 },
      { "categoria": "SPAM", "total": 12 }
    ],
    "topIdentificadores": [
      { "identificador": "+573001234567", "total": 8 }
    ]
  },
  "comite": {
    "integrantesActivos": 5,
    "casosEscalados": 10,
    "casosResueltos": 8,
    "tiempoPromedioResolucionHoras": 48,
    "ultimosCasos": [
      { "id": "cuid", "numero": "COM-0001", "estado": "RESUELTO", "creadoEn": "2026-08-15T10:00:00.000Z" }
    ]
  },
  "alertas": {
    "total": 25,
    "resueltas": 20,
    "ultimasAlertas": [
      { "id": "cuid", "estado": "gestionada", "tipoSujeto": "ESTUDIANTE", "creadoEn": "2026-08-19T10:00:00.000Z" }
    ]
  },
  "hallazgos": {
    "positivos": ["Tasa de resolución del comité > 80%", "0 casos escalados en los últimos 15 días"],
    "negativos": ["No hay reportes hace 45 días"],
    "semaforo": "amarillo"
  },
  "comparacionMedia": {
    "metricas": [
      { "nombre": "reportes por alumno", "valorColegio": 0.45, "mediana": 0.38 },
      { "nombre": "% spam", "valorColegio": 0.12, "mediana": 0.10 }
    ]
  }
}
```

### Response 404
Colegio no encontrado.

---

## Notas de privacidad

- Ninguno de estos endpoints devuelve `Reporte.texto`, `Reporte.textoOriginal` ni el `usuarioId` anónimo/denunciante.
- Los identificadores en `topIdentificadores` son agregados por colegio; no incluyen quién los reportó.
