# PRE-PRODUCCION.md — Producto 002 (Protección Infantil)

**Propósito**: Este documento es la fuente de verdad de TODO lo que debe resolverse o verificarse ANTES de que el Producto 002 pase a producción. No se dispersa en los specs individuales; cualquier ítem de pre-producción se consolida aquí. Al final del desarrollo se ejecutará un spec dedicado (reservado ~SPEC-090) que tilda cada línea de este registro antes del despegue.

**Versión**: `1.0.4`

**Última actualización**: 2026-07-21

---

## 1. 🔒 Planes aprobados sin implementar

| Ítem | Spec de origen | Por qué está pendiente | Qué hacer al implementar |
|---|---|---|---|
| Borrado seguro / derecho al olvido | Spec 045 US3 | Obligación legal (Ley 1581 de 2012, GDPR) antes de usuarios reales. Debe permitir a titulares/menores solicitar la eliminación irreversible de sus datos personales. | Crear entidad `SolicitudBorrado`, flujo de validación de titularidad, anonimización irreversible de PII, resolver el caso del menor sin cuenta (tutor legal), generar certificado de borrado, registrar todo en `AuditLog`. |
| Rotación de `PARAM_ENCRYPTION_KEY` | Spec 046 US6 | Antes de producción la clave de cifrado de parámetros debe poder rotarse sin pérdida de datos. | Versionar cifrado a `enc:vN:...`, soportar múltiples claves (`PARAM_ENCRYPTION_KEY`, `PARAM_ENCRYPTION_KEY_V<N>`), crear `scripts/rotate-param-encryption-key.ts` con descifrado/cifrado y rollback, y cubrir también los IDs cifrados de integrantes del comité (Spec 024). |
| Capa de datos / DAL | Spec 053 | Opcional, NO bloqueante para el lanzamiento inicial. Se recomienda si el producto va a crecer en complejidad. | Implementar repositorios/servicios incrementales, empezando por el módulo `Reporte`, aislando `Prisma` de las rutas API. |

---

## 2. ⚙️ Interruptores de configuración a cambiar al desplegar

| Variable / Config | Valor en dev | Valor en producción | Notas |
|---|---|---|---|
| `ENABLE_HTTPS_HEADERS` | `false` (dev accede por HTTP) | `true` (prod con dominio + HTTPS) | Activa `upgrade-insecure-requests` en CSP y `Strict-Transport-Security` (HSTS). Ver Spec 046. |
| `DISABLE_RATE_LIMIT` | `true` (evita bloqueos locales) | quitar o `false` | El anti-abuso debe estar activo con usuarios reales. Ver `src/lib/rate-limit.ts`. |
| Admin de prueba del seed | `soporte@innovadataco.com` / `Admin123!Test` | cambiar obligatorio antes de prod | El usuario admin de desarrollo se crea en el seed; nunca debe existir en producción. Ver `docs/USUARIOS-PRUEBA.md`. |
| Usuarios de prueba del seed | **Eliminados** de `prisma/seed.ts` y de la BD de desarrollo (2026-07-21). Solo resta el admin de prueba. | no aplicar nunca en producción | Los demás usuarios (`padre`, `operador`, `comite`, `school-admin`) y el `Colegio de Pruebas` fueron removidos. Ver `docs/USUARIOS-PRUEBA.md`. |
| HTTPS real | HTTP por Tailscale/LAN | dominio + certificado (Let's Encrypt, Cloudflare Tunnel, Tailscale Funnel, etc.) | Definir infraestructura de despliegue real antes de producción. |

---

## 3. 🧪 Verificaciones finales (medir, no asumir)

Antes del despegue se deben ejecutar y aprobar las siguientes verificaciones. Cada una deja evidencia en el spec de cierre ~SPEC-090.

- **Validación del clasificador contra datos humanos**: medir recall/precisión de `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE` con el prompt ajustado del Spec 050, usando un set de referencia de casos reales corregidos por operador/comité. No asumir mejora solo con smoke tests sintéticos. Ver Spec 050.
- **Auditoría de dependencias**: `npm audit` con 0 vulnerabilidades críticas/alta o plan de mitigación documentado.
- **Contraste real**: medir con axe/Lighthouse (o herramienta equivalente) las vistas principales en modo claro y oscuro. Aprobar WCAG 2.2 AA (4.5:1 texto, 3:1 no textual). Ver Specs 049, 051, 054. **Nota**: el script `scripts/contrast_check.js` del Spec 054 valida pares estáticos de los componentes corregidos; falta la validación final con axe/Lighthouse en las vistas reales del navegador (no disponible en el entorno de desarrollo).
- **Pentest dinámico**: recomendado, especialmente para endpoints de autenticación, reportes, consulta pública y admin. Registrar hallazgos y remediación.
- **Prueba de carga**: verificar comportamiento del worker y rate limiting bajo concurrencia esperada.
- **Revisión de PII**: validar que ningún endpoint público expone datos personales (inventario en `docs/pii-inventory.md`).
- **Backup y restauración**: probar el restore de la base de datos y el DR plan.

---

## 4. 📌 Convención

- Todo nuevo pendiente de pre-producción se agrega como una línea en este documento, en la sección correspondiente.
- En el spec de origen solo se deja una nota corta: *"Ítem de pre-producción registrado en `docs/PRE-PRODUCCION.md`."*
- Este documento se versiona en el encabezado y se anota en el `## Changelog`.
- Al final del desarrollo se ejecuta el spec reservado ~SPEC-090, que tilda cada ítem de este registro antes del despegue a producción.
- No se cierra un ítem solo marcando una casilla: debe haber evidencia de implementación, prueba y commit asociado.

---

## Changelog

- **v1.0.4** — 2026-07-21: Limpieza de desarrollo: se eliminaron del seed y de la BD los usuarios de prueba de roles no-admin (padre, operador, comité, school-admin) y el colegio de prueba. Se actualiza `docs/USUARIOS-PRUEBA.md`.
- **v1.0.3** — 2026-07-21: Se agrega ítem de usuarios de prueba del seed a eliminar/cambiar antes de producción.
- **v1.0.2** — 2026-07-20: Se agrega verificación final de validación del clasificador contra datos humanos (Spec 050).
- **v1.0.1** — 2026-07-20: Se agrega nota de validación de contraste con axe/Lighthouse pendiente del Spec 054.
- **v1.0.0** — 2026-07-20: Creación del registro con planes sin implementar (Specs 045 US3, 046 US6, 053), interruptores de configuración y verificaciones finales.
