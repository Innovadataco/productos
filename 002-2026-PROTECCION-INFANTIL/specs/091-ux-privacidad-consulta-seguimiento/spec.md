# Spec 091 — UX y privacidad de la consulta + seguimiento

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-24

**Input**: el identificador consultado queda en la URL (`/api/consulta?identificador=X`: historial, logs, caché) — dato sensible nunca en URL. Además el home no permite re-consultar el propio reporte por RPT, y el seguimiento no celebra el cambio de estado.

## User Stories

### US1 — Privacidad: identificador fuera de la URL (P1, bug)

**Como** usuario que consulta un identificador, **quiero** que la consulta viaje por POST con el dato en el cuerpo, **para** que el identificador no quede en historial, logs ni caché de URLs.

- La consulta pública usa POST con el identificador en el cuerpo (query string limpio).
- El navegador NO navega a `/consulta?identificador=X`; resultados inline, URL limpia.
- GET se conserva solo como compatibilidad de API; el cliente web siempre usa POST.

### US2 — Re-consultar el propio reporte por RPT (P1)

**Como** usuario anónimo que reportó, **quiero** un campo en el home "Consultar el estado de mi reporte" donde escribir mi número RPT-XXX, **para** volver a ver el estado sin guardar la URL.

- Campo en el home que lleva al seguimiento con el número ya cargado.
- El número no queda en la URL: se transporta por sessionStorage y se limpia al usarlo (la URL directa `?numero=` sigue funcionando por compatibilidad).

### US3 — Animación de transición En proceso → Procesado (P2)

**Como** usuario, **quiero** ver el paso de estado con movimiento (spinner → flechas encendiéndose → check verde con rebote), **para** entender que mi reporte avanzó. Corre UNA vez al revelar el estado, no en bucle.

## Requirements

- **FR-001**: `POST /api/consulta` con `{ identificador }` en el cuerpo; misma respuesta que GET (contrato de la 089 intacto).
- **FR-002**: Clientes web (home y `/consulta`) usan POST; la URL del navegador nunca contiene el identificador.
- **FR-003**: Home con campo RPT que navega a `/seguimiento` cargando el número vía sessionStorage (limpio tras leer).
- **FR-004**: Animación de una sola corrida en seguimiento al revelar estado (spinner en proceso; flechas + check con rebote en procesado).
- **FR-005**: Nada rompe 089/090; tests: POST sin identificador en URL, input RPT en home.

## Success Criteria

- **SC-001**: `POST /api/consulta` devuelve el mismo contrato que GET y el test verifica que el identificador no viaja en la URL (sin query string).
- **SC-002**: El home ofrece el campo RPT y el seguimiento lo autocompleta sin `?numero=` en la URL.
- **SC-003**: Gate completo + push con staging explícito del 002.
