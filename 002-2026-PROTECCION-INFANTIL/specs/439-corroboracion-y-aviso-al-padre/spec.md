# SPEC-439 · El aviso al padre cuando alguien más reporta lo mismo

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: radicado 439 + su corrección del CEO (04-09 13:38)

**Impacto en arquitectura:** ninguno estructural. Un archivo de servicio nuevo, **dos cables que faltaban**, un campo más en un DTO existente y una plantilla sembrada. **Sin migración**: el opt-out por usuario lo resuelve `NotificacionPreferencia`, que ya existía.

---

## Lo que el radicado pedía y ya estaba construido

El radicado 439 mandaba reconstruir dos cosas que **ya funcionaban**. El CEO lo verificó y corrigió el radicado antes de que se escribiera una línea.

- **Parte 1 · el duplicado hereda la respuesta del original.** Hecha por **SPEC-366 (A-71)**: `reporte-query.ts` resuelve `efectivo = reporte.reporteOrigen ?? reporte` y el duplicado muestra el estado y la clasificación **vivos** del original, sin encender ningún modelo, con el estado almacenado intacto en `DUPLICADO` para que la señal no lo cuente dos veces. **No se aplicó el caché semántico**: persistiría una `ClasificacionIA` falsa en el duplicado y congelaría un instante donde hoy se refleja el estado vivo.
- La frase «el usuario ve *Duplicado — sin acción*» era falsa: ese texto vive **una sola vez**, en `AdminReportesTable.tsx:385`, la tabla del **admin**.
- **Parte 2 · detección y lista.** `EventoMatch` (SPEC-139 · F5) ya detecta el reporte de otra fuente sobre el mismo identificador + plataforma, disparado por el worker (`scripts/worker-reportes.mjs:249`) y por corrección humana. Y `cadenas-padre.ts` ya devolvía los **seis** campos, `esAnonimo` incluido.

---

## El defecto real: faltaba una tercera población

| Quién | Cómo llega al identificador | Estado |
|---|---|---|
| **Suscriptor** | Se suscribió explícitamente | ✅ `enviarAlertasSuscriptores` |
| **Vigilante** | Lo tiene en su círculo de confianza | ✅ `notificarCambioCirculoSiCorresponde`, llamada desde `scripts/worker-reportes.mjs:226` |
| **Reportante** | **Lo reportó** | ❌ **nadie le avisaba** |

Reportar **no** agrega el identificador al círculo (`reporte-creation.ts:47`), así que la tercera población no la cubría ninguna de las otras dos. Era la promesa central del producto —*más gente reportando la misma cuenta = señal más fuerte*— y al padre que ya había reportado no le llegaba nada.

### Corrección de método, escrita a propósito

Este Dev reportó que el aviso del círculo estaba **«sin cablear», con cero llamadores. Era falso.** El CEO lo verificó en `origin/main` y en el contenedor: `scripts/worker-reportes.mjs:25` lo importa del barrel y `:226` lo llama; el worker corre en producción.

**El error fue de método, no de lectura.** El barrido afirmaba cubrir «fuera de `src/` tampoco» y no lo cubría: el `grep` terminaba en un `head` que se llenó con nueve líneas de `specs/*.md` antes de llegar a `scripts/`. La conclusión afirmó más terreno del que el comando recorrió.

**Consecuencia si se hubiera actuado:** el cableado «arreglador» llegó a escribirse y habría producido un aviso **duplicado** al padre, no uno nuevo. Se revirtió: `finalizacion.ts` queda **byte a byte igual a `main`**.

De ahí que el primer candado vigile **el llamador que ya existe**, en el worker. Lo que se dio por muerto por error es justamente lo que hay que blindar: un barrido con ese criterio lo habría marcado como borrable.

> **Anotado, no arreglado (orden del CEO).** Esa llamada es *fire-and-forget* con `.catch()`: si falla, el error muere en un log y nadie se entera. Es degradación silenciosa, distinta de la ausencia de cableado, y no es de esta spec.

## Lo construido

1. **`corroboracion-padre.ts`** — el aviso al padre que ya había reportado. Se dispara desde `detectarYRegistrarMatch`, **después** de `eventos.crear`: esa creación es única por `reporteNuevoId` (FR-004), así que un reintento no puede avisar dos veces. **No necesita enfriamiento propio**; el opt-out lo da el motor con `NotificacionPreferencia`, sin columna nueva.
2. **Plantilla y regla sembradas** (`reporte.corroborado_por_otro`), idempotentes: el admin edita el texto y apaga la regla sin desplegar.
3. **`esAnonimo` en la superficie de seguimiento.** `otrosReportesDe` (SPEC-324) devolvía 4 campos; `cadenas-padre` ya daba los 6. Quedaban inconsistentes: ahora las dos muestran el **tipo** de autor.

**Reserva (A-60 · criterio 5).** El correo lleva plataforma, ciudad, conducta y conteo. Nunca el texto ni la identidad. `usuarioId` **no se selecciona** en la consulta de otros reportes: lo que no se carga no se puede filtrar mal después.

---

## Candados · 13, probados muriendo

| Mutación | Rojos |
|---|---|
| Borrar la llamada del worker, la del match y `esAnonimo` del select | **4** — los tres de cableado + el de reserva |
| Que el aviso se mande a sí mismo / meta un id en las variables | **2** — los de conducta |
| Quitar `DUPLICADO` de las exclusiones de señal + la herencia de SPEC-366 | **2** — los que protegen lo preexistente |

Los candados de cableado miran **quién llama**, no si la función existe — y cuentan llamadores en `scripts/**` además de `src/`, la lección que dejó el falso positivo de arriba. Y hay tres candados nuevos sobre lo que SPEC-366/324/139 ya habían construido y **nadie protegía** — el radicado 439 es la prueba de que lo no protegido no solo se rompe: se olvida.

`tsc` limpio · lint 0 errores · unit **283/283 (2376)** · integración de lo tocado verde.

> **Un test ajeno actualizado, no debilitado.** `seguimiento/[numero]/route.test.ts` afirmaba «SOLO esos 5 campos salen del backend». Ahora son 6 con `esAnonimo`, y se le sumó que ese campo es una **clase** de reportante (`false` para un padre autenticado). Las afirmaciones que son el límite real —que el id y el email del otro padre no aparecen en ningún nivel del payload— quedaron intactas.

> **Verde en CI ≠ funciona.** El cierre lo hace el CEO en producción: radicar un anónimo sobre un identificador que un padre reportó y ver llegar el aviso.
