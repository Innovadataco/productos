# Feature Specification: SPEC-258 — Plantillas de correo del onboarding de colegio (I-124)

**Feature Branch**: `work/002-PI-rescate-pagos`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: se agregan filas a `NotificacionPlantilla` vía `prisma/seed.ts` para las plantillas del flujo de onboarding institucional que hoy no existen en BD y hacen que el Motor de Notificaciones descarte los envíos ("Plantilla no encontrada: clave=colegio.creado.email, canal=EMAIL"). La regla `colegio.creado → EMAIL → SCHOOL_ADMIN` ya está sembrada (`seed.ts:2990`); falta la plantilla concreta. Patrón anti-I-100: `upsert({ create: {...}, update: {} })` — no pisa ediciones futuras del CEO. Sin migración de esquema. Se revisan y siembran las plantillas del mismo flujo si faltan (activación, bienvenida, recordatorio).

**Input**: El CEO crea un colegio; el evento `colegio.creado` sí se dispara, pero el envío se descarta con `Plantilla no encontrada`. El colegio nunca recibe la contraseña. Los envíos de `consentimiento.aceptado` sí funcionaron para el mismo usuario, así que el motor está sano — falta el registro.

**Dependencias**: ninguna dura. Se ejecuta tras `npx prisma db seed`; en un ambiente vivo, corre el seed sin resetear.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Al crear un colegio, el rector recibe el correo (Priority: P1)

Como rector que se registra en `/registro-colegio`, quiero recibir el correo con mi contraseña inicial para poder entrar.

**Independent Test**: crear un colegio vía la API de registro; verificar en tabla `notificaciones` que existe una fila con `estado='ENVIADA'` (o `PROGRAMADA` → `ENVIADA`), NO descartada por plantilla faltante; verificar en el mock/log de Resend que el correo se disparó con el asunto y cuerpo esperados.

**Acceptance Scenarios**:
1. **Given** la BD sembrada y el motor de notificaciones activo, **When** se crea un colegio, **Then** la fila `NotificacionPlantilla` para `(claveEvento="colegio.creado", canal="EMAIL")` existe, el motor la resuelve y crea una `notificacion` en estado `ENVIADA`/`PROGRAMADA`.
2. **Given** el CEO edita el texto de la plantilla desde `/dashboard/admin/notificaciones` (u homólogo), **When** se corre el seed dos veces, **Then** el texto editado se conserva (`update: {}` no lo pisa).
3. **Given** faltan otras plantillas del flujo (ej. `colegio.activado.email`, `colegio.bienvenida.email`, `colegio.recordatorio.email`), **When** se corre el seed, **Then** también quedan sembradas de forma idempotente-respetuosa.

### Edge Cases

- ¿Y si la clave ya existe pero con texto genérico placeholder? — `update: {}` lo respeta; el CEO debe editarlo desde admin.
- ¿Y si el evento `colegio.creado` aún no existe en `motor_notif_catalogo`? — verificar en Fase 0; si falta, se agrega la regla + evento en el mismo seed (aditivo).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir una fila en `NotificacionPlantilla` con `(claveEvento="colegio.creado", canal="EMAIL", rol="SCHOOL_ADMIN")` con asunto y cuerpo redactados por ZEUS/CEO.
- **FR-002**: El upsert de la plantilla DEBE usar `create: {...}, update: {}` para respetar ediciones del admin (patrón anti-I-100).
- **FR-003**: DEBE revisarse el flujo completo del onboarding institucional (`colegio.creado`, `colegio.activado`, `colegio.bienvenida`, `colegio.recordatorio`) y sembrar TODAS las plantillas que falten con el mismo patrón.
- **FR-004**: La plantilla `colegio.creado.email` DEBE contener referencia a la contraseña inicial (o instrucción de activación mediante enlace/token, según cómo entregue el flujo la credencial) — el texto exacto lo define el brief o queda como `NEEDS CLARIFICATION` si no está en fuente única.
- **FR-005**: NO se toca el esquema Prisma; solo `prisma/seed.ts`.
- **FR-006**: NO se toca el motor de notificaciones (SPEC-201) ni el catálogo (SPEC-247); solo se agregan filas de plantilla y, si falta, la regla.

### Key Entities

- **`NotificacionPlantilla`** (Prisma, ya existente, SPEC-201): `claveEvento`, `canal`, `rol`, `asunto`, `cuerpoMarkdown` (o similar según schema real).
- **`motor_notif_catalogo`** (SPEC-247): evento + regla + plantilla.

## Success Criteria *(mandatory)*

- **SC-007 (brief)**: al crear un colegio, la notificación `colegio.creado.email` queda `ENVIADA` (no descartada).
- Verificable en vivo: crear un colegio y consultar `SELECT * FROM notificaciones WHERE plantillaClave = 'colegio.creado.email' ORDER BY creadoEn DESC LIMIT 1;`.

## Assumptions

- El motor de notificaciones ya escucha `colegio.creado` (según `seed.ts:2990`).
- Los canales/tabla siguen el esquema de SPEC-201/247 — Fase 0 confirma nombres exactos.
- El texto de la plantilla se redacta con lenguaje neutro, sin voseo (AGENTS.md).
