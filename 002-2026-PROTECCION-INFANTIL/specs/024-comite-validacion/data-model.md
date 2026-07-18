> # Data Model — Rol Comité de Validación + escalamiento

**Date**: 2026-07-18
**Feature**: specs/024-comite-validacion/spec.md

---

## Enum modificado: `RolUsuario`

```prisma
enum RolUsuario {
  ADMIN
  SCHOOL_ADMIN
  PARENT
  OPERADOR
  COMITE_VALIDACION
}
```

---

## Modelo existente modificado: `PerfilOperador`

Nuevo flag `esComite` para distinguir perfiles de comité. `OPERADOR` y `COMITE_VALIDACION` son **excluyentes**.

```prisma
model PerfilOperador {
  id                       String   @id @default(cuid())
  usuarioId                String   @unique
  cupoMaximo               Int?
  esRevisorDeApelaciones Boolean  @default(false)
  esComite                 Boolean  @default(false)  // true solo si rol = COMITE_VALIDACION
  notasInternas            String?
  creadoPorId              String
  creadoEn                 DateTime @default(now())
  actualizadoEn            DateTime @updatedAt

  usuario   Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  creadoPor Usuario @relation(fields: [creadoPorId], references: [id], name: "OperadoresCreados")

  @@index([usuarioId])
  @@index([creadoPorId])
  @@index([esComite])
}
```

**Garantía de exclusividad**:
- En CRUD: `rol=OPERADOR` ⇒ `esComite=false`; `rol=COMITE_VALIDACION` ⇒ `esComite=true`.
- En asignación: operadores se filtran `rol=OPERADOR AND esComite=false`; comité `rol=COMITE_VALIDACION AND esComite=true`.

---

## Modelo existente modificado: `Reporte`

Nuevo campo `comiteId` para asignación explícita al comité.

```prisma
model Reporte {
  // ... campos existentes ...
  operadorId String?
  comiteId   String?

  operador Usuario? @relation(fields: [operadorId], references: [id], name: "CasosOperador")
  comite   Usuario? @relation(fields: [comiteId], references: [id], name: "CasosComite")
}
```

**Relación inversa en `Usuario`**:
```prisma
model Usuario {
  // ... campos existentes ...
  casosAsignados      Reporte[] @relation("CasosOperador")
  casosComiteAsignados Reporte[] @relation("CasosComite")
}
```

---

## Nueva tabla: `SolicitudComite`

Representa una escalación de un operador al comité.

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | Identificador único |
| `reporteId` | String | FK → `Reporte.id`, `@unique` | Una solicitud por reporte |
| `numero` | String | `@unique` | Número interno de solicitud (distinto de `RPT-`) |
| `estado` | String | default `"PENDIENTE"` | `PENDIENTE` \| `ASIGNADA` \| `RESUELTA` |
| `comiteId` | String? | FK → `Usuario.id` | Miembro del comité asignado |
| `operadorId` | String? | FK → `Usuario.id` | Operador que escaló |
| `motivo` | String | `@db.Text` | Razón del escalamiento |
| `resolucion` | String? | `@db.Text` | Nota de resolución del comité |
| `creadoEn` | DateTime | `@default(now())` | Timestamp de creación |
| `resueltoEn` | DateTime? | | Timestamp de resolución |

```prisma
model SolicitudComite {
  id         String    @id @default(cuid())
  reporteId  String    @unique
  numero     String    @unique
  estado     String    @default("PENDIENTE")
  comiteId   String?
  operadorId String?
  motivo     String    @db.Text
  resolucion String?   @db.Text
  creadoEn   DateTime  @default(now())
  resueltoEn DateTime?

  reporte  Reporte  @relation(fields: [reporteId], references: [id], onDelete: Cascade)
  comite   Usuario? @relation(fields: [comiteId], references: [id], name: "SolicitudesComite")
  operador Usuario? @relation(fields: [operadorId], references: [id], name: "SolicitudesEscaladas")

  @@index([estado])
  @@index([comiteId])
  @@index([operadorId])
  @@index([creadoEn])
}
```

**Relaciones inversas en `Usuario`**:
```prisma
model Usuario {
  // ... campos existentes ...
  solicitudesComite   SolicitudComite[] @relation("SolicitudesComite")
  solicitudesEscaladas SolicitudComite[] @relation("SolicitudesEscaladas")
}
```

---

## Enum de estados de solicitud

| Valor | Descripción |
|-------|-------------|
| `PENDIENTE` | Creada, sin asignar a un miembro del comité |
| `ASIGNADA` | Asignada a un miembro del comité |
| `RESUELTA` | Resuelta (aceptada/rechazada/clasificada) |

---

## Migraciones

1. `20260718xx_add_rol_comite_validacion`
   - ALTER TYPE `RolUsuario` ADD VALUE `COMITE_VALIDACION`.
   - ALTER TABLE `PerfilOperador` ADD COLUMN `esComite` BOOLEAN DEFAULT false.
   - ALTER TABLE `Reporte` ADD COLUMN `comiteId` TEXT, ADD FK.
2. `20260718xx_add_solicitud_comite`
   - CREATE TABLE `SolicitudComite`.
   - Índices y FKs.

---

## Invariantes

- Un usuario no puede ser OPERADOR y COMITE al mismo tiempo.
- Un operador no puede escalar un caso a sí mismo (imposible por exclusividad).
- El comité es último eslabón: no existe escalamiento desde comité a admin.
- El comité no ve quién reportó (igual que operador, gobernado por Spec 025).
