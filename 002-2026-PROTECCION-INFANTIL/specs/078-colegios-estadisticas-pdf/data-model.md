# Data Model: Colegios · Fase 5 — Estadísticas e informe PDF institucional

## Modelos utilizados (sin cambios de schema)

Esta fase no requiere cambios en `prisma/schema.prisma`. Se reutilizan las entidades de las Fases 2, 3 y 4.

### Entidades principales

- **Colegio**: raíz del tenant. Se filtra todo por `colegioId`.
- **Curso**: `colegioId`, `nombre`, `grado`, `anioLectivo`, `estado`, `alumnos[]`.
- **Alumno**: `cursoId`, `colegioId`, `nombre`, `estado`, `identificadores[]`.
- **IdentificadorAlumno**: `alumnoId`, `tipo`, `valor`, `plataformaId`, `etiquetaRelacion`, `estado`, `alertas[]`.
- **AlertaColegio**: `colegioId`, `reporteId`, `identificadorAlumnoId`, `estado`, `creadoEn`, `actualizadoEn`. Relaciona con `Reporte` para excluir reportes dados de baja.

## Posible cambio aditivo en AuditLog

- El enum `AccionAudit` de Prisma puede requerir añadir `COLEGIO_ESTADISTICAS_PDF_DESCARGADO` si no existe.
- Esto es aditivo y no afecta datos existentes.

## Notas

- No se persiste el resumen estadístico; se calcula en tiempo real.
- No se modifica el modelo `Reporte` ni el modelo de clasificación IA.
- El PDF es un artefacto derivado; no se almacena.
