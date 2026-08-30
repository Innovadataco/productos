# Data Model: El comité de convivencia, operativo (SPEC-319)

Solo §2.4 toca el esquema. El resto lee entidades existentes.

## Cambio de esquema (§2.4)

### `SolicitudComite` — agregar `integranteFirmanteId`

```prisma
model SolicitudComite {
  // ... campos existentes ...
  integranteFirmanteId String?           // SPEC-319 §2.4 · quién firma el cierre (cuenta compartida)
  integranteFirmante   IntegranteComite? @relation(fields: [integranteFirmanteId], references: [id])
  // ... relaciones existentes ...
  @@index([integranteFirmanteId])
}
```

- **Tipo**: `String?` (nullable). **Migración aditiva, sin backfill.**
- **Relación**: opcional a `IntegranteComite`. Requiere el lado inverso en `IntegranteComite` (`solicitudesFirmadas SolicitudComite[]`).
- **Validación de negocio** (en servicio, no en esquema): al resolver, `integranteFirmanteId` DEBE referir a un `IntegranteComite` **activo** del mismo `colegioId`. Si no hay activos → error `CONFLICT`/`BAD_REQUEST` con mensaje claro.
- **Filas históricas**: cierres previos quedan con `integranteFirmanteId = NULL` (no había firma antes). Sin migración de datos.
- **Reversibilidad**: eliminar la columna revierte sin pérdida de datos operativos previos a la feature.

## Entidades leídas (sin cambio de esquema)

### `Usuario` (rol `COMITE_CONVIVENCIA`) — §2.1, §2.2
- Cuenta compartida por colegio (`comiteColegioId @unique`).
- §2.2: nace con `estadoActivacion: "INVITADO"`, `tokenInvitacion`, `tokenInvitacionExpiraEn` (antes: `debeCambiarPassword: true` + password temporal). El landing tras activar/login lo decide la fuente única `homeParaRol` (§2.1).

### `IntegranteComite` — §2.3, §2.4
- Directorio documental por colegio (NO usuario). Atributos existentes: nombre, estado activo/inactivo, fechas de creación/actualización.
- §2.3: la UI expone contador (total/activos), estado por fila, edición (endpoint existente), fecha con hora.
- §2.4: los **activos** son la fuente del selector de firmante y el conjunto válido para `integranteFirmanteId`.

### `AuditLog` — §2.4
- El cierre con firmante agrega el `integranteFirmanteId` (y/o nombre) al `valorNuevo` de la acción `COLEGIO_CASO_RESUELTO_POR_COMITE` (ya existe la escritura en `comite-convivencia-bandeja.ts:252`).

## Sin cambio de esquema para §2.1, §2.2, §2.3, §2.5, §2.6

- §2.1: lógica pura de mapeo (sin datos).
- §2.2: reusa campos de invitación ya existentes en `Usuario`.
- §2.3: lee campos existentes de `IntegranteComite`.
- §2.5: rediseño de UI sobre datos ya disponibles (bandeja de casos).
- §2.6: lógica de UI.
