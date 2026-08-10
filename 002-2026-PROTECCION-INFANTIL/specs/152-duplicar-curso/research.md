# Research: SPEC-152 — Duplicar curso al año siguiente

## Patrones a reutilizar

### SPEC-134 (tenant-first)
- `CursoRepository`, `EstudianteRepository` e `IdentificadorEstudianteRepository` filtran SIEMPRE por `colegioId` o por relación `estudiante.colegioId`.
- El endpoint debe obtener `colegioId` desde `verifyAuth` y nunca confiar en un body param.

### SPEC-137 (`withUnitOfWork`)
- `withUnitOfWork(fn, tx?)` abre una transacción Prisma si no hay una activa.
- Los repositorios aceptan un `Prisma.TransactionClient` opcional para operar dentro de la tx.
- La creación unificada de SPEC-146 ya demuestra el patrón de múltiples entidades en una sola tx.

### SPEC-146 (endpoint unificado)
- `src/app/api/colegio/cursos/unificado/route.ts` crea curso + estudiantes + identificadores en `withUnitOfWork`.
- Usa `CursoRepository.crear`, `EstudianteRepository.crear` (con acudientes anidados) e `IdentificadorEstudianteRepository.crear`.
- La lógica de duplicado de estudiante es `buscarPorNombreEnCurso` → 409 si existe.

## Decisiones de diseño validadas

1. **No copiar profesor titular**: el curso destino se crea sin `profesorTitularId`. Esto evita asignar un profesor al periodo siguiente sin confirmación del usuario.
2. **Cálculo de `anioLectivo`**: se prefiere incrementar el valor numérico existente. Si no es numérico o está vacío, fallback al año actual + 1.
3. **Soft delete de origen**: el curso origen no se modifica; sus estudiantes e identificadores tampoco.
4. **Auditoría**: se usa `logAudit` con `tx` para que la fila de auditoría se cree en la misma transacción.

## Referencias

- `src/lib/dal/unit-of-work.ts`
- `src/lib/dal/repositories/curso.ts`
- `src/lib/dal/repositories/estudiante.ts`
- `src/lib/dal/repositories/identificador-estudiante.ts`
- `src/app/api/colegio/cursos/unificado/route.ts`
- `prisma/schema.prisma` (modelos `Curso`, `Estudiante`, `AcudienteEstudiante`, `IdentificadorEstudiante`)
