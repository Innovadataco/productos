# Plan · SPEC-366 · A-71 duplicado hereda del original

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisión de diseño (verificado en fuente, candado 15v5)

**Opción (a): resolución en tiempo de LECTURA.** El estado del duplicado NO se
materializa; se sigue `reporteOrigenId` al mostrar. Descartada la opción (b)
copiar-al-resolver (propagación + estado materializado): más estado, y obliga a
migrar la exclusión de señal.

**Enumeración de la exclusión (candado 22v5).** Se buscó todo `estado='DUPLICADO'`
en la señal comunitaria: el predicado ÚNICO `whereReporteAprobado`/`esReporteAprobado`
(reporte-aprobado.ts, ~13 consumidores: scoring, consulta pública, estadísticas,
círculo, colegio, etc.) + las dos raw SQL de dedup (embedding.ts:116,162). Con la
opción (a) el estado sigue `DUPLICADO`, así que **0 de esos callsites cambian**:
todos siguen excluyendo el duplicado igual. Es el resultado más seguro.

**Marcador.** El `reporteOrigenId` ya existe y hace de marcador; no se crea
`esDuplicado`. Se escribe SOLO en la detección de duplicado (verificado: las otras
apariciones son propagación de lectura o el caché semántico, no un marcado nuevo).

**Alcance mínimo por la invariante anónimo.** Los duplicados son siempre anónimos
(`duplicados.ts` corta la dedup para reportes con cuenta) → solo `seguimiento()`
sirve duplicados. Se blinda con un test de invariante.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Doble conteo del duplicado en la señal | Estado sigue DUPLICADO → excluido igual; 0 callsites de exclusión tocados |
| Un futuro cambio hace que un reporte con cuenta quede DUPLICADO | Test de invariante: con cuenta → nunca DUPLICADO (si se rompe, salta) |
| Prometer "en proceso" cuando el original tampoco resuelve | Read-time: muestra el estado VIVO del original; test del original PROCESANDO |
| Filtrar el texto del original (PII) | El DTO expone solo categoría/labels; el texto del original nunca se selecciona al DTO |

## Impacto en arquitectura: no

Sin migración ni campo nuevo. Se amplía un `select` y se resuelve el display en el
servicio de query. Detalle en spec.md.
