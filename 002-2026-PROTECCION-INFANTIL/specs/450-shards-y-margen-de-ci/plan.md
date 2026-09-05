# Plan · SPEC-450 — El margen de CI

## Medición antes de tocar nada

Se midió job por job en cuatro corridas reales, no se supuso. El resultado descartó las tres hipótesis de código que traía el radicado (lock de BD, conexión sin cerrar, timeout ausente) y dejó una sola explicación viva: **runner lento contra un techo que quedó corto**.

## Decisiones

- **6 shards y no 8**: 8 multiplicaría los servicios de Postgres y el tiempo de arranque por job sin ganar margen proporcional. Con 6 el peor caso proyectado (~28 min) ya deja 17 min de aire.
- **No tocar el techo ni el reintento.** Son de SPEC-407 y son lo que impide que un cuelgue real dure para siempre. Subirlos escondería el síntoma.
- **Avisar en vez de cortar** a los 30 min: un corte nuevo competiría con el techo existente y podría matar corridas sanas.
- **Formato de pesos compatible hacia atrás.** Romperlo de golpe dejaría el reparto usando la mediana para todo, en silencio — el estado exacto del 03-09.
- **Mediana en vez de media móvil**: la media deja que un runner lento contamine el peso para siempre.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que alguien vuelva a 4 shards | Candado sobre la matriz. Muere al revertir. |
| Que se «arregle» subiendo el techo | Candado que exige `timeout 45m` intacto. |
| Que el fallback quede en `/4` con matriz de 6 | Candado propio: sería el peor de los mundos —dos shards duplicados y dos vacíos— y no da error. |
| Que el reparto quede desparejo | Candado que compara los seis pesos (±5 %). |
| Que un refresco rompa el reparto | El lector acepta las dos formas, con candado. |
