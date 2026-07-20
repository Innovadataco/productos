# Implementation Plan: Seguridad Fase 1 — Saneamiento de Auth

**Branch**: `[045-seguridad-fase-1]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/045-seguridad-fase-1/spec.md`

---

## Summary

Aplicar las primeras capas de saneamiento de seguridad en los endpoints de autenticación pública: rate limiting por IP e identificador usando el utilitario existente `checkRateLimit`, y validación estructurada con Zod en los endpoints públicos de registro, solicitud de recuperación y restablecimiento de contraseña. Además, entregar el plan de diseño completo para el borrado seguro / derecho al olvido, sin implementar código de ese flujo.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Zod 4.4.3 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Respuesta de endpoints protegidos < 250 ms p95 en desarrollo |
| **Constraints** | Sin Redis, sin migraciones destructivas, sin cambios a SPEC-050/SPEC-060 |
| **Scale/Scope** | 3 endpoints de auth + 1 utilitario de rate limit + 1 utilitario de validadores |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | No se maneja multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública |
| §1.4 Umbral parametrizable en BD | ✅ Pass | No se modifica lógica de consulta |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual, no NextAuth) | ✅ Pass | No cambia stack |
| §2.2 Roles (ADMIN, SCHOOL_ADMIN, PARENT) | ✅ Pass | No se modifica roles |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Zod + tipos estrictos |
| §3.4 Códigos HTTP correctos | ✅ Pass | 400 / 429 / 200 según caso |
| §3.5 Logs y auditoría | ✅ Pass | Audit logs existentes se mantienen; rate limit logea errores |
| §3.6 Límites de tamaño y validación | ✅ Pass | Zod impone límites de email/password |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | No se tocan singletons |
| §4.2 Rutas API individuales | ✅ Pass | Cada endpoint mantiene su `route.ts` |
| §6.2 Validación de inputs | ✅ Pass | Zod para endpoints indicados |
| §6.4 Rate limiting | ✅ Pass | checkRateLimit reutilizado |

**Re-check post-design**: All gates still pass. No violations.

**Additional checks post-spec-update**:
- ✅ §6.2 Zod: se usan esquemas explícitos en endpoints públicos de auth.
- ✅ §6.4 Rate limiting: se añaden scopes aditivos a `src/lib/rate-limit.ts`.
- ✅ No migraciones destructivas: solo cambios de código y parámetros por defecto.

---

## Project Structure

### Documentation (this feature)

```text
specs/045-seguridad-fase-1/
├── spec.md              # Feature specification
├── plan.md              # This file (incluye plan de borrado seguro)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auth.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/
│   ├── app/api/auth/
│   │   ├── register/route.ts              # Zod validation
│   │   ├── recuperar/solicitar/route.ts   # Zod + rate limit
│   │   ├── recuperar/restablecer/route.ts # Zod validation
│   │   └── verificar/solicitar/route.ts   # Rate limit
│   └── lib/
│       ├── rate-limit.ts                  # New scopes
│       ├── validators.ts                 # New auth schemas
│       └── validators.test.ts            # Unit tests
├── specs/045-seguridad-fase-1/
└── package.json (zod already present)
```

**Structure Decision**: Reutilizar utilidades existentes (`checkRateLimit`, `validators.ts`) y centralizar esquemas. No crear nuevos directorios ni utilidades adicionales.

---

## Plan de Borrado Seguro / Derecho al Olvido *(US3 — plan-only)*

> **Alcance**: este plan se entrega como artefacto del Spec 045 pero no se implementa en código. Su implementación corresponderá a un spec posterior (posible SPEC-052 o similar) con migraciones aditivas y flujo de aprobación.

### 1. Objetivo

Permitir a un usuario autenticado (o representante legal de un menor) solicitar la eliminación de sus datos personales, cumpliendo el derecho al olvido de la Ley 1581 de 2012 y las políticas de retención de la plataforma.

### 2. Principios rectores

- **No se elimina evidencia legal**: reportes en investigación o con obligación legal de retención se anonimizan, no se borran físicamente.
- **Audit trail inmutable**: toda solicitud, aprobación, rechazo y ejecución de borrado se registra en `AuditLog`.
- **Verificación de identidad**: antes de ejecutar el borrado se debe confirmar posesión del email mediante un token temporal seguro (similar al de recuperación de contraseña).
- **Aprobación humana**: el borrado final lo ejecuta un ADMIN tras revisar que no exista obligación legal activa.
- **Certificado**: el sistema genera un comprobante de borrado con timestamp, hash y referencia al audit log.
- **Protección del último ADMIN**: no se permite borrar el último usuario con rol ADMIN activo.

### 3. Datos personales identificables (PII) a considerar

| Tabla / Entidad | PII directo | Tratamiento propuesto |
|-------------------|-------------|------------------------|
| `Usuario` | email, nombre, passwordHash | Eliminación física del registro; passwordHash ya está hasheada |
| `CodigoVerificacion` | email | Eliminación física de filas del usuario |
| `TokenRecuperacion` | email | Eliminación física de filas del usuario |
| `Reporte` | texto descriptivo, identificador, plataforma, ciudad, etc. | Anonimización si el usuario es autor y hay retención legal; eliminación física si no hay obligación |
| `ReporteAdjunto` | No aplica (prohibido multimedia) | Ninguno |
| `AuditLog` | ipAddress, userAgent, usuarioId | Retención mínima legal de 5 años; se conservan metadatos pero se anonimiza `usuarioId` |
| `Disputa` | datos del solicitante, evidencia | Anonimización o retención según estado de resolución |
| `CirculoConfianza` | contactos, identificadores | Eliminación física de filas del usuario |
| `Apelacion` | texto, identificador | Anonimización del usuario, conservación del texto anonimizado |

### 4. Flujo propuesto

```text
1. Usuario autenticado solicita borrado
   POST /api/auth/borrar-solicitar
   → Crea BorradoSolicitud en estado PENDIENTE
   → Envia email con token de confirmación

2. Usuario confirma solicitud desde el email
   POST /api/auth/borrar-confirmar
   → Valida token
   → Marca BorradoSolicitud como CONFIRMADA

3. ADMIN revisa en panel de borrados pendientes
   GET /api/admin/borrados-pendientes
   → Lista solicitudes CONFIRMADAS

4. ADMIN ejecuta borrado
   POST /api/admin/borrados/[id]/ejecutar
   → Verifica no sea último ADMIN
   → Anonimiza o elimina según reglas
   → Genera certificado de borrado
   → Registra en AuditLog

5. Notificación al usuario
   → Email con certificado y confirmación
```

### 5. Entidades propuestas (sin implementar)

```prisma
model BorradoSolicitud {
  id            String   @id @default(cuid())
  usuarioId     String
  estado        String   // PENDIENTE, CONFIRMADA, APROBADA, RECHAZADA, EJECUTADA
  tokenHash     String
  motivo        String?
  creadoEn      DateTime @default(now())
  confirmadoEn  DateTime?
  ejecutadoEn   DateTime?
  ejecutadoPorId String?
  certificadoId String?
}
```

### 6. Consideraciones de UX/UI

- Pantalla "Eliminar mi cuenta" en `/dashboard/configuracion/eliminar` con advertencia clara de irreversibilidad.
- Panel de ADMIN `/admin/borrados` con filas: usuario, fecha, estado, motivo, acción.
- Modal de confirmación para ADMIN antes de ejecutar, mostrando reportes afectados y obligaciones legales.

### 7. Tests propuestos (sin implementar)

- Solicitud de borrado crea fila en `BorradoSolicitud`.
- Confirmación con token válido cambia estado a `CONFIRMADA`.
- Rechazo de ejecución si es el último ADMIN.
- Anonimización correcta de reportes con retención legal.
- Generación de certificado con hash verificable.
- Audit log inmutable del evento de borrado.

---

## Complexity Tracking

No constitution violations. No complexity justification needed.
