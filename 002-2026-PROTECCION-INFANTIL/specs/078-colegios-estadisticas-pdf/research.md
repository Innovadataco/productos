# Research: Colegios · Fase 5 — Estadísticas e informe PDF institucional

## Reutilización de patrones existentes

- **Patrón de endpoints colegio**: `src/app/api/colegio/alertas/route.ts` usa `verifyAuth("SCHOOL_ADMIN")`, `verificarVigenciaColegio` (implícita en `verifyAuth` y proxy), y devuelve JSON sin PII. Se reutiliza el mismo patrón.
- **Exportación de archivos**: `src/app/api/admin/ia/simulaciones/[id]/export/route.ts` genera CSV/JSON y devuelve `NextResponse` con headers `Content-Disposition`. El PDF seguirá el mismo patrón: generar un buffer en servidor y devolverlo como `application/pdf`.
- **Sistema de acento verde**: `globals.css` define `.theme-colegio` con variables CSS que sobreescriben `--color-accent` a `#10b981`. La vista de estadísticas debe usar clases como `accent-gradient`, `text-accent`, `bg-emerald-50/60`, etc., siguiendo el mismo patrón de `src/app/dashboard/colegio/page.tsx`.

## Librería PDF

- **Estado actual**: `package.json` no tiene ninguna librería PDF. Opciones evaluadas:
  - `pdfmake`: declarativa, buena para tablas, genera buffers en Node, licencia MIT. Requiere runtime Node (no Edge). Elegida.
  - `jspdf`: más manual, buena para client-side, pero en servidor requiere DOM. Descartada.
  - `pdfkit`: más flexible pero más verbosa. Descartada por simplicidad.
- **Decisión**: usar `pdfmake` con `export const runtime = "nodejs"` en el route handler de PDF.

## Modelos de datos disponibles

- `Colegio` tiene relaciones con `Curso`, `Alumno`, `IdentificadorAlumno` y `AlertaColegio`.
- `Curso` tiene relación `alumnos` (Alumno[]).
- `Alumno` tiene relación `identificadores` (IdentificadorAlumno[]).
- `AlertaColegio` tiene `colegioId`, `reporteId`, `identificadorAlumnoId`, `estado`.
- Para el desglose por curso se contarán:
  - alumnos por `cursoId`,
  - identificadores por `alumno.cursoId`,
  - alertas por `identificadorAlumno.alumno.cursoId` (excluyendo reportes dados de baja).

## Placeholder existente

- `src/app/dashboard/colegio/estadisticas/page.tsx` muestra "Esta funcionalidad estará disponible en la Fase 4." Se reemplazará por la vista real.
- `src/app/dashboard/colegio/page.tsx` tiene una tarjeta de Estadísticas con opacidad 70 y texto "Próximamente en Fase 4."; se actualizará a link activo.

## Decisión de cálculo en tiempo real

- No se agregan tablas de estadísticas. Las métricas se calculan con `prisma.$queryRaw` o múltiples `count`/`groupBy`. Para el alcance (miles de registros como máximo) es suficiente y evita migraciones.
- Si en el futuro el volumen crece, se puede agregar materialización en Fase posterior o en el SPEC-090 de pre-producción.

## Riesgo de precisión de alertas

- El conteo de alertas debe excluir reportes `eliminado=true` o cuyo `estado` no sea visible. Se usa el mismo filtro de estados visibles que en Fase 4 (`src/lib/colegio/alertas.ts`).

## Nota sobre PII

- El PDF y la UI nunca incluyen: nombres de alumnos, valores de identificadores, texto del reporte, ciudad/país/edad, identificador del denunciante, ni identificador de alerta interna. Solo conteos y nombres de cursos.
