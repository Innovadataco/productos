# Data Model: Frontend Público y Flujo de Reporte

**Date**: 2026-07-14
**Feature**: specs/003-frontend-publico/spec.md

## Entities

### Pais (Catálogo global)

Catálogo de países. Es un catálogo global: no lleva `tenantId` (constitución §4.5).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String (CUID) | PK | |
| codigo | String | Unique | ISO 3166-1 alpha-2, ej: `"CO"`, `"MX"` |
| nombre | String | | Ej: `"Colombia"` |
| esActivo | Boolean | Default: true | Soft-delete |
| creadoEn | DateTime | Default: now() | |

**Indexes**: `@@index([codigo])`, `@@index([esActivo])`

**Relations**:
- `ciudades`: `Ciudad[]` (1:N)
- `reportes`: `Reporte[]` (1:N, via `paisId`)

---

### Ciudad (Catálogo global)

Catálogo de ciudades por país. Es un catálogo global: no lleva `tenantId`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String (CUID) | PK | |
| nombre | String | | Ej: `"Bogotá"` |
| paisId | String | FK → Pais.id | |
| esActivo | Boolean | Default: true | Soft-delete |
| creadoEn | DateTime | Default: now() | |

**Indexes**: `@@index([paisId])`, `@@index([esActivo])`

**Relations**:
- `pais`: `Pais` (N:1)
- `reportes`: `Reporte[]` (1:N, via `ciudadId`)

---

### Reporte (Ampliación)

**Decision**: Reporte guarda **ambos**: FKs (`paisId`, `ciudadId`) para consultas agregadas consistentes, y strings (`pais`, `ciudad`) para preservar el texto exacto del usuario. Los FKs son opcionales para compatibilidad con reportes existentes y para el caso "Otra ciudad" (FK null, string con el texto libre).

Nuevos campos:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| paisId | String? | FK → Pais.id | Null cuando el usuario escribió "Otro" o es reporte antiguo |
| ciudadId | String? | FK → Ciudad.id | Null cuando el usuario escribió "Otra" o es reporte antiguo |
| otraPlataforma | String? | | Nombre escrito cuando seleccionó "Otra" plataforma |

**Relations**:
- `pais`: `Pais?` @relation(fields: [paisId], references: [id])
- `ciudad`: `Ciudad?` @relation(fields: [ciudadId], references: [id])

**Plataforma "Otra"**: Cuando el usuario selecciona "Otra" en el frontend, `plataformaId` apunta a la fila de Plataforma con `clave = "otro"`, y `otraPlataforma` guarda el nombre escrito por el usuario.

---

### Plataforma (existente, ampliado)

La entidad `Plataforma` ya existe en el schema. Se amplía con seed para incluir Roblox y Minecraft.

Campos existentes:
- `id`, `clave` (unique), `nombre`, `categoria`, `esActiva`, `creadoEn`

**Seed mínimo**: whatsapp, instagram, facebook, tiktok, twitter, discord, telegram, snapchat, youtube, twitch, **roblox**, **minecraft**, **otro**

---

## Schema Prisma (fragmentos nuevos)

```prisma
model Pais {
  id       String   @id @default(cuid())
  codigo   String   @unique
  nombre   String
  esActivo Boolean  @default(true)
  creadoEn DateTime @default(now())

  ciudades Ciudad[]
  reportes Reporte[]

  @@index([codigo])
  @@index([esActivo])
}

model Ciudad {
  id       String   @id @default(cuid())
  nombre   String
  paisId   String
  esActivo Boolean  @default(true)
  creadoEn DateTime @default(now())

  pais     Pais     @relation(fields: [paisId], references: [id])
  reportes Reporte[]

  @@index([paisId])
  @@index([esActivo])
}
```

Ampliación de `Reporte`:
```prisma
model Reporte {
  // ... campos existentes ...
  paisId         String?
  ciudadId       String?
  otraPlataforma String?
  // ciudad y pais (String) ya existen

  pais           Pais?       @relation(fields: [paisId], references: [id])
  ciudad         Ciudad?     @relation(fields: [ciudadId], references: [id])
  // plataforma ya existe
}
```

---

## Seed: Latinoamérica (alcance)

**Principio**: No exhaustivo. Capitales + principales ciudades por país. ~8-10 ciudades por país máximo.

**Países** (18):
Colombia (CO), México (MX), Argentina (AR), Brasil (BR), Chile (CL), Perú (PE), Ecuador (EC), Venezuela (VE), Uruguay (UY), Paraguay (PY), Bolivia (BO), Costa Rica (CR), Panamá (PA), Guatemala (GT), República Dominicana (DO), Honduras (HN), El Salvador (SV), Nicaragua (NI).

**Ejemplo — Colombia**:
Bogotá (capital), Medellín, Cali, Barranquilla, Cartagena, Bucaramanga, Pereira, Manizales, Cúcuta, Ibagué.

**Ejemplo — México**:
Ciudad de México (capital), Guadalajara, Monterrey, Puebla, Tijuana, León, Cancún, Mérida.

---

## Migration Strategy

1. `npx prisma migrate dev --name add_pais_ciudad` (no `db push` — constitución §2.1)
2. Seed con `prisma/seed.ts` o script dedicado
3. Reportes existentes: `paisId` y `ciudadId` quedan null; siguen funcionando con strings