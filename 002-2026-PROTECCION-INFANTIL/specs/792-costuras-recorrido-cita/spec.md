# SPEC-792 · Las cuatro costuras del recorrido de la cita

> **Status**: `IMPLEMENTADO` · parches de SECUENCIA y de CIERRE (no rediseño). Diagnóstico de Diseño
> caminado sobre el código de #771 (784). **Apilada sobre 784**; se rebasa a `main` cuando #771 entre.
> **Rama**: `work/pi-SPEC-792-costuras-recorrido-cita`. **Radicado**: `6b33c54`. **Copy de Diseño**: `3d45701`.

## Por qué

Cada pantalla de la cita está certificada por Diseño; **la SECUENCIA no lo estaba**. Caminada de punta a
punta, aparecieron cuatro costuras, y dos caen en el caso que más importa: **el padre al que no le
prestaron el servicio que pagó**.

## Las cuatro (C2 primero — la grave)

- **C2 · la vía de escape del motor de contradicciones.** «Esta cita ya pasó» ofrecía **[Pedir otra cita]**
  en paralelo, sin mencionar la encuesta → el padre reprogramaba **sin responder nunca**. Ahora: la
  TARJETA de la encuesta (arriba, 784) es el **primer** camino; la vista «ya pasó» de CONFIRMADA **ya no
  ofrece [Pedir otra cita] en paralelo** (se llega DESPUÉS, por el desenlace «no» de la encuesta). Queda
  [Escríbenos]. (`vista-espera-cita.ts` + `EsperaCitaPanel`.)
- **C1 · callejón del camino feliz.** El cierre de la encuesta solo tenía salida para «no se realizó».
  Ahora las **cuatro** combinaciones (padre/profesional × sí/no) ofrecen **«Volver a mi panel»** (padre →
  `/dashboard`, profesional → `/dashboard/profesional`). (`EncuestaFormulario`.)
- **C3 · voz de archivador en el cierre feliz del padre.** El padre venía en voz cálida y cerraba con
  «quedó registrado» (voz del profesional). Ahora padre-sí: **«Gracias por contarnos cómo te fue…»**; el
  profesional se queda con «Gracias, quedó registrado». Voz por audiencia (como el resto de 784).
- **C4 · «ya pasó» rozaba la culpa cuando el enlace NUNCA se publicó.** El padre esperó siguiendo nuestra
  instrucción y leía «Esta cita ya pasó» como si él la hubiera perdido. Ahora, sub-estado honesto: **«El
  acceso a tu reunión no llegó a estar disponible… Esto no dependió de ti»** + [Pedir otra cita] (que
  **HEREDA el pago** — servicio no entregado) + [Escríbenos]. Sin culpar al operador, sin inventar causa
  técnica. (`enlace-derivado.ts` nuevo sub-estado + `vista-espera-cita.ts` + `EsperaCitaPanel`.)

## Candados (control positivo por mutación)

| # | Candado | Qué prueba |
|---|---|---|
| C2 | `espera-cita-encuesta-primero.candado.test.tsx` + `vista-espera-cita.candado.test.ts` | con encuesta pendiente, se ofrece «Contar cómo me fue» y NO hay [Pedir otra cita] paralelo; la vista de CONFIRMADA-pasada no incluye `pedirOtraCita`. Re-añadirlo → rojo. |
| C1 | `encuesta-cierre.candado.test.tsx` | las 4 combinaciones del cierre ofrecen una salida navegable (nunca solo «atrás»). |
| C3 | `encuesta-cierre.candado.test.tsx` | padre-sí = cálido (NO «quedó registrado»); profesional = «quedó registrado». Cadenas distintas por audiencia. |
| C4 | `enlace-derivado.candado.test.ts` + `vista-espera-cita.candado.test.ts` | enlace nunca publicado + hora pasada → `PASADA_SIN_PUBLICAR` → copy «no dependió de ti», sin nombrar operador/causa técnica, con pago heredado. Enlace publicado → «ya pasó» normal (control negativo). |

## Hallazgos (lo que el diff no explica)

1. **C4 · el estado del enlace se COLAPSABA a `PASADA`.** `derivarEnlaceParaCita` devolvía `PASADA` al
   pasar la hora, perdiendo si se había publicado. La referencia de Diseño a `SIN_PUBLICAR` no existía en
   ese punto. Se agregó el sub-estado **`PASADA_SIN_PUBLICAR`** (derivado de `enlacePublicadoEn`, sin
   exponer el campo interno). El copy e intención son de Diseño; el mecanismo es implementación.
2. **C2 · la copy del detalle «ya pasó» perdió la cláusula «pedir otra cita».** Diseño dijo «C2 = secuencia,
   no copy nuevo». No inventé texto: **quité** la frase «Si quieres continuar, puedes pedir otra cita;»
   porque la acción se fue (la encuesta es el camino). Queda para que Diseño lo certifique.
3. **Co-cambio de candados de 750 (NO reconciliar):** `vista-espera-cita.candado` (C2 cambió las acciones
   de CONFIRMADA-pasada) y los tests de 750 que asumían el comportamiento viejo se actualizaron al nuevo
   contrato, preservando sus invariantes originales. Es el comportamiento que 792 cambia a propósito.
4. **C5 (fuera de alcance, medido):** «Elegir otro profesional» y «Pedir otra cita» NO van al mismo lado
   (directorio-de-otros+hereda vs mismo-profesional vs cita-nueva-paga) → distinción real, sin promesa
   falsa. No se unificó (decisión del CEO).

## Fuera de alcance

Rediseñar pantallas · el motor del cruce (753) · la bandeja del verificador (787) · unificar C5.

---
> **Impacto en arquitectura:** amplía una derivación pura (`enlace-derivado`, nuevo sub-estado) y la vista
> pura del padre (`vista-espera-cita`), y ajusta dos componentes de UI (`EncuestaFormulario`,
> `EsperaCitaPanel`). No toca schema, endpoints ni el stack; no regenera artefactos.
