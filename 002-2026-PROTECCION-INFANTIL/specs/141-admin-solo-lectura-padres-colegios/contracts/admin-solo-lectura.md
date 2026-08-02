# Contracts: SPEC-141 — Admin solo lectura (círculo de padres + estructura de colegios)

## Base URL y guards comunes

Todas las rutas requieren rol `ADMIN` (cookie JWT httpOnly), módulo activo
(`padres` o `colegios_gestion` vía `assertModulo` — denegar por defecto) y pasan
por rate limit `admin_read` (429 con `retryAfter` si se excede). Errores con el
envelope estándar `{ error: { message, code } }` (400/401/403/404/429/500).

Solo se define `GET`. Cualquier otro verbo sobre estas rutas: 405 (no existe
handler — FR-003).

## Círculo de confianza de un padre

### `GET /api/admin/padres/[id]/circulo-confianza`

Módulo: `padres`. `[id]` = id de un `Usuario` con rol PARENT (404 genérico si no
existe o no es PARENT — no oráculo).

Efecto lateral: una fila `AuditLog` (`CIRCULO_CONFIANZA_ACCESO_ADMIN`,
`usuarioId` = admin, `recursoId` = id del padre, metadatos sin identificadores)
por cada respuesta 200.

Respuesta 200 (misma forma que `GET /api/circulo-confianza` para el dueño):

```json
{
  "contactos": [
    {
      "id": "clx...",
      "etiqueta": "Mamá de Juan",
      "nota": "...",
      "activo": true,
      "estado": "clasificado",
      "identificadores": [
        { "id": "clx...", "valor": "+57300...", "tipo": "telefono", "plataforma": { "id": "...", "nombre": "WhatsApp", "clave": "whatsapp" } }
      ],
      "reportes": 3
    }
  ],
  "resumen": { "sinReportes": 1, "enRevision": 0, "clasificado": 2 }
}
```

Campos de estado derivados con el predicado `whereReportesCirculo` (spec
093-US1): solo reportes aprobados + en revisión humana; nunca veredictos.

## Estructura de un colegio

### `GET /api/admin/colegios/[id]/cursos`

Módulo: `colegios_gestion`. `[id]` = id de `Colegio` (404 si no existe). Sin
guard de vigencia (el ADMIN consulta histórico).

Respuesta 200:

```json
{
  "cursos": [
    { "id": "clx...", "nombre": "Séptimo A", "grado": "7", "anioLectivo": "2026", "estado": "activo", "alumnos": 28 }
  ]
}
```

### `GET /api/admin/colegios/[id]/cursos/[cursoId]/alumnos`

Módulo: `colegios_gestion`. 404 si el curso no existe o no pertenece al colegio
de la ruta (aislamiento por tenant). Query: `page` (default 1), `pageSize`
(default 25, máx 100).

Efecto lateral: una fila `AuditLog` (`COLEGIO_ROSTER_ACCESO_ADMIN`, `recursoId` =
id del colegio, metadatos `{ cursoId, page }`) por cada respuesta 200.

Respuesta 200 (paginación estándar):

```json
{
  "items": [
    {
      "id": "clx...",
      "nombre": "Nombre del alumno",
      "estado": "activo",
      "identificadores": [
        { "id": "clx...", "tipo": "telefono", "valor": "+57300...", "plataforma": { "id": "...", "nombre": "WhatsApp", "clave": "whatsapp" }, "etiquetaRelacion": "ALUMNO" }
      ]
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 28, "totalPages": 2 }
}
```
