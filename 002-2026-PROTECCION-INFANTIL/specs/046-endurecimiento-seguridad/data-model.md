# Data Model: Endurecimiento de Seguridad (Spec 046)

**Date**: 2026-07-20
**Feature**: specs/046-endurecimiento-seguridad/spec.md

---

## Nota sobre cambios de schema

Esta spec **no modifica** el schema de Prisma. Los cambios son de validación, headers, mensajes de error y tests. El modelo de datos permanece igual; solo se documenta y audita el tratamiento de PII.

---

## Entidades con PII relevantes

### `Usuario`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `email` | String @unique | Acceso restringido; no exponer en respuestas públicas |
| `nombre` | String? | Acceso restringido |
| `passwordHash` | String | bcrypt; nunca exponer |

### `CodigoVerificacion` / `TokenRecuperacion`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `email` | String | Transitorio; usado solo para envío |
| `codigoHash` / `tokenHash` | String | Hash; OK |

### `ParametroSistema`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `valor` | String | Cifrado con `param-encryption` si `esSecreto=true`; plaintext si no es secreto |

### `Reporte`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `texto` | String @db.Text | Anonimizado tras procesamiento |
| `textoOriginal` | String? @db.Text | Cifrado con `param-encryption` |
| `identificador` | String | Público bajo umbral de visibilidad |
| `numeroSeguimiento` | String? | Solo para el reportante |
| `processingError` | String? @db.Text | **Riesgo**: no debe contener texto del reporte |

### `IntegranteComite`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `nombres`, `apellidos` | String | Acceso restringido a admin/comité |
| `numeroIdentificacion` | String | Cifrado con `param-encryption` |
| `email` | String | Acceso restringido |

### `ApelacionIdentificador`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `identificador` | String | Público vía token |
| `contacto` | String | Solo admin/apelación |
| `motivoSolicitud` | String @db.Text | No exponer en consulta pública |
| `respuestaAdmin` | String? @db.Text | Solo admin |
| `smsCodigoHash` | String? | Hash; OK |

### `ContactoConfianza` / `IdentificadorContacto` / `AlertaSuscripcion`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `etiqueta`, `nota`, `valor`, `identificador` | String/Text | Solo usuario propietario |

### `DatasetEntrenamiento`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `texto` | String @db.Text | **Debe ser la versión anonimizada** |
| `textoAnonimizado` | Boolean | Flag de auditoría |

### `ClasificacionIA`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `rawResponse` | String? @db.Text | Puede contener prompt/texto; tratar como PII |
| `piiDetectada` | String[] | Fragmentos de PII; no exponer en APIs públicas |

### `AuditLog`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `metadatos` | Json? | No debe contener texto de reporte ni PII |
| `valorAnterior` / `valorNuevo` | String? | No debe contener PII cruda |

### `FuenteReporte`

| Field | Tipo | Tratamiento |
|-------|------|-------------|
| `ipHash` | String? | Hash de IP; OK |
| `fingerprintHash` | String? | Hash de fingerprint; OK |

---

## Invariantes de seguridad

1. `DatasetEntrenamiento.texto` nunca contiene PII cruda cuando `textoAnonimizado=true`.
2. `Reporte.textoOriginal` siempre está cifrado si no es null.
3. `AuditLog` no almacena texto de reportes ni datos personales en `metadatos`/`valorAnterior`/`valorNuevo`.
4. Los endpoints de consulta pública no devuelven `texto` de `Reporte` ni `rawResponse` de `ClasificacionIA`.
5. Los hashes en `FuenteReporte` no son reversibles a IPs/fingerprint originales.

---

## Relaciones clave

```
Reporte ||--o{ ClasificacionIA : "clasifica"
Reporte ||--o| EmbeddingReporte : "embedding"
ClasificacionIA ||--o| CorreccionAdmin : "corregido"
CorreccionAdmin ||--o| DatasetEntrenamiento : "genera"
DatasetEntrenamiento ||--o| EmbeddingDataset : "embedding"
```

El flujo de PII:

1. Usuario crea `Reporte` con `texto` crudo.
2. Worker detecta PII y anonimiza `texto`, guardando `textoOriginal` cifrado.
3. Operador valida/ corrige; si genera `DatasetEntrenamiento`, el texto guardado es el anonimizado.
4. `EmbeddingDataset` se genera a partir del texto anonimizado.
5. Consulta pública solo ve agregados, nunca texto.

No se requieren cambios de schema para esta spec.
