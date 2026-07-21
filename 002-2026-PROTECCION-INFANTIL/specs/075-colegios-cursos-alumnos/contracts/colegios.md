# Contracts: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

## Base URL

Todas las rutas bajo `/api/colegio/*` requieren autenticación con rol `SCHOOL_ADMIN` y colegio vigente.

## Cursos

### `GET /api/colegio/cursos`

Respuesta:
```json
{
  "cursos": [
    { "id": "...", "nombre": "6A", "grado": "Sexto", "anioLectivo": "2026", "estado": "activo", "_count": { "alumnos": 25 } }
  ]
}
```

### `POST /api/colegio/cursos`

Body:
```json
{
  "nombre": "6A",
  "grado": "Sexto",
  "anioLectivo": "2026"
}
```

Respuesta 201:
```json
{
  "curso": { "id": "...", "nombre": "6A", "grado": "Sexto", "anioLectivo": "2026", "estado": "activo" }
}
```

### `PATCH /api/colegio/cursos/[id]`

Body: `{ "nombre": "6A - Matemáticas", "grado": "Sexto", "anioLectivo": "2026" }`

Respuesta 200:
```json
{ "curso": { "id": "...", "nombre": "6A - Matemáticas", ... } }
```

### `PATCH /api/colegio/cursos/[id]/estado`

Body: `{ "estado": "inactivo" }` (o `activo`).

## Alumnos

### `GET /api/colegio/cursos/[id]/alumnos`

Respuesta:
```json
{
  "alumnos": [
    { "id": "...", "nombre": "María Gómez", "estado": "activo" }
  ]
}
```

### `POST /api/colegio/cursos/[id]/alumnos`

Body: `{ "nombre": "María Gómez" }`

Respuesta 201:
```json
{ "alumno": { "id": "...", "nombre": "María Gómez", "estado": "activo" } }
```

### `PATCH /api/colegio/alumnos/[id]`

Body: `{ "nombre": "María G." }`

### `PATCH /api/colegio/alumnos/[id]/estado`

Body: `{ "estado": "inactivo" }`

## Identificadores

### `GET /api/colegio/alumnos/[id]/identificadores`

Respuesta:
```json
{
  "identificadores": [
    { "id": "...", "tipo": "telefono", "valor": "+573001234567", "etiquetaRelacion": "alumno", "plataforma": { "id": "...", "nombre": "WhatsApp" } }
  ]
}
```

### `POST /api/colegio/alumnos/[id]/identificadores`

Body:
```json
{
  "tipo": "telefono",
  "valor": "+573001234567",
  "plataformaId": "...",
  "etiquetaRelacion": "alumno"
}
```

Respuesta 201:
```json
{ "identificador": { "id": "...", "tipo": "telefono", "valor": "+573001234567", ... } }
```

### `PATCH /api/colegio/identificadores/[id]`

Body: `{ "tipo": "email", "valor": "maria@example.com", "etiquetaRelacion": "madre" }`

### `PATCH /api/colegio/identificadores/[id]/estado`

Body: `{ "estado": "inactivo" }`

## Errores comunes

- `400`: datos inválidos o duplicados.
- `401`: no autenticado.
- `403`: rol no SCHOOL_ADMIN o colegio no vigente.
- `404`: recurso no existe o no pertenece al colegio del usuario.
- `409`: estado inválido (ej. desactivar inactivo) o duplicado.
