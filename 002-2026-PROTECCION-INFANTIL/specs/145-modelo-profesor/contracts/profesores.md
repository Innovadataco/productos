# Contracts: SPEC-145 — CRUD `/api/colegio/profesores`

**Spec**: [../spec.md](../spec.md) · Rol: `SCHOOL_ADMIN` (módulo `colegios_gestion`,
vigencia, rate limits `admin_read`/`admin_write`). Sin UI en esta SPEC (SPEC-148 la
consume).

## GET /api/colegio/profesores

Query: `page` (default 1), `pageSize` (default 25, máx 100), `estado` (`activo` |
`inactivo` | `todos`; default `activo`).

```jsonc
// 200
{
  "items": [
    { "id": "…", "nombre": "María", "apellidos": "López", "email": "…",
      "telefono": "…", "estado": "activo" }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 28, "totalPages": 2 }
}
```

## POST /api/colegio/profesores

```jsonc
// Body (profesorBodySchema)
{ "nombre": "María", "apellidos": "López",          // requeridos
  "email": "maria@colegio.edu.co",                  // opcional, formato email
  "telefono": "+573001112233" }                     // opcional

// 201 → { "profesor": { … } }
// 400 → falta nombre/apellidos · email inválido (mensaje humano)
// 409 → { "error": { "message": "Ya existe un profesor con ese nombre y apellidos" } }
```

## GET /api/colegio/profesores/[id]

`200 → { "profesor": { … } }` · `404` si no existe **o es de otro colegio** (E-1).

## PATCH /api/colegio/profesores/[id]

```jsonc
// Body: cualquier subconjunto de { nombre, apellidos, email, telefono, estado }
{ "telefono": "+573009998877" }
{ "estado": "inactivo" }        // baja suave — la fila NUNCA se borra

// 200 → { "profesor": { … } }
// 400 → estado fuera de { activo, inactivo } · email inválido
// 404 → no existe o es de otro colegio
```

## Auditoría

| Mutación | Acción `AccionAudit` |
|---|---|
| POST | `COLEGIO_PROFESOR_CREADO` |
| PATCH (campos) | `COLEGIO_PROFESOR_EDITADO` |
| PATCH (`estado: "inactivo"`) | `COLEGIO_PROFESOR_DESACTIVADO` |

`valorNuevo` con metadatos solamente (nunca payload completo sensible).

## Asignación curso↔profesor (D1=a)

`POST /api/colegio/cursos` y `PATCH /api/colegio/cursos/[id]` aceptan
`profesorTitularId?` (nullable: `null` desasigna). Si el profesor no existe o es de
otro colegio → 400/404. Si D1=b, este apartado se difiere a SPEC-146.
