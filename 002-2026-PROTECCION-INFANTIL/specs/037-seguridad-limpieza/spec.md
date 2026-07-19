# Feature Specification: Fixes de seguridad y limpieza

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-19

**Status**: CERRADA

**Input**: Contexto de hardening: reforzar rate limiting en endpoints administrativos y sanitizar mensajes de error crudos que se persisten en metadatos de transiciones.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rate limiting faltante en endpoints admin (Priority: P1)

El sistema ya cuenta con un limitador centralizado (`src/lib/rate-limit.ts`) y varios endpoints administrativos lo usan. Sin embargo, algunos endpoints de administración aún no invocan `checkRateLimit`, lo que permite que un usuario autenticado con privilegios admin dispare un volumen ilimitado de peticiones contra operadores, comité de validación y reportes en revisión.

**Why this priority**: Los endpoints admin manipulan usuarios, contraseñas, asignaciones y reportes. Sin rate limiting, un ataque de fuerza bruta o un script con credenciales robadas puede saturar la base de datos, exfiltrar datos o modificar masivamente el estado del sistema.

**Independent Test**: Un usuario ADMIN puede realizar peticiones GET/POST/PATCH/DELETE a endpoints admin protegidos y recibir encabezados `X-RateLimit-*`. Tras superar el límite correspondiente, la respuesta es `429` con `Retry-After` y no se ejecuta la lógica de negocio.

**Acceptance Scenarios**:

1. **Given** un endpoint admin existente que no invocaba `checkRateLimit`, **When** se agrega la llamada al inicio del handler y se excede el límite de escritura, **Then** el endpoint retorna `429` y no ejecuta queries de negocio.
2. **Given** un endpoint admin de lectura (GET), **When** se alcanza el límite de lectura, **Then** el endpoint retorna `429` con scope `admin_read`.
3. **Given** un endpoint admin de mutación (POST/PUT/PATCH/DELETE), **When** se alcanza el límite de escritura, **Then** el endpoint retorna `429` con scope `admin_write`.
4. **Given** un endpoint admin con `verifyAuth`, **When** se agrega `checkRateLimit`, **Then** la verificación de autenticación y autorización previa se mantiene sin cambios.
5. **Given** un endpoint admin con múltiples métodos (GET y POST), **When** se aplica rate limiting, **Then** cada método usa el scope correspondiente (`admin_read` vs `admin_write`).

---

### User Story 2 - errMsg crudo en transiciones de procesamiento de reportes (Priority: P1)

El worker de procesamiento (`src/app/api/reportes/procesar/route.ts`) persiste el mensaje de error exacto (`error.message`) tanto en el campo `motivo` como en los metadatos de la transición de reporte cuando falla el procesamiento. Esto puede filtrar detalles de implementación, rutas internas o mensajes de terceros a quienes consulten el histórico del reporte.

**Why this priority**: Los metadatos de transición son una traza de auditoría consultada por operadores y admins. Filtrar errores crudos viola el principio de mínimo privilegio de información y dificulta la clasificación de fallas.

**Independent Test**: Forzar un error en el procesamiento de un reporte y verificar que el registro de transición guarda un mensaje genérico y un código de error, no el texto original del error.

**Acceptance Scenarios**:

1. **Given** un error no transitorio durante el procesamiento de un reporte, **When** el worker registra la transición de fallback a `REVISION_MANUAL`, **Then** el campo `motivo` contiene un texto genérico y el campo `metadatos` contiene un código de error, sin el mensaje crudo.
2. **Given** un error con propiedad `code` (por ejemplo, un error de Prisma o validación), **When** se registra la transición, **Then** el código se usa como identificador de error si está disponible.
3. **Given** un error sin código específico, **When** se registra la transición, **Then** el código almacenado es `INTERNAL_ERROR`.

---

## Edge Cases

- ¿Qué ocurre si `checkRateLimit` falla internamente (por ejemplo, conexión a BD)? El helper ya falla abierto (`allowed: true`) y loguea el error; por tanto, no se bloquea el endpoint por un problema del limitador.
- ¿Qué pasa si el límite es excedido en medio de un flujo de varias peticiones? La respuesta es `429` con `Retry-After` calculado desde el inicio de la ventana.
- ¿Cómo se comporta un endpoint con `verifyAuth` si se agrega `checkRateLimit`? El orden de verificación se mantiene: primero autenticación, luego rate limit, luego lógica de negocio.
- ¿Y si el error de procesamiento contiene datos sensibles? Al no persistirse el mensaje crudo, se evita que PII o detalles de sistema queden en la traza de auditoría.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE aplicar `checkRateLimit` al inicio de cada handler de endpoints admin que aún no lo tenga.
- **FR-002**: El scope DEBE ser `admin_read` para métodos HTTP de lectura (GET) y `admin_write` para métodos de mutación (POST, PUT, PATCH, DELETE).
- **FR-003**: La verificación `verifyAuth` DEBE permanecer sin cambios; `checkRateLimit` DEBE ir después de ella y usar el identificador del usuario autenticado.
- **FR-004**: El sistema DEBE retornar una respuesta `429` con `Retry-After` y encabezados `X-RateLimit-*` cuando se exceda el límite.
- **FR-005**: El sistema NO DEBE persistir el mensaje de error crudo (`error.message`) en el campo `motivo` ni en los metadatos de la transición de fallback del worker de procesamiento.
- **FR-006**: El sistema DEBE usar un mensaje genérico de error más un código de error en las metadatos de la transición.

### Key Entities

- **RateLimit**: Tabla de ventanas fijas de límite de requests (`src/lib/rate-limit.ts`).
- **Transición de Reporte**: Registro de cambio de estado de un reporte, incluye `motivo` y `metadatos`.
- **Usuario admin**: Usuario autenticado con rol `ADMIN` o `SCHOOL_ADMIN` que consume los endpoints afectados.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los endpoints admin identificados sin `checkRateLimit` ahora lo invocan con el scope correcto.
- **SC-002**: Al menos un test de integración o verificación manual demuestra respuesta `429` tras exceder el límite de admin_write.
- **SC-003**: Las trazas de transición de fallback de procesamiento no contienen textos de error crudos; contienen mensaje genérico + código.
- **SC-004**: `npm run test`, `npx tsc --noEmit` y `npm run lint` pasan sin errores nuevos.
- **SC-005**: El deploy con `./scripts/dev-restart.sh` finaliza con healthcheck exitoso.

---

## Assumptions

- No se modifican migraciones, seed, middleware, worker ni lógica central de negocio de specs anteriores (035, 036).
- Los cambios son aditivos: solo se agrega la llamada a `checkRateLimit` y se reemplaza el mensaje de error por uno genérico.
- No se agregan nuevas dependencias ni se reconfigura infraestructura.
- El limitador existente (`admin_read` y `admin_write`) tiene ventanas y límites configurables por parámetro de sistema; si no existen, se usan los valores por defecto del helper.
- El worker de procesamiento continúa clasificando correctamente; este spec solo cambia el mensaje de error almacenado en transición.

---

## Implementación (documentado al cierre)

### Objetivo alcanzado

Aplicar rate limiting a los endpoints administrativos que aún no lo tenían y eliminar el mensaje de error crudo de las transiciones de fallback del worker de procesamiento de reportes.

### Endpoints y componentes afectados

- `src/app/api/admin/operadores/route.ts` (GET → `admin_read`, POST → `admin_write`)
- `src/app/api/admin/operadores/[id]/route.ts` (PATCH/DELETE → `admin_write`)
- `src/app/api/admin/operadores/[id]/regenerar-password/route.ts` (POST → `admin_write`)
- `src/app/api/admin/operadores/[id]/reenviar-email/route.ts` (POST → `admin_write`)
- `src/app/api/admin/operadores/[id]/reactivar/route.ts` (POST → `admin_write`)
- `src/app/api/admin/comite/integrantes/route.ts` (GET → `admin_read`, POST → `admin_write`)
- `src/app/api/admin/comite/integrantes/[id]/route.ts` (PATCH/DELETE → `admin_write`)
- `src/app/api/admin/reportes-revision/[id]/reasignar/route.ts` (POST → `admin_write`)
- `src/app/api/reportes/procesar/route.ts` (mensaje de transición genérico + `errorCode`)

### Decisiones de diseño

- Se mantuvo `verifyAuth` exactamente como estaba; `checkRateLimit` se agregó inmediatamente después, usando el `id` del usuario autenticado como identificador.
- Se usó `admin_read` para GET y `admin_write` para cualquier mutación (POST, PATCH, DELETE).
- Se siguió el patrón de respuesta `429` con `RATE_LIMITED` y headers `X-RateLimit-*` ya usado en otros endpoints admin.
- En el worker de procesamiento se reemplazó `motivo: `Error de procesamiento: ${errMsg}`` y `metadatos: { error: errMsg }` por un mensaje genérico y un `errorCode` extraído del error si existe, o `INTERNAL_ERROR` por defecto.

### Tests

- `npx tsc --noEmit`: OK
- `npm run lint`: OK (0 errores, 1 warning preexistente en `src/app/dashboard/admin/comite/gestion/page.tsx`)
- `npm run test`: 78 files, 412 tests passed

### Migraciones

No se agregaron ni modificaron migraciones ni seed. La tabla `RateLimit` ya existía y es utilizada por otros endpoints.

### Deuda técnica

- El campo `Reporte.processingError` aún almacena el mensaje de error crudo (`errMsg`). Este spec se limitó a los metadatos de la transición. Si el negocio decide que tampoco debe persistirse en el reporte, se requiere un spec aparte para evaluar impacto en UI y alertas.
- No se agregaron tests específicos que verifiquen la respuesta `429` en los endpoints admin afectados; el patrón está cubierto por `src/lib/rate-limit.test.ts` y por endpoints similares ya existentes.
