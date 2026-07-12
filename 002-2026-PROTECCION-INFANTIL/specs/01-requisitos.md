# 01 — Requisitos

## 1.1 Requisitos Funcionales

### RF-AUT — Autenticación y Gestión de Identidad

| ID | Descripción | Prioridad | Fase |
|----|-------------|-----------|------|
| REQ-AUT-001 | El sistema DEBE permitir registro de cuentas con correo electrónico y contraseña segura. | Alta | 1 |
| REQ-AUT-002 | El sistema DEBE enviar correo de verificación antes de activar una cuenta. | Alta | 1 |
| REQ-AUT-003 | El sistema DEBE permitir inicio de sesión con correo y contraseña. | Alta | 1 |
| REQ-AUT-004 | El sistema DEBE implementar autenticación de doble factor (2FA/TOTP) opcional para todos los roles. | Alta | 1 |
| REQ-AUT-005 | El sistema DEBE soportar inicio de sesión social (Google, Apple) para el rol Padre. | Media | 1 |
| REQ-AUT-006 | El sistema DEBE gestionar tokens de acceso (JWT) con expiración corta (15 min) y tokens de refresco con expiración larga (7 días). | Alta | 1 |
| REQ-AUT-007 | El sistema DEBE permitir cierre de sesión en todos los dispositivos (revocación global de refresh tokens). | Alta | 1 |
| REQ-AUT-008 | El sistema DEBE permitir recuperación de contraseña vía correo electrónico con enlace de un solo uso. | Alta | 1 |
| REQ-AUT-009 | El sistema DEBE bloquear temporalmente una cuenta tras 5 intentos fallidos de inicio de sesión consecutivos. | Alta | 1 |
| REQ-AUT-010 | El sistema DEBE registrar cada evento de autenticación en el log de auditoría. | Alta | 1 |

### RF-ROL — Gestión de Roles y Permisos

| ID | Descripción | Prioridad | Fase |
|----|-------------|-----------|------|
| REQ-ROL-001 | El sistema DEBE definir tres roles base: `PLATFORM_ADMIN`, `SCHOOL_ADMIN`, `PARENT`. | Alta | 1 |
| REQ-ROL-002 | El sistema DEBE permitir al `PLATFORM_ADMIN` crear, modificar y eliminar roles personalizados con permisos granulares. | Media | 1 |
| REQ-ROL-003 | El sistema DEBE soportar permisos a nivel de acción (ej. `user:read`, `config:write`, `report:delete`). | Alta | 1 |
| REQ-ROL-004 | El sistema DEBE permitir asignar múltiples roles a un mismo usuario, con resolución de permisos por unión (OR lógico). | Media | 1 |
| REQ-ROL-005 | El sistema DEBE restringir el acceso a endpoints según los permisos efectivos del usuario autenticado. | Alta | 1 |
| REQ-ROL-006 | El sistema DEBE permitir al `PLATFORM_ADMIN` listar todos los usuarios, filtrar por rol y estado, y modificar sus roles. | Alta | 1 |
| REQ-ROL-007 | El sistema DEBE permitir al `SCHOOL_ADMIN` gestionar únicamente usuarios de su organización asignada. | Alta | 1 |
| REQ-ROL-008 | El sistema NO DEBE permitir a un `SCHOOL_ADMIN` otorgarse a sí mismo permisos de `PLATFORM_ADMIN`. | Alta | 1 |
| REQ-ROL-009 | El sistema DEBE exponer una API de introspección para que el frontend determine la capacidad del usuario (`/me/capabilities`). | Media | 1 |

### RF-CFG — Parámetros de Configuración

| ID | Descripción | Prioridad | Fase |
|----|-------------|-----------|------|
| REQ-CFG-001 | El sistema DEBE almacenar parámetros de configuración en base de datos con clave-valor tipado. | Alta | 1 |
| REQ-CFG-002 | El sistema DEBE soportar tipos de parámetro: `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `JSON`, `STRING_ARRAY`. | Alta | 1 |
| REQ-CFG-003 | El sistema DEBE permitir agrupar parámetros por categoría (ej. `visibility`, `security`, `legal`). | Media | 1 |
| REQ-CFG-004 | El sistema DEBE exponer un endpoint para lectura de parámetros públicos sin autenticación. | Alta | 1 |
| REQ-CFG-005 | El sistema DEBE requerir autenticación como `PLATFORM_ADMIN` para modificar parámetros. | Alta | 1 |
| REQ-CFG-006 | El sistema DEBE registrar un log de auditoría por cada cambio de parámetro (quién, cuándo, valor anterior y nuevo). | Alta | 1 |
| REQ-CFG-007 | El sistema DEBE soportar parámetros por entorno (`development`, `staging`, `production`). | Media | 1 |
| REQ-CFG-008 | El sistema DEBE cachear parámetros frecuentemente leídos en memoria con invalidación automática. | Media | 1 |
| REQ-CFG-009 | El sistema DEBE validar tipos y rangos al escribir parámetros (ej. `report_threshold` ≥ 1). | Alta | 1 |
| REQ-CFG-010 | El sistema DEBE soportar parámetros sensibles marcados como `secret` que se cifran en reposo. | Alta | 1 |

### RF-USR — Gestión de Usuarios (Fase Fundación)

| ID | Descripción | Prioridad | Fase |
|----|-------------|-----------|------|
| REQ-USR-001 | El sistema DEBE permitir a todo usuario autenticado consultar y modificar su perfil (nombre, idioma preferido, zona horaria). | Alta | 1 |
| REQ-USR-002 | El sistema DEBE permitir a todo usuario autenticado cambiar su contraseña previa validación de la actual. | Alta | 1 |
| REQ-USR-003 | El sistema DEBE permitir a todo usuario autenticado habilitar/deshabilitar 2FA. | Alta | 1 |
| REQ-USR-004 | El sistema DEBE permitir al `PLATFORM_ADMIN` desactivar (soft delete) cualquier cuenta. | Alta | 1 |
| REQ-USR-005 | El sistema DEBE permitir al `PLATFORM_ADMIN` ver el historial de actividad (log de auditoría) de cualquier usuario. | Media | 1 |
| REQ-USR-006 | El sistema NO DEBE permitir la eliminación física de cuentas con registros de auditoría asociados. | Alta | 1 |

### RF-LOG — Logging y Auditoría

| ID | Descripción | Prioridad | Fase |
|----|-------------|-----------|------|
| REQ-LOG-001 | El sistema DEBE registrar en auditoría: creación de cuenta, inicio/cierre de sesión, cambios de rol, cambios de configuración. | Alta | 1 |
| REQ-LOG-002 | El sistema DEBE registrar en auditoría: IP origen, user-agent, timestamp UTC, ID de sesión. | Alta | 1 |
| REQ-LOG-003 | El sistema DEBE almacenar logs de auditoría por mínimo 5 años. | Alta | 1 |
| REQ-LOG-004 | El sistema DEBE exponer logs de auditoría al `PLATFORM_ADMIN` con filtros por fecha, usuario y tipo de evento. | Media | 1 |

---

## 1.2 Requisitos No Funcionales

### RNF-DISP — Disponibilidad y Rendimiento

| ID | Descripción | Objetivo |
|----|-------------|----------|
| RNF-DISP-001 | La API DEBE responder al 99.9% de las solicitudes en < 500 ms (p95) bajo carga normal. | < 500 ms |
| RNF-DISP-002 | El sistema DEBE soportar 1000 usuarios concurrentes en la fase fundacional. | 1000 CCU |
| RNF-DISP-003 | El sistema DEBE tener una disponibilidad objetivo del 99.9% (máximo 43 min/mes de downtime). | 99.9% |
| RNF-DISP-004 | El tiempo de recuperación ante desastre (RTO) DEBE ser menor a 4 horas. | < 4h |

### RNF-SEG — Seguridad

| ID | Descripción |
|----|-------------|
| RNF-SEG-001 | Todas las comunicaciones DEBEN usar TLS 1.3 como mínimo. |
| RNF-SEG-002 | Las contraseñas DEBEN almacenarse con bcrypt (cost ≥ 12) o Argon2id. |
| RNF-SEG-003 | Los tokens JWT DEBEN usar algoritmo RS256 con rotación de claves periódica. |
| RNF-SEG-004 | El sistema DEBE implementar rate limiting por IP y por usuario: 100 req/min para autenticación, 1000 req/min para API general. |
| RNF-SEG-005 | El sistema DEBE sanitizar toda entrada de usuario para prevenir XSS, SQLi y NoSQLi. |
| RNF-SEG-006 | Los parámetros marcados como `secret` DEBEN cifrarse con AES-256-GCM antes de almacenarse. |
| RNF-SEG-007 | El sistema DEBE implementar headers de seguridad: HSTS, CSP, X-Frame-Options, X-Content-Type-Options. |
| RNF-SEG-008 | El sistema DEBE pasar evaluación OWASP ASVS Nivel 2 en la fase fundacional. |

### RNF-PRIV — Privacidad y Cumplimiento

| ID | Descripción |
|----|-------------|
| RNF-PRIV-001 | El sistema DEBE cumplir la Ley 1581 de 2012 (Colombia) y el Decreto 1377 de 2013. |
| RNF-PRIV-002 | El sistema DEBE cumplir GDPR para usuarios de la Unión Europea. |
| RNF-PRIV-003 | El sistema DEBE permitir al usuario solicitar exportación de sus datos personales. |
| RNF-PRIV-004 | El sistema DEBE permitir al usuario solicitar la supresión de sus datos personales (derecho al olvido), salvo obligaciones legales de retención. |
| RNF-PRIV-005 | El sistema NO DEBE almacenar datos personales de menores de edad sin consentimiento verificable del representante legal. |
| RNF-PRIV-006 | El sistema DEBE mantener un registro de tratamiento de datos personales (RTD). |

### RNF-OPS — Operabilidad

| ID | Descripción |
|----|-------------|
| RNF-OPS-001 | El sistema DEBE exponer health checks en `/health`, `/health/ready` y `/health/live`. |
| RNF-OPS-002 | El sistema DEBE emitir métricas en formato Prometheus en `/metrics`. |
| RNF-OPS-003 | El sistema DEBE usar logging estructurado (JSON) con niveles DEBUG, INFO, WARN, ERROR. |
| RNF-OPS-004 | El sistema DEBE soportar despliegue mediante contenedores Docker. |
| RNF-OPS-005 | El sistema DEBE permitir configuración exclusiva por variables de entorno para credenciales y endpoints sensibles. |

---

## 1.3 Restricciones y Supuestos

### Restricciones Técnicas

1. **RT-001:** El backend DEBE desarrollarse en Node.js (TypeScript) o Python (FastAPI/ Django Ninja). La elección se justifica en el documento de arquitectura.
2. **RT-002:** La base de datos relacional DEBE ser PostgreSQL 15+.
3. **RT-003:** La base de datos de caché DEBE ser Redis 7+.
4. **RT-004:** El frontend DEBE ser una SPA progresiva (PWA) con React o Vue 3.
5. **RT-005:** La infraestructura DEBE ser cloud-native, preferiblemente AWS o GCP.

### Supuestos

1. **SP-001:** Se asume disponibilidad de servicio de correo electrónico transaccional (SendGrid, AWS SES, o similar).
2. **SP-002:** Se asume que el equipo de operaciones gestionará certificados SSL/TLS.
3. **SP-003:** Se asume que el módulo de colegios (Fase 2) requerirá integración con sistemas de información educativa existentes; la interfaz se definirá en su momento.