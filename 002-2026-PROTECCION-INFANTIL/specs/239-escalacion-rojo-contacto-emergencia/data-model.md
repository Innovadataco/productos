# Data Model: SPEC-239 — Escalación ROJO + SLA 12h + Contacto emergencia

## Cambios de schema Prisma (migración aditiva)

### Nuevo modelo `ContactoEmergencia`

```prisma
enum RelacionContactoEmergencia {
  MADRE
  PADRE
  TUTOR
  HERMANO
  OTRO
}

model ContactoEmergencia {
  id             String                     @id @default(cuid())
  padreUsuarioId String
  nombre         String
  relacion       RelacionContactoEmergencia
  telefono       String // E.164 validado en Zod y helper
  email          String?
  prioridad      Int // 1..3
  activo         Boolean                    @default(true)
  createdAt      DateTime                   @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime                   @updatedAt @db.Timestamptz(6)

  padre Usuario @relation(fields: [padreUsuarioId], references: [id])

  @@index([padreUsuarioId, prioridad])
  @@map("contactos_emergencia")
}
```

Relación inversa en `Usuario`:

```prisma
contactosEmergencia ContactoEmergencia[]
```

### Extensión aditiva del modelo `Expediente` (entregado por SPEC-230/SPEC-236)

SPEC-239 NO redefine `Expediente`; solo añade los siguientes campos aditivos para persistir el SLA efectivo al escalar a ROJO:

```prisma
model Expediente {
  // ... campos existentes de SPEC-230/SPEC-236 ...
  slaEfectivoHoras    Int?      // Horas de SLA vigentes (12 al escalar a ROJO)
  fechaEscaladoRojoEn DateTime? @db.Timestamptz(6)
  // ...
}
```

Índices aditivos recomendados:

```prisma
@@index([padreUsuarioId, scoreGravedadActual, estado])
@@index([scoreGravedadActual, estado, fechaEscaladoRojoEn])
```

### Valores nuevos en `AccionAudit`

```prisma
CONTACTO_EMERGENCIA_CREADO
CONTACTO_EMERGENCIA_ACTUALIZADO
CONTACTO_EMERGENCIA_ELIMINADO
CONTACTO_EMERGENCIA_FALLBACK_USADO
EXPEDIENTE_ESCALADO_A_ROJO
EXPEDIENTE_EMERGENCIA_ACTIVADA
EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS
EXPEDIENTE_COMITE_SLA_VENCIDO
```

## Parámetros nuevos en `prisma/seed.ts`

| Clave | Tipo | Default | Categoría | Público | Descripción |
|-------|------|---------|-----------|---------|-------------|
| `padre.comite.sla_horas_gravedad_roja` | INTEGER | `12` | SYSTEM | false | Horas de SLA efectivo al escalar un expediente a gravedad ROJO |

## Catálogo Motor Notif (seed idempotente)

| Evento / Plantilla | Destinatario | Canales | Prioridad | Variables |
|--------------------|--------------|---------|-----------|-----------|
| `expediente.gravedad.subio_a_rojo` | Admin/CEO (parámetro `notificaciones.admin.destinatarios_urgentes`) — plantilla sembrada por SPEC-236 | email, push | URGENTE | `expedienteNumero`, `scoreGravedad`, `tiempoRestanteHoras` |
| `expediente.emergencia.activada` | Contacto prioritario del padre | sms, email | URGENTE | `contactoNombre`, `relacion`, `telefono`, `expedienteNumero`, `padreNombre` |

## Cambios de validación (Zod)

Nuevos schemas en `src/lib/schemas/index.ts`:

```ts
export const relacionContactoEmergenciaSchema = z.enum([
  "MADRE",
  "PADRE",
  "TUTOR",
  "HERMANO",
  "OTRO",
]);

export const contactoEmergenciaBodySchema = z.object({
  nombre: z.string().min(1).max(100),
  relacion: relacionContactoEmergenciaSchema,
  telefono: telefonoE164Schema, // reutilizar helper/schema existente
  email: z.string().email().optional(),
  prioridad: z.number().int().min(1).max(3),
});

export const contactoEmergenciaUpdateSchema = contactoEmergenciaBodySchema.partial();
```

Validación E.164 (helper reutilizado):

```ts
// src/lib/validaciones/telefono.ts (o ubicación existente)
export const telefonoE164Schema = z.string().regex(
  /^\+[1-9]\d{1,14}$/,
  "Teléfono debe estar en formato E.164 (ej. +573001234567)"
);
```

## DTOs / payloads API

### `GET /api/padre/contacto-emergencia`

Response 200:

```json
{
  "items": [
    {
      "id": "cm0...",
      "nombre": "María García",
      "relacion": "MADRE",
      "telefono": "+573001234567",
      "email": "maria@example.com",
      "prioridad": 1,
      "activo": true,
      "createdAt": "2026-08-22T20:00:00.000Z",
      "updatedAt": "2026-08-22T20:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 3,
    "totalPages": 1
  }
}
```

### `POST /api/padre/contacto-emergencia`

Body:

```json
{
  "nombre": "María García",
  "relacion": "MADRE",
  "telefono": "+573001234567",
  "email": "maria@example.com",
  "prioridad": 1
}
```

Response 201:

```json
{
  "contacto": {
    "id": "cm0...",
    "nombre": "María García",
    "relacion": "MADRE",
    "telefono": "+573001234567",
    "email": "maria@example.com",
    "prioridad": 1,
    "activo": true,
    "createdAt": "2026-08-22T20:00:00.000Z",
    "updatedAt": "2026-08-22T20:00:00.000Z"
  }
}
```

### `PATCH /api/padre/contacto-emergencia/[id]`

Body (parcial):

```json
{
  "telefono": "+573009876543",
  "prioridad": 2
}
```

Response 200 con contacto actualizado.

### `DELETE /api/padre/contacto-emergencia/[id]`

Response 204 (baja lógica) o 200 con `{ eliminado: true }`.

### `POST /api/admin/comite/expediente/[id]/activar-emergencia`

Response 200 (éxito):

```json
{
  "expediente": {
    "id": "cm0...",
    "scoreGravedadActual": "ROJO",
    "estado": "PENDIENTE_COMITE",
    "slaEfectivoHoras": 12
  },
  "contacto": {
    "id": "cm0...",
    "nombre": "María García",
    "relacion": "MADRE",
    "telefono": "+573001234567",
    "email": "maria@example.com",
    "prioridad": 1
  },
  "notificacionProgramada": true,
  "eventoPublicado": "expediente.emergencia.activada"
}
```

Response 409 (sin contactos activos):

```json
{
  "error": "No hay contactos de emergencia activos para este padre",
  "code": "SIN_CONTACTOS_EMERGENCIA"
}
```

Response 409 (expediente no ROJO):

```json
{
  "error": "Solo se puede activar emergencia en expedientes con gravedad ROJO",
  "code": "GRAVEDAD_NO_ROJO"
}
```

## Entidades leídas (no modificadas)

- **Usuario**: leído para validar `padreUsuarioId` y rol del comité.
- **Reporte / AlertaColegio**: referenciados por `Expediente` para contexto.
- **Motor Notif**: catálogo/plantillas añadidos; código del motor no modificado.
- **AuditLog**: reutilizado para todas las mutaciones críticas.
