# Contracts: SPEC-144 — Altas de estudiante (cambio de validación)

**Spec**: [../spec.md](../spec.md) · No hay endpoints nuevos: cambian los contratos de
entrada de los verbos de creación existentes. Los paths se conservan (D2).

## POST /api/colegio/cursos/[id]/alumnos

Rol: `SCHOOL_ADMIN` (módulo `colegios_gestion`, vigencia, rate limit `admin_write`).

### Request (antes → después)

```jsonc
// ANTES (alumnoBodySchema)
{ "nombre": "Ana" }

// DESPUÉS (estudianteBodySchema — src/lib/schemas)
{
  "nombre": "Ana",                    // requerido (sin cambio)
  "apellidos": "Pérez Torres",        // REQUERIDO (nuevo — FR-010)
  "documentoTipo": "TI",              // opcional — set Zod: TI|CC|CE|PASAPORTE|OTRO (D3)
  "documentoNumero": "1020…",         // opcional
  "acudientes": [                     // opcional — máx 2 (FR-007; shape según D1)
    { "orden": 1, "nombre": "Marta Torres", "relacion": "madre",
      "telefono": "+573001112233", "email": "marta@example.com" }
  ]
}
```

### Responses

| Caso | Status | Body |
|---|---|---|
| Alta OK | 201 | `{ "alumno": { … } }` (shape de respuesta sin cambio de nombre de clave en esta SPEC; SPEC-146 introduce las rutas nuevas) |
| Falta `apellidos` | 400 | `{ "error": { "message": "Falta el apellido del estudiante", "code": "BAD_REQUEST" } }` |
| `documentoTipo` fuera del set | 400 | mensaje humano con los valores aceptados |
| 3+ acudientes | 400 | "Máximo 2 acudientes por estudiante" |
| Duplicado por nombre en curso | 409 | sin cambio (la deduplicación por nombre pasa a considerar `nombre + apellidos`) |
| Curso de otro colegio | 404 | sin cambio (tenant-first E-1) |

### Notas de contrato

- **AuditLog**: la acción `COLEGIO_ALUMNO_CREADO` y `tipoRecurso: "Alumno"` se
  CONSERVAN — el audit log es histórico e inmutable; renombrar sus valores rompería
  consultas y reportes de auditoría. La terminología nueva aplica a código y modelo,
  no a valores históricos persistidos. (`valorNuevo` pasa a incluir `apellidos`).
- **Escritura multi-entidad**: si D1 = A (tabla hija), crear estudiante + acudientes
  es UNA escritura atómica con `withUnitOfWork` (patrón SPEC-137, candado §7.4).

## Flujo de carga masiva (`POST /api/colegio/carga/*`)

- La plantilla Excel gana la columna `apellidos_alumno` (y, según D1/D4, columnas de
  acudiente en SPEC-146 — en 144 solo apellidos).
- Filas sin `apellidos`: comportamiento pendiente de **D4** (rechazo de fila con el
  flujo §5.4 del brief, o aceptación con `apellidos = ""` + completitud posterior).
  Recomendación ODIN: **(b) aceptar** — máxima adopción, no bloquea.
- El resto del pipeline (parser → sesión roster → confirmar) mantiene su contrato y
  seguridad de SPEC-132.

## GET /api/colegio/cursos/[id]/alumnos

Sin cambio de contrato en esta SPEC: los campos nuevos viajan en la respuesta pero
ninguna pantalla actual los consume (SPEC-146/147 los usan). I-29 intacto.
