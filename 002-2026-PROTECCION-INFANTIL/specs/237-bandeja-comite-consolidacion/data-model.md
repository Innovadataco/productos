> # Data Model — Bandeja comité CONSOLIDACION + aprobación multi-miembro

**Date**: 2026-08-22
**Feature**: specs/237-bandeja-comite-consolidacion/spec.md

---

## Nota sobre modelos base

Los modelos base `InformeConsolidado`, `PatronExpediente` y `Expediente` se definen en SPEC-234. Esta spec NO crea modelos nuevos; extiende `InformeConsolidado`, el enum/campo de tipo de tarea de bandeja y `AccionAudit`, y documenta los métodos del repositorio.

---

## Cambios de schema Prisma (migración aditiva)

### Extensión del tipo de tarea de bandeja

Añadir valor al enum/campo que representa el tipo de fila en la bandeja del comité:

```prisma
enum TareaBandejaComiteTipo {
  REVISION_REPORTE
  CONSOLIDACION_EXPEDIENTE
}
```

Si el tipo está modelado como `String` en una tabla `TareaBandejaComite`, la migración añade el valor mediante `ALTER TYPE ... ADD VALUE` o actualiza constraint check; nunca DROP.

### Modelo existente modificado: `InformeConsolidado`

```prisma
model InformeConsolidado {
  id                              String    @id @default(cuid())
  expedienteId                    String    @unique
  estadoAprobacion                String    @default("PENDIENTE_CONSOLIDACION")
  resumenTextoGenerado            String    @db.Text
  correccionesJson                Json      @default("[]")
  aprobadoPorMiembrosJson         Json      @default("[]")
  guiaAccionCategoriaIdPrincipal  String?
  motivoDevolucion                String?   @db.Text
  createdAt                       DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt                       DateTime  @updatedAt @db.Timestamptz(6)

  expediente Expediente @relation(fields: [expedienteId], references: [id])

  @@index([expedienteId])
  @@index([estadoAprobacion])
  @@index([createdAt])
  @@map("informes_consolidados")
}
```

**Campos añadidos/modificados por esta spec**:

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `estadoAprobacion` | String | `PENDIENTE_CONSOLIDACION` | Estados: `PENDIENTE_CONSOLIDACION`, `CORREGIDO`, `DEVUELTO`, `APROBADO` |
| `correccionesJson` | Json | `[]` | Array de snapshots `{miembroId, nombre, textoAnterior, textoNuevo, motivo, corregidoEn}` |
| `aprobadoPorMiembrosJson` | Json | `[]` | Array de `{miembroId, nombre, aprobadoEn}` |
| `guiaAccionCategoriaIdPrincipal` | String? | — | FK lógica a `CategoriaConducta`; guía de acción seleccionada por el comité |
| `motivoDevolucion` | String? `@db.Text` | — | Motivo de devolución al área de origen |
| `createdAt` / `updatedAt` | DateTime | — | `@db.Timestamptz(6)` |

### Valores nuevos en `AccionAudit`

```prisma
INFORME_CONSOLIDADO_APROBADO
INFORME_CONSOLIDADO_CORREGIDO
INFORME_CONSOLIDADO_DEVUELTO
```

### Parámetros nuevos en `prisma/seed.ts`

| Clave | Tipo | Default | Categoría | Público | Descripción |
|-------|------|---------|-----------|---------|-------------|
| `padre.comite.miembros_minimos_aprobacion` | INTEGER | `2` | PADRE | false | Mínimo de miembros distintos que deben aprobar un informe consolidado |
| `padre.comite.sla_horas_consolidacion` | INTEGER | `72` | PADRE | false | Horas para SLA de una tarea de consolidación desde su creación |

---

## Entidades leídas (no modificadas)

- **Expediente**: encabezado, estado, eventos/timeline.
- **PatronExpediente**: patrones N1 verificables.
- **CategoriaConducta**: guía de acción sugerida y categoría dominante.
- **Reporte / IdentificadorReportado**: fuente de la señal comunitaria agregada.
- **Usuario / IntegranteComite**: validación de miembros del comité.
- **AuditLog**: registro de acciones del comité.
- **ParametroSistema**: umbral de aprobaciones y SLA.

---

## DTOs / payloads API

### `GET /api/admin/comite/consolidacion?page=1&pageSize=25`

Response 200:

```json
{
  "items": [
    {
      "id": "informe_123",
      "expedienteId": "exp_456",
      "tipo": "CONSOLIDACION_EXPEDIENTE",
      "estadoAprobacion": "PENDIENTE_CONSOLIDACION",
      "categoriaDominante": "Solicitud de material íntimo o sexual",
      "sla": {
        "fechaLimite": "2026-08-25T15:00:00-05:00",
        "color": "pino",
        "vencido": false
      },
      "aprobacionesActuales": 0,
      "aprobacionesRequeridas": 2,
      "createdAt": "2026-08-22T15:00:00-05:00"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 5,
    "totalPages": 1
  }
}
```

### `GET /api/admin/comite/consolidacion/[expedienteId]`

Response 200:

```json
{
  "informe": {
    "id": "informe_123",
    "expedienteId": "exp_456",
    "estadoAprobacion": "PENDIENTE_CONSOLIDACION",
    "resumenTextoGenerado": "Resumen actual del expediente...",
    "guiaAccionCategoriaIdPrincipal": "cat_789",
    "aprobadoPorMiembrosJson": [
      { "miembroId": "usr_001", "nombre": "Ana Pérez", "aprobadoEn": "2026-08-22T16:00:00-05:00" }
    ],
    "correccionesJson": [
      { "miembroId": "usr_002", "nombre": "Luis Gómez", "motivo": "Ajuste redacción", "corregidoEn": "2026-08-22T15:30:00-05:00" }
    ],
    "createdAt": "2026-08-22T15:00:00-05:00",
    "updatedAt": "2026-08-22T16:00:00-05:00"
  },
  "expediente": {
    "id": "exp_456",
    "estado": "PENDIENTE_CONSOLIDACION",
    "identificadorPrincipal": "+573001234567",
    "eventos": [
      { "tipo": "CREACION", "fecha": "2026-08-22T15:00:00-05:00", "descripcion": "Expediente creado" }
    ]
  },
  "patrones": [
    { "id": "pat_001", "tipo": "N1", "descripcion": "Contacto insistente desde múltiples reportes", "verificado": true }
  ],
  "senalComunitaria": {
    "reportesRegistrados": 12,
    "plataformas": ["WhatsApp", "Instagram"],
    "periodo": { "desde": "2026-08-01", "hasta": "2026-08-22" }
  },
  "guiasDisponibles": [
    { "id": "cat_789", "nombre": "Solicitud de material íntimo o sexual" },
    { "id": "cat_012", "nombre": "Contacto insistente o acoso repetido" }
  ],
  "permisos": {
    "puedeAprobar": true,
    "puedeCorregir": true,
    "puedeDevolver": true
  }
}
```

### `POST /api/admin/comite/consolidacion/[expedienteId]/aprobar`

Body: `{}` (la identidad viene de la sesión).

Response 200 (primer aprobación, no umbral):

```json
{
  "informe": { "id": "informe_123", "aprobadoPorMiembrosJson": [...] },
  "aprobo": false,
  "aprobacionesActuales": 1,
  "aprobacionesRequeridas": 2
}
```

Response 200 (umbral alcanzado):

```json
{
  "informe": { "id": "informe_123", "estadoAprobacion": "APROBADO", "aprobadoPorMiembrosJson": [...] },
  "aprobo": true,
  "transicion": { "estadoAnterior": "PENDIENTE_CONSOLIDACION", "estadoNuevo": "EN_APROBACION_PADRE" },
  "evento": "expediente.comite.aprobo"
}
```

Response 409:

```json
{ "error": "El miembro ya aprobó este informe" }
```

### `POST /api/admin/comite/consolidacion/[expedienteId]/corregir`

Body:

```json
{
  "resumenTextoGenerado": "Nuevo resumen corregido...",
  "motivo": "Se ajusta lenguaje a la evidencia",
  "guiaAccionCategoriaIdPrincipal": "cat_012"
}
```

Response 200:

```json
{
  "informe": {
    "id": "informe_123",
    "estadoAprobacion": "CORREGIDO",
    "resumenTextoGenerado": "Nuevo resumen corregido...",
    "correccionesJson": [...],
    "guiaAccionCategoriaIdPrincipal": "cat_012"
  }
}
```

### `POST /api/admin/comite/consolidacion/[expedienteId]/devolver`

Body:

```json
{
  "motivo": "Falta documentación de respaldo del operador"
}
```

Response 200:

```json
{
  "informe": {
    "id": "informe_123",
    "estadoAprobacion": "DEVUELTO",
    "motivoDevolucion": "Falta documentación de respaldo del operador"
  }
}
```

Response 400:

```json
{ "error": "El motivo es obligatorio" }
```

---

## Repositorio `informe-consolidado-repository`

Ubicación tentativa: `src/lib/dal/repositories/informe-consolidado.ts`.

### Métodos a implementar/extender

#### `listarPendientesConsolidacion(opts)`

```ts
async function listarPendientesConsolidacion(opts: {
  page: number;
  pageSize: number;
  tipo?: "REVISION_REPORTE" | "CONSOLIDACION_EXPEDIENTE";
}): Promise<{ items: InformeConsolidadoPendienteDto[]; pagination: Pagination }>
```

Lista informes en estados `PENDIENTE_CONSOLIDACION` y `CORREGIDO`. El filtro `tipo` se aplica sobre la bandeja unificada; si la tarea es `REVISION_REPORTE`, el repositorio no es responsable de esa entidad, pero el servicio de bandeja lo consume.

#### `aprobarPorMiembro(informeId, miembroId)`

```ts
async function aprobarPorMiembro(
  informeId: string,
  miembroId: string
): Promise<{
  informe: InformeConsolidado;
  aprobo: boolean;
  transicion?: { estadoAnterior: string; estadoNuevo: string };
}>
```

- Lee el informe y `aprobadoPorMiembrosJson`.
- Si `miembroId` ya existe en el array → lanza `AppError` 409.
- Añade `{miembroId, aprobadoEn}` al array.
- Lee parámetro `padre.comite.miembros_minimos_aprobacion`.
- Si longitud del array >= umbral:
  - Cambia `estadoAprobacion` a `APROBADO`.
  - Invoca `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')`.
  - Publica evento `expediente.comite.aprobo`.
  - Retorna `aprobo: true` + transición.
- Si no, retorna `aprobo: false`.

#### `corregirTexto(informeId, miembroId, textoNuevo, motivo, guiaAccionCategoriaIdPrincipal?)`

```ts
async function corregirTexto(
  informeId: string,
  miembroId: string,
  textoNuevo: string,
  motivo: string,
  guiaAccionCategoriaIdPrincipal?: string
): Promise<InformeConsolidado>
```

- Lee informe actual.
- Añade snapshot a `correccionesJson`: `{miembroId, textoAnterior, textoNuevo, motivo, corregidoEn}`.
- Actualiza `resumenTextoGenerado` con `textoNuevo`.
- Actualiza `estadoAprobacion` a `CORREGIDO`.
- Si se provee `guiaAccionCategoriaIdPrincipal`, actualízala.
- Persiste y retorna.

#### `devolverConMotivo(informeId, miembroId, motivo)`

```ts
async function devolverConMotivo(
  informeId: string,
  miembroId: string,
  motivo: string
): Promise<InformeConsolidado>
```

- Valida motivo no vacío (Zod ya valida, el repositorio asume saneado).
- Actualiza `estadoAprobacion` a `DEVUELTO`.
- Guarda `motivoDevolucion`.
- Registra `AuditLog`.
- Retorna informe.

---

## Invariantes

- `correccionesJson` nunca se borra; solo se añaden snapshots.
- `aprobadoPorMiembrosJson` nunca tiene duplicados de `miembroId`.
- Un miembro no puede aprobar un informe que él mismo devolvió sin que el expediente vuelva a estado consolidable.
- La transición a `EN_APROBACION_PADRE` ocurre exactamente una vez por informe.
- Todos los timestamps se persisten en UTC (`Timestamptz(6)`) y se muestran en `America/Bogota`.
