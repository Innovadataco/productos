# 10 — Glosario

## Términos del Dominio

| Término | Definición |
|---------|------------|
| **Identificador** | Número telefónico, nombre de usuario (nick) o handle de red social que puede ser reportado como de riesgo para menores. |
| **Reporte** | Registro comunitario que asocia un identificador con una situación de riesgo percibida. Incluye descripción, fecha, ubicación y plataforma. |
| **Reporte independiente** | Reporte realizado desde una sesión o IP diferente, usado para calcular el umbral de visibilidad. El sistema descarta reportes duplicados del mismo origen. |
| **Umbral de visibilidad** | Cantidad mínima de reportes independientes que un identificador debe acumular para aparecer en consultas públicas. Parámetro configurable por el administrador. |
| **Consulta pública** | Búsqueda de un identificador que retorna solo métricas agregadas (cantidad de reportes, distribución geográfica/temporal). Nunca indica culpabilidad. |
| **Plataforma** | Red social, juego en línea, aplicación de mensajería u otro servicio digital donde se registra la interacción (ej. WhatsApp, TikTok, Discord, Fortnite). |
| **Colegio** | Institución educativa que utiliza el sistema para validar listas de contactos de sus estudiantes contra la base de reportes. |
| **Perfil interno** | Usuario creado por un `SCHOOL_ADMIN` dentro de la organización de su colegio, con permisos granulares definidos localmente. |

## Términos Técnicos

| Término | Definición |
|---------|------------|
| **2FA / TOTP** | Two-Factor Authentication / Time-based One-Time Password. Método de autenticación que requiere un código temporal generado por una aplicación autenticadora. |
| **ABAC** | Attribute-Based Access Control. Modelo de autorización que evalúa permisos basándose en atributos del sujeto, recurso y entorno. |
| **AES-256-GCM** | Advanced Encryption Standard con clave de 256 bits en modo Galois/Counter Mode. Algoritmo de cifrado simétrico con autenticación. |
| **CUID** | Collision-resistant Unique Identifier. Identificador único diseñado para ser seguro en URLs y ordenable cronológicamente. |
| **JWT** | JSON Web Token. Token firmado digitalmente que contiene claims (afirmaciones) sobre una entidad. |
| **MFA** | Multi-Factor Authentication. Autenticación que requiere dos o más factores de verificación. |
| **OWASP ASVS** | Open Web Application Security Project Application Security Verification Standard. Estándar de verificación de seguridad de aplicaciones web. |
| **PITR** | Point-In-Time Recovery. Capacidad de restaurar una base de datos a un momento específico en el pasado. |
| **RBAC** | Role-Based Access Control. Modelo de autorización donde los permisos se asignan a roles y los roles a usuarios. |
| **Redis** | Base de datos en memoria de estructuras de datos, usada para caché, sesiones y rate limiting. |
| **RS256** | Algoritmo de firma RSA con SHA-256. Usado para firmar JWTs de forma asimétrica. |
| **RTD** | Registro de Tratamiento de Datos. Documento obligatorio bajo la Ley 1581 de 2012 que describe cómo una organización procesa datos personales. |
| **RTO** | Recovery Time Objective. Tiempo máximo aceptable para restaurar un servicio tras una interrupción. |
| **Soft delete** | Eliminación lógica donde el registro se marca como eliminado pero permanece en base de datos para preservar integridad referencial. |
| **TOTP** | Time-based One-Time Password. Código de un solo uso basado en tiempo, típicamente de 6 dígitos, válido por 30 segundos. |

## Abreviaturas

| Abreviatura | Significado |
|-------------|-------------|
| **API** | Application Programming Interface |
| **CCU** | Concurrent Connected Users |
| **CDN** | Content Delivery Network |
| **CI/CD** | Continuous Integration / Continuous Deployment |
| **CSP** | Content Security Policy |
| **CSRF** | Cross-Site Request Forgery |
| **DTO** | Data Transfer Object |
| **ECS** | Elastic Container Service (AWS) |
| **GDPR** | General Data Protection Regulation |
| **HIBP** | Have I Been Pwned |
| **HSTS** | HTTP Strict Transport Security |
| **IP** | Internet Protocol |
| **MFA** | Multi-Factor Authentication |
| **ORM** | Object-Relational Mapping |
| **PKCE** | Proof Key for Code Exchange |
| **PWA** | Progressive Web App |
| **RDS** | Relational Database Service (AWS) |
| **S3** | Simple Storage Service (AWS) |
| **SES** | Simple Email Service (AWS) |
| **SHA-256** | Secure Hash Algorithm 256 bits |
| **SLA** | Service Level Agreement |
| **SIC** | Superintendencia de Industria y Comercio (Colombia) |
| **SQL** | Structured Query Language |
| **SQLi** | SQL Injection |
| **SSL/TLS** | Secure Sockets Layer / Transport Layer Security |
| **TTL** | Time To Live |
| **UUID** | Universally Unique Identifier |
| **WAF** | Web Application Firewall |
| **XSS** | Cross-Site Scripting |

## Notación de Permisos

| Patrón | Significado | Ejemplo |
|--------|-------------|---------|
| `recurso:accion` | Permiso sobre un recurso para una acción | `user:read` |
| `recurso:admin` | Todos los permisos sobre el recurso | `config:admin` |
| `*` | Comodín (todos los recursos o acciones) | No usado en este sistema por seguridad |

## Versionado

| Término | Definición |
|---------|------------|
| **Breaking change** | Cambio que requiere modificación en los consumidores de la API. Incrementa versión mayor. |
| **Fase 1 / Fundación** | Primera etapa del proyecto: autenticación, estructura base, configuración. |
| **Fase 2** | Segunda etapa: reportes, consultas públicas, colegios. |
| **Fase 3** | Tercera etapa: analítica avanzada, integraciones, notificaciones en tiempo real. |