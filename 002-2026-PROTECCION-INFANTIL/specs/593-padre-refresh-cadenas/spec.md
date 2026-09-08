# SPEC-593 · Panel del padre: clasificación sin refresh + rediseño de «Otros reportes»

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: hallazgos en vivo del CEO (Jelkin), 07-09-2026, en `https://pi.innovadataco.com/mis-reportes` y el detalle de un reporte. Rama `work/pi-SPEC-593-padre-refresh-cadenas`.

## Impacto en arquitectura: no

Cambios 100 % de UI (dos componentes cliente). Sin endpoints nuevos, sin schema, sin migraciones. El detalle ya entregaba `reporte.enProceso` (`mapEstadoUsuario`, SPEC-090/116) y las cadenas ya entregaban `otrosReportes` con fecha, lugar y clasificación (SPEC-340).

## El problema

Dos fricciones vistas en vivo con el dueño:

1. **La clasificación no se refresca en vivo.** El padre crea un reporte; la IA lo procesa en segundo plano (cola pg-boss + worker: PENDIENTE → CLASIFICADO/CORREGIDO/…), pero en `MisReporteDetalle` sigue viendo «En proceso» hasta que SALE y VUELVE A ENTRAR a la pantalla.
2. **El bloque «Otros reportes» era confuso.** Copy disperso («No estás solo…»), lista plana separada por puntos, y un párrafo motivacional («Cada evento que agregas fortalece tu expediente. Nada se cierra…») que sonaba a otra funcionalidad. El dueño pidió: «mejorar el diseño, debe ser más claro».

## Alcance

- **(a) Refresco en vivo del detalle** (`src/components/modules/MisReporteDetalle.tsx`):
  - Polling ligero cada 15 s SOLO mientras `reporte.enProceso` sea true; al llegar a estado final se corta el interval. Mismo patrón y ritmo que `AnalisisExpediente` (SPEC-341, R-7), ya validado en la zona padre.
  - Mensaje de «procesando» claro: indicador pulsante + «Estamos procesando tu reporte» + aviso de que la pantalla se actualiza sola (`aria-live="polite"`).
  - Un fallo de un tick de polling NO borra lo que ya se muestra (error solo cuando aún no hay datos).
  - Robustez: `cargar` ahora es estable entre renders (`router.push` vive en un ref); antes, depender del objeto `router` re-disparaba el efecto de carga en cada render.
- **(b) Rediseño del bloque «Otros reportes»** (`src/components/modules/padre/MisReportesCadenas.tsx`):
  - Tarjeta con jerarquía clara: título «Otros reportes sobre este identificador» + contador prominente en badge («1 persona más» / «N personas más», solo cuando hay).
  - Frase de acompañamiento con el identificador en negrita.
  - Lista de eventos limpia: fecha-hora, lugar y clasificación en badge (no más puntos intermedios ni etiqueta «anónimo/otro padre» — la regla de privacidad es «nunca el texto ni quién reportó»).
  - Nota de privacidad en texto secundario pequeño.
  - Se ELIMINA el copy motivacional redundante («Cada evento que agregas fortalece tu expediente. Nada se cierra…»).
- **Zona de exclusión respetada**: no se toca bandeja admin/operador, notificaciones ni el flujo de revelado de texto con contraseña/código (SPEC-584, otro agente).

## Functional Requirements

- **FR-001**: El detalle del reporte DEBE refrescar el estado automáticamente mientras el reporte esté en procesamiento, con un intervalo de ~15 s, y DEBE dejar de consultar al llegar a un estado final.
- **FR-002**: El componente DEBE limpiar el interval al desmontarse (sin setState ni fetches posteriores al unmount).
- **FR-003**: Mientras procesa, la UI DEBE mostrar un mensaje claro de procesamiento con actualización automática (sin exigir salir y volver a entrar).
- **FR-004**: El bloque «Otros reportes» DEBE mostrar título, contador prominente y cada evento con fecha, lugar y clasificación en formato limpio.
- **FR-005**: El bloque NO DEBE mostrar texto de reportes ajenos ni quién reportó (regla de privacidad del dominio), y NO DEBE incluir copy motivacional ajeno al bloque.

## Criterios de aceptación

- [x] Polling: refresca a los 15 s y corta al estado final (test con fake timers).
- [x] Unmount: no hay fetches de polling tras el desmontaje (test con fake timers).
- [x] Bloque: contador (singular/plural), fecha, lugar y clasificación visibles; «anónimo/otro padre» ausente; copy motivacional ausente.
- [x] Tests existentes del detalle (spec 116, contrato de no-exposición técnica) siguen en verde.
- [x] `tsc --noEmit`, ESLint, vitest (unit + integration) y build verdes.

## Implementación

- `src/components/modules/MisReporteDetalle.tsx` — `cargar` estable (push en ref), estado de carga derivado, efecto de polling con limpieza, tarjeta «Estamos procesando tu reporte» con `aria-live`.
- `src/components/modules/MisReporteDetalle.test.tsx` — +2 tests SPEC-593 (fake timers: corta en estado final / no fetch tras unmount); el test «en proceso» existente sigue pasando.
- `src/components/modules/padre/MisReportesCadenas.tsx` — bloque rediseñado como tarjeta; se retira el párrafo motivacional y la etiqueta de anonimato.
- `src/components/modules/padre/MisReportesCadenas.test.tsx` — nuevo: 4 tests del bloque (contenido, singular, privacidad/copy, empty state).

## Deuda / notas

- El polling del detalle no avisa al usuario cuando el estado cambia mientras mira otra pestaña: al volver, el próximo tick (máx. 15 s) lo refleja. Se evaluó revalidación por foco (`visibilitychange`) y se dejó fuera para no duplicar superficie; el interval ya cubre el escenario del hallazgo.
- El listado de cadenas (`/mis-reportes`) no hace polling: el hallazgo del CEO fue en el DETALLE; el evento nuevo del padre mismo ya dispara `cargar()` al agregar. Si el CEO quiere refresco en vivo también en la lista, es una extensión de 5 líneas sobre el mismo patrón.
