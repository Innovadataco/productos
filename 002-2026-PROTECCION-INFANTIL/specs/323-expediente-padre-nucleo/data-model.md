# Data Model — SPEC-323: El expediente del padre · NÚCLEO

**Date**: 2026-08-30

**Nota**: El esquema de BD ya existe completo para `Expediente` y `EventoExpediente`. Esta SPEC no genera migraciones. El modelo describe las entidades usadas y las relaciones relevantes para el nuevo flujo.

---

## Entidades existentes (sin cambios de schema)

### Reporte

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `identificador` | string | El número/nick/perfil reportado |
| `plataformaId` | UUID | FK → Plataforma |
| `texto` | string (cifrado) | `cifrarTextoReporte(plaintext)` |
| `textoOriginal` | string (cifrado) | `encryptParameter(plaintext)` |
| `fechaIncidente` | Date | |
| `ciudad` | string | Plaintext en BD |
| `pais` | string | Plaintext en BD |
| `esAnonimo` | boolean | |
| `usuarioId` | UUID\|null | null si anónimo |
| `estado` | enum | PENDIENTE, POSIBLE_SPAM, REVISION_MANUAL, etc. |
| `numeroSeguimiento` | string | |
| `creadoEn` | Date | |

**SPEC-323**: `usuarioId` se usa para validar titularidad en el guard de vinculación. `ciudad` y `pais` (plaintext) alimentan la vista de eventos propios y el contexto de otros.

---

### Expediente

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `padreUsuarioId` | UUID | FK → Usuario (PARENT) |
| `identificadorReportado` | string | El identificador que agrupa los eventos |
| `plataformaId` | UUID\|null | FK → Plataforma (opcional) |
| `fechaApertura` | Date | Fecha de creación del expediente |
| `estado` | enum | ACTIVO, CERRADO |
| `scoreGravedadActual` | string | "VERDE" al crear; no se toca en esta SPEC |
| `numEventos` | int | Incrementado atómicamente por `agregarEvento` |
| `ultimoEventoEn` | Date\|null | Actualizado por `agregarEvento` |
| `updatedAt` | Date | |

**SPEC-323**: Se crea vía `crearExpediente()` al 2.º reporte. Se busca vía nuevo método `buscarExpedienteActivo(padreUsuarioId, identificadorReportado)` para evitar duplicados en el 3.er reporte.

---

### EventoExpediente

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `expedienteId` | UUID | FK → Expediente |
| `ordenSecuencial` | int | Calculado atómicamente |
| `reporteId` | UUID\|null | FK → Reporte (vinculado) |
| `fechaEvento` | Date | |
| `texto` | string | Plaintext del evento (puede ser "") |
| `plataforma` | string\|null | |
| `adjuntosMetaJson` | JSON\|null | No usado en esta SPEC |

**SPEC-323**:
- Event #1 (retroactivo): `texto = ""`, `reporteId = reporte1.id`, `fechaEvento = reporte1.creadoEn`
- Event #2: `texto = input.texto` (plaintext del 2.º reporte), `reporteId = reporte2.id`

---

## Flujo de estado

```
POST /api/reportes (1.º reporte)
  → Reporte #1 creado (usuarioId = padre)
  → Sin expediente

POST /api/reportes (2.º reporte, mismo identificador)
  → Servicio detecta duplicado: existente = Reporte #1
  → Sin reportePrevioId → respuesta 200 {oferta: true, reporteExistenteId: reporte1.id}

POST /api/reportes (aceptar oferta, reportePrevioId = reporte1.id)
  → Servicio detecta duplicado: existente = Reporte #1
  → reportePrevioId === existente.id && existente.usuarioId === usuarioId → bypass
  → Reporte #2 creado
  → buscarExpedienteActivo(padre, identificador) → null
  → crearExpediente → Expediente #1
  → agregarEvento(expediente, texto="", reporteId=reporte1.id) → EventoExpediente #1
  → agregarEvento(expediente, texto=input.texto, reporteId=reporte2.id) → EventoExpediente #2
  → Respuesta: {ok: true, reporte: Reporte#2, expediente: Expediente#1}

POST /api/reportes (3.er reporte, mismo identificador)
  → Servicio detecta duplicado: existente = Reporte #2 (el más reciente)
  → Sin reportePrevioId → respuesta 200 {oferta: true, reporteExistenteId: reporte2.id}

POST /api/reportes (aceptar 3.ª oferta, reportePrevioId = reporte2.id)
  → bypass por reportePrevioId
  → Reporte #3 creado
  → buscarExpedienteActivo(padre, identificador) → Expediente #1 (ya existe)
  → agregarEvento(expediente, texto=input.texto, reporteId=reporte3.id) → EventoExpediente #3
```

---

## Queries nuevas necesarias

### GET /api/padre/expedientes/[id] — eventos propios

```
EventoExpediente (donde expedienteId = id AND expediente.padreUsuarioId = usuarioId)
  JOIN Reporte (para ciudad, pais, fechaIncidente, estado/clasificacion)
  SELECT: evento.id, evento.ordenSecuencial, evento.fechaEvento, evento.texto,
          reporte.ciudad, reporte.pais, reporte.fechaIncidente, reporte.estado
  ORDER BY: evento.ordenSecuencial ASC
```

### GET /api/padre/expedientes/[id] — contexto de otros (Ley 1581)

```
Reporte (donde identificador = expediente.identificadorReportado AND usuarioId ≠ padreUsuarioId)
  SELECT SOLO: reporte.fechaIncidente, reporte.ciudad, reporte.pais, reporte.estado
  -- SIN: texto, textoOriginal, usuarioId, email, nombre
  ORDER BY: reporte.creadoEn DESC
  LIMIT: configurable (default 50)
```

**Importante**: La exclusión del texto y del autor es en el `SELECT` del Prisma — no en la capa de presentación. El payload enviado al cliente no contiene esos campos.
