# Data Model — SPEC-197

No hay cambios en el esquema de Prisma.

## Entidades leídas

- `Usuario`: listados por `rol` (PARENT, SCHOOL_ADMIN, OPERADOR, COMITE_VALIDACION, COMITE_CONVIVENCIA, ADMIN).
- `PerfilOperador`: `cupoMaximo` usado para filtrar operadores destino.
- `Reporte`: conteo de `casosAbiertos` por operador.

## APIs reutilizadas

- `GET /api/admin/operadores` → `OperadorService.listar()` devuelve operadores con `casosAbiertos` y `perfil.cupoMaximo`.
- `GET /api/admin/usuarios?rol=...` → lista paginada por rol.
