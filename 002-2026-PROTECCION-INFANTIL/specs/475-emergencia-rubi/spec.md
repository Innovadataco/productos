# SPEC-475 · El botón de emergencia: disparador fantasma, confirmar sólido — cierra I-320 (parte 1)

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: hallazgo I-320 (los botones con rubí sólido fuera de la reserva), radicado por CEO. Autoridad de diseño: **Diseño** (certifica la forma; CI no cierra un rediseño).

## Para qué

La regla del Sistema de Diseño §7.1 (fijada por Diseño al migrar el Button en SPEC-454): **el rubí SÓLIDO se reserva al «confirmar» del modal** —donde el usuario ya decidió— y **el disparador de una acción destructiva es Fantasma-rubí** (borde rubí, no relleno). Repartir rubí sólido por las pantallas quema la señal de «punto de no retorno».

`BotonActivarEmergencia` (vista de consolidación del comité, SPEC-239) tenía la **polaridad invertida**: el disparador que abre el modal era rubí **sólido** y el «confirmar» de dentro del modal era `variant="danger"` (Fantasma-rubí). Exactamente al revés de la reserva. Esta spec lo endereza.

## Decisiones de gobierno aplicadas

- **Corrección exacta ordenada por el CEO** (canal Dev→CEO, ruling de Diseño sobre I-320): disparador → Fantasma-rubí; confirmar del modal → sólido `rubi`.
- **El sólido rubí NO se vuelve una variante reusable.** Se deja como `<button>` crudo con `bg-rubi` en el único sitio que la reserva permite (el confirmar del modal). Crear un `variant="danger-solid"` compartido invitaría a repartirlo por las 16 pantallas y rompería la reserva que esta spec defiende. **One-off intencional, comentado en fuente.**
- **`bg-rubi` es token, no color crudo.** El swap mueve un `bg-rubi` del disparador al confirmar: **net-zero** en `tokens:check`. Esta spec **no toca el piso** (queda en 1021).
- **`CancelarSuscripcion.tsx:107/:164` NO se tocan.** El CEO verificó con Diseño que ya cumplen la reserva. Fuera de alcance de esta spec.

## Cambios

- **`src/components/modules/comite/consolidacion/BotonActivarEmergencia.tsx`**:
  - **Disparador** (abre el modal): era `<button class="…bg-rubi px-5 py-2.5…">Activar emergencia</button>` → `<Button variant="danger" onClick={() => setAbierto(true)}>` (Fantasma-rubí, la misma piel que el resto de acciones destructivas desde SPEC-454).
  - **Confirmar** (dentro del modal): era `<Button variant="danger" onClick={confirmar}>` → `<button class="…bg-rubi px-5 py-2.5…">` (el rubí sólido reservado, one-off comentado).
  - **Cancelar** del modal intacto (`variant="outline"`). Conducta, `fetch`, estados (`ejecutando`/`error`/`mensaje`) y a11y sin cambios.

## Candados

- **`src/lib/rediseno/emergencia-rubi.candado.test.ts`** (nuevo, unit, lee fuente, sin BD):
  - **Test 1** — el disparador (bloque del `onClick` con `setAbierto(true)`) **NO** contiene `bg-rubi` y **SÍ** lleva `variant="danger"`.
  - **Test 2** — el confirmar (bloque del `onClick={confirmar}`) **SÍ** contiene `bg-rubi` sólido (la reserva).
  - Aísla cada bloque por su handler y limpia comentarios antes de mirar, para vigilar el **cableado real**, no menciones en comentarios.
  - **Verificado por mutación (rojo distinto en cada dirección):** volver el disparador a sólido → rojo del test 1; quitar el sólido del confirmar → rojo del test 2. Restaurado → 2/2 verde.
- Registrado en `vitest.unit.includes.ts` (proyecto unit).

## Impacto en arquitectura:

- No cambia API ni conducta de ningún componente; corrige la piel de un botón concreto y **fija la reserva de rubí sólido con un candado** que muere si se reintroduce la inversión.
- **No toca el piso de `tokens:check`** (swap net-zero de un token): la spec es floor-safe y no serializa con la cadena de muebles.
- No introduce variante reusable de rubí sólido — decisión explícita para no diluir la reserva.

## Certificación (la da Diseño)

Diseño revisa —contra el código o tras desplegar— que el disparador es Fantasma-rubí y el confirmar del modal es el rubí sólido reservado. Hasta esa certificación, I-320 (parte 1) **no cierra**. **Verde en CI no cierra un rediseño.**

## Fuera de alcance

- Los otros hallazgos de I-320 (otros botones con rubí sólido) → los rige Diseño caso por caso; esta spec solo endereza `BotonActivarEmergencia`.
- `CancelarSuscripcion.tsx:107/:164` → ya cumplen (verificado por Diseño); no se tocan.

## Referencias

- **Sistema de Diseño** `SISTEMA-DE-DISENO.md` §7.1 (Botón / jerarquías) · §3 (color).
- **SPEC-454** — fijó la reserva «rubí sólido = confirmar del modal» al migrar el Button.
- **SPEC-239** — origen de `BotonActivarEmergencia` (US5, FR-010).
- I-320 — hallazgo de botones con rubí sólido fuera de la reserva.
