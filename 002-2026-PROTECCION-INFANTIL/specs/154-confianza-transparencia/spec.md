# Feature Specification: SPEC-154 — Confianza: transparencia, protocolo e historial

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-10

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-058, brief §10. El rector necesita una sección de confianza que centralice la transparencia institucional (documentos de protocolo), el compromiso de buen uso y el historial de auditoría reciente del colegio, sin exponer PII.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consultar documentos de transparencia y protocolo (Priority: P1)

Como SCHOOL_ADMIN, quiero leer los documentos de protocolo y transparencia del colegio desde el panel, para entender los compromisos y procedimientos de la plataforma.

**Why this priority**: Es la base de la sección de confianza y materializa la transparencia hacia el rector.

**Independent Test**: un SCHOOL_ADMIN accede a `/dashboard/colegio/confianza` y ve al menos los documentos `docs/rector/transparencia.md` y `docs/rector/protocolo.md` renderizados como HTML seguro; un ADMIN u otro rol recibe 403.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN, **When** accede a `/dashboard/colegio/confianza`, **Then** ve una lista de documentos y puede abrir cada uno.
2. **Given** un documento Markdown, **Then** se renderiza sin HTML crudo ni scripts (solo el subset soportado por `Markdown` de SPEC-017).
3. **Given** un ADMIN u otro rol, **When** llama al endpoint, **Then** recibe 403.
4. **Given** un documento que no está en la allowlist, **Then** no se puede leer (prevención de path traversal).

---

### User Story 2 — Revisar historial de auditoría de 90 días (Priority: P1)

Como SCHOOL_ADMIN, quiero ver los eventos de auditoría de mi colegio de los últimos 90 días, para tener trazabilidad de las acciones sin ver datos sensibles.

**Why this priority**: Da visibilidad y control sobre el uso del módulo colegio, reforzando la confianza.

**Independent Test**: `GET /api/colegio/confianza/auditoria?dias=90` devuelve eventos del colegio de los últimos 90 días, paginados, sin incluir texto completo de reportes ni IPs en claro; un ADMIN recibe 403.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN con eventos de auditoría recientes, **When** consulta el historial, **Then** ve acción, fecha, recurso y usuario (si aplica), sin PII.
2. **Given** la configuración por defecto, **Then** el límite es 90 días y se puede pedir menos (`dias=30`).
3. **Given** más eventos que el tamaño de página, **Then** la respuesta incluye paginación estándar.
4. **Given** eventos de otros colegios, **Then** no aparecen en la respuesta (tenant-first).

---

### User Story 3 — Descargar protocolo en PDF (Priority: P2)

Como SCHOOL_ADMIN, quiero descargar el protocolo en PDF para conservarlo o compartirlo en reuniones institucionales.

**Why this priority**: Soporte a la gobernanza escolar; entrega opcional que no bloquea la funcionalidad central.

**Independent Test**: `GET /api/colegio/confianza/protocolo/pdf` devuelve un PDF no vacío con el contenido de `docs/rector/protocolo.md`; un ADMIN recibe 403.

**Acceptance Scenarios**:

1. **Given** el protocolo disponible, **When** hago clic en "Descargar PDF", **Then** se descarga un archivo `.pdf` con nombre `protocolo-<colegio>.pdf`.
2. **Given** un ADMIN, **When** intenta descargar, **Then** recibe 403.

## Edge Cases

- **Sin documentos**: se muestra estado vacío con instrucciones.
- **Sin eventos de auditoría**: tabla vacía, sin errores.
- **`dias` inválido o mayor a 90**: se ajusta a 90; negativo → 400.
- **Colegio no vigente**: 403 con mensaje de vigencia.
- **Documento markdown con contenido no soportado**: se ignora silenciosamente o se renderiza como texto plano (según `Markdown`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Página `/dashboard/colegio/confianza` accesible para `SCHOOL_ADMIN` bajo módulo `colegios_gestion`.
- **FR-002**: Documentos fuente en `docs/rector/transparencia.md`, `docs/rector/protocolo.md` y `docs/rector/compromiso.md` (allowlist cerrada).
- **FR-003**: Renderizado Markdown seguro vía componente `Markdown` existente (sin `dangerouslySetInnerHTML`).
- **FR-004**: Endpoint `GET /api/colegio/confianza/auditoria?dias=N` para `SCHOOL_ADMIN`; default 90, máx 90.
- **FR-005**: Endpoint devuelve solo eventos con `colegioId` del usuario; excluye campos sensibles (IPs hasheadas se muestran como `sha256:...` o resumidas).
- **FR-006**: Paginación estándar `page`/`pageSize` (default 25, máx 100).
- **FR-007**: Endpoint `GET /api/colegio/confianza/protocolo/pdf` para descargar PDF del protocolo.
- **FR-008**: Rate limit `admin_read` en endpoints.
- **FR-009**: No se toca `src/lib/ai/**`; `arch:check` y `tokens:check` verdes.
- **FR-010**: Tests de integración: lectura de documentos, auditoría 90d, 403 para ADMIN.

### Key Entities

- **DocumentoConfianza**: `{ clave: string; titulo: string; ruta: string; }`.
- **EventoAuditoriaColegio**: `{ id: string; accion: string; tipoRecurso: string; recursoId?: string; usuarioId?: string; fecha: string; resumen?: string; }`.
- **AuditoriaQuery**: `{ dias: number; page: number; pageSize: number; }`.

## Success Criteria *(mandatory)*

- **SC-001**: SCHOOL_ADMIN ve documentos de transparencia/protocolo renderizados de forma segura.
- **SC-002**: SCHOOL_ADMIN consulta auditoría del colegio de hasta 90 días, paginada y sin PII.
- **SC-003**: ADMIN y otros roles reciben 403 en endpoints y página.
- **SC-004**: `tsc`, `lint`, `tokens:check`, `arch:check`, `test:coverage` y `build` verdes.

## Assumptions

- Se reutiliza el componente `Markdown` de SPEC-017 y el lector `leerDocumento`.
- Se crean los archivos Markdown fuente en `docs/rector/` como parte de esta spec.
- El modelo `AuditLog` ya almacena `colegioId` para eventos del colegio.
- El PDF se genera con `pdfmake` o `@react-pdf/renderer` (ya dependencias del proyecto).

## Impacto en arquitectura:

Añade página `/dashboard/colegio/confianza`, endpoints `/api/colegio/confianza/auditoria` y `/api/colegio/confianza/protocolo/pdf`, servicio de auditoría del colegio, documentos `docs/rector/*.md` y actualización de la línea base de roles/pantallas. No modifica el modelo de datos. No toca el motor de IA.

## Implementación

- **Documentos**: `docs/rector/transparencia.md`, `docs/rector/protocolo.md` y `docs/rector/compromiso.md`.
- **Servicios**: `src/lib/colegio/confianza-documentos.ts` (allowlist cerrada), `src/lib/colegio/confianza-auditoria.ts` (usa `AuditLogRepository`), `src/lib/colegio/pdf-protocolo.tsx` + `render-protocolo-pdf.ts`.
- **Schemas**: `src/lib/schemas/confianza.ts` valida `dias`/`page`/`pageSize`.
- **Endpoints**: `GET /api/colegio/confianza/documentos`, `GET /api/colegio/confianza/auditoria`, `GET /api/colegio/confianza/protocolo/pdf`.
- **UI**: `src/app/dashboard/colegio/confianza/page.tsx` + `ConfianzaPageClient.tsx` con selector de documento, renderizado Markdown y tabla de auditoría.
- **Tests**: `src/app/api/colegio/confianza/documentos/route.test.ts`, `auditoria/route.test.ts`, `protocolo/pdf/route.test.ts`.
- **Arquitectura**: regenerados `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md`.
- **No se tocó** `src/lib/ai/**`.
