# Feature Specification: Autenticación real (roles 1/2/3) y reporte de un despacho con doble token

**Feature Branch**: `[001-auth-despacho-doble-token]`

**Created**: 2026-07-21

**Status**: IMPLEMENTADO (pendiente de prueba en vivo y de verificación humana antes de consumir APIs productivas) — ver `cierre.md`

**Input**: User description: "Rediseño de Gesmovil/SICOV para la Operación de Transporte de Pasajeros por Carreteras (OTPC). Primera feature P1 = el núcleo de integración: (a) autenticación real por usuario/contraseña con roles numéricos 1=Administrador, 2=Cliente/empresa vigilada, 3=Operador/subusuario (roles verificados en el legacy; el rol 9 del HANDOFF no existe en el código real y se descartó por decisión del responsable), corrigiendo el login demo que tenía pestaña 'Vigía'; el login único devuelve dos tokens (JWT interno + tokenExterno de la integradora), y el subusuario rol 3 hereda el token autorizado y el NIT de su administrador. (b) Registro y reporte de un despacho (salida) a la Superintendencia de Transporte usando el esquema de doble token: tres cabeceras Authorization: Bearer <tokenExterno> (proveedor Gesmovil, cacheado con auto-refresh), token: <tokenAutorizado> (del vigilado), documento: <nitVigilado>; con la solicitud persistida en una cola y procesada por un worker independiente. La integración externa se resuelve tras una interfaz con stubs hasta tener credenciales reales."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login único usuario/contraseña con roles diferenciados (Priority: P1)

Un usuario del sistema (administrador, empresa vigilada u operador subusuario) inicia sesión con **un único formulario de usuario y contraseña**. Tras validar credenciales, el sistema le otorga una sesión activa y le habilita únicamente los módulos correspondientes a su rol. No existe una pestaña ni un flujo alterno de ingreso "por token de vigía": el segundo token que maneja el sistema es el `tokenExterno` de la integradora, obtenido internamente, no un método de login del usuario.

**Why this priority**: La autenticación es la puerta de entrada a toda la plataforma y la base del reporte a Supertransporte (define quién es el vigilado, su NIT y su token autorizado). Corrige además una desviación conocida del demo (login "Vigía") que debe quedar resuelta antes de construir cualquier módulo encima.

**Independent Test**: Un usuario puede iniciar sesión con credenciales válidas, recibir una sesión activa, y comprobar que solo ve/accede a los módulos de su rol; con credenciales inválidas es rechazado; el flujo no expone ninguna opción de login por token.

**Acceptance Scenarios**:

1. **Given** un usuario con `usn_estado` activo y credenciales válidas, **When** envía usuario y contraseña, **Then** el sistema valida la contraseña contra el hash bcrypt (`usn_clave`), crea una sesión (JWT interno en cookie httpOnly) y responde con el rol y los módulos habilitados.
2. **Given** un usuario con `usn_clave_temporal = true`, **When** inicia sesión por primera vez, **Then** el sistema fuerza el cambio de contraseña antes de permitir el acceso a cualquier módulo.
3. **Given** un usuario con credenciales inválidas, **When** intenta iniciar sesión, **Then** el sistema rechaza la autenticación, registra el intento fallido y **no enmascara errores 5xx del backend** como si fueran credenciales inválidas (corrige bug del demo).
4. **Given** un usuario rol 3 (operador/subusuario), **When** inicia sesión, **Then** el sistema resuelve su empresa vigilada a través de `usn_administrador` y **hereda** el `usn_token_autorizado` y el NIT del administrador para las operaciones de integración.
5. **Given** una sesión expirada o inválida (401), **When** el usuario consulta un recurso protegido, **Then** el sistema fuerza re-login y **no muestra datos demo** ante el 401 (corrige bug del demo `useRecurso`).
6. **Given** un usuario autenticado, **When** cierra sesión, **Then** el sistema invalida su sesión y exige nueva autenticación para rutas protegidas.
7. **Given** un usuario con rol X, **When** intenta acceder a un módulo no habilitado para su rol, **Then** el sistema deniega el acceso con error de permisos (403).

---

### User Story 2 - Reporte de un despacho a Supertransporte con doble token (Priority: P1)

Una empresa vigilada (o su operador rol 3) registra la **salida (despacho)** de un vehículo. El sistema encola la solicitud y un **worker independiente** la reporta a la Superintendencia de Transporte usando las **tres cabeceras** del esquema de doble token. La respuesta externa (o el error) se persiste y queda visible en el log de la cola.

**Why this priority**: El reporte con doble token es el corazón de la interoperación regulatoria y el diferenciador del sistema. Ejercita end-to-end la autenticación (token del vigilado + NIT), el token de proveedor cacheado, la cola y el worker — todo el andamiaje del que dependen despachos, llegadas y mantenimientos.

**Independent Test**: Con un vigilado autenticado y credenciales de proveedor (reales o stub), se registra un despacho; el worker envía el POST con las tres cabeceras correctas; la solicitud pasa de pendiente a procesada y guarda `id_despacho_externo` y la respuesta; un fallo controlado deja la solicitud en error reintentable con el contador correcto.

**Acceptance Scenarios**:

1. **Given** un vigilado autenticado con contrato vigente, **When** registra un despacho, **Then** el sistema persiste la solicitud en `tbl_despachos_solicitudes` con `des_sol_procesado = false`, `des_sol_nit_vigilado`, `des_sol_usuario_id`, `des_sol_fuente = WEB` y el payload JSON.
2. **Given** una solicitud encolada, **When** el worker independiente la toma, **Then** arma las tres cabeceras: `Authorization: Bearer <tokenExterno>` (proveedor), `token: <tokenAutorizado>` (vigilado), `documento: <nitVigilado>`, y hace **un solo POST** al endpoint de despachos.
3. **Given** el token de proveedor cacheado está vigente, **When** el worker reporta, **Then** reutiliza el token cacheado sin re-autenticarse; **si está vencido**, lo refresca (auto-refresh) antes de enviar.
4. **Given** un usuario rol 3, **When** su despacho se reporta, **Then** el sistema usa el `usn_token_autorizado` y el NIT **heredados del administrador**, no valores propios del subusuario.
5. **Given** un vigilado con contrato **fuera de vigencia** (`tpv_fecha_inicial`/`tpv_fecha_final`), **When** intenta reportar, **Then** el sistema **rechaza** la operación por validación de proveedor (token + NIT + contrato vigente).
6. **Given** un reporte externo exitoso, **When** el worker recibe la respuesta, **Then** persiste `des_sol_id_despacho_externo` y `des_sol_respuesta_externa`, marca `des_sol_procesado = true` y lo refleja en el log de cola.
7. **Given** un reporte externo fallido, **When** el worker recibe un error, **Then** persiste `des_sol_error_externo`, deja la solicitud como reintentable y **resetea/gestiona el contador de reintentos correctamente** (corrige bug del demo: no debe quedar atascado).
8. **Given** una solicitud en error visible en el log de cola, **When** el usuario pulsa "Reintentar", **Then** el botón tiene handler funcional y re-encola la solicitud (corrige bug del demo: botón sin handler).
9. **Given** la respuesta externa con forma variable (`array_data | data | obj`, claves snake/camel), **When** el sistema la procesa, **Then** la normaliza de forma tolerante sin romper.

---

### User Story 3 - Base del proyecto e infraestructura aislada del 003 (Priority: P2)

La estructura del proyecto (Next.js 16 + Prisma + PostgreSQL, esquema `sicov`) y su infraestructura Docker propia quedan establecidas y aisladas de 001/002, de modo que las features siguientes (llegadas, mantenimientos, novedades) se construyan reutilizando auth, cliente de integración y cola sin refactor masivo.

**Why this priority**: Sin valor visible directo, pero reduce el riesgo técnico de todas las fases siguientes y materializa el principio de aislamiento (constitución §1.1). Corrige además el `docker-compose.yml` del scaffold, que hoy colisiona con el puerto de 001.

**Independent Test**: `docker compose up` levanta el contenedor `003-2026-sicov-otpc-db-1` en el puerto 5434 con su volumen y `mem_limit`, sin tocar 001/002; la app arranca en 5010; un desarrollador agrega un endpoint reutilizando la utilidad de auth y el cliente de integración sin duplicar código.

**Acceptance Scenarios**:

1. **Given** el `docker-compose.yml` corregido, **When** se levanta la BD, **Then** usa nombre/volumen con prefijo `003-`, puerto **5434→5432**, `mem_limit` declarado, y **no interfiere** con los contenedores/puertos de 001/002.
2. **Given** el esquema Prisma sobre PostgreSQL, **When** se aplican migraciones, **Then** son **aditivas y no destructivas** (nunca `migrate reset`) y modelan el esquema `sicov`.
3. **Given** la estructura base, **When** se ejecutan las pruebas, **Then** pasan las de auth, cola/worker y cliente de integración con stubs.

---

### Edge Cases

- ¿Qué ocurre si un subusuario (rol 3) no tiene administrador (`usn_administrador`) asociado o el administrador no tiene `usn_token_autorizado`? El sistema debe rechazar el reporte con un error claro, no enviar cabeceras vacías.
- ¿Qué pasa si el `EXTERNAL_APP_USER`/`EXTERNAL_APP_PASSWORD` del proveedor son inválidos o la Super devuelve 401 al pedir el token externo? El worker debe marcar error de integración (no de credenciales del vigilado) y no dejar la solicitud atascada.
- ¿Qué sucede si dos ejecuciones del worker toman la misma solicitud? Debe existir un mecanismo que garantice **un solo procesamiento** por solicitud (locking/estado atómico).
- ¿Cómo responde el sistema si el reporte externo agota los reintentos? Debe quedar en un estado terminal de error, visible y reintentable manualmente, sin bloquear la cola.
- ¿Qué ocurre si el usuario intenta iniciar sesión mientras `usn_estado` está inactivo/bloqueado? El sistema deniega el acceso con mensaje diferenciado.
- ¿Qué pasa si el payload del despacho está incompleto o mal formado? Se rechaza en la API (400) antes de encolar.
- ¿Cómo se maneja la zona horaria de las fechas del despacho? Todas en `America/Bogota`.

---

## Requirements *(mandatory)*

### Functional Requirements

**Autenticación y roles**
- **FR-001**: El sistema DEBE autenticar mediante **un único formulario** de usuario (`usn_usuario`) y contraseña, validando contra el hash bcrypt `usn_clave`. NO DEBE existir un flujo de login por "token de vigía".
- **FR-002**: El sistema DEBE emitir, tras login exitoso, una sesión interna (JWT en cookie httpOnly) y disponer internamente del `tokenExterno` de la integradora; el `tokenExterno` no es un método de ingreso del usuario.
- **FR-003**: El sistema DEBE soportar los roles numéricos **1** (Administrador), **2** (Cliente/empresa vigilada) y **3** (Operador/subusuario), habilitando módulos según el rol. (El rol 9 del HANDOFF no existe en el legacy y queda fuera de alcance por decisión del responsable.)
- **FR-004**: El sistema DEBE forzar el cambio de contraseña cuando `usn_clave_temporal` sea verdadero, antes de dar acceso a módulos.
- **FR-005**: El sistema DEBE resolver, para un usuario rol 3, su empresa vigilada vía `usn_administrador` y **heredar** `usn_token_autorizado` y NIT del administrador.
- **FR-006**: El sistema DEBE denegar (403) el acceso a módulos no habilitados para el rol del usuario, y registrar el intento.
- **FR-007**: El sistema DEBE rechazar credenciales inválidas y **no enmascarar errores 5xx** del backend como fallo de credenciales.
- **FR-008**: El sistema DEBE invalidar la sesión al cerrar sesión y exigir re-autenticación para rutas protegidas.
- **FR-009**: Ante una respuesta 401 (sesión expirada), el sistema **NO DEBE** mostrar datos demo; DEBE forzar re-login.

**Doble token e integración**
- **FR-010**: El sistema DEBE enviar en cada petición transaccional a la Super las tres cabeceras: `Authorization: Bearer <tokenExterno>`, `token: <tokenAutorizado>`, `documento: <nitVigilado>`.
- **FR-011**: El sistema DEBE obtener el token de proveedor autenticándose con `EXTERNAL_APP_USER` + `EXTERNAL_APP_PASSWORD`, **cachearlo con vigencia** y **refrescarlo automáticamente** al vencer, sin pedir uno por request si el vigente sirve.
- **FR-012**: El sistema DEBE validar, antes de reportar, **token + NIT + contrato vigente** del proveedor vigilado (`tpv_token`, `tpv_documento`, `tpv_fecha_inicial`/`tpv_fecha_final`), rechazando operaciones fuera de vigencia.
- **FR-013**: El sistema DEBE resolver la integración externa **tras una interfaz con stubs** mientras no haya credenciales reales, respetando el mismo contrato de cabeceras.
- **FR-014**: El sistema DEBE **normalizar de forma tolerante** las respuestas externas (`array_data | data | obj`; claves snake_case/camelCase).
- **FR-015**: El sistema DEBE registrar todas las fechas en zona `America/Bogota`.

**Despacho y cola**
- **FR-016**: El sistema DEBE permitir registrar un despacho con **un solo POST** desde la API, persistiendo la solicitud en `tbl_despachos_solicitudes` (`des_sol_payload`, `des_sol_nit_vigilado`, `des_sol_usuario_id`, `des_sol_fuente`, `des_sol_procesado = false`).
- **FR-017**: El sistema DEBE procesar la cola mediante un **worker independiente** (proceso separado del server web), no con `setInterval` en proceso.
- **FR-018**: El worker DEBE persistir el resultado: `des_sol_id_despacho_externo` y `des_sol_respuesta_externa` en éxito, `des_sol_error_externo` en fallo, y marcar `des_sol_procesado`.
- **FR-019**: El sistema DEBE reintentar solicitudes fallidas con **gestión correcta del contador de reintentos** (no dejar solicitudes atascadas) y ofrecer **reintento manual con handler funcional** desde el log de cola.
- **FR-020**: El sistema DEBE garantizar **un solo procesamiento** por solicitud aun con concurrencia de workers (estado/lock atómico).
- **FR-021**: El sistema DEBE validar el payload del despacho (400) antes de encolar, rechazando payloads incompletos o mal formados.

**Infraestructura (US3)**
- **FR-022**: El sistema DEBE correr con infraestructura Docker propia con prefijo `003-` (contenedor `003-2026-sicov-otpc-db-1`, puerto 5434→5432, volumen propio, `mem_limit`), **sin tocar** 001/002.
- **FR-023**: Las migraciones DEBEN ser **aditivas y no destructivas** (prohibido `prisma migrate reset`), sobre el esquema `sicov`.
- **FR-024**: Los secretos (credenciales de Supertransporte, `DATABASE_URL`) DEBEN provenir de `.env` local; el repositorio solo contiene `.env.example` sin valores reales.

### Key Entities

- **Usuario** (`tbl_usuarios`): cuenta del sistema. Atributos: `usn_id`, `usn_nombre`, `usn_identificacion` (unique), `usn_usuario` (unique), `usn_clave` (bcrypt), `usn_clave_temporal`, `usn_telefono`, `usn_correo`, `usn_token_autorizado` (token del vigilado), `usn_rol_id` (1/2/3), `usn_administrador` (identificación del administrador del subusuario; join lógico a `usn_identificacion`), `usn_estado`.
- **Proveedor vigilado** (`tbl_proveedores_vigilados`): empresa de transporte supervisada y su vigencia contractual. Atributos: `tpv_id`, `tpv_empresa`, `tpv_vigilado`, `tpv_token` (uuid), `tpv_fecha_inicial`/`tpv_fecha_final` (vigencia), `tpv_documento` (NIT), `tpv_ruta`, `tpv_estado`.
- **Solicitud de despacho** (`tbl_despachos_solicitudes`): elemento de la cola de reporte. Atributos: `des_sol_id`, `des_sol_payload` (JSON), `des_sol_nit_vigilado`, `des_sol_usuario_id`, `des_sol_fuente` (WEB…), `des_sol_procesado` (bool), `des_sol_id_despacho_externo`, `des_sol_respuesta_externa` (JSON), `des_sol_error_externo`, y contador de reintentos.
- **Token de proveedor** (cacheado en memoria/almacén): token externo de Gesmovil con vigencia y auto-refresh; no es una entidad persistente de negocio pero DEBE tener un ciclo de vida explícito.
- **Rol**: catálogo numérico (1/2/3) que determina módulos habilitados.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario válido completa el login (credenciales → sesión → módulos según rol) en menos de 2 segundos en condiciones normales.
- **SC-002**: El 100% de los intentos de acceso a módulos no habilitados por rol son bloqueados (403) y registrados.
- **SC-003**: El 100% de los despachos reportados salen con las **tres cabeceras** correctas; ninguna petición transaccional a la Super sale con menos de tres.
- **SC-004**: El token de proveedor se reutiliza mientras esté vigente; el número de solicitudes de token externo por N despachos consecutivos con token vigente es **1**, no N.
- **SC-005**: Una solicitud de despacho que falla queda en estado de error reintentable con contador correcto, y el reintento manual funciona en el 100% de los casos (sin solicitudes atascadas).
- **SC-006**: `docker compose up` del 003 no altera ningún contenedor, volumen ni puerto de 001/002 (verificable antes/después).
- **SC-007**: Ninguna sesión expirada (401) muestra datos demo; el 100% fuerza re-login.

---

## Assumptions

- El stack es **Next.js 16 + Prisma + PostgreSQL** (decisión confirmada 2026-07-21); el scaffold demo (React+Vite/NestJS/SQLite) se reemplaza y su lógica de dominio se reaprovecha.
- Mientras no haya credenciales reales de Supertransporte, la integración se prueba **contra stubs** que respetan el contrato de las tres cabeceras; el paso a endpoints reales no cambia el contrato interno.
- El mecanismo de cola/worker se implementa con un proceso Node independiente (BullMQ+Redis o `pg-boss`); la elección concreta se decide en `plan.md`/`research.md`.
- Los usuarios y proveedores vigilados de prueba se cargan con **datos demo** (no dump real), respetando el esquema `sicov`.
- La política de contraseñas y los umbrales de bloqueo por intentos fallidos siguen el estándar de la fábrica (mín. 8 caracteres, letra + número) salvo indicación distinta. **[NEEDS CLARIFICATION: política/umbral de bloqueo exactos del sistema real]**
- El alcance de esta P1 cubre **el reporte de un despacho (salida)**; llegadas, mantenimientos, novedades y consulta integradora completa quedan para fases siguientes.

---

## Preguntas abiertas para `/speckit.clarify` (no asumidas)

- **[NEEDS CLARIFICATION]** Contrato exacto (payload y campos obligatorios) del endpoint externo de despachos (`URL_DESPACHOS/despachosempresa`) y forma de la respuesta de éxito/error.
- **[NEEDS CLARIFICATION]** URLs base y nombres exactos de variables de entorno de Supertransporte (`URL_DESPACHOS`, `URL_INTEGRADORA`, `TOKEN`, `TOKEN_PARAMETRICO`, endpoint de autenticación del proveedor).
- **[NEEDS CLARIFICATION]** Mecanismo de cola/worker preferido para la fábrica (BullMQ+Redis vs `pg-boss`) — Redis añade un servicio al compose del 003.
- **[NEEDS CLARIFICATION]** Política de contraseñas y umbral/duración de bloqueo por intentos fallidos del sistema real.
- ~~Alcance del rol 9~~ **RESUELTO (opción A):** el rol 9 no existe en el legacy; el 003 implementa solo 1/2/3.
- **[NEEDS CLARIFICATION]** ¿Se migra algún dato existente o se parte de seed demo limpio?
