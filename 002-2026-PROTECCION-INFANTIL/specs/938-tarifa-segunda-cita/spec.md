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

## Hallazgos y su veredicto (CEO)

- **Reprogramar NO se funde con el bloqueo (hallazgo 1 · FALSO POSITIVO):** `reprogramarPorPadre` crea la fila nueva
  con `pagoHeredadoDeId`, que entra por la rama de pago heredado de `crearSolicitudCita` — ANTES del guardia de la
  2.ª cita. Así una cita CONFIRMADA se puede reprogramar aunque pedir una NUEVA con ese profesional dé 409. El candado
  `segunda-cita` lo fija (caso «crear → 409, reprogramar → OK») para que nadie funda las dos rutas.
- **Panel del profesional (2) y tarjeta del directorio (3)** — superficies del MISMO defecto, scope de 938 por
  VEREDICTO del CEO: `panel.service` muestra «El padre paga» = tarifa + % (el padre paga el ESTÁNDAR + %); la tarjeta
  muestra «De la 2ª cita: $X» sin aclarar que PI no la cobra. El número del panel y el copy de ambas superficies
  dependen de la FORMA que Diseño está definiendo (el CEO se la pidió) — se aplican junto con esa FORMA, no se
  adivinan en una superficie 🔴. (Pre-existentes en main; 938 no las empeora.)
- Pedidos duplicados en curso con el mismo profesional (`SIN_CONFIRMAR`/`PAGADA_PENDIENTE`) siguen permitidos (fuera
  de la regla del VEREDICTO).

## Candados

- `src/lib/profesional/cita/segunda-cita.candado.test.ts` (integración, servicio real + BD): 2.ª con el mismo tras
  CONFIRMADA/CUMPLIDA/NO_ASISTIO_PADRE → 409, sin solicitud y franja libre · tras VENCIDA/REEMBOLSADA → permitida ·
  otro profesional → permitida · otro padre → permitida · tarifa 120.000 → se cobra 50.000 + 10 %. Mutación probada:
  quitar el guardia → 3 rojos. Caso reprogramar: tras una CONFIRMADA, `crearSolicitudCita` con ese profesional → 409
  pero `reprogramarPorPadre` de esa cita → OK (hereda el pago; la original queda REPROGRAMADA).
- `cita.service.test.ts`: el test que exigía «sin override cae a la tarifa» se reescribió: sin precio estándar → 500,
  sin solicitud.
- `src/components/modules/padre/profesionales/segunda-cita-perfil.candado.test.tsx` (unit): aviso y sin panel con cita
  previa; control sin cita previa; tarifa informativa.
