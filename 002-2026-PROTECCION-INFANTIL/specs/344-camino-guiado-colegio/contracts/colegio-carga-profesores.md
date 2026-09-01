# Contracts · Excel de profesores

Tres endpoints nuevos bajo `/api/colegio/carga-profesores/**`, patrón
espejo de `/api/colegio/carga/**` (alumnos, ya existente).

## Plantilla · `GET /api/colegio/carga-profesores/plantilla`

**Purpose**: descargar la plantilla oficial con TODAS las columnas
obligatorias del validador + una fila de ejemplo válida (FR-026-bis,
test-candado I-245).

- **Auth**: `SCHOOL_ADMIN`.
- **Response**: 200 con `Content-Type: text/csv; charset=utf-8` y header
  `Content-Disposition: attachment; filename="plantilla-profesores.csv"`.
- **Cuerpo**:

```
nombre,apellidos,tipo_documento,numero_documento,anio_nacimiento,sexo,email,telefono
Andrés Felipe,Mora,CC,80114552,1985,M,amora@sagrado.edu.co,+573152201144
```

- **Contract test (obligatorio)**: `plantilla.integration.test.ts` consume
  el endpoint, alimenta el buffer al parser + validator y afirma
  `{ crear: 1, omitido: 0, error: 0 }`.

## Validar · `POST /api/colegio/carga-profesores/validar`

**Purpose**: dry-run — parsea, valida, devuelve el reporte y firma un token
temporal (JWT, TTL 15 min) que ampara la confirmación.

- **Auth**: `SCHOOL_ADMIN`. Exento del guardián del camino.
- **Request**: `multipart/form-data` con `archivo` (≤ 5 MB, ≤ 2000 filas por
  parámetro).
- **Response 200**:

```json
{
  "ok": true,
  "resumen": { "crear": 3, "omitidos": 1, "errores": 2 },
  "filas": [
    { "linea": 2, "estado": "crear",   "identidad": { "nombre":"…","numeroDocumento":"…" } },
    { "linea": 3, "estado": "omitido", "razon": "documento_ya_registrado" },
    { "linea": 4, "estado": "error",   "razon": "sexo_invalido", "columna": "sexo" }
  ],
  "token": "<jwt-15min>"
}
```

- **Response 400**: `archivo_invalido` / `archivo_demasiado_grande` /
  `demasiadas_filas` / `columnas_faltantes` — el error nombra la columna
  faltante (candado UX brief).

## Confirmar · `POST /api/colegio/carga-profesores/confirmar`

**Purpose**: consume el token y persiste solo las filas en estado `crear`.
Idempotente (segundo intento con el mismo token → 200 sin crear duplicados).

- **Auth**: `SCHOOL_ADMIN` + token firmado.
- **Request**:

```json
{ "token": "<jwt del validar>" }
```

- **Response 201**:

```json
{
  "ok": true,
  "creados": 3,
  "profesores": [ { "id":"cmt…", "nombre":"…", "numeroDocumento":"…" }, … ]
}
```

- **Efecto en el camino**: al persistir ≥ 1 profesor activo, el Paso 3 se
  cumple. Se sella la cookie vía `sellarCookieSesionEstado`.
- **Auditoría**: 1 `AuditLog` por fila creada + 1 agregado de la operación.
- **Errores**: 401/403 estándar, 410 `token_invalido` (usado o vencido),
  409 `duplicados_race` (otro proceso creó los mismos entre validar y
  confirmar; el mensaje lista los documentos).

## Consideraciones cross-endpoint

- Todo el pipeline en `src/lib/colegio/carga-profesores/` (parser,
  validator, importer) SE ESCRIBE FRESCO (matiz CEO). Suite unit +
  integración obligatoria antes de cerrar la spec.
- La plantilla se genera desde una constante ÚNICA que también consume el
  validador — evita desincronización estructural (I-245 pattern applied).
