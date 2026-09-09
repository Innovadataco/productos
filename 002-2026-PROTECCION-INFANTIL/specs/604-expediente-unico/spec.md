# SPEC-604 · Modelo EXPEDIENTE (cimientos): toda cadena del padre nace con expediente

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-09 · **Origen**: diseño final aprobado (`design/expediente-final-mockup.html` — «EXPEDIENTE como módulo único»: un expediente = ficha de UNA cuenta que toca a UN menor; los reportes son eventos dentro; el anónimo NO cambia en nada). Rama `work/pi-SPEC-604-expediente-unico`.

## Modelo aprobado

UN SOLO módulo Expediente para el padre autenticado: **crear un reporte = abrir un expediente nuevo o sumar un evento al existente**. Se deroga la creación manual de SPEC-340 (el botón «Crear expediente»): el automático vuelve, ahora por diseño aprobado y desde el EVENTO 1 (SPEC-323 lo hacía al 2º reporte). El reporte anónimo queda exactamente igual: mismo wizard de 3 pasos, sin paso 0, sin expediente, con su campo de edad.

## User Stories

### US1 — Paso 0: «¿Para quién reportas?» con alta «solo nombre» (P1)

Como padre autenticado, al reportar quiero elegir para cuál de mis hijos es el reporte —y si no tengo la ficha, crearla ahí mismo con solo el nombre— para no abandonar el reporte por tener que ir a otra pantalla.

- El paso 0 (existente desde SPEC-591) lista SOLO fichas ACTIVAS (`GET /api/padre/hijos`), cada una con la edad registrada («Laura · 11 años», «Nicolás · sin edad»).
- Opción «+ Nuevo hijo (solo nombre)» del mockup: el padre escribe solo el nombre; la ficha se crea AL ENVIAR el reporte (no antes: un wizard abandonado no deja fichas huérfanas) y el reporte nace atado a ella.
- Sin fichas activas, el alta inline queda ofrecida directamente (ya no es un callejón sin salida que mandaba a otra pantalla).
- Escenario de aceptación: padre sin fichas escribe «Valentina», completa el wizard y envía → `POST /api/padre/hijos {nombre:"Valentina"}` (201) y luego `POST /api/reportes` con el `hijoId` devuelto.

### US2 — Edad automática desde la ficha (P1)

Como padre, no quiero que me pregunten la edad de mi hijo si ya la registré, para reportar más rápido y sin contradicciones.

- Con ficha elegida, `edadVictima` se DERIVA del año de nacimiento (`año en curso − anioNacimiento`) y el campo «Edad aproximada del menor» se OCULTA en el paso 2 (solo modo autenticado).
- Ficha «sin edad» (o alta «solo nombre», que nace sin año) → el reporte va sin edad; no se inventa ninguna.
- El anónimo conserva el campo tal cual (no tiene fichas).

### US3 — El expediente nace con el primer reporte (P1)

Como padre, quiero que cada cuenta que reporto tenga su expediente desde el primer evento, para seguir la situación en un solo lugar sin tener que crear nada a mano.

- Al crear el PRIMER reporte de un identificador, el expediente se crea automáticamente en la MISMA transacción del `POST /api/reportes` (estado ACTIVO, `origenCreacion = AUTOMATICO`, evento 1 = ese reporte).
- Los eventos siguientes (vinculación `reportePrevioId` o «Agregar otro evento») se suman al expediente existente — idempotente: un reporte entra UNA sola vez.
- El botón «Crear expediente» de Mis reportes desaparece; queda «Ver expediente».
- `POST /api/padre/expedientes` NO se elimina: queda como backfill idempotente para cadenas legadas anteriores a esta spec (devuelve el existente si ya hay).

### US4 — El anónimo no cambia en nada (P1 · candado)

Como visitante anónimo, reporto exactamente como antes: wizard de 3 pasos, sin paso 0, con el campo de edad, mi número de seguimiento y ninguna funcionalidad nueva — el modelo Expediente es solo del padre autenticado.

## Impacto en arquitectura: sí (acotado)

- **Migración: NO se agrega ninguna.** `Reporte.hijoId` (nullable, FK a `Hijo` con `ON DELETE SET NULL`, índice `Reporte_hijoId_idx`) YA existe por SPEC-591 (migración `20260908005736_spec591_reporte_atado_a_hijo`, 100 % aditiva) — el requisito del brief ya estaba satisfecho en `main`. El schema solo cambia un COMENTARIO (`Expediente.origenCreacion`: `AUTOMATICO` vuelve a ser el origen normal).
- **Navegación: sin rutas nuevas ni cambios de proxy/menú.** Cambia la navegación INTERNA del wizard autenticado (el paso 0 gana el alta inline «solo nombre» y el paso 2 oculta la edad) y se retira la acción «Crear expediente» de Mis reportes. `npm run arch:check` queda en VERDE sin regenerar artefactos (la línea base no cambia).
- **Nuevo servicio DAL**: `src/lib/dal/services/expediente-automatico.ts` (`asegurarExpedienteParaReporte`), llamado dentro de la UoW del alta y del endpoint de evento. La carrera de altas concurrentes sigue cerrada por el advisory lock (usuario+identificador) de SPEC-137, que se toma antes en la misma tx.

## Functional Requirements

- **FR-001**: En modo autenticado, el paso 0 del wizard DEBE listar solo fichas ACTIVAS del padre con su edad derivada del año de nacimiento («N años» o «sin edad»), y DEBE ofrecer «Nuevo hijo (solo nombre)» con un campo de nombre; sin fichas activas, ese alta inline DEBE quedar visible de entrada. El anónimo NO DEBE ver paso 0.
- **FR-002**: El alta «solo nombre» DEBE materializarse recién al enviar el reporte: primero `POST /api/padre/hijos` con `{ nombre }` y después `POST /api/reportes` con el `hijoId` devuelto; si el alta falla, el reporte NO se envía y el error se muestra. `POST /api/padre/hijos` DEBE aceptar la ficha sin apellidos (deroga parcialmente SPEC-339 FR-019: la columna queda con su default `""`; el formulario completo de «A quién protejo» sigue pudiendo enviarlos).
- **FR-003**: Con ficha elegida, el wizard DEBE derivar `edadVictima = año en curso − anioNacimiento` al seleccionarla y OCULTAR el campo «Edad aproximada del menor» del paso 2 (solo autenticado). Sin año de nacimiento, el reporte va sin edad. El anónimo DEBE conservar el campo.
- **FR-004**: `POST /api/reportes` DEBE persistir `Reporte.hijoId` solo si la ficha pertenece al padre autenticado (regla SPEC-591 intacta: ajena o inexistente → 403 sin distinguir; inactiva → 409; anónimo con `hijoId` → 400).
- **FR-005**: Al crear el primer reporte de un identificador para ese padre, el sistema DEBE crear el `Expediente` en la misma transacción (ACTIVO, `origenCreacion = AUTOMATICO`) y registrar el reporte como evento 1; los reportes siguientes del mismo (padre, identificador) DEBEN sumarse como eventos del expediente vigente sin duplicarse (idempotencia por `reporteId`). Un expediente cuyo último ciclo está CERRADO no acepta eventos: el reporte nuevo abre un ciclo nuevo.
- **FR-006**: «Agregar otro evento» (`POST /api/reportes/[id]/evento`) DEBE heredar también el `hijoId` del principal y sumar el evento al expediente de la cadena (cadenas legadas sin expediente lo abren aquí, misma regla).
- **FR-007**: La respuesta 201 del padre DEBE incluir `expedienteId`; la del anónimo NO. La tarjeta de Mis reportes DEBE mostrar «Ver expediente» y NUNCA «Crear expediente».
- **FR-008**: La spec DEBE declarar `## Impacto en arquitectura:` explícito (ratchet CI, SPEC-126) — ver la sección arriba.
- **FR-009**: El flujo anónimo y la agregación pública NO DEBEN cambiar: reporte anónimo sin `hijoId`, sin expediente, sin paso 0, con su campo de edad, y `GET /api/consulta` intacta.

## Criterios de aceptación

- [x] Paso 0 lista solo activos con edad; la inactiva no se ofrece; «Nuevo hijo (solo nombre)» presente (test wizard).
- [x] Sin fichas, el alta inline aparece de entrada; sin elegir ficha ni escribir nombre no se avanza (test wizard).
- [x] Con ficha (año 2015) el paso 2 no muestra el campo de edad y el POST lleva `edadVictima` derivada; alta «solo nombre» → `POST /api/padre/hijos {nombre}` antes de `POST /api/reportes` con el `hijoId` nuevo y sin edad (tests wizard).
- [x] Anónimo: sin paso 0, el paso 2 conserva «Edad aproximada del menor» (test wizard de regresión).
- [x] Hijo ajeno → 403; hijo inactivo → 409; `hijoId` persistido; anónimo con `hijoId` → 400 (tests SPEC-591, intactos y verdes).
- [x] 1er reporte → expediente ACTIVO/AUTOMATICO con 1 evento y `expedienteId` en la respuesta; 2º y 3er reporte → MISMO expediente (2 y 3 eventos), cadena plana intacta; oferta sin aceptar no escribe nada; anónimo → 0 expedientes (route-expediente-vinculacion.test.ts reescrito).
- [x] «Agregar otro evento» hereda `hijoId` y suma al expediente; endpoint legado idempotente sin duplicar (cadenas/route.test.ts).
- [x] Alta «solo nombre» por API → 201 con `apellidos = ""` (hijos/route.test.ts).

## Assumptions

- `Reporte.hijoId` ya existe en BD por SPEC-591: esta spec no agrega migración (la pedida por el brief ya estaba en `main`).
- Las cadenas creadas ANTES de esta spec no reciben backfill automático: su expediente se abre cuando el padre agrega un evento (o vía el endpoint legado). Sin migración de datos.
- La edad se deriva con el año en curso del servidor/cliente al momento del reporte; no se recalcula sobre reportes históricos.
- El listado de expedientes del padre y el PDF/timeline leen `EventoExpediente` como siempre: al nacer el expediente con el evento 1, todo el mundo lector funciona sin cambios.

## Implementación

- Backend: `src/lib/dal/services/expediente-automatico.ts` (nuevo, `asegurarExpedienteParaReporte`); `src/app/api/reportes/route.ts` (auto-expediente en la UoW + `expedienteId` en la respuesta del padre); `src/app/api/reportes/[id]/evento/route.ts` (hereda `hijoId` + suma al expediente); `src/app/api/padre/hijos/route.ts` + `src/lib/dal/services/hijos/tipos.ts` + `hijos.ts` (apellidos opcionales — alta «solo nombre»); `src/app/api/padre/expedientes/route.ts` (queda como backfill legado, comentario); `prisma/schema.prisma` (solo comentario de `origenCreacion`); comentarios barridos en `reporte-creation.ts` y `cadenas-padre.ts`.
- Frontend: `src/components/modules/ReporteStepHijo.tsx` (chips con edad + alta inline), `ReporteWizard.tsx` (selección con edad derivada, validación del paso 0, alta al enviar, `ocultarEdad`, `hijoNombre` en confirmación), `ReporteStepDetalle.tsx` (prop `ocultarEdad`), `ReporteStepConfirmar.tsx` (fila «Para quién es» + nota del expediente), `padre/MisReportesCadenas.tsx` (sin botón «Crear expediente»).
- Tests: `ReporteWizard.test.tsx` (+5: paso 0, edad auto/oculta, alta al enviar, bloqueo de avance, regresión anónimo), `route-expediente-vinculacion.test.ts` (reescrito: 5 tests del modelo nuevo), `cadenas/route.test.ts` (2 T016 reescritos + herencia de `hijoId`), `hijos/route.test.ts` (alta «solo nombre»).

## Deuda técnica

- `POST /api/padre/expedientes` queda como backfill legado sin UI que lo llame; candidato a retiro cuando no queden cadenas pre-SPEC-604 (requiere medir en prod).
- Cadenas legadas sin expediente no muestran acción en la tarjeta (ni «Crear» ni «Ver») hasta que el padre agrega un evento — aceptado como cimiento; el rediseño completo del módulo («Mis expedientes» como lista principal, órbita del círculo, tendencia) es de la siguiente ola del mockup.
- `estado` no-ACTIVO del expediente (CONSOLIDANDO, PENDIENTE_COMITE, etc.) acepta eventos pero la tarjeta solo enlaza «Ver» para ACTIVO (comportamiento preexistente de `cadenas-padre.ts`, sin cambios).
