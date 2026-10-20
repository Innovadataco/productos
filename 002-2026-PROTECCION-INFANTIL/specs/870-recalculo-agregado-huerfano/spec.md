# SPEC-870 · Recálculo del agregado público huérfano (I-446)

> Estado: IMPLEMENTADO (pendiente CI verde + revisión del CEO). Rama `work/pi-SPEC-870-recalculo-agregado-huerfano`.
> Radicado: CEO → Datos, 20-10-2026. Carril **Datos** + D-121 (sin migración). Toca RUNTIME (chokepoint de borrado).

**Impacto en arquitectura:** NO toca el schema (sin migración). Cierra la FUENTE del drift de I-446 en el
chokepoint de borrado `borrarReporte` (ahora recalcula el agregado PROPIO del reporte), lo BLINDA con un
guard de arquitectura nuevo (`no-reporte-delete-directo`, sección (k) de arch:check: `reporte.delete`
crudo solo en `borrarReporte`), agrega un corrector y un detector que REÚSAN los escritores vivos
(`recalcularYGuardarScore` + `actualizarVisibilidadPublica`, cero lógica nueva, D-72), y retira/rutea los
borradores crudos legacy. Respeta la frontera DAL (el detector vive en `src/lib/dal/services/`).

## Problema (I-446)

`IdentificadorReportado` (agregado público: `score`, `esVisiblePublicamente`) se escribía al
CREAR/clasificar pero NO al borrar/purgar. 11 de 23 filas del piloto quedaron SIN reporte vivo detrás —
una visible con score 58: un identificador «de riesgo» en la consulta pública sin evidencia.

## Causa raíz (corrección del framing «solo scripts legacy»)

La fuente real es el **chokepoint** `borrarReporte`: solo limpiaba agregados ligados por `eventoMatch`,
NUNCA el del identificador PROPIO (lo crea `upsertIncrementoReporte` al alta). Un reporte SIN match (el
primero/único de un identificador) dejaba su agregado colgado **aunque se borrara por el camino
canónico** — y `reset-piloto` usa `borrarReporte`, así que heredó el hueco. Sin FK-cascade desde
`Reporte` (la clave es identificador+plataforma), nada lo limpiaba.

## Fix (decisión CEO: recalc, no zero+hide directo)

1. **`borrarReporte` (la FUENTE):** tras borrar el reporte, recalcula el agregado PROPIO con
   `recalcularYGuardarScore` + `actualizarVisibilidadPublica` (en su tx). Si era el último → 0 + oculto;
   si QUEDAN otros vivos → computa el score restante (un zero+hide directo los pondría en 0 MAL — por eso
   recalc, no update puntual). Reemplaza el viejo borrado de agregados por-eventoMatch.
2. **Corrector** `scripts/limpieza/recalcular-agregados-huerfanos.ts` (dry-run/`--confirm`): itera TODAS
   las filas y re-ejecuta los mismos escritores. Sanea las 11 (zero+hide). NUNCA borra la fila (una
   report-less puede ser intencional, p.ej. PA-16). Atómico por fila, exit≠0 si falla alguna.
3. **Detector** `src/lib/dal/services/agregados-huerfanos.ts` (+ CLI) BLANDO, solo-lectura contra la BD
   viva: lista agregados con presencia pública y 0 reportes vivos. No es gate duro.
4. **Guard estructural** `no-reporte-delete-directo` (arch:check (k)): `reporte.delete` crudo PROHIBIDO
   fuera de `borrarReporte` (gemelo de `no-reporte-create-directo`). Cierra la fuente a futuro.
5. **Legacy:** retirados los 4 borradores crudos sin caller (`scripts/demo/borrar-demo{,-v2,-v4}.ts`,
   `scripts/generar-reportes-demo.ts`); `borrar-simulacion` y `smoke-e2e` ruteados por `borrarReporte`.

## D-121

SIN migración (dato/servicio + runtime). El agregado se recalcula con los escritores existentes; no hay
columnas nuevas. La CORRIDA del corrector contra PROD y el DEPLOY del fix de runtime son APARTE del PR
(los hace el responsable; la sesión del CEO está capada para prod).

## Fuera de alcance (escalación documentada)

Opción ESTRUCTURAL (la consulta pública deriva la visibilidad del conteo de aprobados vivos al leer, en
vez de confiar en `esVisiblePublicamente` almacenado) — NO ahora (P3, toca la consulta pública caliente).
Se escala solo si el detector muestra drift RECURRENTE pese al chokepoint blindado.

## Candado (muere con el defecto)

`src/lib/dal/services/agregado-huerfano.candado.test.ts`: A · borrar el único reporte sin match → 0+oculto
(control positivo: con otro vivo, refleja el restante). B · el detector caza el huérfano, no el sano.
C · el corrector sanea a 0+oculto. + guard (k) en arch:check.
