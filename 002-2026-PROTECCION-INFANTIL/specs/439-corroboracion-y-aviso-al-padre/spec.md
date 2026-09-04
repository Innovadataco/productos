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

## El defecto real: no faltaba código, sobraba código muerto

**`notificarCambioCirculoSiCorresponde` no tenía un solo llamador.** Construida en SPEC-135 (E-2), enriquecida en SPEC-308 (A-50) —contacto, identificador, plataforma, categoría, total de reportes, link al expediente—, con interruptor, enfriamiento y tests. Su propia spec afirma *«el punto de disparo es este flujo, ya invocado cuando un reporte pasa a estado visible»*. **Nunca lo estuvo.**

Verificado: el barrel la reexporta, cinco archivos importan el barrel y **ninguno importa ese símbolo**; fuera de `src/` tampoco. Solo la llamaban sus propios tests — que es exactamente por qué nadie lo notó: **probaban que funciona sin probar que se usa.**

Es el **segundo caso en dos días**. I-303 (`leerAutorizacion`, SPEC-436) fue idéntico.

---

## Y son tres poblaciones, no una

| Quién | Cómo llega al identificador | Estado antes |
|---|---|---|
| **Suscriptor** | Se suscribió explícitamente | ✅ `enviarAlertasSuscriptores` |
| **Vigilante** | Lo tiene en su círculo de confianza | ⚠️ construido y **sin cablear** |
| **Reportante** | **Lo reportó** | ❌ nadie le avisaba |

Reportar **no** agrega el identificador al círculo (`reporte-creation.ts:47`), así que la tercera población no la cubría ninguna de las otras dos. Era la promesa central del producto —*más gente reportando la misma cuenta = señal más fuerte*— y al padre no le llegaba nada.

---

## Lo construido

1. **El cable que faltaba.** `notificarCambioCirculoSiCorresponde(reporteId)` se llama desde `finalizacion.ts`, en el bloque `CLASIFICADO || CORREGIDO` — el punto exacto que su propia spec nombraba.
2. **`corroboracion-padre.ts`** — el aviso al padre que ya había reportado. Se dispara desde `detectarYRegistrarMatch`, **después** de `eventos.crear`: esa creación es única por `reporteNuevoId` (FR-004), así que un reintento no puede avisar dos veces. **No necesita enfriamiento propio**; el opt-out lo da el motor con `NotificacionPreferencia`, sin columna nueva.
3. **Plantilla y regla sembradas** (`reporte.corroborado_por_otro`), idempotentes: el admin edita el texto y apaga la regla sin desplegar.
4. **`esAnonimo` en la superficie de seguimiento.** `otrosReportesDe` (SPEC-324) devolvía 4 campos; `cadenas-padre` ya daba los 6. Quedaban inconsistentes: ahora las dos muestran el **tipo** de autor.

**Reserva (A-60 · criterio 5).** El correo lleva plataforma, ciudad, conducta y conteo. Nunca el texto ni la identidad. `usuarioId` **no se selecciona** en la consulta de otros reportes: lo que no se carga no se puede filtrar mal después.

---

## Candados · 13, probados muriendo

| Mutación | Rojos |
|---|---|
| Borrar los dos cables + `esAnonimo` del select | **4** — los tres de cableado + el de reserva |
| Que el aviso se mande a sí mismo / meta un id en las variables | **2** — los de conducta |
| Quitar `DUPLICADO` de las exclusiones de señal + la herencia de SPEC-366 | **2** — los que protegen lo preexistente |

Los candados de cableado miran **quién llama**, no si la función existe: es la lección del defecto que cierra esta spec. Y hay tres candados nuevos sobre lo que SPEC-366/324/139 ya habían construido y **nadie protegía** — el radicado 439 es la prueba de que lo no protegido no solo se rompe: se olvida.

`tsc` limpio · lint 0 errores · unit **283/283 (2376)** · integración de lo tocado verde.

> **Un test ajeno actualizado, no debilitado.** `seguimiento/[numero]/route.test.ts` afirmaba «SOLO esos 5 campos salen del backend». Ahora son 6 con `esAnonimo`, y se le sumó que ese campo es una **clase** de reportante (`false` para un padre autenticado). Las afirmaciones que son el límite real —que el id y el email del otro padre no aparecen en ningún nivel del payload— quedaron intactas.

> **Verde en CI ≠ funciona.** El cierre lo hace el CEO en producción: radicar un anónimo sobre un identificador que un padre reportó y ver llegar el aviso.
