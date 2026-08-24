# Modelo de datos — SPEC-232

## Cambio de schema

**Ninguno.** Se reutilizan los modelos de SPEC-230 (`Expediente`, `EventoExpediente`, `Reporte`) sin modificaciones.

## Modelos afectados

### `Expediente` (lectura + escritura de contadores)
Campos usados:
- `id`, `padreUsuarioId`, `identificadorReportado`, `plataformaId`
- `estado`, `scoreGravedadActual`, `fechaApertura`, `numEventos`, `ultimoEventoEn`, `updatedAt`

### `EventoExpediente` (lectura + creación)
Campos usados:
- `id`, `expedienteId`, `ordenSecuencial`, `reporteId`
- `fechaEvento`, `texto`, `categoriaDetectada`, `confianzaClasificacion`, `plataforma`

### `Reporte` (creación)
Campos usados:
- `identificador`, `plataformaId`, `texto`, `fechaIncidente`, `ciudad`, `pais`, `esAnonimo`

### `AuditLog` (creación)
Se registra una fila al agregar un evento a un expediente.

## Seed

No requiere seed adicional.
