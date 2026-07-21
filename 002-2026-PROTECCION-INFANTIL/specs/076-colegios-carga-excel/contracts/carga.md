# Contracts: Colegios · Fase 3 — Carga masiva por Excel/CSV

## Base URL

Todas las rutas bajo `/api/colegio/carga/*` requieren autenticación con rol `SCHOOL_ADMIN` y colegio vigente.

## Descargar plantilla

### `GET /api/colegio/carga/plantilla`

Respuesta: archivo CSV con encabezados y fila de ejemplo, `Content-Disposition: attachment; filename="plantilla-carga-alumnos.csv"`.

Columnas: `nombre_curso`, `grado`, `anio_lectivo`, `nombre_alumno`, `tipo_identificador`, `valor_identificador`, `etiqueta_relacion`, `plataforma`.

## Validar archivo

### `POST /api/colegio/carga/validar`

Body: `multipart/form-data` con campo `archivo` (CSV o XLSX).

Respuesta 200:
```json
{
  "valido": true,
  "totalFilas": 10,
  "filasValidas": 10,
  "errores": [],
  "tokenConfirmacion": "eyJ...",
  "resumen": {
    "cursos": 1,
    "alumnos": 5,
    "identificadores": 8
  }
}
```

Respuesta 200 con errores:
```json
{
  "valido": false,
  "totalFilas": 10,
  "filasValidas": 8,
  "errores": [
    { "fila": 3, "campos": ["nombre_alumno"], "mensaje": "El nombre del alumno es requerido" }
  ],
  "tokenConfirmacion": null,
  "resumen": null
}
```

## Confirmar carga

### `POST /api/colegio/carga/confirmar`

Body:
```json
{
  "tokenConfirmacion": "eyJ..."
}
```

Respuesta 201:
```json
{
  "mensaje": "Carga completada correctamente",
  "resumen": {
    "cursosCreados": 1,
    "cursosReutilizados": 0,
    "alumnosCreados": 5,
    "alumnosReutilizados": 0,
    "identificadoresCreados": 8,
    "identificadoresReutilizados": 0
  }
}
```

## Errores comunes

- `400`: archivo no enviado, formato no soportado, archivo vacío, excede tope de filas, token inválido.
- `401`: no autenticado.
- `403`: rol no SCHOOL_ADMIN o colegio no vigente.
- `409`: la confirmación generaría duplicados o el token ya fue usado.
