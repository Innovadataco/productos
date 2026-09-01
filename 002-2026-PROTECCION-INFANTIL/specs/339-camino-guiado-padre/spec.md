# SPEC-339 · El camino guiado del padre (A-67 · Fase 1)

**Feature Branch**: `work/pi-SPEC-339-camino-guiado-padre`
**Created**: 31-08-2026
**Status**: DESARROLLO
**Radicado**: A-67 · Brief del CEO 31-08-2026 v1.0 · mockup navegable aprobado por Jelkin
**Impacto en arquitectura:** SÍ.
1. Nace un **cuarto portero** en `middleware.ts` (camino incompleto), alimentado por un campo nuevo de la cookie firmada `sesion_estado`. Es el mismo mecanismo de los porteros de consentimiento/vigencia (SPEC-287/318/331/337), no uno nuevo.
2. Migración **aditiva** sobre `Usuario` (documento del padre) y **parámetro nuevo** `padre.hijos.maximo`.
3. Nuevo modelo de token de registro por enlace (aditivo, patrón `TokenRecuperacion`).
4. Dos eventos/plantillas nuevos en el motor de notificaciones (`auth.registro_enlace`, `auth.bienvenida_padre`).
5. **Cada menor pasa a tener padre propio** (decisión CEO 19:24): la unicidad del documento deja de ser global y pasa a ser por padre. Cambia el esquema de `Hijo` y exige migración de datos. Ver D-4.
6. Navegación del padre gana variante móvil (hoy no existe).
Regenerar `docs/architecture/` y dejar `npm run arch:check` en verde en el mismo PR.

---

## Problema (verificado en fuente, `origin/main` = 04f5af5c0)

Hoy el padre entra a un tablero con módulos abiertos y **nada lo obliga a completar su cuenta**. El resultado es una cuenta a medias que no puede recibir un solo aviso: sin datos de contacto verificables y, sobre todo, **sin un solo menor cargado** no hay a quién cuidar ni a quién avisar.

Lo que existe hoy y se aprovecha:

| Pieza | Estado real | Fuente |
|---|---|---|
| Registro self-service | Código OTP de 6 dígitos en 3 pasos | `src/app/registro/page.tsx`, `src/app/api/auth/verificar/{solicitar,validar,completar}/route.ts` |
| Anti-enumeración del registro | Ya correcto, no se toca | SPEC-338 · `verificar/solicitar/route.ts` |
| Consentimiento | Modal completo y bien hecho (lectura hasta el final, dos casillas, fecha/documento/IP) | `src/components/modules/ModalConsentimiento.tsx` |
| Datos del padre | `apellidos`, `telefono`, `paisId`, `ciudadId`, `fechaNacimiento` ya en `Usuario` | SPEC-334 · `prisma/schema.prisma` |
| Selector de ciudad sin «Otra ciudad» | Ya resuelto en el perfil | `src/components/modules/padre/PerfilPadreForm.tsx:24` |
| Menores | Modelo `Hijo`/`HijoPadre`/`IdentificadorHijo` completo | SPEC-325 |
| Planes y prueba gratis | Activar freemium ya re-sella la cookie de sesión | SPEC-337 · `src/app/api/padre/suscripcion/activar-freemium/route.ts` |
| Porteros de acceso | Cuatro pasos en `middleware.ts` sobre cookie firmada `sesion_estado` | SPEC-287/318 · `middleware.ts`, `src/lib/routing/sesion-estado-emitter.ts` |

Lo que **falta** (verificado, no supuesto):

1. No existe registro por enlace: el flujo es OTP (`CodigoVerificacion`).
2. `Usuario` **no tiene** tipo ni número de documento del padre.
3. `POST /api/padre/hijos` **no tiene ningún tope** de menores.
4. `PATCH /api/padre/hijos/[id]` acepta **solo** `{ estado }` — no se pueden corregir los datos de un menor ya creado (`src/app/api/padre/hijos/[id]/route.ts:11`).
5. No existe correo de bienvenida (`src/lib/email.ts` solo tiene bienvenida de operador y de comité).
6. En móvil el padre **no tiene menú**: `PadreSideNav` es `hidden … sm:flex` (`src/components/modules/padre/PadreSideNav.tsx:20`).
7. No existe ningún portero que exija perfil completo, un menor cargado ni plan elegido.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Me registro con un enlace, no con un código (Priority: P1)

Un padre que no es cercano a la tecnología deja su correo, abre el enlace que le llega y elige su contraseña. No transcribe nada.

**Why this priority**: es la puerta. Si el padre se traba acá, no existe ningún otro paso.

**Independent Test**: se prueba sola, con un correo nuevo, sin tocar el resto del camino: enlace → contraseña → cuenta creada + correo de bienvenida.

**Acceptance Scenarios**:

1. **Given** un correo que no tiene cuenta, **When** el padre lo deja y confirma, **Then** ve la pantalla de aviso con su correo escrito, la nota de correo no deseado y el botón de enviar de nuevo, y recibe un enlace en su buzón.
2. **Given** el enlace recibido, **When** lo abre, **Then** puede elegir su contraseña dos veces con las dos condiciones visibles (8 caracteres · coinciden) y el botón deshabilitado hasta cumplirlas.
3. **Given** la contraseña guardada, **When** termina, **Then** queda con sesión iniciada, recibe el correo de bienvenida y aterriza en el Paso 1 del camino.
4. **Given** un correo que YA tiene cuenta, **When** lo deja, **Then** ve **exactamente la misma pantalla** que en el escenario 1 y el aviso «ya tenés una cuenta» le llega al buzón (SPEC-338 intacto).
5. **Given** un enlace ya usado o de más de 24 horas, **When** lo abre, **Then** el sistema se lo dice con calma y le ofrece pedir uno nuevo, sin dejarlo en un callejón.

---

### User Story 2 — El sistema me lleva de la mano y no me deja saltar pasos (Priority: P1)

El padre recorre cuatro pasos —permiso, sus datos, sus hijos, su plan— con el indicador «Paso N de 4» siempre visible y una sola cosa por pantalla. Los módulos no aparecen hasta terminar.

**Why this priority**: es el corazón del brief. Sin el portero, el camino es una sugerencia y el padre queda a medias, que es el problema que se está arreglando.

**Independent Test**: con una cuenta recién creada, intentar entrar por URL escrita a mano a cualquier módulo y verificar que el sistema devuelve al paso pendiente.

**Acceptance Scenarios**:

1. **Given** una cuenta que no aceptó el consentimiento, **When** escribe a mano la dirección de cualquier módulo, **Then** el sistema lo devuelve al Paso 1.
2. **Given** un padre con consentimiento aceptado y datos incompletos, **When** intenta cualquier módulo, **Then** vuelve al Paso 2.
3. **Given** un padre con datos completos y **ningún** menor cargado, **When** intenta cualquier módulo, **Then** vuelve al Paso 3.
4. **Given** un padre con un menor cargado y sin plan, **When** intenta cualquier módulo, **Then** vuelve al Paso 4.
5. **Given** un padre a mitad del Paso 3, **When** cierra el navegador y vuelve horas después, **Then** retoma en el Paso 3 con lo que ya había cargado, no empieza de cero.
6. **Given** una llamada de datos (no de pantalla) con el camino incompleto, **When** se ejecuta, **Then** responde un error en formato JSON con el destino del paso pendiente, nunca una redirección que el navegador no pueda seguir.

---

### User Story 3 — Cargo a mis hijos, los corrijo, y el sistema me pone un tope (Priority: P1)

El padre registra al menos un menor con sus datos, opcionalmente sus cuentas, y puede corregir después lo que escribió mal.

**Why this priority**: sin un menor cargado el padre no recibe un solo aviso; es la razón de ser del producto.

**Independent Test**: cargar un menor, corregirle un apellido, e intentar cargar un sexto.

**Acceptance Scenarios**:

1. **Given** el Paso 3, **When** el padre carga un menor con nombres, apellidos, tipo y número de documento, año de nacimiento y sexo, **Then** el menor queda registrado y el paso se puede continuar.
2. **Given** un menor ya creado, **When** el padre corrige cualquiera de sus datos, **Then** el cambio queda guardado y visible.
3. **Given** cinco menores registrados, **When** intenta un sexto, **Then** el sistema lo rechaza con el mensaje del parámetro, sin número escrito en el código.
4. **Given** un menor cargado, **When** el padre suma una cuenta (plataforma + nick), **Then** queda asociada, y puede sumar varias o ninguna.

---

### User Story 3-bis — Cada padre tiene su propia lista (Priority: P1)

Dos padres pueden cuidar al mismo menor sin pisarse: cada uno tiene su registro, sus interruptores y sus avisos.

**Why this priority**: sin esto, la corrección de datos de la Historia 3 nace rota — un padre reescribiría los datos del menor del otro — y un padre puede apagarle los avisos al otro sin enterarse.

**Independent Test**: dos padres distintos registran al mismo menor por documento y verifican que sus listas no se afectan entre sí.

**Acceptance Scenarios**:

1. **Given** un menor ya registrado por el padre A, **When** el padre B registra al mismo menor con el mismo documento, **Then** el padre B obtiene **su propio registro** y no se engancha al del padre A.
2. **Given** los dos registros, **When** el padre A inactiva a ese menor, **Then** el padre B **sigue recibiendo** sus avisos con normalidad.
3. **Given** los dos registros, **When** el padre A corrige el nombre o el documento del menor, **Then** el registro del padre B **no cambia**.
4. **Given** un menor ya en la lista del padre A, **When** el padre A intenta registrar ese mismo documento otra vez, **Then** el sistema lo rechaza con un mensaje claro (la unicidad vive dentro de la lista de cada padre).

---

### User Story 4 — Elijo mi plan y los módulos abren al instante (Priority: P2)

El padre ve las tarjetas de los planes activos que el administrador configuró, con la prueba gratis destacada, y un campo de bono promocional.

**Why this priority**: cierra el camino; depende de las tres anteriores.

**Independent Test**: activar la prueba gratis y navegar a un módulo sin recargar ni tocar «Renovar».

**Acceptance Scenarios**:

1. **Given** el Paso 4, **When** el padre activa la prueba gratis, **Then** ve la pantalla de cierre y los módulos abren **al instante**, sin recargar.
2. **Given** planes que el administrador desactivó, **When** el padre llega al Paso 4, **Then** no los ve.
3. **Given** la pantalla de cierre, **When** el padre la ve, **Then** tiene los dos accesos que siguen (sumar al círculo · elegir avisos) y un botón a su panel — nunca un callejón sin salida.

---

### User Story 5 — Uso todo esto desde el teléfono (Priority: P2)

El padre recorre el camino y navega la aplicación a 390 px de ancho.

**Why this priority**: Jelkin: «la mayoría de los padres van a entrar desde el móvil». El camino sin menú móvil deja al padre encerrado al terminar.

**Independent Test**: recorrer camino y módulos a 390 px sin desbordes horizontales y con acceso a todos los destinos del menú.

**Acceptance Scenarios**:

1. **Given** un ancho de 390 px, **When** el padre recorre cualquier pantalla del camino, **Then** ve una sola cosa por pantalla, el indicador de progreso y ningún desborde horizontal.
2. **Given** un ancho de 390 px con el camino terminado, **When** el padre está en cualquier módulo, **Then** tiene acceso a todos los destinos del menú, «Reportar» incluido.

---

### Edge Cases

- Enlace de registro **usado dos veces**: el segundo intento no crea nada y ofrece pedir uno nuevo.
- Enlace **vencido** (24 h): mensaje sereno + reenvío.
- Padre que pide el enlace **muchas veces seguidas**: el límite de solicitudes actual se conserva y responde con el mismo mensaje neutro de siempre.
- Padre que **inactiva su único menor** después de terminar el camino: el guardián lo devuelve al Paso 3 (el camino no se «gana» de por vida, se sostiene). No existe borrado de menores, solo activar e inactivar.
- Documento de menor **que ya existe en otro padre**: se permite; cada padre tiene su propio registro (D-4).
- Documento de menor **repetido dentro del mismo padre**: se rechaza con mensaje claro.
- Padre cuyo plan **vence**: el portero de vigencia (ya existente) manda; el del camino no lo pisa.
- Roles que **no son padre** (colegio, operador, comité, administrador): el portero del camino **no los toca** en absoluto.
- Registro de **colegio**: sigue con código de 6 dígitos, intacto (ver Assumptions A-2).

---

## Requirements *(mandatory)*

### Functional Requirements

**Registro por enlace**

- **FR-001**: El sistema DEBE permitir que un padre pida su registro dejando **solo su correo**, y DEBE enviarle un **enlace** de un solo uso con vencimiento de 24 horas.
- **FR-002**: El sistema DEBE conservar el comportamiento anti-enumeración vigente: la respuesta en pantalla es idéntica exista o no el correo, y el aviso «ya tenés una cuenta» viaja al buzón (SPEC-338).
- **FR-003**: El sistema DEBE mostrar una pantalla intermedia que nombre el correo al que escribió, advierta sobre el correo no deseado, y ofrezca reenviar el enlace y escribir otro correo.
- **FR-004**: Al abrir el enlace, el sistema DEBE pedir la contraseña dos veces con las dos condiciones visibles, y DEBE mantener el botón deshabilitado hasta cumplirlas.
- **FR-005**: Al guardar la contraseña, el sistema DEBE crear la cuenta con rol de padre, iniciar sesión y enviar un **correo de bienvenida**.
- **FR-006**: El enlace DEBE quedar inservible tras el primer uso y tras su vencimiento, y ambos casos DEBEN ofrecer pedir uno nuevo.
- **FR-007**: El registro por **código de 6 dígitos DEBE seguir funcionando** para el registro de colegio, que usa el mismo formulario y las mismas rutas.

**El camino y su portero**

- **FR-008**: El sistema DEBE definir el camino como cuatro pasos ordenados: (1) consentimiento, (2) datos del padre, (3) al menos un menor, (4) plan.
- **FR-009**: El sistema DEBE impedir el acceso a cualquier módulo mientras el camino esté incompleto, **incluso cuando la dirección se escribe a mano**, devolviendo al padre al paso pendiente de menor número.
- **FR-010**: El sistema DEBE retomar el camino en el paso pendiente cuando el padre lo abandona y vuelve, conservando lo ya cargado.
- **FR-011**: El sistema DEBE reflejar el avance **al instante** al completar cada paso, sin exigir recarga ni un segundo intento.
- **FR-012**: Las llamadas de datos bloqueadas por el portero DEBEN responder en formato de datos con el destino del paso pendiente, nunca con una redirección.
- **FR-013**: El portero del camino DEBE aplicar **solo al rol padre**, y NO DEBE alterar los porteros existentes de consentimiento, cambio de contraseña ni vigencia.
- **FR-014**: Cada pantalla del camino DEBE mostrar el indicador «Paso N de 4», una sola cosa por pantalla, y anunciar qué sigue.

**Paso 2 · datos del padre**

- **FR-015**: El sistema DEBE exigir nombres, apellidos, tipo de documento, número de documento, teléfono, país y ciudad.
- **FR-016**: El sistema DEBE ofrecer país y ciudad desde el catálogo existente **sin** la opción «Otra ciudad».
- **FR-017**: El sistema DEBE guardar tipo y número de documento del padre (campos que hoy no existen).

**Paso 3 · los menores**

- **FR-018**: El sistema DEBE exigir **al menos un menor activo** para dar el camino por terminado. Un menor inactivo no cuenta: el padre lo apagó, no lo está cuidando.
- **FR-019**: El sistema DEBE exigir del menor: nombres, apellidos, tipo de documento, número de documento, año de nacimiento y sexo.
- **FR-020**: El sistema DEBE permitir sumar, de forma opcional, varias cuentas (plataforma + nick) por menor.
- **FR-021**: El sistema DEBE topar la cantidad de menores por padre con un **parámetro de sistema** sembrado en 5, nunca con un número escrito en el código, y DEBE rechazar el excedente con el mensaje del parámetro.
- **FR-022**: El sistema DEBE permitir **corregir los datos** de un menor ya creado (hoy solo se puede activar o inactivar).
- **FR-022-a**: Cada menor DEBE pertenecer a **un solo padre**. Dos padres pueden registrar al mismo menor por documento y cada uno obtiene **su propio registro**, con sus propios datos, interruptores y avisos.
- **FR-022-b**: El mismo documento NO DEBE repetirse **dentro de la lista de un mismo padre**, y el intento DEBE rechazarse con un mensaje claro.
- **FR-022-c**: Ninguna acción de un padre sobre un menor (corregir datos, inactivar, apagar una cuenta) DEBE alterar lo que ve o recibe otro padre.
- **FR-022-d**: La migración DEBE **separar** los menores hoy compartidos en un registro por padre, con sus cuentas, **sin perder ningún dato**.

**Paso 4 · el plan y el cierre**

- **FR-023**: El sistema DEBE mostrar únicamente los planes que el administrador tenga activos, con la prueba gratis destacada, más el campo de bono promocional.
- **FR-024**: Al activar un plan, los módulos DEBEN abrir al instante, sin recargar ni pasar por «Renovar».
- **FR-025**: La pantalla de cierre DEBE nombrar al menor cuidado y ofrecer los dos accesos siguientes más el botón al panel.

**Voz, marca y móvil**

- **FR-026**: Todos los textos DEBEN usar el **tuteo neutro colombiano** («Déjanos tu correo», «Léelo con calma», «Entra a ver de qué se trata»), con la voz serena y cercana del brief §3: cero alarma, cero jerga técnica, cero nombres internos, cero mayúsculas de alarma y **cero rojo**. El voseo del brief y del mockup **no se copia** (decisión CEO 19:24 · `AGENTS.md` manda).
- **FR-026-bis**: El mensaje del portero de consentimiento en `middleware.ts:195` («Debés aceptar…») DEBE pasar a tuteo en este mismo PR — es la única frase del código que el padre lee en voseo.
- **FR-027**: El camino DEBE usar el sistema visual existente de la aplicación con sus valores exactos, y la marca El Guardián con el ámbar como único color de alerta, respetando la preferencia de movimiento reducido.
- **FR-028**: El sistema DEBE dar al padre acceso a todos los destinos de su menú **en móvil**, donde hoy no tiene ninguno.
- **FR-029**: El camino DEBE verse correctamente a 390 px de ancho, sin desbordes horizontales.

### Key Entities

- **Token de registro**: permiso de un solo uso, con vencimiento, que autoriza a fijar la contraseña de un correo. No guarda la contraseña ni el enlace en claro.
- **Padre (Usuario)**: gana tipo y número de documento. Conserva todo lo demás.
- **Menor (Hijo)**: sin cambios de forma; gana la posibilidad de que su padre corrija sus datos.
- **Parámetro de tope de menores**: valor editable por el administrador, sembrado en 5, con el mensaje que ve el padre al excederlo.
- **Estado del camino**: el paso pendiente del padre, derivado de datos que ya existen (consentimiento, perfil, menores, suscripción) — no es un dato nuevo que se pueda desincronizar.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un padre que nunca usó la aplicación completa el camino entero —de dejar su correo a ver su panel— en **menos de 5 minutos** y **sin transcribir ningún código**.
- **SC-002**: **Ninguna** dirección escrita a mano deja entrar a un módulo con el camino incompleto: 100 % de los intentos vuelven al paso pendiente.
- **SC-003**: Un padre que abandona en cualquier paso y vuelve retoma **exactamente** donde quedó, en el 100 % de los pasos.
- **SC-004**: Al terminar el camino los módulos abren **al primer intento**, sin recargar ni tocar «Renovar».
- **SC-005**: El sexto menor se rechaza con el mensaje del parámetro, y cambiar el parámetro a otro número **cambia el comportamiento sin tocar código**.
- **SC-006**: El recorrido completo funciona a **390 px** de ancho sin desbordes horizontales, y desde ahí el padre alcanza todos los destinos de su menú.
- **SC-007**: Ninguna pantalla del camino muestra jerga técnica, nombres internos ni el color rojo.
- **SC-008**: El registro de colegio sigue funcionando con su código de 6 dígitos, sin cambios visibles.
- **SC-009**: Con dos padres sobre el mismo menor, **ninguna** acción de uno cambia lo que ve o recibe el otro.
- **SC-010**: Tras la migración, la cantidad de menores y de cuentas visibles para **cada** padre es la misma que antes: cero pérdidas.
- **SC-011**: Ninguna pantalla ni mensaje del sistema le habla al padre en voseo.

---

## Decisiones del CEO (31-08-2026 19:24)

Las cuatro dudas se reportaron antes de implementar (brief §7) y quedaron resueltas.

- **D-1 · La voz** — RESUELTA: **manda `AGENTS.md`, no el brief.** El producto es para Colombia: todo va en **tuteo neutro**. El voseo del mockup no se copia, y la frase en voseo que hoy existe en el código (`middleware.ts:195`) se corrige en este PR. `AGENTS.md` **no se toca**.
- **D-2 · Fecha de nacimiento del padre** — RESUELTA: **fuera del formulario**. Jelkin pidió nombres, apellidos, tipo y número de documento y teléfono, nada más. El campo permanece en la base de datos sin tocar.
- **D-3 · El código de 6 dígitos** — RESUELTA: se conserva **vivo e intacto** para el registro de colegio. El enlace es solo del padre. No se toca `/registro-colegio`.
- **D-4 · Un menor, dos padres** — RESUELTA con cambio de regla: **la unicidad del documento pasa de global a por padre.** Regla de Jelkin (31-08): *si otro padre se registra con otro correo y quiere vincular a los mismos hijos, no pasa absolutamente nada* — cada padre tiene su lista, sus interruptores y sus avisos, independientes.

### Lo que D-4 arrastra (verificado en fuente, reportado al CEO 19:30)

1. Hoy el interruptor de un menor es **global**: si un padre lo inactiva, el otro deja de recibir avisos sin enterarse.
2. Hoy el interruptor de cada cuenta del menor también es global — el propio código lo llama «flag global compartido».
3. **La corrección de datos (FR-022) nace rota sin D-4**: sobre una ficha compartida, un padre le reescribiría el nombre y el documento al menor del otro.
4. La regla **no se puede expresar sobre la ficha del menor tal como está**: la ficha no sabe quién es el padre; el vínculo vive en una tabla aparte. Cumplir la regla exige darle **dueño** a la ficha y que el alta deje de enganchar al segundo padre.
5. El mecanismo de «cuentas desvinculadas por este padre» que SPEC-325 acaba de desplegar **queda sin razón de ser** y se apaga.

### Alcance de D-4 — resuelto (CEO, 31-08-2026 19:34)

Conteo en producción, solo lectura: **0 menores con más de un padre vinculado** (2 menores, 2 vínculos, 5 cuentas, 0 desvinculaciones, 1 padre — la base se limpió hoy por orden de Jelkin). La separación **entra en SPEC-339**: no hay ninguna ficha que partir, la migración no duplica nada y la ventana de costo cero se cierra a medida que entren padres reales.

**Lo que queda inactivo, no borrado** (orden del CEO, por si Jelkin revierte la regla):

- La tabla puente padre↔menor queda **sin uso** y documentada como tal — no se elimina.
- El mecanismo de «cuentas desvinculadas por este padre» queda **apagado** y documentado — no se elimina.

## Addendum · Auditoría de Calidad (31-08-2026, consolidada por el CEO)

Calidad auditó el diseño en paralelo. Tres bloqueos y siete ajustes entraron al alcance; todo verificado en fuente antes de aceptarse:

1. **Bucle camino↔vigencia** (real): las rutas del camino entran a las exentas de vigencia del padre, y nace la **invariante cruzada** — el destino de cada guardián debe estar exento en todos los que corren después. Verificada al arranque; probada por mutación.
2. **Paso 1 sin pantalla propia**: reusa `/consentimiento` con el rótulo «Paso 1 de 4» — el modal no se rehace (brief §2.2) y desaparece el choque con el guardián de consentimiento.
3. **Plan pagado no encierra**: «Paso 4 cumplido» = cualquier suscripción registrada, incluida una pendiente de autorización.
4. **El cruce identificador-de-hijo → aviso ENTRA en A-67**: nadie leía los identificadores del menor — el Paso 3 exigía un dato que no disparaba nada. Mismo mecanismo del círculo, presentación propia, e **interruptor y enfriamiento propios** (`notificacionesHijos`, `ultimaNotificacionHijosEn`): reusar los del círculo hacía que un aviso de contacto silenciara al hijo y que apagar el círculo apagara al hijo.
5. **Reportar sin muro de cobro**: el enlace del menú del padre (`/dashboard/padre/reportar`) chocaba contra la guarda de vigencia. Exento, junto a `/mis-reportes`. El ayudante muerto `esRutaExenta` (nadie lo llamaba y comparaba la ruta equivocada) se eliminó.
6. `/api/session/ping` y el re-sellado, exentos del camino.
7. El sellado fallido al cerrar los pasos 2 y 3 **avisa al padre** (no silencioso), con prueba del camino infeliz.
8. El armazón del camino lleva **dos salidas visibles**: «Salir y seguir después» y «Este no es mi correo» (I-25/I-35 fueron de rutas; este habría sido de pantalla).
9. **Retroactivo**: los padres existentes entran al camino en su próximo ingreso — automático porque el paso se deriva del estado real, y hoy cuesta cero (1 padre en producción, base limpiada el 31-08 por orden de Jelkin).
10. «Suscripción resuelta» definida explícitamente (= cualquier suscripción registrada); si el plan vence estando en el camino, **manda el guardián de vigencia**, no el del camino.

## Assumptions

- **A-1**: El consentimiento existente (`ModalConsentimiento`) **no se rehace**; se integra al camino con su indicador de paso. Así lo ordena el brief §2.2.
- **A-2**: El registro por código de 6 dígitos **no se puede retirar**: el registro de colegio usa el mismo formulario y las mismas rutas (`src/app/registro-colegio/page.tsx`). El enlace es el camino del padre; el código sobrevive para el colegio. Verificado en fuente, no supuesto.
- **A-3**: El portero del camino se apoya en el mecanismo de sesión firmada ya existente, el mismo de consentimiento y vigencia. No se inventa un mecanismo nuevo ni se ponen redirecciones en los layouts (ratchet vigente).
- **A-4**: «Reportar» **se queda en el menú** aunque no se rediseñe en esta fase (decisión CEO, precedente I-38).
- **A-5**: Los correos nuevos se emiten por el motor de notificaciones existente (evento + plantilla sembrada), no como envíos sueltos — es el patrón vigente y hay un ratchet que lo exige.
- **A-6**: La **estructura** de cada pantalla sale del mockup aprobado; el **texto** se reescribe en tuteo neutro conservando el tono. Donde el mockup no diga nada, se consulta antes de inventar.
- **A-7**: Quedan **fuera de alcance** (brief §5): Reportar, Mis reportes, Expedientes y el PDF; el rediseño de Inicio, A quién protejo, Círculo y Suscripción; el puente con el colegio por NIT; y cualquier medición de riesgo o puntaje.
- **A-8**: Las migraciones son aditivas y no destructivas; ningún dato existente se pierde. La única excepción prevista es la separación de fichas de D-4, que **duplica** registros para preservarlos — nunca borra.
- **A-10**: Nada de lo que D-4 deja obsoleto se borra: la tabla puente y el mecanismo de desvinculación quedan inactivos y documentados, reversibles si Jelkin cambia la regla.
- **A-9**: La base de datos de desarrollo de esta máquina está por detrás de `main` y hay que ponerla al día antes de probar; no es un hallazgo del producto.

---

## Implementación (31-08-2026)

**Rama**: `work/pi-SPEC-339-camino-guiado-padre` · 8 commits · todo pusheado.

| Área | Piezas |
|---|---|
| Esquema | 4 migraciones: documento del padre + `TokenRegistro` · dueño del menor (3 guardas que abortan en voz alta) · tuteo de la plantilla SPEC-338 · interruptor/enfriamiento de avisos de hijos |
| Datos sembrados | `padre.hijos.maximo` + mensaje · eventos `auth.registro_enlace`, `auth.bienvenida_padre`, `padre.hijo.reporte` |
| Guardián | `pasoCamino` en la cookie firmada · paso 5 de `middleware.ts` · rebote `/api/sesion/al-dia` (falla-cerrada) · invariante cruzada verificada al arranque |
| Fuente única | `src/lib/camino/pasos.ts` (orden/destinos) · `src/lib/dal/services/camino/estado.ts` (derivación, sin columna de progreso) |
| La puerta | `RegistroEnlaceService` + rutas `solicitar`/`completar` · `/registro` rehecha · `/registro/crear-clave/[token]` · colegio intacto |
| Menores | ficha propia por padre · `actualizarHijo` (corrección) · tope por parámetro · sellados de pasos 2-3 con aviso si fallan |
| El cruce | `notificarHijosSiCorresponde` en el worker · presentación propia · independencia del círculo probada en ambas direcciones |
| Pantallas | `/camino/{datos,hijos,plan,listo}` + Paso 1 = `/consentimiento` rotulado · armazón con dos salidas · `PadreNavMovil` |
| Evidencia | 1837 unit + ~90 integración por módulo · build · arch:check · E2E escrito · ver `cierre.md` |

**Pendiente**: recorrido del CEO en navegador (candado 25) y aceptación de Jelkin.
