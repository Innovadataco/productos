# Modelo de datos — SPEC-233

## Cambio de schema

**Ninguno.** Cero migraciones. Se reutilizan los modelos de SPEC-230 y SPEC-234 sin modificaciones.

## Modelos afectados (solo lectura)

### `Expediente` (lectura)
Campos usados:
- Vista padre: `id`, `padreUsuarioId` (solo filtro `where`, nunca render), `identificadorReportado`, `estado`, `scoreGravedadActual`, `fechaApertura`, `numEventos`, `ultimoEventoEn`, `plataformaId`.
- Vista admin (select anonimizado): `estado`, `scoreGravedadActual`, `fechaApertura`, `fechaCierre`, `numEventos`, `plataformaId`. **Excluidos por construcción**: `padreUsuarioId`, `eventos`, `categoriasDominantesJson`, `patronesDetectadosJson` y cualquier texto.

Índice existente aprovechado: `@@index([identificadorReportado])` (`prisma/schema.prisma:2128`).

### `SenalComunitariaCache` (lectura, vía `obtenerSenalComunitaria`)
Campos usados:
- `totalExpedientesActivos`, `totalExpedientesCerrados`, `totalExpedientesEscalados`
- `categoriasFrecuenciaJson`, `paisesJson`, `ciudadesJson`, `plataformasJson`
- `primeraAparicionEn`, `ultimaAparicionEn`

Todo agregado anónimo (Ley 1581, §13 del brief): cero textos, cero identidades.

## Métodos DAL nuevos (aditivos, sin cambio de modelo)

| Método | Archivo | Propósito |
|---|---|---|
| `listarExpedientesDePadrePorIdentificador(padreUsuarioId, identificadorReportado, paginacion?)` | `src/lib/dal/repositories/expediente-repository.ts` | Lista propia del padre sobre un identificador, orden `fechaApertura` desc. |
| `listarExpedientesPorIdentificadorAnonimo(identificadorReportado)` | `src/lib/dal/repositories/expediente-repository.ts` | Lista anonimizada plataforma completa (select explícito sin campos sensibles). |

## Seed

No requiere seed adicional.
