# Inventario de PII — Producto 002 (Protección Infantil)

**Versión**: 1.0.0
**Fecha**: 2026-07-20
**Spec**: 046-endurecimiento-seguridad

---

## Resumen ejecutivo

Este documento mapea todos los campos y flujos que pueden contener información de identificación personal (PII) o datos sensibles en la plataforma. El objetivo es facilitar auditorías, retenciones y la verificación de que la anonimización/cifrado funcionan correctamente.

Clasificación de riesgo:

- **Alto**: datos sensibles que se almacenan o transmiten sin cifrado/anonimización y podrían exponerse.
- **Medio**: datos restringidos a usuarios autorizados, pero que siguen siendo PII.
- **Bajo**: datos hasheados, agregados o técnicamente no identificables.

---

## 1. Base de datos

### 1.1 `Usuario`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `email` | String @unique | Medio | Acceso restringido a admin / propietario | Usado para login; no exponer en listados públicos |
| `nombre` | String? | Medio | Acceso restringido | Opcional |
| `passwordHash` | String | Bajo | bcrypt | Nunca exponer |

### 1.2 `CodigoVerificacion`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `email` | String | Medio | Transitorio (15 min) | Usado para envío de código |
| `codigoHash` | String | Bajo | bcrypt | No es PII reversible |

### 1.3 `TokenRecuperacion`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `email` | String | Medio | Transitorio (1 h) | Usado para envío de enlace |
| `tokenHash` | String | Bajo | hash | No es PII reversible |

### 1.4 `ParametroSistema`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `valor` | String | Medio/Alto | Cifrado con `param-encryption` si `esSecreto=true`; plaintext si no | Valores secretos (tokens, claves) cifrados |

### 1.5 `Reporte` (entidad crítica)

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `identificador` | String | Medio | Público bajo umbral de visibilidad | Es el sujeto de la consulta pública |
| `texto` | String @db.Text | **Alto** | Anonimizado tras procesamiento | No exponer en consulta pública |
| `textoOriginal` | String? @db.Text | **Alto** | Cifrado con `param-encryption` | Solo revelar con autorización y audit |
| `numeroSeguimiento` | String? | Medio | Solo para el reportante | No exponer en consulta pública |
| `processingError` | String? @db.Text | **Alto** | Puede contener texto si no se sanitiza | **Acción**: no incluir `reporte.texto` en errores |
| `otraPlataforma` | String? | Bajo | Texto plano | Normalmente no PII |
| `ciudad` / `pais` | String | Bajo | Agregados en consulta pública | No son PII directa |

### 1.6 `ClasificacionIA`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `rawResponse` | String? @db.Text | **Alto** | Puede contener texto del prompt/reporte | Tratar como PII; no exponer en APIs públicas |
| `piiDetectada` | String[] | **Alto** | Fragmentos de PII detectada | No exponer en APIs públicas |
| `categoriasSecundarias` | Json? | Bajo | Categorías | No PII |
| `votos` | Json? | Bajo | Votos de clasificación | No PII |

### 1.7 `IntegranteComite`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `nombres` | String | Medio | Acceso restringido | |
| `apellidos` | String | Medio | Acceso restringido | |
| `numeroIdentificacion` | String | Bajo | **Cifrado** con `param-encryption` | OK |
| `email` | String | Medio | Acceso restringido | |

### 1.8 `ApelacionIdentificador`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `identificador` | String | Medio | Público vía token | |
| `contacto` | String | Medio | Solo admin/apelación | Teléfono o nick de contacto |
| `motivoSolicitud` | String @db.Text | Medio | No exponer en consulta pública | |
| `respuestaAdmin` | String? @db.Text | Medio | Solo admin | |
| `smsCodigoHash` | String? | Bajo | Hash | |

### 1.9 `ContactoConfianza` / `IdentificadorContacto` / `AlertaSuscripcion`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `etiqueta` | String? | Medio | Solo usuario propietario | |
| `nota` | String? @db.Text | Medio | Solo usuario propietario | |
| `valor` | String | Medio | Solo usuario propietario | En `IdentificadorContacto` |
| `identificador` | String | Medio | Solo usuario propietario | En `AlertaSuscripcion` |

### 1.10 `DatasetEntrenamiento` (RAG)

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `texto` | String @db.Text | **Alto** | Debe ser **siempre** la versión anonimizada | **Crítico**: verificar en tests |
| `textoAnonimizado` | Boolean | Bajo | Flag de auditoría | |

### 1.11 `EmbeddingReporte` / `EmbeddingDataset`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `vector` | Unsupported("vector(768)") | Bajo | Embedding numérico | No es reversible a texto exacto, pero puede contener información semántica; tratar como restringido |

### 1.12 `AuditLog`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `metadatos` | Json? | **Alto** | No debe contener texto de reporte ni PII | Verificar en cada llamada a `logAudit` |
| `valorAnterior` / `valorNuevo` | String? | **Alto** | No debe contener PII cruda | Ejemplo: parámetros secretos cifrados |
| `ipAddress` | String | Bajo | Dirección IP | Retención según política |
| `userAgent` | String | Bajo | Agente de usuario | |

### 1.13 `FuenteReporte`

| Campo | Tipo | Riesgo | Tratamiento | Notas |
|-------|------|--------|-------------|-------|
| `ipHash` | String? | Bajo | Hash de IP | OK |
| `fingerprintHash` | String? | Bajo | Hash de fingerprint | OK |

---

## 2. APIs y respuestas

| Endpoint | Datos devueltos | Contiene PII? | Control |
|----------|-----------------|---------------|---------|
| `GET /api/consulta` | Agregados por ciudad, país, plataforma, categoría, timeline | No texto | Verificado: no devuelve `texto` |
| `GET /api/consulta/detalle` | Agregados + items por reporte (sin texto) | No texto | Verificado: no devuelve `texto` |
| `GET /api/reportes/mis-reportes` | Items del usuario propietario | Sí (estado, identificador) | Acceso restringido por cookie |
| `GET /api/admin/dataset-entrenamiento` | Textos anonimizados | Potencial | Filtra `textoAnonimizado=true`; verificar ausencia de PII residual |
| `POST /api/reportes` | Texto crudo de entrada | Sí | Se cifra/anonimiza en procesamiento |
| `GET /api/admin/reportes/[id]/revelar-original` | `textoOriginal` descifrado | Sí | Solo admin/operador; audit `TEXTO_ORIGINAL_REVELADO` |

---

## 3. Logs y trazas

| Ubicación | Riesgo | Control |
|-----------|--------|---------|
| `console.error` en `reportes/procesar` | Alto | Nunca loguear `reporte.texto` ni `textoOriginal` |
| `console.error` en `correcciones` | Medio | Solo loguear errores de anonimización, no el texto |
| `AuditLog.metadatos` | Alto | No incluir texto de reporte |
| Respuestas de error de API | Medio | Sanitizar con `safeErrorMessage()` (US5) |

---

## 4. Minimización aplicada

1. **Anonimización de reportes**: `Reporte.texto` se reemplaza por versión sin PII; `textoOriginal` se cifra.
2. **Dataset de entrenamiento**: solo se alimenta con textos anonimizados; si falla la anonimización, se encola backfill.
3. **Parámetros secretos**: cifrados con AES-256-GCM (`param-encryption`).
4. **Identificación de comité**: `numeroIdentificacion` cifrado.
5. **Fuente de reporte**: IPs y fingerprints hasheados, no almacenados en claro.
6. **Auditoría**: solo metadatos de categoría/estado; nunca texto de reporte.

---

## 5. Acciones pendientes de seguimiento

- [ ] Implementar plan de rotación de `PARAM_ENCRYPTION_KEY` (US6 plan-only en Spec 046).
- [ ] Revisar periódicamente `ClasificacionIA.rawResponse` para detectar fuga accidental de PII en prompts.
- [ ] Evaluar retención de `AuditLog` (>5 años según constitución) y políticas de purga.
- [ ] Considerar cifrado de `Reporte.texto` en reposo además de anonimización.
