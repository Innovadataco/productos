# Data Model: SPEC-110 — Apelación del identificador reportado

**Date**: 2026-07-29 | **Migración**: aditiva (sin DROP ni ALTER destructivo)

## Enum nuevo

```prisma
enum EstadoApelacion {
  RECIBIDA      // radicada, en bandeja del comité sin asignar
  EN_REVISION   // tomada por un miembro del comité
  ACEPTADA      // resuelta a favor del apelante (con efectos elegidos)
  RECHAZADA     // resuelta en contra; puede volver a apelar
}
```

## Modelos nuevos

### Apelacion

| Campo | Tipo | Notas |
|-------|------|-------|
| id | String @id @default(cuid()) | |
| numero | String @unique | `APL-<año>-<secuencial opaco>` legible para el caso |
| usuarioId | String | FK Usuario (apelante autenticado) |
| identificador | String | declarado por el apelante (teléfono/nick) |
| plataformaId | String | FK Plataforma |
| motivo | String @db.Text | ≤ 4000 chars |
| esRepresentante | Boolean @default(false) | |
| acreditacion | String? @db.Text | obligatoria si esRepresentante |
| estado | EstadoApelacion @default(RECIBIDA) | |
| comiteId | String? | FK Usuario (miembro del comité que tomó el caso) |
| asignadoEn | DateTime? | |
| plazoRespuestaEn | DateTime | creadoEn + 15 días hábiles (parámetro al radicar) |
| decision | String? | "ACEPTADA"/"RECHAZADA" (redundante con estado, para lectura directa) |
| motivacionResolucion | String? @db.Text | obligatoria al resolver |
| quitoVisibilidad | Boolean @default(false) | efecto elegido al aceptar |
| resueltoPorId | String? | FK Usuario |
| resueltoEn | DateTime? | base del cómputo de retención del documento |
| creadoEn / actualizadoEn | DateTime | |

Índices: `(usuarioId)`, `(estado)`, `(identificador, plataformaId)`, `(creadoEn)`,
`(resueltoEn)`. Restricción de unicidad parcial (índice único con WHERE en SQL) sobre
`(usuarioId, identificador, plataformaId)` para estados abiertos — implementada como
índice único parcial en la migración:
`CREATE UNIQUE INDEX apelacion_abierta_unica ON "Apelacion" ("usuarioId","identificador","plataformaId") WHERE estado IN ('RECIBIDA','EN_REVISION');`
(Prisma no expresa índices parciales en schema; va en el SQL de la migración.)

### DocumentoApelacion

| Campo | Tipo | Notas |
|-------|------|-------|
| id | String @id @default(cuid()) | también es el nombre opaco del `.enc` |
| apelacionId | String | FK Apelacion (Cascade) |
| nombreOriginal | String | solo metadato |
| rutaArchivo | String | ruta absoluta/relativa del `.enc` (fuera de public/) |
| hashSha256 | String | del PDF en claro (integridad) |
| tamanoBytes | Int | |
| mimeType | String | `application/pdf` |
| eliminadoEn | DateTime? | marca de purga (el archivo ya no existe) |
| creadoEn | DateTime | |

Relación N:1 con Apelacion (en esta fase la API admite exactamente 1; el modelo no lo
impide para no re-migrar si se amplía). Índice `(apelacionId)`, `(eliminadoEn)`.

### AccesoDocumentoApelacion

| Campo | Tipo | Notas |
|-------|------|-------|
| id | String @id @default(cuid()) | |
| documentoId | String | FK DocumentoApelacion (Cascade) |
| usuarioId | String | FK Usuario (miembro del comité) |
| ipAddress / userAgent | String | |
| accedidoEn | DateTime @default(now()) | |

Índice `(documentoId)`. Permanente: sobrevive a la purga del archivo (auditoría).

## Cambios aditivos a modelos existentes

- `IdentificadorReportado.ocultoPorComiteEn DateTime?` — marca del ocultamiento decidido
  por el comité. La lee `actualizarVisibilidadPublica`; la levanta SOLO el upsert de
  reporte nuevo (`ocultoPorComiteEn: null`).
- `AccionAudit` += `APELACION_DOCUMENTO_ACCESO`, `APELACION_DOCUMENTO_PURGADO`,
  `APELACION_AVISO_PLAZO` (se reutilizan los huérfanos `APELACION_CREADA` /
  `APELACION_RESUELTA`).
- `Usuario` += relaciones `apelaciones`, `apelacionesAsignadas`, `apelacionesResueltas`,
  `accesosDocumentoApelacion`. `Plataforma` += `apelaciones`.

## Parámetros (ParametroSistema, seed + fallback)

| Clave | Default | Efecto |
|-------|---------|--------|
| `apelacion.plazo_respuesta_dias_habiles` | `15` | plazo legal al radicar |
| `apelacion.aviso_previo_dias` | `10` | umbral del aviso/marca al comité |
| `apelacion.retencion_documento_dias` | `30` | purga del `.enc` tras resolver |
| `apelacion.max_tamano_documento_mb` | `5` | rechazo 413 del upload |

## Ciclo de vida

```text
RECIBIDA --(tomar)--> EN_REVISION --(resolver ACEPTADA)--> ACEPTADA
                                   \-(resolver RECHAZADA)-> RECHAZADA
RECHAZADA: el usuario puede radicar una nueva apelación (la anterior ya no está abierta).
Documento: creado al radicar → accesos auditados → purgado por job a los N días de
`resueltoEn` (metadatos y accesos permanecen).
```
