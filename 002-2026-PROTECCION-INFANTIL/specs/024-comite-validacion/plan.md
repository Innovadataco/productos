# Plan — Spec 024: Rol Comité de Validación + escalamiento

## Modelos y campos de BD (schema.prisma)

**Decisión cerrada: OPERADOR y COMITE_VALIDACION son EXCLUYENTES.** Un empleado es uno u otro, nunca ambos.

```prisma
enum RolUsuario {
  ADMIN
  SCHOOL_ADMIN
  PARENT
  OPERADOR
  COMITE_VALIDACION
}

model PerfilOperador {
  id                       String   @id @default(cuid())
  usuarioId                String   @unique
  cupoMaximo               Int?
  esRevisorDeApelaciones Boolean  @default(false)
  esComite                 Boolean  @default(false)  // NUEVO; true solo si rol = COMITE_VALIDACION
  notasInternas            String?
  creadoPorId              String
  creadoEn                 DateTime @default(now())
  actualizadoEn            DateTime @updatedAt

  usuario   Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  creadoPor Usuario @relation(fields: [creadoPorId], references: [id], name: "OperadoresCreados")
}
```

**Garantía de exclusividad:**
- A nivel de datos: validación en el helper de creación/edición (`src/lib/operadores/crud.ts`) que impida `rol=OPERADOR` con `esComite=true` o `rol=COMITE_VALIDACION` con `esComite=false`.
- A nivel de asignación: el motor de asignación (Spec 020) filtra `rol=OPERADOR` y `esComite=false` para casos operador; la bandeja del comité filtra `rol=COMITE_VALIDACION` y `esComite=true`.
- Un operador no puede escalar un caso a sí mismo porque nunca será COMITE.

**Modelos existentes modificados:**
- `RolUsuario`: agregar `COMITE_VALIDACION`.
- `PerfilOperador`: agregar `esComite`.
- `Reporte`: ya tiene `operadorId`; se agrega `comiteId` para asignación al comité (más explícito que reusar `operadorId`).

**Nuevo modelo:**

```prisma
model SolicitudComite {
  id              String   @id @default(cuid())
  reporteId       String   @unique
  numero          String   @unique
  estado          String   @default("PENDIENTE") // PENDIENTE | RESUELTA
  comiteId        String?
  operadorId      String?
  motivo          String   @db.Text
  resolucion      String?  @db.Text
  creadoEn        DateTime @default(now())
  resueltoEn      DateTime?

  reporte   Reporte  @relation(fields: [reporteId], references: [id], onDelete: Cascade)
  comite    Usuario? @relation(fields: [comiteId], references: [id], name: "SolicitudesComite")
  operador  Usuario? @relation(fields: [operadorId], references: [id], name: "SolicitudesEscaladas")

  @@index([estado])
  @@index([comiteId])
}
```

**Modelo existente modificado:** `Usuario` agrega relaciones `solicitudesComite` y `solicitudesEscaladas`; `Reporte` agrega `comiteId` y relación `comite`.

**Migraciones:**
1. `2026xxxxxx_add_rol_comite_validacion` (alter enum + flag + comiteId en Reporte).
2. `2026xxxxxx_add_solicitud_comite`.

## Herramientas

- **Reutilizar**: auth/roles existente, `PerfilOperador`, `AuditLog`, asignador ponderado (Spec 020), `ParametroSistema`.
- **Nueva**: ninguna.

## Dependencias

- Requiere **Spec 022** para registrar transiciones de escalamiento/resolución.
- Requiere **Spec 025** para garantizar que el comité no ve datos del denunciante.
- Requiere **Spec 019** (permisos de módulos) si se quiere granular acceso, pero se puede implementar con verificación de rol directa.

## Fases

1. Schema: extender `RolUsuario`, flag `esComite`, modelo `SolicitudComite`.
2. Auth/middleware: permitir `COMITE_VALIDACION`.
3. API de escalamiento: operador crea solicitud, reporte pasa a `REVISION_MANUAL` asignado al comité.
4. API de bandeja del comité: lista, asignación, resolución.
5. UI: bandeja del comité, detalle, acciones.
6. Tests de integración.
