# Plan · SPEC-427b — El código de expediente, de punta a punta

## De dónde sale

427 dejó el código de expediente a medias (validaba y auditaba, pero nadie emitía ni abría). El CEO lo partió a esta spec para no meter media funcionalidad y no dejar botón muerto.

## Análisis en fuente

| Archivo | Qué se sacó |
|---|---|
| `cierre.service.ts` (427) | El patrón del código de cita: emisión atómica con aviso, validar/consumir separados. Se replica para el de expediente. |
| `panel.service.ts:184` | El panel YA expone `expedientesCompartidos` (SPEC-425), listado sin abrir. Es el lugar donde vive la UI. |
| `expediente-vivo.ts:99` | `lecturaDelExpediente(id, usuarioId)` gatea por padre. Se extrae el cálculo y se agrega `lecturaDelExpedientePorId` para el profesional. |
| `docker-adapter.ts`, `worker-citas.mjs` | `pi-citas` ya existe (427); se le suma el quinto barredor. |
| `verify-reglas-notificacion.ts` | El guardián del despliegue: el evento nuevo se declara (no bloqueante). |

## Decisiones

| Decisión | Por qué |
|---|---|
| El acceso vive en la fila usada del código | Una segunda verdad (booleano) podría contradecir la traza que el brief exige. |
| Consumir + auditar en una transacción | Lección fix a de 427: si el audit falla tras consumir, código quemado sin rastro. |
| Auditar CADA lectura, no solo el digitado | H-2: reserva legal. Un acceso sin fila es un acceso que no pasó, legalmente. |
| La lectura es la misma capa 1 del padre | No inventar una segunda vista; el profesional ve lo que el padre, en solo lectura. |
| `lecturaDelExpedientePorId` en el DAL | Q-3: Prisma no sale del DAL; el servicio del profesional no lo toca. |

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| Un atajo que abra el expediente sin código | Candado: el panel no tiene `href` al expediente; el acceso pasa por el POST que consume. |
| Una lectura sin auditar | Candado: la auditoría va ANTES del return, con contraprueba. |
| El código en claro | Candado: no se audita ni se loguea el valor. |
| Emitir a quien no compartió | El barrido filtra `expedienteCompartidoId: { not: null }`; test de integración. |
