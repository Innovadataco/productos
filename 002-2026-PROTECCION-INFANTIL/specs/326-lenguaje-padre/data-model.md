# Data Model: Cómo le habla PI al padre (SPEC-326)

Solo §3.4/§3.5 tocan el esquema. §3.1/§3.6 no.

## Cambio de esquema — `Usuario` (aditivo, nullable, sin backfill)

```prisma
model Usuario {
  // ... campos existentes ...
  telefono            String?   // §3.4 perfil
  paisId              String?   // §3.5/§3.4 (FK a Pais)
  ciudadId            String?   // §3.5/§3.4 (FK a Ciudad)
  emailNuevoPendiente String?   // §3.4 correo nuevo esperando verificación (no aplica hasta confirmar)
  // relaciones opcionales al catálogo geográfico existente
  pais    Pais?   @relation(fields: [paisId], references: [id])
  ciudad  Ciudad? @relation(fields: [ciudadId], references: [id])
  @@index([paisId])
  @@index([ciudadId])
}
```

- **Nullable, sin backfill**: cuentas viejas quedan con estos campos en `NULL`; el perfil permite completarlos. Reversible.
- **FK a catálogo geográfico** (`Pais`/`Ciudad` existentes): se confirma el nombre exacto de los modelos en implement (leer el esquema del catálogo). Lado inverso opcional en `Pais`/`Ciudad` (`usuarios Usuario[]`) — evaluar si Prisma lo exige.
- **Correo nuevo pendiente**: `emailNuevoPendiente` guarda el correo aún no verificado; el `email` real no cambia hasta confirmar. El código/expiración se apoya en `CodigoVerificacion` (reuso); si su esquema no encaja para "cambio de email", se agregan `tokenCambioEmail String?` + `tokenCambioEmailExpiraEn DateTime?` — decisión en implement leyendo `CodigoVerificacion`.

## Entidades leídas (sin cambio)

- **CodigoVerificacion** (existente): valida el correo nuevo (§3.4) y ya valida el registro (§3.5 no lo cambia).
- **Pais / Ciudad** (catálogo geográfico, 92.558 ciudades): solo lectura; fuente de país/ciudad.
- **NotificacionPreferencia** (existente): un registro (padre, evento, habilitado) por cada toggle de §3.1; el motor lo respeta. Sin cambio de esquema.

## Sin cambio para §3.1 y §3.6

- §3.1: catálogo curado en código + `NotificacionPreferencia` existente.
- §3.6: `PADRE_NAV_ITEMS` (constante) + layout del padre.
