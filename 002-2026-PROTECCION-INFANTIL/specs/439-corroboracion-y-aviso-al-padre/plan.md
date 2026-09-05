# Plan · SPEC-439 — El aviso al padre cuando alguien más reporta lo mismo

## Análisis en fuente (antes de escribir una línea)

| Archivo | Qué se sacó |
|---|---|
| `reporte-query.ts:165` | `efectivo = reporte.reporteOrigen ?? reporte` — **la Parte 1 del radicado ya estaba hecha** (SPEC-366 · A-71), con tests en `seguimiento/[numero]/route.test.ts:176`. |
| `reporte-processing/index.ts:96,103,195` | `detectarDuplicado` corta y sale por `return` **antes** de clasificar: un duplicado nunca enciende un modelo. Ya era cierto. |
| `AdminReportesTable.tsx:385` | Única aparición de «Duplicado — sin acción»: es la tabla del **admin**, no la del usuario. La premisa del radicado era falsa. |
| `cadenas-padre.ts:239,250` | Ya devolvía los 6 campos con `esAnonimo`. El «refinamiento» pedido ya existía. |
| `evento-match.ts` + `worker-reportes.mjs:249` | `EventoMatch` (SPEC-139) detecta y se dispara desde el worker y desde corrección humana. Casi lo reporto como no cableado: **lo estaba**, fuera de `src/`. |
| `circulo-confianza/notificaciones.ts` | **Se reportó «cero llamadores» y era FALSO.** El llamador está en `scripts/worker-reportes.mjs:25,226`. El barrido no cubrió `scripts/` pese a afirmarlo: terminaba en un `head` que se llenó con líneas de `specs/*.md`. Lo cazó el CEO verificando en `origin/main` y en el contenedor. |
| `reporte-creation.ts:47` | Reportar NO agrega el identificador al círculo → el reportante es una población aparte. |
| `notificaciones/motor.ts:233-240` | El opt-out por usuario es genérico (`NotificacionPreferencia`): un evento nuevo lo hereda **sin migración**. |
| `email.ts:426` | `enviarAlertasSuscriptores` es una tercera población (suscripción explícita), no las otras dos. |

## Decisiones

- **No aplicar el caché semántico al duplicado.** Persistiría una `ClasificacionIA` falsa y congelaría un instante donde SPEC-366 refleja el estado vivo. Reusar lo mejor gana a cumplir el radicado al pie de la letra.
- **No tocar el aviso del círculo**: ya está cableado en el worker. El cableado que se había escrito para «arreglarlo» se revirtió — habría duplicado el aviso. `finalizacion.ts` vuelve byte a byte a `main`.
- **El aviso al reportante va DENTRO de `detectarYRegistrarMatch`**, no en sus tres llamadores. Cablear tres sitios es cómo nace exactamente el defecto que esta spec cierra.
- **Sin enfriamiento propio ni columna nueva**: la unicidad de `reporteNuevoId` acota a un aviso por reporte, y el opt-out ya es genérico.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que un cable se caiga | Candados que exigen el llamador REAL en el archivo que dispara —el del worker para el círculo, el de `evento-match` para el nuevo—, no la existencia de la función. Mueren al borrar la línea. Cuentan `scripts/**`, no solo `src/`. |
| Que un reintento avise dos veces | El aviso va después de `eventos.crear` (único por `reporteNuevoId`), y hay candado de ORDEN que lo exige. |
| Que se filtre la identidad del otro reportante | `usuarioId` no se selecciona; candado sobre el select y sobre las variables del correo. El test de reserva de SPEC-324 se conservó y se reforzó. |
| Que el aviso tumbe la detección del match | `avisarPadresQueReportaronSinFallar` se traga el error y lo loguea (FR-005). |
