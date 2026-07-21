# Plan: Colegios · Fase 5 — Estadísticas e informe PDF institucional

## Constitution Check

- **Protección de datos de menores**: la UI y el PDF solo muestran conteos agregados por curso; nunca nombres de alumnos, identificadores, textos de reportes ni PII de denunciantes. ✅
- **Aislamiento por colegio**: todo filtrado por `colegioId` del SCHOOL_ADMIN autenticado. ✅
- **Migraciones aditivas**: no se requieren cambios de modelo (no se toca `Reporte`, ni IA, ni se añaden tablas de estadísticas). ✅
- **Un solo worker**: no se modifica el worker. ✅
- **Tono neutral y sin voseo**: se mantiene en documentación y UI. ✅
- **Tests**: cada endpoint nuevo tiene su `.test.ts`. ✅

Constitution Check: **PASADO**.

---

## Technical Context

- El módulo Colegios ya tiene modelos `Colegio`, `Curso`, `Alumno`, `IdentificadorAlumno` y `AlertaColegio`.
- `src/app/dashboard/colegio/estadisticas/page.tsx` existe como placeholder que dice "Próximamente en Fase 4"; se reemplazará por la vista real.
- El sistema de color verde institucional ya está en `globals.css` (`.theme-colegio`) y se aplica en el layout del colegio.
- El patrón de exportación CSV existe en `src/app/api/admin/ia/simulaciones/[id]/export/route.ts`; se reutiliza la idea de generar bytes y devolver `NextResponse` con `Content-Disposition`.
- No hay librería PDF instalada; se instalará `pdfmake` en implementación.
- `verifyAuth("SCHOOL_ADMIN")` y `verificarVigenciaColegio` (patrón de Fase 4) se reutilizan.
- `AuditLog` debe incluir una nueva acción `COLEGIO_ESTADISTICAS_PDF_DESCARGADO` (aditiva, no rompe nada).

---

## Complexity Tracking

- **Nuevos endpoints**: 2 (`GET /api/colegio/estadisticas`, `GET /api/colegio/estadisticas/pdf`).
- **Nuevos componentes UI**: 1 vista (`src/app/dashboard/colegio/estadisticas/page.tsx`) + helpers de tarjetas/tabla.
- **Nueva librería**: 1 (`pdfmake`).
- **Tests nuevos**: 2 (`route.test.ts` para estadísticas, test de PDF).
- **Riesgo**: bajo. No hay cambios de modelo ni de worker. El único riesgo es la correcta instalación/uso de `pdfmake` en App Router con Node runtime.

---

## Approach Summary

1. Reutilizar `verifyAuth` y helpers de vigencia de colegio.
2. Crear servicio `src/lib/colegio/estadisticas.ts` que calcule agregados.
3. Crear endpoints `route.ts` para JSON y PDF.
4. Crear helper de PDF `src/lib/colegio/pdf-estadisticas.ts` con `pdfmake`.
5. Reemplazar `src/app/dashboard/colegio/estadisticas/page.tsx` por la vista real con tarjetas, tabla y botón de descarga.
6. Actualizar `src/app/dashboard/colegio/page.tsx` para que el link de "Estadísticas" apunte a la vista real y no diga "Próximamente".
7. Tests de aislamiento y generación de PDF.
8. Cierre con Spec-Kit completo.

---

## Open Questions / Risks

- `pdfmake` requiere runtime Node; se debe declarar `export const runtime = "nodejs"` en el route handler de PDF. Se verifica al implementar.
- Fuentes de `pdfmake`: por defecto usa Roboto, que soporta UTF-8 básico. Si hay problemas con "ñ" o tildes, se evalúa instalar fuentes alternativas o usar `pdfkit`.
- No se medirá contraste en este spec; queda pendiente de `docs/PRE-PRODUCCION.md` (Sección 3).
