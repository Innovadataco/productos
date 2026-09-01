# SPEC-340 · Mis reportes y el expediente · el hilo (A-68 · Fase 1)

**Feature Branch**: `work/pi-SPEC-340-mis-reportes-expediente`
**Created**: 01-09-2026
**Status**: IMPLEMENTADO
**Radicado**: A-68 · Brief del CEO v1.0 (mesa Jelkin 31-08/01-09) · mockup aprobado · Fase 1 de 2 (la Fase 2, «la inteligencia» — análisis IA, radar semanal, aviso proactivo — es SPEC-341, partición aprobada por el CEO 01-09)
**Impacto en arquitectura:** SÍ.
1. **Deroga la creación automática del expediente** (SPEC-323): el expediente pasa a nacer por botón del padre. La cadena de reportes sigue existiendo siempre; el expediente es la vista consolidada que el padre arma a propósito.
2. **Deroga el auto-cierre por inactividad** (decisión CEO 01-09, regla de Jelkin: *nada se cierra nunca*): el motor deja de cerrar; los estados de cierre quedan como código muerto documentado, no se borran.
3. **Revive SPEC-234**: el PDF del padre se conecta al registro de informes con hash y al endpoint público de verificación, hoy sin consumidor.
4. Modelo nuevo de auditoría de informes del padre (inmutable) + 2 parámetros del step-up del texto sensible.
5. Se elimina el CTA «Reportar de nuevo» de `/seguimiento` (SPEC-324, superado por agregar-evento desde el reporte).
Regenerar `docs/architecture/` y `npm run arch:check` verde en el mismo PR.

---

## Problema (verificado en fuente, `origin/main` = 0fa65d67a)

El flujo del padre hoy está **partido en pedazos que no se hablan**: reporta en un formulario que no pide la hora; sus reportes se listan planos, sin la cadena; agregar un evento re-pide país, ciudad y edad que el sistema ya sabe; el análisis del modelo se muestra con la clave técnica, no con lo que significa; el texto sensible queda a la vista de cualquiera que mire la pantalla; el expediente nace solo —sin que el padre sepa qué es— y se cierra solo a los 6 meses; el PDF existe pero no tiene botón; y el escudo del header nunca cambia aunque haya alertas sin ver.

Lo que existe y se reusa (verificado archivo por archivo):

| Pieza | Estado real | Fuente |
|---|---|---|
| Cadena + vinculación de eventos | En la transacción del alta de reportes — ahí mismo nace el expediente automático a derogar | `src/app/api/reportes/route.ts:118-155` |
| «Otros reportes» blindados | Fecha/lugar/clasificación sin texto ni autor, servido al padre | SPEC-323 FR-009 · `src/lib/dal/services/reporte-query.ts:135-191` |
| PDF del expediente | Generador + endpoint listos; falta el botón | `src/lib/expediente/pdf-expediente.ts` · `api/padre/expedientes/[id]/pdf` |
| Verificación pública | Endpoint sin consumidor + `InformeConsolidado.pdfHash @unique` | SPEC-234 · `api/publico/verificar-pdf/[hash]` |
| Mapa | Componente existente | `src/components/modules/MapaUbicaciones.tsx` |
| Escudo | `Guardian` ya pinta calma/alerta; falta la señal | `src/components/ui/Guardian.tsx` · `api/notificaciones/resumen` (devuelve `noLeidas`) |
| Hora del incidente | `fechaIncidente` ya es `DateTime` — la hora siempre cupo; el defecto es solo el campo `type="date"` del formulario. **Cero migración.** | `prisma/schema.prisma:1743` · `ReporteStepDetalle.tsx:153` |
| Auto-cierre a derogar | Tarea del worker que cierra ACTIVO tras N meses | `src/lib/expediente/motor/tareas-motor.ts:65-89` · `worker-expediente-motor.mjs` |
| Letrero a quitar | «Reportando como …» | `ReporteWizard.tsx:232` (+2 tests que lo afirman) |
| CTA a quitar | «Reportar de nuevo a este identificador» | `SeguimientoClient.tsx:293` |
| Guías de acción | Sembradas, con servicio y repo (las usará SPEC-341) | `src/lib/dal/services/guia-accion.ts` |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reporto con día y hora, sin ruido (Priority: P1)

El padre reporta una situación: el formulario pide el día **y la hora** del incidente, y ya no le muestra el letrero «Reportando como …» que no aporta nada.

**Why this priority**: la hora es materia prima del análisis (franjas horarias); sin ella, la capa de lectura del expediente nace coja.

**Independent Test**: crear un reporte con fecha y hora y verificar que ambas quedan guardadas y visibles en el detalle.

**Acceptance Scenarios**:

1. **Given** el formulario de reportar, **When** el padre lo llena, **Then** el campo de fecha pide también la hora, y el reporte guarda ambas.
2. **Given** un padre con sesión iniciada, **When** abre el formulario, **Then** NO ve el letrero «Reportando como …».
3. **Given** un reporte viejo sin hora precisa, **When** se muestra, **Then** no se inventa una hora: se muestra solo la fecha.
4. **Given** la pantalla de seguimiento de un reporte, **When** el padre la ve, **Then** ya NO existe el botón «Reportar de nuevo a este identificador» — el camino es agregar el evento desde su reporte.

---

### User Story 2 — Mis reportes: una tarjeta por cadena, y agrego eventos sin repetir datos (Priority: P1)

Mis reportes muestra **una tarjeta por cadena** (reporte principal + eventos en acordeón cronológico): nick + plataforma, clasificación dominante, cantidad de eventos y fecha del último. Desde el reporte, «Agregar otro evento» trae **nick, país, ciudad y edad fijos, no editables** — el padre solo escribe el texto nuevo y el día y la hora.

**Why this priority**: es la pantalla central del hilo. Hoy la vinculación existe pero re-pide datos que el sistema ya sabe — fricción exactamente donde el padre está más angustiado.

**Independent Test**: con una cadena de 3 eventos, ver una sola tarjeta; agregar un 4º evento escribiendo solo texto + fecha/hora.

**Acceptance Scenarios**:

1. **Given** un padre con una cadena de 3 eventos y un reporte suelto, **When** abre Mis reportes, **Then** ve DOS tarjetas: una con «3 eventos» y acordeón cronológico, otra con el reporte suelto.
2. **Given** la tarjeta de una cadena, **When** el padre toca «Agregar otro evento», **Then** nick, país, ciudad y edad aparecen fijos y NO editables; escribe solo el texto y el día y la hora.
3. **Given** el evento nuevo guardado, **When** vuelve a la tarjeta, **Then** el evento quedó enlazado al principal y el contador y la fecha del último se actualizaron.
4. **Given** cualquier pantalla del hilo, **When** se busca la palabra «cerrar», «resuelto» o un puntaje de riesgo, **Then** no existe.

---

### User Story 3 — Entiendo el análisis y mi texto queda protegido (Priority: P1)

Cada reporte tiene «Ver análisis»: la clasificación del modelo **explicada en lenguaje de padre** («Encontramos señales de contacto sexual: alguien pidiendo fotos o encuentros. Es grave y vale la pena documentarlo.»). Y el texto que el padre escribió vive **tapado por defecto** (el agresor puede vivir en la misma casa): revelar lo muestra, se vuelve a tapar solo a los N minutos, y si la sesión lleva más de M minutos revelar pide la contraseña.

**Why this priority**: privacidad de datos sensibles (P1 por seguridad) + la explicación es lo que convierte una clave técnica en una razón para actuar.

**Independent Test**: abrir un reporte clasificado, ver la explicación; verificar el texto difuminado, revelarlo, esperar el re-tapado; simular sesión vieja y verificar el pedido de contraseña.

**Acceptance Scenarios**:

1. **Given** un reporte clasificado, **When** el padre toca «Ver análisis», **Then** ve la explicación en lenguaje sereno de qué significa la clasificación — nunca la clave técnica sola.
2. **Given** cualquier vista con el texto propio del padre (Mis reportes, expediente), **When** carga, **Then** el texto está difuminado con el control «Revelar texto · se ocultó por tu seguridad».
3. **Given** el texto revelado, **When** pasan N minutos (parámetro, arranca en 10), **Then** se tapa solo.
4. **Given** una sesión de más de M minutos (parámetro, arranca en 30), **When** el padre toca revelar, **Then** el sistema pide **su contraseña** — nunca el correo.
5. **Given** el PDF del expediente, **When** se genera, **Then** el texto va SIN tapar (es el entregable deliberado).
6. **Given** el texto de reportes ajenos, **When** cualquier vista, **Then** jamás se muestra — el blindaje de servidor no cambia.

---

### User Story 4 — Veo que no estoy solo: otros reportes al mismo identificador (Priority: P2)

En la tarjeta de la cadena, la sección «Otros reportes» muestra los de otros padres y anónimos: **fecha, hora, país, ciudad y clasificación — nunca el texto, nunca el autor** — con distinción visual mío / autenticado / anónimo.

**Why this priority**: el dato blindado ya existe en el servidor; es presentarlo. Mueve al padre a documentar («No estás solo: 2 personas más reportaron a 300»).

**Independent Test**: sembrar un reporte anónimo al mismo identificador y verificar que aparece con sus metadatos y sin texto.

**Acceptance Scenarios**:

1. **Given** un identificador con un reporte ajeno anónimo y uno autenticado, **When** el padre abre su tarjeta, **Then** ve «Otros reportes» con fecha, hora, lugar y clasificación de cada uno, marcados como anónimo/autenticado, sin texto ni autor.
2. **Given** un identificador sin reportes ajenos, **When** abre la tarjeta, **Then** ve «sin otros reportes por ahora» — no un espacio vacío.

---

### User Story 5 — YO creo mi expediente, y nunca se cierra (Priority: P1)

En la tarjeta: **«Crear expediente»** la primera vez, **«Ver expediente»** después. Se acaba el expediente que nacía solo y se cerraba solo.

**Why this priority**: cambio de fondo del brief (§4): si el padre lo crea, entiende qué es — *su* carpeta deliberada para llevar a una autoridad.

**Independent Test**: cadena sin expediente → botón «Crear» → expediente creado → botón pasa a «Ver». Verificar que un 2º reporte vinculado ya NO crea expediente solo.

**Acceptance Scenarios**:

1. **Given** una cadena sin expediente, **When** el padre toca «Crear expediente», **Then** nace el expediente de esa cadena y el botón pasa a «Ver expediente».
2. **Given** un padre que vincula un 2º reporte, **When** la vinculación se guarda, **Then** NO se crea ningún expediente automáticamente.
3. **Given** un expediente con más de N meses sin actividad, **When** corre el motor, **Then** NO lo cierra — el auto-cierre queda derogado.
4. **Given** el único expediente que ya existe en producción, **When** se despliega este cambio, **Then** sigue vivo, visible e intacto.

---

### User Story 6 — El expediente: el mapa cuenta la historia (Priority: P2)

El expediente (ventana propia) trae tres bloques: el **mapa** con las ciudades de todos los reportes y el botón **«Reproducir la historia»** (aparecen ciudad por ciudad en orden cronológico, con la fecha visible y barra de reproducción con pausa/arrastre; si aparece otro país, el mapa se amplía solo); la **línea de tiempo** vertical (míos completos, ajenos solo lugar+clasificación, cada uno marcado); y **«Generar informe (PDF)»**.

**Why this priority**: es la vista que motiva a actuar — el padre VE el modo de operar. Depende de la 5.

**Independent Test**: expediente con reportes en 3 ciudades → reproducir la historia → verificar orden cronológico y fechas visibles.

**Acceptance Scenarios**:

1. **Given** un expediente con hechos en 3 ciudades (uno ajeno), **When** el padre abre el expediente, **Then** ve el mapa con las 3 ciudades y el encabezado del estilo «5 hechos documentados · 3 tuyos, 1 de otro padre, 1 anónimo · siempre abierto».
2. **Given** el botón «Reproducir la historia», **When** lo toca, **Then** los hechos aparecen ciudad por ciudad en orden cronológico con la fecha visible, y puede pausar y arrastrar.
3. **Given** un hecho en otro país, **When** la reproducción llega a él, **Then** el mapa se amplía solo para mostrarlo.
4. **Given** la línea de tiempo, **When** la recorre, **Then** los hechos propios muestran su texto (tapado, con revelar), los ajenos solo lugar y clasificación, y cada uno está marcado mío/autenticado/anónimo.
5. **Given** cualquier parte del expediente, **When** se muestra un dato de ubicación, **Then** es solo la ciudad — nunca una dirección.

---

### User Story 7 — Genero informes para siempre, con sello verificable (Priority: P2)

«Generar informe (PDF)» funciona **las veces que quiera, para siempre**. Cada PDF lleva impresa la **fecha y hora de generación** (hora de Colombia) y un **código de verificación**: quien lo reciba puede confirmar en la página pública que es auténtico y no fue alterado. Cada generación queda en «Informes generados» — lista permanente que **no se puede borrar ni editar**.

**Why this priority**: es el entregable con valor probatorio. El mecanismo de verificación YA existe (SPEC-234) — se revive, no se reconstruye.

**Independent Test**: generar dos informes con una hora de diferencia → ambos en la lista con su fecha → verificar el código del segundo en la página pública.

**Acceptance Scenarios**:

1. **Given** el expediente, **When** el padre genera el informe, **Then** el PDF trae impresas la fecha y hora de generación (hora de Colombia) y el código de verificación.
2. **Given** dos generaciones separadas una hora, **When** mira «Informes generados», **Then** ve las DOS entradas con su fecha y hora, permanentes.
3. **Given** el código de un informe, **When** una autoridad lo consulta en la página pública, **Then** confirma que es auténtico; un PDF alterado NO verifica.
4. **Given** el registro de informes, **When** se intenta borrar o editar una entrada por cualquier vía de la aplicación, **Then** no se puede.

---

### User Story 8 — Leo lo que muestra mi expediente, en cifras (Priority: P2)

El panel «Lo que muestra tu expediente» entrega la lectura **determinista** (capa 1, sin IA): franjas horarias («4 de 5 entre 9 y 11 p. m.»), escalada de clasificación, aceleración («3 hechos en 4 días»), alcance (cuántas personas reportaron), perfil (edades; si el identificador cruza con un hijo, su edad). Bajo el mapa: solo cifras calculadas («Riohacha 7 · Valledupar 5 · Cali 4 — el más reciente: Cali, 31 ago 9:40 p. m.»). Las frases interpretativas NO existen como plantilla — donde iría la interpretación, la invitación: «Pide el análisis detallado para la lectura completa de este patrón» (el análisis es SPEC-341).

**Why this priority**: los HECHOS son de reglas, la INTERPRETACIÓN es de la IA (regla de Jelkin 01-09). La capa 1 debe estar siempre al día, con o sin análisis.

**Independent Test**: expediente con hechos conocidos → verificar las cifras exactas de cada regla, y que ninguna frase con significado aparece pre-horneada.

**Acceptance Scenarios**:

1. **Given** 5 hechos, 4 entre 9 y 11 p. m., **When** el panel carga, **Then** la franja horaria dice exactamente eso, en tono descriptivo.
2. **Given** una cadena que pasó de una clasificación a otra, **When** el panel carga, **Then** la escalada se muestra como hecho («empezó X, el último es Y») — jamás como acusación.
3. **Given** un solo hecho o una sola ciudad, **When** el panel carga, **Then** las cifras cubren el caso sin romperse ni rellenar con frases vacías.
4. **Given** cualquier pantalla de la capa 1, **When** se busca una frase interpretativa de plantilla («se está moviendo», «se concentra en»), **Then** no existe — en su lugar está la invitación al análisis detallado.

---

### User Story 9 — El escudo me avisa con el ámbar (Priority: P3)

El escudo del header pasa a **ámbar** siempre que el padre tenga alguna alerta sin ver — del círculo o de sus hijos. Al verlas, vuelve a la calma.

**Why this priority**: el componente ya pinta ambos estados; es conectar la señal que ya existe.

**Independent Test**: sembrar una alerta sin leer → escudo ámbar → marcarla vista → escudo en calma.

**Acceptance Scenarios**:

1. **Given** una alerta sin ver, **When** el padre entra a cualquier pantalla, **Then** el escudo del header está en ámbar.
2. **Given** que ve sus alertas, **When** la última queda leída, **Then** el escudo vuelve a la calma.
3. **Given** un usuario que no es padre, **When** navega, **Then** su escudo no cambia por esta señal.

---

### Edge Cases

- Cadena con **todos los eventos el mismo día**: el acordeón ordena por hora.
- Reporte **pendiente de clasificar**: «Ver análisis» dice con calma que el análisis está en camino, no muestra vacío.
- **Dos pestañas** con el texto revelado: cada una re-tapa por su propio reloj; la contraseña pedida en una no desbloquea la otra sesión vieja.
- Contraseña equivocada en el step-up: mensaje sereno, sin bloquear la cuenta al primer error (respeta el límite de intentos global existente).
- Expediente creado y luego **todos los reportes de la cadena eliminados/anonimizados** por disputa: el expediente muestra lo que queda, sin romperse.
- «Reproducir la historia» con **una sola ciudad**: la reproducción funciona igual (aparece y termina).
- Generar PDF **dos veces en el mismo minuto**: dos entradas con su hora; códigos distintos.
- El **único expediente de producción** (creado automático): sobrevive intacto; su origen automático no se borra del registro.
- Padre en el **camino guiado sin terminar** (A-67): estas pantallas viven detrás del guardián — sin camino terminado no se llega; ninguna colisión nueva.

---

## Requirements *(mandatory)*

### Functional Requirements

**Reportar (§2 del brief)**

- **FR-001**: El formulario de reportar DEBE pedir día **y hora** del incidente; ambos se guardan. Los reportes existentes no se reescriben.
- **FR-002**: El letrero «Reportando como <nombre> <correo>» DEBE desaparecer del formulario.
- **FR-003**: El botón «Reportar de nuevo a este identificador» de la pantalla de seguimiento DEBE eliminarse (deroga esa parte de SPEC-324).
- **FR-004**: La edad del menor DEBE seguir capturándose y guardarse limpia (materia prima de analítica futura — ese análisis es OTRO alcance).

**Mis reportes (§3)**

- **FR-005**: Mis reportes DEBE mostrar una tarjeta por **cadena** (principal + eventos en acordeón cronológico) con: nick + plataforma, clasificación dominante, cantidad de eventos y fecha del último.
- **FR-006**: «Agregar otro evento» DEBE vivir dentro del reporte y traer nick, país, ciudad y edad **fijos y no editables**; el padre escribe solo el texto y el día y la hora. El evento queda enlazado al principal.
- **FR-007**: Cada reporte/evento DEBE ofrecer «Ver análisis» con la clasificación **explicada en lenguaje de padre** — la explicación por categoría vive parametrizada (editable por el administrador), nunca la clave técnica sola.
- **FR-008** (step-up del texto sensible): el texto propio DEBE vivir tapado por defecto en toda vista; revelar lo muestra; se re-tapa solo a los N minutos (`ParametroSistema`, semilla 10); con sesión de más de M minutos (`ParametroSistema`, semilla 30) revelar exige la **contraseña** — nunca el correo. El PDF no se tapa. El texto ajeno sigue blindado en servidor, sin cambio.
- **FR-009**: La sección «Otros reportes» DEBE mostrar los reportes ajenos al mismo identificador con fecha, hora, país, ciudad y clasificación — nunca texto ni autor — distinguiendo mío / autenticado / anónimo, y decir «sin otros reportes por ahora» cuando no haya.

**El expediente (§4)**

- **FR-010**: El expediente DEBE crearse SOLO por el botón del padre («Crear expediente» → «Ver expediente»). La creación automática al vincular DEBE derogarse.
- **FR-011**: El auto-cierre por inactividad DEBE derogarse: el motor deja de cerrar expedientes; los estados de cierre quedan como código muerto documentado (no se borran). Ningún expediente existente se toca.
- **FR-012**: En ninguna pantalla del hilo DEBEN existir «cerrar», «resuelto», «caso terminado» ni puntajes de riesgo.
- **FR-013**: El expediente DEBE abrir con el mapa de ciudades de TODOS los reportes de la cadena (propios y ajenos) y el botón «Reproducir la historia»: aparición ciudad por ciudad en orden cronológico, fecha visible, barra con pausa y arrastre, ampliación automática si entra otro país. Solo ciudades, jamás direcciones.
- **FR-014**: La línea de tiempo vertical DEBE listar todos los hechos por fecha y hora: los propios completos (tapados, con revelar), los ajenos solo lugar + clasificación, cada uno marcado mío/autenticado/anónimo.
- **FR-015**: «Generar informe (PDF)» DEBE funcionar ilimitadamente, para siempre. Cada PDF DEBE llevar impresas fecha y hora de generación (hora de Colombia) y el código de verificación.
- **FR-016**: Cada generación DEBE quedar en «Informes generados» — registro visible al padre, permanente, **sin borrado ni edición posibles** desde la aplicación.
- **FR-017**: El código de verificación DEBE resolver en la página pública existente: un PDF auténtico verifica; uno alterado no. Se conecta el mecanismo de SPEC-234, no se construye otro.
- **FR-018** (capa 1 · reglas deterministas): el panel «Lo que muestra tu expediente» DEBE calcular en vivo, de los datos: franjas horarias de concentración, escalada de clasificación, aceleración de frecuencia, alcance (personas distintas), perfil (edades reportadas; si el identificador cruza con un hijo del padre, su edad/sexo). Siempre descriptivo, jamás acusatorio.
- **FR-019**: Bajo el mapa y en todo panel de capa 1 DEBEN ir solo cifras calculadas y ordenadas que cubran cualquier combinación (una ciudad, empates, otro país). Las frases interpretativas de plantilla ESTÁN PROHIBIDAS; en su lugar, la invitación al análisis detallado (SPEC-341).

**El escudo (§5)**

- **FR-020**: El escudo del header DEBE estar en ámbar siempre que el padre tenga alertas sin ver (círculo o hijos) y volver a la calma cuando no queden. Solo aplica al padre.

### Key Entities

- **Cadena de reportes**: el principal y sus eventos enlazados — ya existe; gana presentación de tarjeta única.
- **Expediente**: pasa de nacer solo a nacer por decisión del padre. Nunca se cierra.
- **Informe generado**: registro inmutable de cada PDF — fecha/hora, hash verificable, número secuencial. Visible al padre para siempre.
- **Explicación de clasificación**: texto por categoría en lenguaje de padre, parametrizado y editable por el administrador.
- **Parámetros del step-up**: minutos de re-tapado (10) y edad de sesión que exige contraseña (30).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un padre agrega un evento a su cadena escribiendo **solo** el texto y el día y la hora — cero campos repetidos — en menos de 1 minuto.
- **SC-002**: El 100 % de los reportes nuevos guardan fecha **y hora** del incidente.
- **SC-003**: El texto sensible no es legible en pantalla sin una acción explícita de revelar, se re-tapa solo a los N minutos, y con sesión vieja exige contraseña — verificado en Mis reportes y en el expediente.
- **SC-004**: Tras el despliegue, **cero** expedientes nacen sin botón y **cero** expedientes se cierran por inactividad; el existente de producción sigue intacto.
- **SC-005**: Dos informes generados con una hora de diferencia aparecen ambos, permanentes, con su fecha y hora; el código del PDF verifica en la página pública y un PDF alterado no verifica.
- **SC-006**: La reproducción del mapa recorre los hechos en orden cronológico con la fecha visible, y cubre los casos de una sola ciudad y de otro país sin romperse.
- **SC-007**: En ninguna pantalla del hilo existe «cerrar», «resuelto» ni puntaje — verificado por búsqueda de texto en el recorrido.
- **SC-008**: El escudo pasa a ámbar con una alerta sin ver y vuelve a calma al leerla, sin recargar.
- **SC-009**: Todo texto de capa 1 sale de cifras calculadas; ninguna frase interpretativa aparece dos veces idéntica por venir de plantilla.

---

## Decisiones ya tomadas (CEO, 01-09-2026)

- **D-1 · Auto-cierre**: se APAGA. La regla de Jelkin («nada se cierra nunca») deroga el auto-cierre de SPEC-230/323. Parámetro apagado, el motor deja de cerrar, estados de cierre = código muerto documentado. Nada se borra.
- **D-2 · Partición**: A-68 va en dos specs. Esta (340) es el hilo completo sin IA; SPEC-341 es la inteligencia (análisis IA con cola, radar semanal, aviso proactivo). Un PR cada una.
- **D-3 · La cola del análisis** (aplica a 341, se anota acá por el diseño): misma cola de trabajos existente, prioridad MENOR que clasificar. Proteger va antes que narrar.
- **D-4 · Reescritura de #202**: la transacción del alta de reportes (arreglada ayer) se reescribe al derogar el expediente automático — avisado, sin sorpresa.

## Assumptions

- **A-1**: `fechaIncidente` ya guarda hora en la base — el cambio es solo del formulario y validación. Cero migración de datos.
- **A-2**: Las explicaciones por categoría se **siembran** parametrizadas con texto inicial en la voz del brief; el administrador las edita después (regla vigente: sembrar parametrizables, no preguntar).
- **A-3**: El registro «Informes generados» reusa el modelo de informes existente (`InformeConsolidado`, que ya tiene hash único y fecha) extendido para el flujo del padre — antes de crear un modelo nuevo se verifica en plan si alcanza.
- **A-4**: El step-up aplica al TEXTO del reporte propio; los metadatos (fechas, lugares, clasificación) quedan visibles — son los que orientan al padre sin exponer el contenido.
- **A-5**: «Sesión reciente» se mide desde el inicio de sesión. El reloj del re-tapado es del cliente; el del umbral de contraseña se valida en servidor (el cliente no puede saltárselo).
- **A-6**: La distinción mío/autenticado/anónimo usa los datos que ya sirve el blindaje de SPEC-323; no se expone ningún dato nuevo del autor.
- **A-7**: Fuera de alcance de esta spec (van en SPEC-341): análisis IA (capa 2), radar semanal del hijo, aviso proactivo «otra familia reportó». Fuera de A-68 entero: cuentas gemelas, «prepárate para la denuncia», integración con la entidad competente.
- **A-8**: Voz: tuteo neutro colombiano, serena; ámbar único color de alerta; nada de rojo (reglas vigentes de A-67).
- **A-9**: Migraciones aditivas; el expediente de producción (1) se conserva con su historia.

---

## Implementación (01-09-2026)

**Rama**: `work/pi-SPEC-340-mis-reportes-expediente` · ver `cierre.md` para el detalle completo, las desviaciones (la self-FK de la cadena, la derogación incondicional, el contrato del sello por construcción) y la deuda declarada.

| Área | Piezas |
|---|---|
| Esquema | 4 migraciones: derogar auto-cierre (parámetro) · self-FK de la cadena con backfill y guardas · InformePadre + origenCreacion |
| Derogaciones | alta sin expediente · auto-cierre incondicional · letrero y CTA fuera |
| Rutas | cadenas · evento (herencia) · expedientes (botón) · step-up · texto (única vía) · lectura (capa 1) · PDF con sello · verificar-pdf de 3 vías |
| Módulos puros | `lectura-capa1` (12 casos + anti-plantilla) · `stepup-sello` |
| UI | MisReportesCadenas · AgregarEvento · TextoSensible · VerAnalisis · ExpedienteVivo (mapa+historia) · escudo ámbar |
| Consumidores | home-timeline, sugerencia y estado vacío → la cadena (círculo documentado como no migrado) |

**Pendiente**: recorrido del CEO (candado 25) y aceptación de Jelkin.
