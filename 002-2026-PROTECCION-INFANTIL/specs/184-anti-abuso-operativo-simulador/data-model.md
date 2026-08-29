# Data Model: SPEC-184 — Anti-abuso operativo + simulador de abusos

## Cambios de schema Prisma (migración aditiva)

### Nuevo modelo `BlockList`

```prisma
model BlockList {
  id            String    @id @default(cuid())
  ipHash        String    @unique
  motivo        String
  expiraEn      DateTime?
  creadoPorId   String
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt

  creadoPor Usuario @relation(fields: [creadoPorId], references: [id])

  @@index([ipHash])
  @@map("block_list")
}
```

Relación inversa en `Usuario`:

```prisma
bloqueosCreados BlockList[]
```

### Nuevo modelo `SimulacionAbusoRun`

```prisma
model SimulacionAbusoRun {
  id             String   @id @default(cuid())
  escenario      String
  totalReportes  Int
  progreso       Int      @default(0)
  estado         String   @default("PENDIENTE")
  configJson     Json?
  resultadosJson Json?
  creadoPorId    String
  creadoEn       DateTime @default(now())
  actualizadoEn  DateTime @updatedAt

  creadoPor Usuario @relation(fields: [creadoPorId], references: [id])

  @@index([estado])
  @@index([creadoPorId])
  @@map("simulacion_abuso_runs")
}
```

### Valores nuevos en `AccionAudit`

```prisma
IP_BLOQUEADA
IP_DESBLOQUEADA
SIMULACION_ABUSO_INICIADA
SIMULACION_ABUSO_CANCELADA
SIMULACION_ABUSO_COMPLETADA
```

## Parámetros nuevos en `prisma/seed.ts`

| Clave | Tipo | Default | Categoría | Público | Descripción |
|-------|------|---------|-----------|---------|-------------|
| `alerts.ratelimit.enabled` | BOOLEAN | `true` | SYSTEM | false | Activar alertas por pico de bloqueos |
| `alerts.ratelimit.umbral_bloqueos_hora` | INTEGER | `20` | SYSTEM | false | Bloqueos por IP/hora que disparan alerta |
| `alerts.ratelimit.throttle_min` | INTEGER | `60` | SYSTEM | false | Mínimo entre emails del mismo pico (minutos) |
| `alerts.ratelimit.destinatarios` | STRING | `""` | SYSTEM | false | Emails separados por coma; vacío = no enviar |

## Cambios de validación (Zod)

Nuevos schemas en `src/lib/schemas/index.ts`:

```ts
export const duracionBloqueoSchema = z.enum(["24h", "7d", "permanente"]);

export const bloquearIpBodySchema = z.object({
  ipHash: z.string().min(64).max(64), // sha256 hex
  motivo: z.string().min(1).max(500),
  duracion: duracionBloqueoSchema,
});

export const desbloquearIpBodySchema = z.object({
  id: cuidIdSchema,
});

export const escenarioAbusoSchema = z.enum([
  "robot_inundando",
  "ataque_coordinado",
  "ips_rotativas_fingerprint",
  "denunciante_spam",
  "personalizado",
]);

export const simularAbusoBodySchema = z.object({
  escenario: escenarioAbusoSchema,
  n: z.coerce.number().int().min(1).max(100).optional(),
  ip: z.string().ip().optional(),
  identificador: z.string().min(3).max(100).optional(),
  plataformaId: cuidIdSchema.optional(),
  usuarioId: cuidIdSchema.optional(),
}).refine((data) => {
  if (data.escenario === "personalizado") {
    return data.n !== undefined && data.ip !== undefined && data.identificador !== undefined && data.plataformaId !== undefined;
  }
  return true;
}, { message: "Escenario personalizado requiere n, ip, identificador y plataformaId", path: ["root"] });

export const ventanaTableroSchema = z.enum(["24h", "7d", "30d"]).default("24h");
```

Validación RFC 5737 en `src/lib/anti-abuso/rfc5737.ts`:

```ts
export function esIpRfc5737(ip: string): boolean {
  // IPv4 only
  const [a, b, c, d] = ip.split(".").map(Number);
  if ([a, b, c, d].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}
```

## DTOs / payloads API

### `GET /api/admin/anti-abuso/tablero?ventana=24h`

```json
{
  "ventana": "24h",
  "topIpsBloqueadas": [
    { "ipHash": "sha256:...", "bloqueos": 45, "ultimoBloqueoEn": "2026-08-19T20:00:00Z" }
  ],
  "topIdentificadores": [
    { "identificador": "+573001234567", "plataformaNombre": "WhatsApp", "reportes": 12 }
  ],
  "topFingerprints": [
    { "fingerprintHash": "sha256:...", "reportes": 18 }
  ],
  "alertasActivas": {
    "blockList": [{ "id": "...", "ipHash": "sha256:...", "motivo": "...", "expiraEn": "..." }],
    "incidentes": [{ "id": "...", "senal": "rate_limit:report:sha256:...", "inicio": "..." }]
  }
}
```

### `POST /api/admin/anti-abuso/bloquear`

Body:

```json
{
  "ipHash": "sha256:...",
  "motivo": "Robot inundando desde esta IP",
  "duracion": "24h"
}
```

Response 201:

```json
{
  "blockList": { "id": "...", "ipHash": "sha256:...", "expiraEn": "..." }
}
```

### `POST /api/admin/anti-abuso/simular`

Body:

```json
{
  "escenario": "robot_inundando"
}
```

Response 202:

```json
{
  "runId": "...",
  "estado": "PENDIENTE",
  "totalReportes": 50
}
```

### `GET /api/admin/anti-abuso/simular/[id]`

Response 200:

```json
{
  "id": "...",
  "escenario": "robot_inundando",
  "estado": "EN_PROGRESO",
  "progreso": 23,
  "totalReportes": 50,
  "resultados": {
    "exitosos": 20,
    "bloqueados": 3,
    "spam": 0,
    "latenciaPromedioMs": 85000
  }
}
```

## Entidades leídas (no modificadas)

- `RateLimit`: agregados para tops de bloqueos.
- `FuenteReporte`: agregados para tops de fingerprints.
- `Reporte` / `IdentificadorReportado`: agregados para tops de identificadores.
- `IncidenteInfra`: reutilizado para alertas de pico de rate-limit.
- `AuditLog`: reutilizado para block/unblock y simulaciones.
- `Usuario`: leído para validar `creadoPorId` y `usuarioId` del escenario 4.
