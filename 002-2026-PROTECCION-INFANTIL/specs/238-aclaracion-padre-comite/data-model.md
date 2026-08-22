# Data Model: SPEC-238 — Aclaración padre-comité

## Cambios de schema Prisma (migración aditiva)

### Nuevo modelo `AclaracionExpediente`

Modelo exacto brief §7.4:

```prisma
model AclaracionExpediente {
  id                   String    @id @default(cuid())
  expedienteId         String    @unique
  informeConsolidadoId String
  solicitadaEn         DateTime  @db.Timestamptz(6) @default(now())
  solicitudTexto       String    @db.Text
  respondidaEn         DateTime? @db.Timestamptz(6)
  respondidaPor        String?
  respuestaTexto       String?   @db.Text
  estado               String    // PENDIENTE | RESPONDIDA | CERRADA_FORZOSAMENTE
  createdAt            DateTime  @db.Timestamptz(6) @default(now())

  expediente           Expediente         @relation(fields: [expedienteId], references: [id])
  informeConsolidado   InformeConsolidado @relation(fields: [informeConsolidadoId], references: [id])
  respondidaPorUsuario Usuario?           @relation(fields: [respondidaPor], references: [id])

  @@index([expedienteId])
  @@index([informeConsolidadoId])
  @@index([estado])
  @@index([solicitadaEn])
  @@map("aclaracion_expediente")
}
```

Puntos clave:

- `@@unique([expedienteId])` garantiza **máximo una aclaración por expediente** a nivel de base de datos.
- `estado` es `String` (no enum) para respetar el brief; la validación de valores permitidos ocurre en Zod y en el servicio.
- Todos los campos de fecha usan `@db.Timestamptz(6)`.
- `solicitudTexto` y `respuestaTexto` son `@db.Text` y siempre obligatorios en sus respectivos estados.

### Relaciones inversas

En `Expediente` (entrega SPEC-236):

```prisma
aclaracion AclaracionExpediente?
```

En `InformeConsolidado` (entrega SPEC-236):

```prisma
aclaraciones AclaracionExpediente[]
```

En `Usuario`:

```prisma
aclaracionesRespondidas AclaracionExpediente[]
```

### Valores nuevos en `AccionAudit`

```prisma
ACLARACION_SOLICITADA
ACLARACION_RESPONDIDA
ACLARACION_CERRADA_FORZOSAMENTE
```

---

## Cambios de validación (Zod)

En `src/lib/schemas/index.ts`:

```ts
export const estadoAclaracionExpedienteSchema = z.enum([
  "PENDIENTE",
  "RESPONDIDA",
  "CERRADA_FORZOSAMENTE",
]);

export const pedirAclaracionBodySchema = z.object({
  solicitudTexto: z.string().min(1).max(2000),
});

export const responderAclaracionBodySchema = z.object({
  respuestaTexto: z.string().min(1).max(2000),
});
```

---

## DTOs / payloads API

### `POST /api/padre/expediente/[id]/pedir-aclaracion`

Body:

```json
{
  "solicitudTexto": "No entiendo la conclusión sobre el identificador reportado."
}
```

Response 201:

```json
{
  "id": "...",
  "expedienteId": "...",
  "informeConsolidadoId": "...",
  "estado": "PENDIENTE",
  "solicitadaEn": "2026-08-22T20:00:00.000Z",
  "createdAt": "2026-08-22T20:00:00.000Z"
}
```

> El texto de la solicitud no se devuelve en el payload público por defecto; la UI que lo necesite lo lee por separado con permiso.

### `POST /api/admin/comite/aclaracion/[id]/responder`

Body:

```json
{
  "respuestaTexto": "El informe detalla que el identificador aparece en 3 reportes independientes validados."
}
```

Response 200:

```json
{
  "id": "...",
  "expedienteId": "...",
  "estado": "RESPONDIDA",
  "respondidaEn": "2026-08-22T21:00:00.000Z",
  "respondidaPor": "..."
}
```

### `POST /api/padre/expediente/[id]/cerrar-forzoso`

Body: vacío (o `{ "motivo": "opcional" }` si se decide exponer).

Response 200:

```json
{
  "expedienteId": "...",
  "estadoExpediente": "CERRADO",
  "aclaracionEstado": "CERRADA_FORZOSAMENTE"
}
```

---

## Eventos (publicados vía pg-boss)

| Nombre | Disparador | Payload mínimo |
|--------|-----------|----------------|
| `expediente.aclaracion.solicitada` | Al crear aclaración `PENDIENTE` | `{ expedienteId, aclaracionId, informeConsolidadoId }` |
| `expediente.aclaracion.respondida` | Al responder aclaración | `{ expedienteId, aclaracionId, respondidaPor }` |
| `expediente.comite.sla_vencido` | Tick del worker al detectar SLA vencido | `{ expedienteId, aclaracionId, solicitadaEn }` |

---

## Entidades leídas (no modificadas)

- **Expediente**: se lee estado y padre titular; se actualiza vía `aplicarTransicion`.
- **InformeConsolidado**: se vincula en la creación para trazabilidad.
- **Usuario**: se usa `respondidaPor` para el comité y se valida propiedad del padre.
- **ParametroSistema**: clave `padre.comite.sla_horas_normal` (INTEGER, horas) leída por el worker.
- **AuditLog**: registra cambios de estado sin textos.
