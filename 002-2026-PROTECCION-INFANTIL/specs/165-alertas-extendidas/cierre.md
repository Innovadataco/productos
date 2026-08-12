# Cierre: SPEC-165 — Alertas extendidas: profesor/acudiente + tipo de sujeto

**Estado**: IMPLEMENTADO  
**Fecha de cierre**: 2026-08-12  
**Rama de trabajo**: `work/002-pi-062`  
**PR**: #48 → `feature/001-scaffolding`  
**Hash de merge**: `3456ca49`  
**CI-PUSH**: `31622011644` — success

---

## Resumen

Se extendió el matching de `notificarColegioSiCorresponde` para que, además de estudiantes, cruce identificadores reportados contra profesores y acudientes registrados por cada colegio. Cada `AlertaColegio` ahora lleva `tipoSujeto` (`ESTUDIANTE` | `PROFESOR` | `ACUDIENTE`) y la FK correspondiente. Las alertas históricas se marcaron como `ESTUDIANTE` vía backfill. El pipeline de avisos, los umbrales y los patrones institucionales siguen funcionando; las agregaciones que dependen de curso se restringen a alertas de estudiante.

---

## Cambios integrados

### Modelo de datos

- `prisma/schema.prisma`:
  - `AlertaColegio` añade `tipoSujeto` (String, default `ESTUDIANTE`), `identificadorProfesorId`, `identificadorAcudienteId`.
  - `identificadorEstudianteId` pasa a opcional.
  - Relaciones opcionales a `IdentificadorProfesor` e `IdentificadorAcudiente`.
  - Unique constraints por tipo de sujeto.
  - Índice sobre `tipoSujeto`.
  - Relaciones inversas `alertas` en `IdentificadorProfesor` e `IdentificadorAcudiente`.
- `prisma/migrations/20260812140000_spec_165_alerta_tipo_sujeto/migration.sql`: migración aditiva con ALTER COLUMN nullable, ADD COLUMN, ADD FOREIGN KEY, unique constraints, índice y backfill `tipoSujeto = 'ESTUDIANTE'`.

### Backend

- `src/lib/dal/repositories/alerta-colegio.ts`:
  - Tipos `TipoSujeto` y `CrearAlertaInput`.
  - `INCLUDE_LISTADO` incluye los tres vínculos opcionales.
  - `listarPorColegio` filtra por `tipoSujeto`.
  - `buscarExistente` y `crear` soportan los tres tipos.
  - Agregaciones con join a `Alumno`/`Curso` filtran `tipoSujeto = 'ESTUDIANTE'`.
  - `obtenerDetalleConCurso` devuelve los tres vínculos.
- `src/lib/dal/repositories/alerta-colegio-mensual.ts` (nuevo): extrae `resumenMensual`, `porCursoMensual`, `porCategoriaMensual` para respetar el límite de líneas del repo principal.
- `src/lib/colegio/alertas.ts`:
  - `notificarColegioSiCorresponde` consulta los tres repos de identificadores, crea alertas por tipo, mantiene idempotencia y fail-open por tipo.
  - `listarAlertasColegio` expone `tipoSujeto`, `sujetoNombre`, `identificador` y `relación` según el tipo.
  - Auditoría `COLEGIO_ALERTA_CREADA` / `COLEGIO_ALERTA_ESTADO` incluye `tipoSujeto`.
- `src/lib/colegio/avisos.ts`: `evaluarUmbralesPorAlerta` retorna temprano si la alerta no es de estudiante.
- `src/lib/colegio/patrones.ts`: usa optional chaining en `identificadorEstudiante` (el repo ya filtra por `ESTUDIANTE`).
- `src/lib/colegio/informe-mensual.ts`: usa `AlertaColegioMensualRepository`.
- `src/lib/colegio/seguimiento.ts`: `DetalleCaso` ahora es genérico (`tipoSujeto`, `sujetoNombre`, `sujetoRelacion`, `curso` opcional).
- `src/lib/schemas/index.ts`: `alertaQuerySchema` acepta `tipoSujeto`.

### API y frontend

- `src/app/api/colegio/alertas/route.ts`: expone query param `tipoSujeto`.
- `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx`: muestra badge de tipo de sujeto, nombre del sujeto, filtro por tipo y ajusta el identificador según privacidad.
- `src/app/dashboard/colegio/alertas/[id]/CasoDetalleClient.tsx`: adapta el resumen al tipo de sujeto (oculta curso cuando no aplica).

### Tests

- `src/lib/dal/repositories/alerta-colegio.test.ts`: tests de crear alertas de profesor/acudiente y dedupe.
- `src/lib/colegio/alertas.test.ts`: tests de matching simple y triple sobre estudiante/profesor/acudiente, idempotencia, filtro por tipo.
- `src/app/api/colegio/alertas/route.test.ts`: test de filtro por `tipoSujeto`.
- `src/app/api/colegio/alertas/[id]/route.test.ts`: ajustado al nuevo DTO genérico.
- Tests auxiliares (`seguimiento-caso`, `[id]/notas`) actualizados a la firma de `crear` con `tipoSujeto`.

### Arquitectura

- `docs/architecture/01-modelo-datos.md` regenerado (`npm run arch:check` verde).

---

## Gate de calidad

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ (0 errores; warnings preexistentes) |
| `npm run test` | ✅ |
| `npm run tokens:check` | ✅ |
| `npm run arch:check` | ✅ |
| `npm run build` | ✅ |

---

## Notas

- No se tocó `src/lib/ai/**`.
- No se modificó `Curso` ni `Estudiante.cursoId`.
- La migración es aditiva: solo nullable + columnas/relaciones/constraints nuevos en `AlertaColegio`.
- El matching sigue siendo cross-tenant a propósito; cada colegio con el identificador registrado recibe su alerta.
