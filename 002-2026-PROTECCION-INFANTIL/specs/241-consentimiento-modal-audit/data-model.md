# Data Model: Consentimiento informado + traza de auditoría (SPEC-241)

**Date**: 2026-08-25  
**Feature**: `specs/241-consentimiento-modal-audit/spec.md`  
**Branch**: `work/002-PI-144`

---

## Cambios en modelo

### `Usuario` (extensión aditiva)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `consentimientoAceptadoEn` | `DateTime?` | opcional | Timestamp UTC de la última aceptación |
| `consentimientoVersion` | `String?` | opcional | Versión del documento aceptada (ej. `v0.4`) |
| `consentimientoDocumentoHash` | `String?` | opcional | Hash SHA256 del documento leído en aceptación |
| `consentimientoIP` | `String?` | opcional | IP desde la que se aceptó |

**Relación**: `Usuario` 1 → N `AuditConsentimiento` (`auditConsentimientos`).

---

### `AuditConsentimiento` (nueva tabla)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` | `@id @default(cuid())` | |
| `usuarioId` | `String` | FK → `Usuario.id`, `ON DELETE CASCADE` | |
| `version` | `String` | | Versión vigente al momento de aceptar |
| `documentoTipo` | `String` | | `POLITICA_DATOS` o `CONVENIO_INSTITUCIONAL` |
| `documentoHash` | `String` | | SHA256 del contenido del documento aceptado |
| `aceptadoEn` | `DateTime` | `@default(now())` | UTC |
| `ip` | `String` | | IP real (`x-forwarded-for` o `unknown`) |
| `userAgent` | `String?` | opcional | User-Agent del request |
| `esRepresentanteLegal` | `Boolean` | `@default(false)` | Flag de representante legal |

**Índices**:

| Fields | Reason |
|--------|--------|
| `(usuarioId, aceptadoEn)` | Historial de aceptaciones por usuario |
| `(version)` | Reportes de versión vigente / re-aceptaciones |

**Invariante**: no existe endpoint, servicio ni migración que edite o borre filas de esta tabla.

---

## Migración

Archivo: `prisma/migrations/20260825054000_consentimiento_audit/migration.sql`

Solo operaciones aditivas:

```sql
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS ...
CREATE TABLE IF NOT EXISTS "audit_consentimientos" ...
CREATE INDEX IF NOT EXISTS ...
ALTER TABLE "audit_consentimientos" ADD CONSTRAINT ... FOREIGN KEY ...
```

Cero `DROP`, `RENAME` o cambios destructivos.

---

## Parámetros de sistema (seed)

Sembrados idempotentemente en `prisma/seed.ts`:

| Clave | Tipo | Valor dev | Descripción |
|-------|------|-----------|-------------|
| `consentimiento.version_actual` | `STRING` | `v0.4` | Versión vigente |
| `consentimiento.padre.documento_ruta` | `STRING` | `public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` | Documento para PARENT/ADMIN/OPERADOR/COMITE_VALIDACION |
| `consentimiento.colegio.documento_ruta` | `STRING` | `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` | Documento para SCHOOL_ADMIN/COMITE_CONVIVENCIA |

## Evento de notificación (seed)

Evento: `consentimiento.aceptado`

- Plantillas: `consentimiento.aceptado.email`, `consentimiento.aceptado.in_app`
- Canales: `EMAIL`, `IN_APP`
- Reglas para roles: `PARENT`, `SCHOOL_ADMIN`, `ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `COMITE_CONVIVENCIA`

---

## Mapeo rol → documento

| Rol | Documento por defecto | Color UI |
|-----|----------------------|----------|
| `PARENT` | `POLITICA_DATOS` | cielo |
| `ADMIN` | `POLITICA_DATOS` | ambar |
| `OPERADOR` | `POLITICA_DATOS` | ambar |
| `COMITE_VALIDACION` | `POLITICA_DATOS` | ambar |
| `SCHOOL_ADMIN` | `CONVENIO_INSTITUCIONAL` | pino |
| `COMITE_CONVIVENCIA` | `CONVENIO_INSTITUCIONAL` | pino |

---

## Entity Relationships

```text
Usuario ||--o{ AuditConsentimiento : "genera"
Usuario ||--o{ AuditLog : "genera (al aceptar)"
ParametroSistema : "configura versión y rutas"
NotificacionRegla : "dispara evento consentimiento.aceptado"
```
