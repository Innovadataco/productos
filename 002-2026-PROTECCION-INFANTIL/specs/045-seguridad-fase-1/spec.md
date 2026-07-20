# Feature Specification: Seguridad Fase 1 — Saneamiento de Auth

**Feature Branch**: `[045-seguridad-fase-1]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: PROGRAMA DE SANEAMIENTO — Fase 1: endurecer endpoints de autenticación pública con rate limiting y validación de inputs antes de abordar funcionalidades mayores (borrado seguro, hardening avanzado).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rate limiting en endpoints de recuperación y verificación (Priority: P1)

Un actor malicioso o un script automatizado no debe poder abusar de los endpoints públicos que envían códigos de verificación o enlaces de recuperación. El sistema debe limitar las solicitudes tanto por dirección IP como por identificador (email), devolviendo siempre una respuesta uniforme que no revele si una cuenta existe.

**Why this priority**: Los flujos de verificación por email y recuperación de contraseña son vectores comunes de enumeración de cuentas y de gasto de presupuesto de email. Sin rate limiting explícito, un atacante puede provocar costos, saturación y fuga de información.

**Independent Test**: Desde una misma IP y con un mismo email, realizar más solicitudes de las permitidas y verificar que el sistema retorna `429 Too Many Requests` con cabeceras `Retry-After` y `X-RateLimit-*` sin revelar existencia de la cuenta.

**Acceptance Scenarios**:

1. **Given** una IP anónima que aún no ha solicitado códigos de verificación, **When** envía `POST /api/auth/verificar/solicitar`, **Then** el sistema consume un contador del scope `verificacion_solicitar` y permite la operación si no excede el límite.
2. **Given** una IP anónima que excedió el límite de solicitudes de verificación, **When** intenta solicitar otro código, **Then** el sistema retorna `429` con el mensaje uniforme de límite excedido.
3. **Given** un email específico que excedió su límite de solicitudes de verificación, **When** se solicita un código desde cualquier IP, **Then** el sistema retorna `429` (rate limit por identificador).
4. **Given** una IP anónima que excedió el límite de solicitudes de recuperación, **When** envía `POST /api/auth/recuperar/solicitar`, **Then** el sistema retorna `429` sin revelar si el email está registrado.
5. **Given** un email específico que excedió su límite de solicitudes de recuperación, **When** se solicita una recuperación, **Then** el sistema retorna `429` (rate limit por identificador).
6. **Given** un cliente bloqueado por rate limit, **Then** la respuesta incluye cabeceras `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `Retry-After` conforme al estándar del proyecto.

---

### User Story 2 — Validación Zod en endpoints públicos de autenticación (Priority: P1)

Los endpoints `POST /api/auth/register`, `POST /api/auth/recuperar/solicitar` y `POST /api/auth/recuperar/restablecer` deben validar explícitamente sus payloads con esquemas Zod, rechazando inputs inválidos de forma consistente y evitando que datos malformados lleguen a la base de datos o a la lógica de negocio.

**Why this priority**: La constitución del proyecto (§6.2) establece la migración a Zod como meta. Hoy los endpoints de autenticación pública validan de forma manual y dispersa, lo que genera inconsistencias y riesgo de bypasses. La validación estructurada es prerequisito para cualquier saneamiento posterior de seguridad.

**Independent Test**: Enviar payloads con emails inválidos, contraseñas débiles, tokens malformados, campos faltantes o tipos incorrectos, y verificar que todos los endpoints retornan `400` con el código `VALIDATION_ERROR` sin ejecutar consultas a base de datos.

**Acceptance Scenarios**:

1. **Given** un payload con email vacío o sin `@`, **When** se envía a `POST /api/auth/register`, **Then** el sistema retorna `400` con `VALIDATION_ERROR`.
2. **Given** una contraseña con menos de 8 caracteres, sin letra o sin número, **When** se envía a `POST /api/auth/register`, **Then** el sistema retorna `400` con `VALIDATION_ERROR`.
3. **Given** un payload con email inválido o faltante, **When** se envía a `POST /api/auth/recuperar/solicitar`, **Then** el sistema retorna `400` con `VALIDATION_ERROR`.
4. **Given** un payload con token faltante, vacío o con formato inválido, **When** se envía a `POST /api/auth/recuperar/restablecer`, **Then** el sistema retorna `400` con `VALIDATION_ERROR`.
5. **Given** una contraseña débil en `POST /api/auth/recuperar/restablecer`, **Then** el sistema retorna `400` con `VALIDATION_ERROR`.
6. **Given** un payload válido, **Then** el endpoint continúa con la lógica de negocio existente sin alterar los mensajes de éxito ni las respuestas uniformes.

---

### User Story 3 — Borrado seguro / derecho al olvido (Priority: P1) *(plan-only)*

Un usuario autenticado (o su representante legal en caso de menor) debe poder solicitar el borrado seguro de sus datos personales. El sistema debe garantizar que el borrado cumpla con el derecho al olvido de la Ley 1581 de 2012, pero **no se implementa código en esta fase**. Solo se entrega el plan de diseño para que la fase siguiente lo ejecute.

**Why this priority**: El derecho al olvido es un requisito legal de protección de datos personales en Colombia. Abordarlo antes de escalar reportes y consultas públicas reduce el riesgo regulatorio y técnico. Sin embargo, su implementación requiere impactar múltiples tablas (usuario, reportes, audit logs, códigos, tokens) y debe planificarse cuidadosamente para no romper integridad referencial ni evidencia legal.

**Independent Test** (plan-only): Verificar que el plan de borrado seguro cubra: identificación de datos personales, flujo de solicitud, aprobación, anonimización vs. eliminación física, retención mínima legal, generación de certificado de borrado y pruebas de regresión. No se escriben endpoints ni migraciones.

**Acceptance Scenarios** (plan-only):

1. **Given** el plan de borrado seguro, **Then** identifica todas las tablas que contienen datos personales identificables (PII) del usuario.
2. **Given** el plan de borrado seguro, **Then** define un flujo de dos pasos: solicitud de borrado con verificación de identidad y aprobación por un ADMIN.
3. **Given** el plan de borrado seguro, **Then** distingue entre borrado físico (cuando no hay obligación legal de retención) y anonimización (cuando el reporte debe conservarse por mandato legal).
4. **Given** el plan de borrado seguro, **Then** incluye el registro de auditoría inmutable del evento de borrado.
5. **Given** el plan de borrado seguro, **Then** describe un endpoint `POST /api/auth/borrar-solicitar` y un panel de ADMIN para aprobar y ejecutar el borrado.

---

## Edge Cases

- **Rate limit deshabilitado**: Si `DISABLE_RATE_LIMIT=true`, los endpoints deben continuar operando normalmente sin validar límite.
- **Rate limit falla en BD**: Si la tabla `RateLimit` no responde, `checkRateLimit` falla abierto (`allowed: true`) para no bloquear el servicio; se registra error en logs.
- **IP spoofing**: `X-Forwarded-For` se lee desde el primer valor confiable si existe; si no, se usa `X-Real-Ip` o `unknown`. El límite por IP es una capa adicional, no la única.
- **Enumeración de cuentas**: Tanto el rate limit exitoso como el bloqueo por rate limit deben retornar exactamente el mismo mensaje que el caso de email no registrado, evitando diferencias temporales o de código de estado.
- **Zod y `NaN`**: Los campos numéricos o de fecha no aceptados deben ser rechazados como `VALIDATION_ERROR`.
- **Payloads extraños**: Presencia de campos adicionales en el payload debe ser ignorada (no estricta) o rechazada según el estándar del proyecto; aquí se usa `strict()` para prevenir inyección de campos no esperados.
- **Borrado seguro**: Borrar el usuario que es autor de reportes que aún están en investigación activa debe conservar el reporte (anonimizado) y no permitir la eliminación física si hay obligación legal.
- **Último ADMIN**: El plan de borrado seguro debe impedir que el último ADMIN activo sea borrado, para evitar bloqueo de la plataforma.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE aplicar rate limiting a `POST /api/auth/recuperar/solicitar` usando el scope `recuperar_solicitar` y retornar `429` cuando se exceda el límite, por IP o por email.
- **FR-002**: El sistema DEBE aplicar rate limiting a `POST /api/auth/verificar/solicitar` usando el scope `verificacion_solicitar` y retornar `429` cuando se exceda el límite, por IP o por email.
- **FR-003**: El sistema DEBE retornar respuestas uniformes en los endpoints de recuperación y verificación sin revelar si un email está registrado, incluso cuando el rate limit se activa.
- **FR-004**: El sistema DEBE incluir cabeceras `X-RateLimit-*` y `Retry-After` en las respuestas de rate limit.
- **FR-005**: El endpoint `POST /api/auth/register` DEBE validar el payload con Zod, exigiendo email válido, contraseña con mínimo 8 caracteres, al menos 1 letra y 1 número, rol permitido y `tenantId` opcional válido.
- **FR-006**: El endpoint `POST /api/auth/recuperar/solicitar` DEBE validar el payload con Zod, exigiendo email válido y retornar `400` si el payload es inválido.
- **FR-007**: El endpoint `POST /api/auth/recuperar/restablecer` DEBE validar el payload con Zod, exigiendo token no vacío y contraseña que cumpla las reglas de complejidad.
- **FR-008**: La validación Zod DEBE usar el código de error `VALIDATION_ERROR` y un mensaje legible, sin exponer detalles internos del esquema.
- **FR-009**: El plan de borrado seguro DEBE identificar todas las tablas con PII del usuario (`Usuario`, `Reporte`, `AuditLog`, `CodigoVerificacion`, `TokenRecuperacion`, `Disputa`, etc.).
- **FR-010**: El plan de borrado seguro DEBE definir el flujo de solicitud, aprobación por ADMIN y ejecución con registro de auditoría.
- **FR-011**: El plan de borrado seguro DEBE distinguir entre eliminación física y anonimización, respetando retención legal mínima de 5 años para audit logs y reportes según la constitución.
- **FR-012**: El plan de borrado seguro DEBE incluir endpoint y panel de administración propuesto, pero NO se implementa en esta fase.

### Key Entities

- **RateLimit**: Entidad existente que almacena contadores por scope, identificador y ventana temporal. Usada por `checkRateLimit`.
- **Usuario**: Cuenta de plataforma. Datos personales sensibles al borrado seguro.
- **CodigoVerificacion**: Transitorio, vinculado a email. Límite de 3 activos por hora ya existe; el rate limit es una capa adicional por IP/identificador.
- **TokenRecuperacion**: Transitorio, vinculado a email. Límite de 3 activos por hora ya existe; el rate limit es una capa adicional por IP/identificador.
- **Reporte / AuditLog / Disputa**: Entidades que pueden contener PII del usuario y requieren anonimización o retención según el plan de borrado seguro.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las peticiones a `POST /api/auth/recuperar/solicitar` y `POST /api/auth/verificar/solicitar` que superan el límite configurado retornan `429` con el mensaje uniforme y las cabeceras de rate limit.
- **SC-002**: El 100% de los payloads inválidos en `register`, `recuperar/solicitar` y `recuperar/restablecer` retornan `400` con `VALIDATION_ERROR` antes de tocar Prisma.
- **SC-003**: El tiempo de respuesta de los endpoints protegidos no aumenta más de 50 ms en el percentil 95 por la adición de Zod y rate limit, respecto a la versión anterior.
- **SC-004**: No se introducen nuevos `any` ni se silencian errores de TypeScript con `as any` en el código modificado.
- **SC-005**: El plan de borrado seguro cubre al menos: flujo de solicitud, aprobación, ejecución, auditoría, anonimización, retención legal y UI/UX propuesta.
- **SC-006**: Todos los tests existentes de autenticación continúan pasando y se agregan tests específicos para los nuevos rate limits y esquemas Zod.

---

## Assumptions

- `checkRateLimit` y la tabla `RateLimit` existen y son la fuente de verdad para rate limiting en el proyecto.
- Zod ya está instalado y es la librería estándar de validación elegida por la constitución.
- Los scopes `recuperar_solicitar` y `verificacion_solicitar` no existen aún en `DEFAULTS` de `src/lib/rate-limit.ts` y se agregan en esta fase.
- Los límites por defecto son: 5 solicitudes por ventana de 1 hora para `recuperar_solicitar` y `verificacion_solicitar`, por IP y por email.
- Los endpoints de `verificar/validar` y `verificar/completar` no se incluyen en US2 porque ya cuentan con validación manual explícita; se deja para una fase posterior de estandarización generalizada.
- El plan de borrado seguro no requiere migraciones ni cambios de schema; solo documentación.
- No se modifica la lógica de envío de emails ni los mensajes de éxito existentes.
- No se alteran SPEC-050 ni SPEC-060, conforme a restricciones del PROGRAMA DE SANEAMIENTO.

---

## Implementación (documentado al cierre de la fase)

### Objetivo alcanzado

Endurecer los endpoints de autenticación pública con rate limiting por IP/identificador y validación Zod, y entregar el plan de diseño para el borrado seguro/derecho al olvido sin implementar código de ese flujo.

### Decisiones de diseño derivadas del código

- **Rate limit reutilizado**: se usa `checkRateLimit` existente en `src/lib/rate-limit.ts` con scopes nuevos `recuperar_solicitar` y `verificacion_solicitar`, aplicando una capa por IP y otra por email para mitigar tanto ataques distribuidos como por identificador.
- **Respuesta uniforme**: se mantiene el mensaje `MENSAJE_EXITO` existente en ambos endpoints de solicitud, incluso cuando se bloquea por rate limit, evitando enumeración de cuentas.
- **Zod en endpoints públicos**: se crean esquemas en `src/lib/validators.ts` para `register`, `recuperarSolicitar` y `restablecerPassword`, dejando los esquemas reutilizables y centralizados.
- **Plan de borrado seguro**: se documenta en `specs/045-seguridad-fase-1/plan.md` como fase futura, sin tocar schema ni código.

### Endpoints y componentes afectados

- `src/app/api/auth/recuperar/solicitar/route.ts` — rate limit + Zod.
- `src/app/api/auth/verificar/solicitar/route.ts` — rate limit.
- `src/app/api/auth/register/route.ts` — Zod.
- `src/app/api/auth/recuperar/restablecer/route.ts` — Zod.
- `src/lib/rate-limit.ts` — scopes `recuperar_solicitar` y `verificacion_solicitar`.
- `src/lib/validators.ts` — esquemas `authRegisterSchema`, `recuperarSolicitarSchema`, `restablecerPasswordSchema`.
- `src/lib/validators.test.ts` — tests unitarios para los esquemas.
- `src/app/api/auth/recuperar/solicitar/route.test.ts` — tests de integración para rate limit y Zod.
- `src/app/api/auth/verificar/solicitar/route.test.ts` — tests de integración para rate limit.
- `specs/045-seguridad-fase-1/plan.md` — plan de borrado seguro.

### Migraciones relevantes

Ninguna. Los cambios son aditivos en código y no requieren migraciones de base de datos.

### Tests

- `src/lib/validators.test.ts`
- `src/app/api/auth/recuperar/solicitar/route.test.ts`
- `src/app/api/auth/verificar/solicitar/route.test.ts`
- `npm run test` — suite completa.
- `quickstart.md` — escenarios de validación manual con curl.

### Deuda técnica y próximos pasos

- Los endpoints `verificar/validar` y `verificar/completar` aún usan validación manual; estandarizar a Zod en una fase posterior de saneamiento.
- El plan de borrado seguro requiere ser implementado en un spec dedicado (posible SPEC-052 o similar) con migraciones aditivas y flujo de aprobación.
- Considerar extracción de helper de respuesta uniforme para rate limit a `src/lib/rate-limit.ts` si más endpoints lo requieren.
