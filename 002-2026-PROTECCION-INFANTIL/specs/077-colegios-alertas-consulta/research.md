# Research: Colegios · Fase 4 — Alertas y Consulta anonimizada

## Hallazgos verificados

### Modelo Reporte

- `Reporte` tiene `identificador`, `estado`, `eliminado`, `categoria` (o relación a `ClasificacionIA`), `creadoEn`.
- Estados visibles: `CLASIFICADO`, `CORREGIDO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `REQUIERE_ANONIMIZACION`.

### Matching del Círculo de Confianza

- `src/lib/circulo-confianza.ts` función `notificarCambioCirculoSiCorresponde(reporteId)`:
  - Lee el reporte.
  - Busca `ContactoConfianza` con `identificadores.valor = reporte.identificador`.
  - Agrupa por usuario, aplica cooldown y envía email ciego.
- Se invoca desde `scripts/worker-reportes.mjs` tras procesar el reporte.

### Anonimizador

- `src/lib/ai/anonimizador.ts` anonimiza texto; no reemplaza el identificador del reportado.
- Para la alerta del colegio no se necesita anonimizar más porque no se muestra texto; solo categoría y estado.

### IdentificadorAlumno

- `valor` se normaliza en minúsculas + trim en Fase 3.
- `estado` activo/inactivo.
- Relación con `Alumno` y `Colegio`.

## Decisiones técnicas

- Extender `notificarCambioCirculoSiCorresponde` o crear `notificarColegioSiCorresponde` separada.
- Crear `AlertaColegio` en `prisma/schema.prisma`.
- Endpoint `GET /api/colegio/alertas` filtrado por `colegioId` del SCHOOL_ADMIN.
- Endpoint `PATCH /api/colegio/alertas/[id]/estado` para marcar como vista/gestionada.
- UI en `/dashboard/colegio/alertas` con tema verde.

## Riesgos y mitigaciones

- **Exposición de PII**: tests que verifiquen que la respuesta no incluye `texto`, `ciudad`, `pais`, `edadVictima`, `plataforma` del reporte, ni identificador del denunciante.
- **Aislamiento**: tests que un SCHOOL_ADMIN no ve alertas de otro colegio.
- **Duplicados**: usar `upsert` en `AlertaColegio` por `(colegioId, reporteId, identificadorAlumnoId)`.
