# SPEC-380 (PR B) · Plan

1. **Diagnóstico 15v5**: enumerar los 16 consumidores de `tipoSujeto`
   (archivo:línea) y clasificarlos en escritura vs. lectura vs. UI vs. BI.
2. **Reportar la enumeración al CEO** ANTES de codificar (aprobado).
3. **Verificar BI**: `grep -rn tipoSujeto` en `005-2026-BI-INTELIGENCIA-NEGOCIO`
   — vacío. No hay que avisar a Kimi.
4. **Migración aditiva** `20260902233000_spec_380b_integrantes_monitor`
   con tabla + FK + unique parcial `WHERE estado='activo' NULLS NOT DISTINCT`.
5. **`TipoSujeto` union ampliado** + `Record<TipoSujeto, X>` completos +
   `switch` con `never` default en `buscarExistente` y `crear`.
6. **Repo** `IdentificadorIntegranteComiteRepository` (patrón profesor).
7. **Matching** en `notificarColegioSiCorresponde` (4ª fuente en paralelo).
8. **Detalle del caso**: rama en `seguimiento.ts`, `alertas.ts` (dos), y
   include del repo `obtenerDetalleConCurso` + `alerta-colegio-bandeja`.
9. **UI**: labels/variants exhaustivos en `AlertasColegioPageClient` y
   `CasoDetalleClient` (quitados los fallbacks `?? tipoSujeto`); card en
   `ColegioEstadisticasPageClient`.
10. **Schema Zod**: 4º valor en el enum del filtro.
11. **PDF**: mapa `tipoSujeto → etiqueta` en `pdf-informe-caso`.
12. **API CRUD** GET/POST + PATCH; **UI** nueva página + link en la lista.
13. **Test integration** del endpoint (5 casos: crear, listar, dedup, cross-tenant, PARENT 403).
14. **Gate**: tsc, unit + integration verdes, regen baseline, specs-discipline verde.
