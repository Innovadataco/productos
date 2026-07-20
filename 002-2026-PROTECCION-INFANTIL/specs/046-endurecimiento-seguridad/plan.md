# Implementation Plan: Endurecimiento de Seguridad (Spec 046)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/046-endurecimiento-seguridad/spec.md`

---

## Summary

Ejecutar un saneamiento de seguridad sobre la base del producto: documentar el inventario de PII, endurecer la CSP con nonces, garantizar topes de paginación, sanitizar todos los mensajes de error enviados al cliente y añadir una prueba e2e de anonimización. La rotación de `PARAM_ENCRYPTION_KEY` se planifica pero no se implementa.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Zod, Playwright |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + Playwright |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | CSP generada por petición sin impacto perceptible; paginación <100 ms adicional |
| **Constraints** | Sin migraciones destructivas; sin tocar SPEC-050 ni SPEC-060; sin rotación de clave ahora |
| **Scale/Scope** | Seguridad transversal: config, middleware, múltiples endpoints, tests, docs |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | No se añade multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No se cambia la lógica de culpabilidad |
| §1.4 Umbral parametrizable en BD | ✅ Pass | No se modifica |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual, no NextAuth) | ✅ Pass | No se cambia stack |
| §2.2 Roles | ✅ Pass | No se cambian roles |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Se mantiene |
| §3.4 Códigos HTTP correctos | ✅ Pass | Se respeta AppError |
| §3.5 Logs y auditoría | ✅ Pass | Se audita seguridad |
| §3.6 Límites de tamaño | ✅ Pass | Se refuerza pageSize |
| §4.1 Singletons | ✅ Pass | No se añaden singletons |
| §6.1 JWT en cookie httpOnly | ✅ Pass | No se cambia |
| §6.3 Datos sensibles encriptados | ✅ Pass | Se documenta y audita |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/046-endurecimiento-seguridad/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Fase 0/1: inventario PII, CSP, rotación de clave
├── data-model.md        # Resumen de entidades PII (sin cambios de schema)
├── quickstart.md        # Pasos de validación manuales
├── checklists/
│   └── requirements.md  # Constitution check de la spec
├── tasks.md             # Plan de tareas
└── cierre.md            # Evidencia de cierre (post-implementación)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── next.config.ts                 # Headers de seguridad estáticos (CSP movida a proxy)
├── src/
│   ├── lib/
│   │   ├── proxy.ts              # CSP dinámica con nonce
│   │   ├── errors.ts             # safeErrorMessage
│   │   ├── pagination.ts         # MAX_PAGE_SIZE
│   │   └── audit.ts              # no cambios directos, se documenta PII
│   ├── app/api/
│   │   ├── admin/dataset-entrenamiento/route.ts
│   │   ├── config/parametros/route.ts
│   │   ├── reportes/mis-reportes/route.ts
│   │   ├── admin/ia/...          # sanitización de errores
│   │   ├── circulo-confianza/... # sanitización de errores
│   │   ├── health/worker/route.ts # sanitización de errores
│   │   └── auth/...              # sanitización de errores
├── tests/e2e/
│   └── anonimizacion.spec.ts     # Test e2e de PII
└── docs/
    └── pii-inventory.md          # Inventario de PII
```

---

## Complexity Tracking

No constitution violations. No complexity justification needed.

---

## Phases

### Phase 1: Documentación e inventario

- Crear artefactos del Spec-Kit.
- Generar `docs/pii-inventory.md` con mapa de PII.
- Plan de rotación de `PARAM_ENCRYPTION_KEY` en `research.md` y `tasks.md`.

### Phase 2: CSP con nonce

- Mover CSP de `next.config.ts` a `src/lib/proxy.ts`.
- Generar nonce por petición con `crypto.randomUUID()`.
- Establecer directivas restrictivas: `default-src 'self'`, `script-src 'self' 'nonce-<nonce>'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`, `manifest-src 'self'`, `worker-src 'self'`, `media-src 'self'`.
- Conservar en `next.config.ts`: X-Frame, X-Content-Type, Referrer, Permissions, HSTS.

### Phase 3: Paginación

- Extraer `MAX_PAGE_SIZE = 100` a `src/lib/pagination.ts`.
- Aplicar en `dataset-entrenamiento`, `config/parametros`, `mis-reportes`.
- Asegurar que `pageSize` devuelto en JSON refleje el valor efectivo.

### Phase 4: Sanitización de errores

- Añadir `safeErrorMessage()` en `src/lib/errors.ts`.
- Revisar todas las rutas que devuelven `error.message` crudo y reemplazar por mensaje controlado.
- Preservar mensajes de negocio intencionales (`AppError`).
- Eliminar `emailError` de respuestas de desarrollo en endpoints de email (mantener `devCode`/`devToken` si es necesario, pero no el mensaje de error).

### Phase 5: Test e2e de anonimización

- Crear `tests/e2e/anonimizacion.spec.ts`.
- Crear reporte con texto que contenga PII simulada (nombre + teléfono) y marcarlo como anonimizado.
- Verificar `/api/consulta` no devuelve texto crudo.
- Verificar `DatasetEntrenamiento` no contiene texto crudo.
- Verificar que el error de logs no contiene PII (forzar error sin exponer texto).

### Phase 6: Validación y cierre

- `npx tsc --noEmit`.
- `npm run lint`.
- `npm run test`.
- `npm run test:e2e`.
- `./scripts/dev-restart.sh`.
- `quickstart.md`.
- `cierre.md` + sección Implementación en `spec.md`.
