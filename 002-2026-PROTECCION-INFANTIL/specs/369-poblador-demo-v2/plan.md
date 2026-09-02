# Plan · SPEC-369 · poblador demo v2

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisiones

**Se extiende, no se reescribe.** El v1 queda intacto; el v2 vive en sus propios
archivos (`_common-v2`, `poblar-demo-v2`, `borrar-demo-v2`) y reusa los helpers
comunes (RNG con semilla, parseo de argumentos, auditoría).

**Alcance acotado a lo que Jelkin pidió.** No se rehacen los 9 puntos de BI ni el
andamiaje de colegios del v1: lo que destraba a Kimi es volumen con variedad, o
sea reportes + clasificación. Menos superficie, menos riesgo.

**La marca disjunta es el candado central.** Todo el diseño de reversibilidad
descansa en que `demo2-` y `demo-` no se alcancen. Está probado en los dos
sentidos y el borrador aborta si alguna vez se solaparan.

**Ya no hace falta el candado de operadores demo:** se sube el cupo por defecto a
500 (orden del CEO), con lo que 8 operadores dan 4.000 de capacidad.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Que el borrador del v2 se lleve datos del v1 o reales | Prefijos disjuntos probados en ambas direcciones + guarda que aborta si se solapan; los ids reales son cuid() |
| Datos sucios para BI (fechas futuras) | Test: nunca supera el "ahora"; el año en curso se corta en hoy |
| Que todo caiga en la misma categoría | Relatos propios por categoría + mezcla ponderada, con test de que todas aparecen |
| Re-correr y duplicar | Ids deterministas + skipDuplicates |
| Disparar correos o el motor | Inserción directa; no se encola nada |
| Ejecutar en prod por accidente | Dry-run por defecto; `--confirm` explícito; y se avisa al CEO antes |

## Impacto en arquitectura: no
