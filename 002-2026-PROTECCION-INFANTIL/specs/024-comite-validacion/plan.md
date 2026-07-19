# Plan — Spec 024: Rol Comité de Validación + escalamiento + gestión de cuenta e integrantes

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
  id                       String    @id @default(cuid())
  usuarioId                String    @unique
  cupoMaximo               Int?
  esRevisorDeApelaciones Boolean   @default(false)
  esComite                 Boolean   @default(false)  // true solo si rol = COMITE_VALIDACION
  notasInternas            String?
  ultimoEmailNotificacionEn DateTime?                // control de frecuencia de alertas al comité
  creadoPorId              String
  creadoEn                 DateTime  @default(now())
  actualizadoEn            DateTime  @updatedAt

  usuario   Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  creadoPor Usuario @relation(fields: [creadoPorId], references: [id], name: "OperadoresCreados")
}
```

**Garantía de exclusividad:**
- A nivel de datos: validación en el helper de creación/edición (`src/lib/operadores/permisos.ts`) que impida `rol=OPERADOR` con `esComite=true` o `rol=COMITE_VALIDACION` con `esComite=false`.
- A nivel de asignación: el motor de asignación (Spec 020) filtra `rol=OPERADOR` y `esComite=false` para casos operador; la bandeja del comité filtra `rol=COMITE_VALIDACION` y `esComite=true`.
- Un operador no puede escalar un caso a sí mismo porque nunca será COMITE.
- A nivel de email: no se puede crear un COMITE_VALIDACION con un email que ya tenga un OPERADOR (y viceversa).

**Modelos existentes modificados:**
- `RolUsuario`: agregar `COMITE_VALIDACION`.
- `PerfilOperador`: agregar `esComite` y `ultimoEmailNotificacionEn`.
- `Reporte`: ya tiene `operadorId`; se agrega `comiteId` para asignación al comité (más explícito que reusar `operadorId`).
- `AccionAudit`: agregar `COMITE_CREADO`, `COMITE_ACTIVADO`, `COMITE_DESACTIVADO`, `COMITE_PASSWORD_REGENERADA`, `COMITE_EMAIL_REENVIADO`, `COMITE_INTEGRANTE_CREADO`, `COMITE_INTEGRANTE_ACTUALIZADO`, `COMITE_INTEGRANTE_INACTIVADO`.

**Nuevo modelo:**

```prisma
model SolicitudComite {
  id              String   @id @default(cuid())
  reporteId       String   @unique
  numero          String   @unique
  estado          String   @default("PENDIENTE") // PENDIENTE | ASIGNADA | RESUELTA
  comiteId        String?
  operadorId      String?
  motivo          String   @db.Text
  resolucion      String?  @db.Text
  creadoEn        DateTime @default(now())
  resueltoEn      DateTime?

  reporte  Reporte  @relation(fields: [reporteId], references: [id], onDelete: Cascade)
  comite   Usuario? @relation(fields: [comiteId], references: [id], name: "SolicitudesComite")
  operador Usuario? @relation(fields: [operadorId], references: [id], name: "SolicitudesEscaladas")

  @@index([estado])
  @@index([comiteId])
  @@index([operadorId])
  @@index([creadoEn])
}
```

**Nuevo modelo de integrantes:**

```prisma
enum TipoIdentificacionIntegrante {
  CEDULA_CIUDADANIA
  CEDULA_EXTRANJERIA
  PASAPORTE
  OTRO
}

enum EstadoIntegranteComite {
  ACTIVO
  INACTIVO
}

model IntegranteComite {
  id                    String                        @id @default(cuid())
  comiteId              String
  nombres               String
  apellidos             String
  tipoIdentificacion    TipoIdentificacionIntegrante
  numeroIdentificacion  String                        // cifrado con param-encryption
  email                 String
  fechaInicio           DateTime                      @default(now())
  fechaFin              DateTime?
  estado                EstadoIntegranteComite        @default(ACTIVO)
  creadoPorId           String
  modificadoPorId       String?
  creadoEn              DateTime                      @default(now())
  actualizadoEn         DateTime                      @updatedAt

  comite        Usuario @relation(fields: [comiteId], references: [id], onDelete: Cascade)
  creadoPor     Usuario @relation(fields: [creadoPorId], references: [id], name: "IntegrantesComiteCreados")
  modificadoPor Usuario? @relation(fields: [modificadoPorId], references: [id], name: "IntegrantesComiteModificados")

  @@index([comiteId])
  @@index([estado])
  @@index([tipoIdentificacion])
}
```

**Modelo existente modificado:** `Usuario` agrega relaciones `solicitudesComite`, `solicitudesEscaladas`, `integrantesComite`, `integrantesComiteCreados`, `integrantesComiteModificados`; `Reporte` agrega `comiteId` y relación `comite`.

**Migraciones:**
1. `2026xxxxxx_add_rol_comite_validacion` (alter enum + flag + comiteId en Reporte) — ya aplicada.
2. `2026xxxxxx_add_solicitud_comite` — ya aplicada.
3. `2026xxxxxx_add_integrante_comite` (nuevo): enum, tabla, relaciones, índices; agregar `ultimoEmailNotificacionEn` a `PerfilOperador`; extender `AccionAudit`.

## Herramientas

- **Reutilizar**: auth/roles existente, `PerfilOperador`, `AuditLog`, asignador ponderado (Spec 020), `ParametroSistema`, `param-encryption`, email (Resend).
- **Nueva**: `src/lib/operadores/notificacion-comite.ts`.

## Dependencias

- Requiere **Spec 022** para registrar transiciones de escalamiento/resolución.
- Requiere **Spec 025** para garantizar que el comité no ve datos del denunciante.
- Requiere **Spec 019** (permisos de módulos) si se quiere granular acceso, pero se puede implementar con verificación de rol directa.

## Fases

1. Schema: extender `RolUsuario`, flag `esComite`, `ultimoEmailNotificacionEn`, modelo `SolicitudComite`, enum `TipoIdentificacionIntegrante`, modelo `IntegranteComite`, acciones de `AccionAudit`.
2. Auth/middleware: permitir `COMITE_VALIDACION`.
3. API de escalamiento: operador crea solicitud, reporte pasa a `REVISION_MANUAL` asignado al comité; llamar a notificación de comité en background.
4. API de bandeja del comité: lista, asignación, resolución.
5. API de gestión de cuenta comité: espejo de operadores con acciones y mensajes propios; validar exclusividad de email por rol.
6. API de integrantes del comité: CRUD con cifrado/descifrado de identificación.
7. Notificación por email: parámetros, frecuencia y envío.
8. UI: bandeja del comité, detalle, acciones, gestión de cuenta e integrantes.
9. Tests de integración y unitarios.
10. Cierre, commits y deploy.
