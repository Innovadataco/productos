# 07 — Seguridad

## 7.1 Postura de Seguridad

El sistema maneja información sensible relacionada con protección infantil. La postura de seguridad es **defense in depth** con énfasis en:

1. **Confidencialidad:** Cifrado en tránsito y en reposo. Mínimo principio de privilegio.
2. **Integridad:** Validación estricta de inputs, firmas digitales en tokens, hashes criptográficos.
3. **Disponibilidad:** Rate limiting, protección contra DDoS, monitoreo de anomalías.
4. **No repudio:** Logs de auditoría inmutables con contexto completo de cada acción.

---

## 7.2 Cifrado

### En Tránsito

| Aspecto | Especificación |
|---------|---------------|
| Protocolo mínimo | TLS 1.3 |
| Certificados | ECDSA P-256 o RSA-2048 mínimo |
| HSTS | `max-age=63072000; includeSubDomains; preload` |
| Cipher suites | Solo suites TLS 1.3 (no configurables, forward secrecy por diseño) |

### En Reposo

| Dato | Algoritmo | Detalle |
|------|-----------|---------|
| Contraseñas | bcrypt | Cost factor ≥ 12, salt automático |
| Tokens raw (refresh, reset) | SHA-256 | Solo hashes almacenados |
| MFA secrets | AES-256-GCM | Clave derivada de `MFA_ENCRYPTION_KEY` |
| Config params secretos | AES-256-GCM | Clave derivada de `CONFIG_ENCRYPTION_KEY` |
| Backups de BD | AES-256-GCM | Clave gestionada por AWS KMS / GCP Cloud KMS |

### Gestión de Claves

- Las claves de cifrado (`MFA_ENCRYPTION_KEY`, `CONFIG_ENCRYPTION_KEY`, `JWT_PRIVATE_KEY`) se almacenan en un gestor de secretos (AWS Secrets Manager, HashiCorp Vault, o Google Secret Manager).
- Rotación de claves de firma JWT cada 90 días.
- Las claves antiguas se mantienen durante 24 horas de período de gracia.
- Ninguna clave privada se almacena en código fuente o variables de entorno planas.

---

## 7.3 Autenticación y Autorización

### Contraseñas

- Mínimo 12 caracteres.
- Al menos: 1 mayúscula, 1 minúscula, 1 dígito, 1 símbolo.
- Validación contra lista de contraseñas comprometidas (Have I Been Pwned API v3, k-Anonymity).
- Historial de contraseñas: no se permite reutilizar las últimas 5.
- Cambio forzado cada 365 días para `PLATFORM_ADMIN` (configurable).

### Tokens

| Tipo | Especificación |
|------|---------------|
| Access token | JWT RS256, 15 min, claims: sub, email, roles, permissions, jti, iat, exp |
| Refresh token | UUIDv4, 7 días, hash SHA-256 en BD + Redis |
| MFA token | JWT RS256, 5 min, type: "mfa_pending" |
| Email verification | JWT RS256, 24h, type: "email_verification" |
| Password reset | UUIDv4, 1 hora, hash SHA-256 en BD |

### Bloqueo de Cuenta

- 5 intentos fallidos consecutivos → bloqueo temporal de 30 minutos.
- 3 bloqueos en 24 horas → suspensión de cuenta, requiere intervención de `PLATFORM_ADMIN`.
- Notificación por email al usuario en cada bloqueo.

---

## 7.4 Headers de Seguridad HTTP

| Header | Valor | Propósito |
|--------|-------|-----------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forzar HTTPS |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' api.proteccion-infantil.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self';` | Mitigar XSS |
| `X-Frame-Options` | `DENY` | Prevenir clickjacking |
| `X-Content-Type-Options` | `nosniff` | Evitar MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controlar referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Deshabilitar APIs sensibles |
| `X-Request-ID` | UUID generado por servidor | Trazabilidad |

---

## 7.5 Sanitización y Validación

### Input Validation

Toda entrada de usuario pasa por tres capas:

1. **Schema validation (Zod):** Tipos, rangos, formatos.
2. **Business validation:** Reglas de negocio (unicidad, existencia de referencias).
3. **Output encoding:** Antes de incluir en respuestas o queries.

### Protección contra Inyección

| Tipo | Medida |
|------|--------|
| SQL Injection | ORM parametrizado (Prisma) en todas las queries |
| NoSQL Injection | Validación estricta de tipos antes de construir filtros |
| XSS | CSP + encoding de output + React XSS protection |
| CSRF | SameSite=Strict cookies para sesiones futuras + token-based para API |
| Command Injection | No se ejecutan comandos de shell con input de usuario |
| Path Traversal | Validación de rutas, whitelist de directorios permitidos |

---

## 7.6 Rate Limiting y Protección contra Abuso

### Límites por Endpoint

*(Documentados en 04-autenticacion.md, sección 4.11)*

### Detección de Bots

- Implementación de CAPTCHA (hCaptcha o Cloudflare Turnstile) en:
  - Registro de cuenta
  - Recuperación de contraseña
  - Login tras 3 intentos fallidos
- Análisis de comportamiento (tiempo de interacción, mouse movements) en formularios críticos.

### Prevención de Enumeración

- Registro: respuesta genérica sin revelar si email existe.
- Recuperación de contraseña: respuesta genérica.
- Login: tiempo de respuesta constante (timing attack mitigation) mediante `crypto.timingSafeEqual`.

---

## 7.7 Privacidad y Protección de Datos

### Ley 1581 de 2012 (Colombia)

1. **Finalidad:** Los datos personales se recolectan únicamente para fines explícitos y legítimos.
2. **Consentimiento:** Registro de consentimiento explícito en creación de cuenta.
3. **Derechos ARCO:** Implementación de endpoints para:
   - Acceso: `GET /api/v1/me/data-export`
   - Rectificación: `PATCH /api/v1/me`
   - Cancelación (supresión): `POST /api/v1/me/request-deletion`
   - Oposición: `POST /api/v1/me/objection`
4. **Autorización:** Almacenamiento de timestamp y versión de términos aceptados.

### GDPR (Unión Europea)

| Requisito | Implementación |
|-----------|---------------|
| Art. 13-14 | Información en registro, política de privacidad vinculante |
| Art. 15 | Derecho de acceso: endpoint `/me/data-export` |
| Art. 16 | Derecho de rectificación: `PATCH /me` |
| Art. 17 | Derecho al olvido: soft delete + anonimización tras período legal |
| Art. 18 | Restricción de tratamiento: flag en cuenta |
| Art. 20 | Portabilidad: exportación en JSON estándar |
| Art. 25 | Privacidad por diseño: datos mínimos, anonimización |
| Art. 30 | Registro de tratamiento: documento RTD en `docs/RTD.md` |
| Art. 33 | Notificación de brechas: procedimiento documentado |

### Datos de Menores de Edad

- El sistema NO solicita ni almacena datos personales de menores.
- Los reportes (fase 2) se anonimizan: no se vincula reporte a identidad del reportante en consultas públicas.
- Cualquier detección de datos de menores en reportes se marca para revisión.

---

## 7.8 Registro de Tratamiento de Datos (RTD)

El RTD se mantiene actualizado en `docs/RTD.md` y registra:

| Campo | Descripción |
|-------|-------------|
| Responsable | Innovadata Co. |
| Finalidad | Operación de plataforma de protección infantil |
| Base legal | Consentimiento del titular (Art. 8 Ley 1581) |
| Categorías de datos | Datos de identificación, contacto, logs técnicos |
| Destinatarios | Ningún tercero (salvo obligación legal) |
| Transferencias | Ninguna internacional sin autorización |
| Plazo de conservación | 5 años para logs de auditoría, hasta cancelación de cuenta para datos personales |
| Medidas de seguridad | Cifrado, control de acceso, auditoría |

---

## 7.9 Respuesta a Incidentes

### Clasificación

| Nivel | Ejemplo | SLA de Respuesta |
|-------|---------|------------------|
| P1 - Crítico | Brecha de datos, acceso no autorizado a BD | 1 hora |
| P2 - Alto | Vulnerabilidad explotable, bypass de auth | 4 horas |
| P3 - Medio | XSS reflejado, información sensible en logs | 24 horas |
| P4 - Bajo | Headers de seguridad faltantes | 7 días |

### Procedimiento

1. **Detección:** Alertas automáticas (anomalías de login, accesos a `/config` fuera de horario).
2. **Contención:** Desactivación de cuentas comprometidas, rotación de credenciales.
3. **Investigación:** Revisión de logs de auditoría, análisis forense.
4. **Notificación:** Autoridades competentes (SIC Colombia) en máximo 72h para datos personales.
5. **Remediación:** Parche, re-despliegue, comunicación a usuarios afectados.
6. **Lecciones aprendidas:** Post-mortem documentado, actualización de controles.

---

## 7.10 OWASP ASVS Nivel 2 Checklist

| Capítulo | Requisito | Estado Fase 1 |
|----------|-----------|---------------|
| V1.1 Arquitectura | Documentación de seguridad | ✅ |
| V1.2 Autenticación | MFA, bloqueo, recuperación segura | ✅ |
| V1.4 Control de acceso | RBAC + ABAC | ✅ |
| V2.1 Contraseñas | bcrypt, complejidad, historial | ✅ |
| V2.2 Sesiones | JWT + refresh rotation | ✅ |
| V3.1 Logging | Auditoría inmutable | ✅ |
| V4.1 TLS | TLS 1.3, HSTS | ✅ |
| V5.1 Input validation | Zod schemas, encoding | ✅ |
| V5.3 Output encoding | JSON encoding, CSP | ✅ |
| V6.1 Criptografía | AES-256-GCM, RSA-2048 | ✅ |
| V7.1 Errores | Mensajes genéricos, requestId | ✅ |
| V8.1 Datos sensibles | Cifrado en reposo | ✅ |
| V9.1 Comunicaciones | TLS, cert pinning (futuro) | ✅ |
| V10.1 Inyección | ORM parametrizado | ✅ |
| V11.1 Logs de seguridad | Inmutables, 5 años | ✅ |
| V12.1 Archivos | No aplica (fase 1) | N/A |
| V13.1 API | Rate limiting, versionado | ✅ |
| V14.1 Configuración | Seguridad por defecto | ✅ |