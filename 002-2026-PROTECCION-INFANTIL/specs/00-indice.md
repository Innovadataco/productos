# Sistema de Reportes Comunitarios de Protección Infantil
## Especificación Técnica — Fase Fundación (Fase 1)

**Código del proyecto:** 002-2026-PROTECCION-INFANTIL  
**Versión:** 1.0.0-fundacion  
**Fecha:** 2026-07-11  
**Estado:** Borrador para revisión

---

## Propósito del Documento

Esta especificación define el alcance técnico de la **fase fundacional** del sistema de reportes comunitarios de protección infantil. Las fases posteriores (reportes, consultas públicas, módulo de colegios) se documentarán en especificaciones independientes una vez finalizada esta base.

---

## Visión General del Sistema

Plataforma que permite a usuarios anónimos y autenticados reportar números telefónicos, nicks o usuarios de redes sociales, juegos o mensajería que consideran de riesgo para menores de edad. Los padres pueden consultar si un identificador tiene reportes registrados, visualizando únicamente métricas agregadas (cantidad y distribución geográfica/temporal), nunca etiquetas de culpabilidad. Un identificador solo aparece en consultas públicas al superar un umbral mínimo de reportes independientes, configurable por el administrador de plataforma.

### Principios Rectores

1. **Privacidad por diseño:** Nunca se expone información que pueda identificar a un menor o a un reportante.
2. **Presunción de inocencia:** El sistema no etiqueta identificadores como "peligrosos"; solo expone métricas agregadas.
3. **Transparencia controlada:** Los umbrales de visibilidad son públicos y auditables.
4. **Seguridad en capas:** Autenticación robusta, autorización granular, cifrado en tránsito y en reposo.

---

## Tipos de Usuario (Sistema Completo)

| Rol | Descripción | Alcance Fase 1 |
|-----|-------------|----------------|
| **Administrador de Plataforma** | Control total del sistema. Gestiona parámetros globales, roles, auditoría. | ✅ Completo |
| **Administrador de Colegio** | Crea perfiles internos con permisos granulares. Valida listas de números contra la base. | ✅ Estructura de roles y permisos. Módulo colegios en Fase 2. |
| **Padre / Tutor** | Consulta identificadores, recibe alertas, gestiona perfiles familiares. | ✅ Autenticación y estructura de cuenta. Consultas en Fase 2. |

---

## Alcance de la Fase Fundación

### Incluido en esta fase

- [x] Sistema de autenticación multi-rol (JWT, refresh tokens, MFA opcional).
- [x] Estructura base del proyecto (backend, frontend, base de datos, infraestructura).
- [x] Sistema de parámetros de configuración global (umbrales, flags, textos legales).
- [x] Gestión de usuarios y roles con permisos granulares (RBAC + ABAC híbrido).
- [x] API base con versionado, rate limiting, logging estructurado y health checks.
- [x] Pipeline CI/CD básico y contenerización.

### Excluido de esta fase (Fases 2+)

- [ ] Registro y gestión de reportes comunitarios.
- [ ] Motor de consulta pública de identificadores.
- [ ] Módulo de colegios (validación de listas, perfiles internos).
- [ ] Notificaciones y alertas en tiempo real.
- [ ] Dashboard analítico avanzado.
- [ ] Integraciones con plataformas externas.

---

## Estructura de la Especificación

| Documento | Contenido |
|-----------|-----------|
| `01-requisitos.md` | Requisitos funcionales, no funcionales y restricciones |
| `02-arquitectura.md` | Arquitectura de software, stack tecnológico, diagramas de componentes |
| `03-modelo-datos.md` | Esquema de base de datos, entidades y relaciones (fase fundación) |
| `04-autenticacion.md` | Flujos de autenticación, autorización, gestión de sesiones y MFA |
| `05-configuracion.md` | Sistema de parámetros de configuración global y por entorno |
| `06-api-rest.md` | Contratos de API REST (endpoints, request/response, códigos de error) |
| `07-seguridad.md` | Políticas de seguridad, cifrado, sanitización, privacidad GDPR/Ley 1581 |
| `08-despliegue.md` | Infraestructura, contenerización, orquestación, CI/CD |
| `09-testing.md` | Estrategia de pruebas, cobertura objetivo, entornos de validación |
| `10-glosario.md` | Términos, abreviaturas y definiciones |

---

## Convenciones del Documento

- **DEBE (MUST):** Requisito obligatorio.
- **DEBERÍA (SHOULD):** Recomendación fuerte, sujeta a justificación técnica.
- **PUEDE (MAY):** Opcional, implementación futura.
- **NO DEBE (MUST NOT):** Prohibición explícita.

Los identificadores de requisitos siguen el patrón `REQ-{categoría}-{número}`, por ejemplo: `REQ-AUT-001`.

---

## Historial de Cambios

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0.0-fundacion | 2026-07-11 | Equipo técnico | Versión inicial de la fase fundación |