# Data Model: SPEC-152 — Duplicar curso al año siguiente

## Cambios en el esquema

### Migración aditiva

Se añade un valor al enum `AccionAudit`:

```prisma
enum AccionAudit {
  // ...valores existentes...
  COLEGIO_CURSO_DUPLICADO
}
```

No se modifica ningún modelo de datos. La clonación se resuelve con una transacción que inserta:

- 1 fila en `Curso` (destino).
- N filas en `Estudiante` (uno por estudiante activo del origen).
- 0-2N filas en `AcudienteEstudiante` (copia de los acudientes activos).
- M filas en `IdentificadorEstudiante` (copia de los activos).
- 1 fila en `AuditLog` (acción `COLEGIO_CURSO_DUPLICADO`).

## Constraints utilizados

- `Curso` tiene `@@unique([colegioId, nombre, grado, anioLectivo])`: se usa para detectar duplicado destino antes de insertar.
- `Estudiante` no tiene unique de nombre+apellidos por curso a nivel BD; la validación se hace en el servicio con `buscarPorNombreEnCurso`.
- `AcudienteEstudiante` tiene `@@unique([estudianteId, orden])`: garantiza máximo 2 acudientes por estudiante.
- `IdentificadorEstudiante` tiene `@@unique([estudianteId, valor, tipo, plataformaId])`: evita duplicados al clonar.

## Diagrama de flujo de datos

```
POST /api/colegio/cursos/[id]/duplicar
        │
        ▼
verifyAuth(SCHOOL_ADMIN) + assertModulo + vigencia
        │
        ▼
CursoRepository.obtenerPorId(colegioId, id) ──► 404 si no existe
        │
        ▼
Calcular nuevo anioLectivo
        │
        ▼
CursoRepository.buscarPorDatos(...) ──► 409 si destino existe
        │
        ▼
withUnitOfWork
├── Crear Curso destino
├── Para cada Estudiante activo del origen:
│   ├── Verificar duplicado nombre+apellidos en destino
│   ├── Crear Estudiante con acudientes anidados
│   └── Para cada Identificador activo:
│       └── Crear IdentificadorEstudiante
└── logAudit COLEGIO_CURSO_DUPLICADO
        │
        ▼
201 { curso, resumen }
```
