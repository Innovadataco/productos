> # Data Model — Rol Comité de Validación + escalamiento + gestión de cuenta e integrantes

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

Nuevo flag `esComite` para distinguir perfiles de comité. `OPERADOR` y `COMITE_VALIDACION` son **excluyentes**. Nuevo campo `ultimoEmailNotificacionEn` para controlar la frecuencia de alertas de casos pendientes al comité.

```prisma
model PerfilOperador {
  id                       String    @id @default(cuid())
  usuarioId                String    @unique
  cupoMaximo               Int?
  esRevisorDeApelaciones Boolean   @default(false)
  esComite                 Boolean   @default(false)  // true solo si rol = COMITE_VALIDACION
  notasInternas            String?
  ultimoEmailNotificacionEn DateTime?
  creadoPorId              String
  creadoEn                 DateTime  @default(now())
  actualizadoEn            DateTime  @updatedAt

  usuario   Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  creadoPor Usuario @relation(fields: [creadoPorId], references: [id], name: "OperadoresCreados")
}
```

**Garantía de exclusividad**:
- En CRUD: `rol=OPERADOR` ⇒ `esComite=false`; `rol=COMITE_VALIDACION` ⇒ `esComite=true`.
- En asignación: operadores se filtran `rol=OPERADOR AND esComite=false`; comité `rol=COMITE_VALIDACION AND esComite=true`.
- En creación por email: si existe un usuario con el mismo email y rol distinto en el par `OPERADOR`/`COMITE_VALIDACION`, se rechaza.

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

## Nuevo enum: `TipoIdentificacionIntegrante`

```prisma
enum TipoIdentificacionIntegrante {
  CEDULA_CIUDADANIA
  CEDULA_EXTRANJERIA
  PASAPORTE
  OTRO
}
```

## Nuevo enum: `EstadoIntegranteComite`

```prisma
enum EstadoIntegranteComite {
  ACTIVO
  INACTIVO
}
```

## Nueva tabla: `IntegranteComite`

Representa a una persona real que integra el comité de validación. La cuenta del comité (`Usuario` con rol `COMITE_VALIDACION`) es única; sus integrantes se administran aquí.

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | Identificador único |
| `comiteId` | String | FK → `Usuario.id` | Cuenta del comité a la que pertenece |
| `nombres` | String | | Nombres del integrante |
| `apellidos` | String | | Apellidos del integrante |
| `tipoIdentificacion` | `TipoIdentificacionIntegrante` | | Tipo de documento |
| `numeroIdentificacion` | String | | Número de documento, **cifrado** con param-encryption |
| `email` | String | | Email de contacto del integrante |
| `fechaInicio` | DateTime | `@default(now())` | Fecha de inicio de vigencia |
| `fechaFin` | DateTime? | | Fecha de finalización de vigencia; se setea al inactivar |
| `estado` | `EstadoIntegranteComite` | `@default(ACTIVO)` | `ACTIVO` o `INACTIVO` |
| `creadoPorId` | String | FK → `Usuario.id` | Admin que creó el integrante |
| `modificadoPorId` | String? | FK → `Usuario.id` | Último admin que modificó el integrante |
| `creadoEn` | DateTime | `@default(now())` | Timestamp de creación |
| `actualizadoEn` | DateTime | `@updatedAt` | Timestamp de actualización |

```prisma
model IntegranteComite {
  id                    String                        @id @default(cuid())
  comiteId              String
  nombres               String
  apellidos             String
  tipoIdentificacion    TipoIdentificacionIntegrante
  numeroIdentificacion  String
  email                 String
  fechaInicio           DateTime                      @default(now())
  fechaFin              DateTime?
  estado                EstadoIntegranteComite        @default(ACTIVO)
  creadoPorId           String
  modificadoPorId       String?
  creadoEn              DateTime                      @default(now())
  actualizadoEn         DateTime                      @updatedAt

  comite        Usuario  @relation(fields: [comiteId], references: [id], onDelete: Cascade)
  creadoPor     Usuario  @relation(fields: [creadoPorId], references: [id], name: "IntegrantesComiteCreados")
  modificadoPor Usuario? @relation(fields: [modificadoPorId], references: [id], name: "IntegrantesComiteModificados")

  @@index([comiteId])
  @@index([estado])
  @@index([tipoIdentificacion])
}
```

**Relaciones inversas en `Usuario`**:
```prisma
model Usuario {
  // ... campos existentes ...
  integrantesComite            IntegranteComite[] @relation("IntegrantesComite")
  integrantesComiteCreados     IntegranteComite[] @relation("IntegrantesComiteCreados")
  integrantesComiteModificados IntegranteComite[] @relation("IntegrantesComiteModificados")
}
```

**Cifrado**: `numeroIdentificacion` se cifra con `encryptParameter()` antes de guardar y se descifra con `decryptParameter()` al leer. Para el resto de los campos no se aplica cifrado.

---

## Enum `AccionAudit` modificado

Agregar:
- `COMITE_CREADO`
- `COMITE_ACTIVADO`
- `COMITE_DESACTIVADO`
- `COMITE_PASSWORD_REGENERADA`
- `COMITE_EMAIL_REENVIADO`
- `COMITE_INTEGRANTE_CREADO`
- `COMITE_INTEGRANTE_ACTUALIZADO`
- `COMITE_INTEGRANTE_INACTIVADO`

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

## Parámetros de notificación

```prisma
model ParametroSistema {
  clave: "comite.notificaciones.enabled"
  valor: "true"
  tipo: BOOLEAN
  categoria: EMAIL
}

model ParametroSistema {
  clave: "comite.notificaciones.frecuencia_horas"
  valor: "24"
  tipo: INTEGER
  categoria: EMAIL
}
```

El campo `PerfilOperador.ultimoEmailNotificacionEn` guarda el último envío para respetar la frecuencia configurada por cuenta del comité.

---

## Migraciones

1. `20260718xx_add_rol_comite_validacion`
   - ALTER TYPE `RolUsuario` ADD VALUE `COMITE_VALIDACION`.
   - ALTER TABLE `PerfilOperador` ADD COLUMN `esComite` BOOLEAN DEFAULT false.
   - ALTER TABLE `Reporte` ADD COLUMN `comiteId` TEXT, ADD FK.
2. `20260718xx_add_solicitud_comite`
   - CREATE TABLE `SolicitudComite`.
   - Índices y FKs.
3. `20260718xx_add_integrante_comite`
   - CREATE TYPE `TipoIdentificacionIntegrante`.
   - CREATE TYPE `EstadoIntegranteComite`.
   - ALTER TYPE `AccionAudit` ADD VALUE ... (8 nuevos valores).
   - ALTER TABLE `PerfilOperador` ADD COLUMN `ultimoEmailNotificacionEn` TIMESTAMP.
   - CREATE TABLE `IntegranteComite` con índices y FKs.

---

## Invariantes

- Un usuario no puede ser OPERADOR y COMITE al mismo tiempo.
- Un operador no puede escalar un caso a sí mismo (imposible por exclusividad).
- El comité es último eslabón: no existe escalamiento desde comité a admin.
- El comité no ve quién reportó (igual que operador, gobernado por Spec 025).
- El número de identificación de un integrante del comité siempre se almacena cifrado.
- Solo un admin puede gestionar integrantes del comité.
- Solo existe una cuenta de comité activa por tenant (opcionalmente, validado por lógica de negocio).
