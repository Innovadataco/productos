# Modelo de datos — SPEC-205

## Sin cambios de schema

SPEC-205 no requiere migraciones ni nuevos modelos. Toda la información se deriva de tablas y relaciones existentes.

## Entidades involucradas

### `Usuario`
- Campos clave: `id`, `email`, `nombre`, `rol`, `estado`, `creadoEn`, `ultimaSesion`, `tenantId`, `colegioId`, `comiteColegioId`.
- Relaciones relevantes:
  - `colegio` → `Colegio` (rector).
  - `comiteConvivenciaColegio` → `Colegio` (cuenta compartida del comité de convivencia).
  - `reportes` → `Reporte[]` (reportes enviados por un PARENT).
  - `casosAsignados` → `Reporte[]` (operador asignado).
  - `perfilOperador` → `PerfilOperador`.
  - `integrantesComite` → `IntegranteComite[]`.

### `PerfilOperador`
- Campos clave: `usuarioId`, `cupoMaximo`, `esRevisorDeApelaciones`, `esComite`.
- Un operador `OPERADOR` o `COMITE_VALIDACION` puede tener perfil.

### `Colegio`
- Campos clave: `id`, `nombre`, `estado`, `creadoEn`, `representanteLegalNombre`, `representanteLegalEmail`.
- Relaciones relevantes:
  - `rector` → `Usuario` (`colegioId` unique).
  - `comiteConvivencia` → `Usuario` (`comiteColegioId` unique).
  - `cursos` → `Curso[]`.
  - `estudiantes` → `Estudiante[]`.
  - `profesores` → `Profesor[]`.
  - `reportes` (vía `tenantId`).

### `Reporte`
- Campos clave: `id`, `usuarioId`, `operadorId`, `tenantId`, `estado`, `creadoEn`, `eliminado`.
- Los conteos se hacen sobre reportes vigentes (`eliminado=false`).

### `IntegranteComite`
- Campos clave: `comiteId`, `estado`, `creadoEn`.
- Permite contar miembros activos de un comité de convivencia.

### `AuditLog`
- Campos clave: `accion`, `usuarioId`, `recursoId`, `tipoRecurso`, `creadoEn`.
- Usado en detalle de admin (últimas acciones sensibles) y operador (historial de reasignaciones).

## Posibles índices aditivos (a evaluar en implementación)

Si los agregados de KPI resultan lentos con grandes volúmenes, se consideran índices aditivos:

- `Usuario(rol, estado)` — acelera resumen por rol.
- `Reporte(tenantId, estado, operadorId, eliminado)` — ya existe índice parcial; validar cobertura.

Ningún índice se aplica sin medición previa y sin migración aditiva documentada.
