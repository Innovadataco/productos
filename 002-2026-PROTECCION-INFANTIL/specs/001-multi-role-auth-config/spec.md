# Feature Specification: Autenticación Multi-Rol y Parámetros de Configuración

**Feature Branch**: `[001-multi-role-auth-config]`

**Created**: 2026-07-11

**Status**: CERRADA

**Input**: User description: "Sistema de reportes comunitarios de protección infantil. Usuarios anónimos y autenticados reportan números telefónicos, nicks o usuarios de redes sociales/juegos/mensajería que consideran de riesgo para menores. Cada reporte incluye: texto descriptivo de la situación, fecha, ciudad, país, plataforma. Los padres consultan si un número/nick tiene reportes registrados, viendo cantidad y distribución por ciudad/país/fecha — nunca etiquetas de culpabilidad. Un identificador solo aparece en consultas públicas al superar un umbral mínimo de reportes independientes, parametrizable por el administrador. Tres tipos de usuario: administrador de plataforma, administrador de colegio (crea perfiles internos con permisos granulares), y padres. Los colegios validan listas de números contra la base. Esta primera fase (fundación) cubre únicamente: autenticación multi-rol, estructura base del proyecto, y el sistema de parámetros de configuración. Reportes, consultas y colegios vienen en fases siguientes."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador de plataforma gestiona parámetros del sistema (Priority: P1)

Un administrador de la plataforma necesita ajustar el umbral mínimo de reportes independientes que un identificador debe acumular para aparecer en consultas públicas. Este parámetro afecta la visibilidad de todos los datos de la plataforma y debe ser editable sin requerir despliegues de código.

**Why this priority**: El umbral de visibilidad es un pilar del producto (principio 1.4 de la constitución). Sin un sistema de configuración funcional, las fases posteriores (reportes, consulta pública) no pueden operar correctamente.

**Independent Test**: El admin puede iniciar sesión, navegar al módulo de configuración, modificar el valor del umbral, guardar los cambios, y verificar que la aplicación reconoce el nuevo valor inmediatamente. Esto se puede probar de forma aislada sin depender de los módulos de reportes o consulta.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol ADMIN, **When** accede al panel de parámetros y modifica el umbral de visibilidad de 3 a 5 reportes, **Then** el sistema persiste el cambio y registra quién lo realizó, cuándo y cuál era el valor anterior.
2. **Given** un usuario con rol SCHOOL_ADMIN o PARENT, **When** intenta acceder al panel de parámetros, **Then** el sistema deniega el acceso y retorna un error de permisos insuficientes.
3. **Given** un parámetro de configuración marcado como sensible, **When** el admin lo consulta, **Then** el sistema muestra el valor descifrado únicamente para usuarios con rol ADMIN.

---

### User Story 2 - Registro e inicio de sesión de usuarios (Priority: P1)

Un nuevo usuario (rol PARENT por defecto) se registra ingresando su correo electrónico. El sistema envía un código de verificación de 6 dígitos al email. El usuario ingresa el código dentro de los 15 minutos de validez y, una vez verificado, asigna su contraseña para completar la activación de la cuenta. Posteriormente puede iniciar sesión. ADMIN y SCHOOL_ADMIN crean usuarios directamente sin este flujo.

**Why this priority**: La autenticación multi-rol es la puerta de entrada a toda la plataforma. Sin ella, no hay forma de controlar quién puede gestionar colegios, quién puede crear reportes autenticados, ni quién puede modificar parámetros críticos.

**Independent Test**: Un usuario puede completar el flujo de registro (solicitar código → verificar código → asignar contraseña), iniciar sesión con credenciales válidas, recibir una sesión activa, y acceder únicamente a las rutas correspondientes a su rol.

**Acceptance Scenarios**:

1. **Given** un usuario nuevo con email no registrado, **When** solicita un código de verificación, **Then** el sistema genera un código de 6 dígitos, lo envía por email y establece una validez de 15 minutos.
2. **Given** un usuario que recibió un código de verificación válido, **When** ingresa el código correcto, **Then** el sistema verifica la coincidencia y permite continuar al paso de asignación de contraseña.
3. **Given** un usuario que ingresa un código incorrecto, **When** intenta verificar, **Then** el sistema rechaza la verificación, incrementa el contador de intentos fallidos del código, y bloquea el código tras 5 intentos fallidos.
4. **Given** un usuario con email verificado, **When** asigna una contraseña válida, **Then** el sistema crea la cuenta con rol PARENT y estado activo.
5. **Given** un usuario registrado con rol PARENT y credenciales válidas, **When** inicia sesión, **Then** el sistema le otorga una sesión activa y permite acceder a funciones de reporte y consulta, pero no a funciones de administración.
6. **Given** un usuario registrado con rol SCHOOL_ADMIN, **When** inicia sesión, **Then** el sistema le permite gestionar usuarios de su colegio asignado, pero no de otros colegios ni parámetros globales.
7. **Given** un usuario con credenciales incorrectas, **When** intenta iniciar sesión, **Then** el sistema rechaza la autenticación, incrementa un contador de intentos fallidos, y bloquea temporalmente la cuenta tras superar el límite configurado.
8. **Given** un usuario autenticado, **When** cierra sesión, **Then** el sistema invalida su sesión activa y requiere nueva autenticación para acceder a rutas protegidas.
9. **Given** un usuario que solicita un código, **When** ya ha solicitado 3 códigos en la última hora, **Then** el sistema rechaza la solicitud con un error de límite excedido.

---

### User Story 3 - Estructura base del proyecto soporta extensión futura (Priority: P2)

La estructura del proyecto debe permitir la adición de módulos futuros (reportes, consulta pública, clasificación IA, disputas) sin requerir refactorizaciones masivas. Los modelos de datos base, las utilidades compartidas, y los patrones de autenticación deben estar establecidos.

**Why this priority**: Aunque no es visible para el usuario final, una estructura base bien definida reduce el riesgo técnico de las fases posteriores. Sin embargo, su valor se manifiesta indirectamente mediante la velocidad de desarrollo de features siguientes.

**Independent Test**: Un desarrollador puede crear un nuevo módulo (por ejemplo, un endpoint de prueba) reutilizando la utilidad de autenticación, el cliente de base de datos, y el modelo de roles sin duplicar código.

**Acceptance Scenarios**:

1. **Given** un desarrollador agregando un nuevo endpoint, **When** reutiliza la utilidad de verificación de autenticación existente, **Then** la verificación de rol funciona correctamente sin modificar el código de autenticación base.
2. **Given** la estructura base del proyecto, **When** se ejecutan las pruebas automatizadas, **Then** todas las pruebas de autenticación, configuración y utilidades compartidas pasan exitosamente.

---

### Edge Cases

- ¿Qué ocurre cuando un ADMIN intenta eliminar su propia cuenta? El sistema debe prevenir la eliminación del último ADMIN activo para evitar bloqueo de la plataforma.
- ¿Cómo maneja el sistema un intento de asignar un rol inexistente a un usuario? Debe rechazar la operación con un error claro.
- ¿Qué sucede si un parámetro de configuración se edita simultáneamente por dos administradores? El sistema debe detectar el conflicto y rechazar la segunda modificación basándose en la versión del registro.
- ¿Cómo responde el sistema si la base de datos de parámetros no tiene el umbral configurado? Debe usar un valor predeterminado conservador (por ejemplo, 3 reportes) y registrar la anomalía.
- ¿Qué pasa si un usuario anónimo intenta acceder a un endpoint que requiere autenticación? El sistema debe rechazar la petición con un código de no autenticado.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir la creación de usuarios con tres roles: ADMIN, SCHOOL_ADMIN, y PARENT. Cada rol tiene permisos diferenciados.
- **FR-002**: El sistema DEBE autenticar usuarios mediante correo electrónico y contraseña, otorgando una sesión activa tras validación exitosa.
- **FR-003**: El sistema DEBE rechazar intentos de autenticación con credenciales inválidas y bloquear temporalmente la cuenta tras un número configurable de intentos fallidos consecutivos.
- **FR-004**: El sistema DEBE cerrar sesión de un usuario, invalidando su sesión activa.
- **FR-005**: El sistema DEBE permitir al rol ADMIN crear, leer, actualizar y eliminar parámetros de configuración del sistema, incluyendo el umbral de visibilidad.
- **FR-006**: El sistema DEBE permitir la lectura de parámetros públicos sin requerir autenticación.
- **FR-007**: El sistema DEBE restringir la modificación de parámetros de configuración únicamente al rol ADMIN.
- **FR-008**: El sistema DEBE persistir un registro de auditoría por cada cambio en los parámetros de configuración, incluyendo quién realizó el cambio, cuándo, el valor anterior y el nuevo valor.
- **FR-009**: El sistema DEBE soportar parámetros de configuración de diferentes tipos (numéricos, texto, booleanos, listas) con validación de tipo en escritura.
- **FR-010**: El sistema DEBE marcar parámetros sensibles (como claves de encriptación o tokens de servicio) como secretos, cifrándolos en reposo.
- **FR-011**: El sistema DEBE validar que los parámetros numéricos cumplan rangos mínimos y máximos (por ejemplo, el umbral de visibilidad debe ser al menos 1).
- **FR-012**: El sistema DEBE permitir al rol SCHOOL_ADMIN gestionar únicamente usuarios de su colegio asignado, sin acceso a usuarios de otros colegios.
- **FR-013**: El sistema DEBE permitir al rol PARENT gestionar únicamente su propio perfil.
- **FR-014**: El sistema DEBE implementar soft delete para usuarios, preservando la integridad de los registros de auditoría asociados.
- **FR-015**: El sistema DEBE permitir a un usuario solicitar un código de verificación de 6 dígitos enviado a su correo electrónico para iniciar el registro.
- **FR-016**: El sistema DEBE validar que el email no esté ya registrado antes de enviar un código de verificación.
- **FR-017**: El sistema DEBE permitir un máximo de 3 solicitudes de código de verificación por email en un período de 1 hora.
- **FR-018**: El sistema DEBE validar un código de verificación dentro de un período de validez de 15 minutos desde su generación, permitiendo un máximo de 5 intentos fallidos antes de invalidar el código.
- **FR-019**: El sistema DEBE permitir a un usuario completar su registro asignando contraseña únicamente después de verificar exitosamente el código de verificación enviado a su email.

### Key Entities

- **Usuario**: Representa una cuenta en la plataforma. Atributos: identificador único, correo electrónico, nombre, hash de contraseña, rol asignado, estado de cuenta (activo, inactivo, bloqueado), contador de intentos fallidos, fecha de bloqueo, fecha de última sesión, metadatos de creación.
- **Rol**: Define un conjunto de permisos. Entidades base: ADMIN, SCHOOL_ADMIN, PARENT. Puede extenderse a roles personalizados en el futuro. Atributos: nombre, descripción, lista de permisos asociados.
- **Parámetro de Configuración**: Clave-valor tipado que controla el comportamiento del sistema. Atributos: clave única, valor serializado, tipo de dato, categoría, flag de público, flag de secreto, reglas de validación, descripción, metadatos de modificación.
- **Registro de Auditoría**: Traza inmutable de acciones sobre el sistema. Atributos: identificador, acción realizada, tipo de recurso afectado, identificador del recurso, usuario que ejecutó la acción, dirección IP, agente de usuario, metadatos contextuales, fecha.
- **CodigoVerificacion**: Entidad transitoria para el flujo de registro. Atributos: identificador único, email destinatario, hash del código (bcrypt), fecha de expiración, contador de intentos fallidos, flag de uso, fecha de creación.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario con rol ADMIN puede modificar el umbral de visibilidad y el cambio se refleja en consultas posteriores en menos de 1 segundo.
- **SC-002**: Un usuario puede completar el flujo de inicio de sesión (ingresar credenciales, ser autenticado, recibir sesión) en menos de 2 segundos en condiciones normales de red.
- **SC-003**: El 100% de los intentos de acceso a funciones restringidas por usuarios sin el rol apropiado son bloqueados y registrados en auditoría.
- **SC-004**: El 100% de los cambios en parámetros de configuración generan un registro de auditoría inmutable con valor anterior, valor nuevo, usuario y timestamp.
- **SC-005**: El sistema soporta al menos 1000 usuarios registrados y 100 sesiones concurrentes sin degradación perceptible en el tiempo de respuesta.
- **SC-006**: Un desarrollador puede agregar un nuevo módulo al proyecto reutilizando el sistema de autenticación y roles sin modificar el código existente de autenticación.

---

## Assumptions

- Los usuarios tienen acceso a correo electrónico para la verificación de cuenta y recuperación de contraseña.
- El envío de emails se realiza mediante un proveedor de capa gratuita (Resend o Brevo) configurado por variable de entorno.
- El despliegue inicial es para un solo entorno (desarrollo local), con despliegue a producción en fases posteriores.
- Los parámetros de configuración críticos (umbral de visibilidad, límites de intentos de login) tienen valores predeterminados conservadores que permiten operar la plataforma sin configuración manual previa.
- La autenticación social (Google, Microsoft, Apple) está explícitamente fuera del alcance de esta fase.
- Los colegios y el modelo multi-tenant se establecen en esta fase con la tabla base `Tenant` vacía, pero la lógica de aislamiento por colegio se activa en la fase de colegios.
- Los textos de reporte no se procesan en esta fase; la encriptación de reportes y el worker de pg-boss se implementan junto con el módulo de reportes.
- La validación de contraseñas exige un mínimo de 8 caracteres con al menos una letra y un número. No se requieren símbolos obligatorios.
- Los roles base (ADMIN, SCHOOL_ADMIN, PARENT) se crean automáticamente al inicializar la base de datos y no pueden eliminarse.

---

## Implementación (documentado retroactivamente el 2026-07-18)

### Objetivo alcanzado
Entregar la base de autenticación, autorización por rol y configuración parametrizada que soporta todos los módulos posteriores.

### Decisiones de diseño derivadas del código
- **Sesión con cookie httpOnly**: se usa JWT firmado almacenado en cookie (`src/lib/auth.ts`), nunca en `localStorage`.
- **Roles centralizados**: enum `Rol` con `ADMIN`, `SCHOOL_ADMIN`, `PARENT`; el middleware/proxy verifica el rol en cada ruta protegida.
- **Parámetros en `ParametroSistema`**: clave-valor tipado, caché en `src/lib/config-cache.ts`, valores sensibles cifrados en reposo.
- **Seed por defecto**: `prisma/seed.ts` crea los roles, un admin inicial y los parámetros mínimos de operación.

### Endpoints y componentes afectados
- `/api/auth/*` (login, logout, registro, verificación, recuperación).
- `/api/config/parametros`, `/api/config/parametros/[clave]`, `/api/config/parametros/publicos`.
- Páginas `/login`, `/registro`, `/recuperar`, `/dashboard/configuracion`.
- Utilidades `src/lib/auth.ts`, `src/lib/config-cache.ts`, `src/lib/rate-limit.ts`.

### Tests
- `src/lib/auth.test.ts`
- `src/app/api/config/parametros/route.test.ts`
- `src/app/api/config/parametros/[clave]/route.test.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/password-reset.spec.ts`

### Migraciones relevantes
- `20260712162345_init`
- `20260713061032_reportes_fase2`