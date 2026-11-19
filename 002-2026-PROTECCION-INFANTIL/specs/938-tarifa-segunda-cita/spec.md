# SPEC-938 · I-452 · PI cobra e intermedia SOLO la primera cita con cada profesional

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-938-tarifa-segunda-cita` desde la punta de #932 (SPEC-934, `628bf314`): toca las mismas
líneas de `cita.service` y de la ficha. Hasta que #932 mergee, este PR muestra también sus commits.

## Regla (verificada, no supuesta)

Brief A-75 v2.0 §4 «CORREGIDO 03-09 14:5x» (Jelkin, con precedencia): «En su perfil el profesional declara cuánto
cobra de la segunda cita en adelante. Es dato útil para el padre y **PI no lo cobra ni lo intermedia**: el alcance
termina en la primera cita.» §9: «De la segunda en adelante no se controla, no se intermedia y no se cobra».
Cobrar SIEMPRE el precio estándar es correcto. La premisa original de I-452 («la tarifa nunca se cobra = defecto»)
era equivocada; el CEO la corrigió.

VEREDICTO CEO: (b) + (a), «1.ª cita» = la primera con ESE profesional.

## Cambio

- **(b) Servidor:** `crearSolicitudCita` (cita nueva, sin pago heredado) rechaza con **409** si el padre ya tiene con
  ESE profesional una cita que llegó a confirmarse o posterior (`SolicitudCitaRepository.existeCitaConfirmadaConProfesional`,
  estados `CONFIRMADA`, `CUMPLIDA`, `NO_ASISTIO_PADRE`, `NO_ASISTIO_PROFESIONAL`, `REUBICADA`). No cuentan las que no
  prosperaron (`SIN_CONFIRMAR`, `PAGADA_PENDIENTE`, `VENCIDA_SIN_RESPUESTA`, `REEMBOLSADA`) ni `REPROGRAMADA` (la cadena
  sigue en la fila nueva). Con OTRO profesional, permitido. Reasignación (pago heredado) sin cambios.
- **(b) Pantalla:** la ficha calcula el mismo dato y, si aplica, muestra el aviso en lugar del panel de reserva (solo
  evita un panel que no funcionaría; el rechazo real es del servidor).
- **(a)** Se retiró el fallback a `pro.tarifaConsultaCOP` y el error de SPEC-685 («Por ahora solo puedes agendar la
  primera cita…»). Sin precio estándar, la creación falla en CERRADO (500): ningún camino cobra la tarifa.
- **(a)** La tarifa declarada queda informativa: ficha y panel añaden «Se acuerda directamente con el profesional; la
  red no la cobra.» (sin «+ servicio»).

## Copy

**PROVISIONAL** el mensaje de bloqueo (`segunda-cita.ts`) y la línea de tarifa informativa: los define Diseño.

## Hallazgos (no corregidos; decisiones)

- **Reprogramar pagado:** `reprogramarPorPadre` dice «Ya reprogramaste una vez con este profesional. La siguiente es
  reserva y pago nuevos» (D-103(g): una gratis, la segunda se cobra). Si la cita está CONFIRMADA, esa «reserva nueva»
  con el mismo profesional ahora se rechaza → el camino de la 2.ª reprogramación pagada queda cerrado.
- **Panel del profesional:** `panel.service` muestra «El padre paga» = tarifa del profesional + % — falso según el
  brief (el padre paga el precio estándar + %).
- Pedidos duplicados en curso con el mismo profesional (`SIN_CONFIRMAR`/`PAGADA_PENDIENTE`) siguen permitidos (fuera
  de la regla del VEREDICTO).
- La tarjeta del directorio conserva «De la 2ª cita en adelante: $X» sin la aclaración (espera el copy de Diseño).

## Candados

- `src/lib/profesional/cita/segunda-cita.candado.test.ts` (integración, servicio real + BD): 2.ª con el mismo tras
  CONFIRMADA/CUMPLIDA/NO_ASISTIO_PADRE → 409, sin solicitud y franja libre · tras VENCIDA/REEMBOLSADA → permitida ·
  otro profesional → permitida · otro padre → permitida · tarifa 120.000 → se cobra 50.000 + 10 %. Mutación probada:
  quitar el guardia → 3 rojos.
- `cita.service.test.ts`: el test que exigía «sin override cae a la tarifa» se reescribió: sin precio estándar → 500,
  sin solicitud.
- `src/components/modules/padre/profesionales/segunda-cita-perfil.candado.test.tsx` (unit): aviso y sin panel con cita
  previa; control sin cita previa; tarifa informativa.
