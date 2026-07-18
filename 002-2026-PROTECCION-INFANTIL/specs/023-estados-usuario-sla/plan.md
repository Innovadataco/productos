# Plan — Spec 023: Estados de cara al usuario + SLA visible

## Modelos y campos de BD (schema.prisma)

**Modelos existentes:**
- `Reporte`: campos `estado` (enum `EstadoReporte`), `eliminado` (Boolean).
- `ParametroSistema`: parámetro nuevo `ui.sla_horas_procesamiento` (tipo INTEGER, categoría SYSTEM).

**Sin migraciones de schema** (salvo el parámetro, que se crea por seed/upsert).

## Herramientas

- **Reutilizar**: `ParametroSistema` + `getParametroSistemaValor()`.
- **Nueva**: ninguna.

## Dependencias

- Depende de **Spec 022** para registrar transiciones visibles (En proceso → Procesado).

## Fases

1. Backend: mapeo `EstadoReporte` → `{visual: "En proceso" | "Procesado", badge: variant}` en `src/lib/reporte-estados-usuario.ts`.
2. Backend: filtrar `eliminado=false` en:
   - `src/app/api/reportes/seguimiento/[numero]/route.ts`
   - `src/app/api/reportes/mis-reportes/route.ts`
3. Frontend: actualizar `SeguimientoClient.tsx` y `MisReportesClient` para mostrar estados simplificados + SLA.
4. Configuración: agregar `ui.sla_horas_procesamiento` en `ParametroSistema` y UI de configuración.
5. Tests: estados internos se mapean correctamente; reportes eliminados no aparecen.

## Notas

- En la vista de operador/comité se siguen viendo los estados internos completos.
- La consulta pública (`/api/consulta`) ya filtra `CLASIFICADO`/`CORREGIDO` + `eliminado=false`; no requiere cambios de filtrado, solo alineación visual.
