# Data Model — 009 Configuración: Empresas y Usuarios en cascada

**Fecha**: 2026-07-23 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Gate**: [REVISION-ZEUS-003.md](./REVISION-ZEUS-003.md)

**Principio (constitución §1.2)**: cambios **ADITIVOS**. La spec 009 **NO crea tablas nuevas**:
reusa el esquema `sicov` existente y añade **una sola columna** (`usm_submodulo_id`) + índices.
La única tabla nueva del 003 en esta tanda (`tbl_api_llamadas`) pertenece a la spec 013 —
ver [013/data-model.md](../013-consola-apis/data-model.md).

---

## 1. Entidades REUSADAS (sin cambio de esquema)

| Modelo Prisma | Tabla | Uso en 009 |
|---|---|---|
| `ProveedorVigilado` | `tbl_proveedores_vigilados` | Empresa+token: `tpv_empresa`, `tpv_documento` (NIT), `tpv_token` (uuid, nullable), `tpv_fecha_inicial/final`, `tpv_estado`. CRUD rol 1; desactivación lógica |
| `Usuario` | `tbl_usuarios` | Admin de empresa (rol 2) por join lógico NIT (`usn_identificacion == tpv_documento`); operadores (rol 3) por `usn_administrador = NIT`. `usn_token_autorizado` sincroniza con `tpv_token` |
| `Modulo` | `tbl_modulos` | Catálogo del menú; se siembra `configuracion` por NOMBRE |
| `Submodulo` | `tbl_submodulos` | Granularidad ya modelada (`smod_modulo`); se puebla por seed |
| `UsuarioModulo` | `tbl_usuarios_modulos` | Permisos por usuario; **gana la columna aditiva** |
| `Rol`, `RolModulo`, `Funcionalidad`, `RolModuloFuncionalidad` | (varias) | Sin cambios; techo por rol futuro fuera de alcance |

### Reglas de identidad y unicidad (server-side, G2/G3)

- **NIT**: la unicidad la garantiza `Usuario.usn_identificacion @unique` (el admin de empresa se
  crea con `identificacion = NIT`). `tpv_documento` NO es único en BD; el 409 por NIT duplicado se
  materializa por el `@unique` del usuario admin + validación server-side previa. (G3)
- **Token de empresa (`tpv_token`)**: **único operativamente, validado SERVER-SIDE** — NO se añade
  índice único en BD (la columna es `nullable` y podría colisionar con filas legacy sin token).
  Antes de crear/modificar token se verifica que ningún otro `ProveedorVigilado` lo tenga → 409.
  (G2, decisión ZEUS-006)

---

## 2. Cambio ADITIVO — `UsuarioModulo` (la ÚNICA migración de 009)

### 2.1 Columna nueva (Prisma)

```prisma
model UsuarioModulo {
  id          Int       @id @default(autoincrement()) @map("usm_id")
  usuarioId   Int?      @map("usm_usuario_id")
  moduloId    Int?      @map("usm_modulo_id")
  submoduloId Int?      @map("usm_submodulo_id")   // ← ADITIVA, nullable: NULL = módulo completo
  estado      Boolean?  @default(true) @map("usm_estado")
  creado      DateTime? @default(now()) @map("usm_creado") @db.Timestamptz()
  actualizado DateTime? @default(now()) @map("usm_actualizado") @db.Timestamptz()

  usuario   Usuario?   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  modulo    Modulo?    @relation(fields: [moduloId], references: [id], onDelete: Cascade)
  submodulo Submodulo? @relation(fields: [submoduloId], references: [id], onDelete: Cascade)  // ← nueva

  // ⚠️ SIN @@unique de Prisma: la unicidad va por índices PARCIALES en el SQL manual (§2.2, B1).
  @@map("tbl_usuarios_modulos")
  @@schema("sicov")
}
```

`Submodulo` gana la back-relation `usuariosModulos UsuarioModulo[]`.

### 2.2 Índices únicos PARCIALES (B1) — SQL editado a mano (`--create-only`)

**Por qué NO `@@unique([usuarioId, moduloId, submoduloId])`**: en PostgreSQL los `NULL` son
**distintos entre sí** en un índice único, así que dos filas `(5, 4, NULL)` (usuario 5,
mantenimientos, módulo completo) serían **ambas admitidas** — se pierde la garantía de "una sola
fila de módulo completo por usuario". La unicidad se declara con **dos índices parciales**:

```sql
-- 1) retirar el unique viejo (una sola columna de par)
ALTER TABLE sicov.tbl_usuarios_modulos DROP CONSTRAINT tbl_usuarios_modulos_usm_usuario_id_usm_modulo_id_key;

-- 2) columna aditiva + FK
ALTER TABLE sicov.tbl_usuarios_modulos ADD COLUMN usm_submodulo_id INT NULL;
ALTER TABLE sicov.tbl_usuarios_modulos
  ADD CONSTRAINT tbl_usuarios_modulos_usm_submodulo_id_fkey
  FOREIGN KEY (usm_submodulo_id) REFERENCES sicov.tbl_submodulos(smod_id) ON DELETE CASCADE;

-- 3) unicidad B1: dos índices únicos PARCIALES
CREATE UNIQUE INDEX ux_usmod_completo  ON sicov.tbl_usuarios_modulos (usm_usuario_id, usm_modulo_id)                   WHERE usm_submodulo_id IS NULL;
CREATE UNIQUE INDEX ux_usmod_submodulo ON sicov.tbl_usuarios_modulos (usm_usuario_id, usm_modulo_id, usm_submodulo_id) WHERE usm_submodulo_id IS NOT NULL;
```

> El nombre exacto del constraint viejo se confirma con `\d sicov.tbl_usuarios_modulos` en la
> revisión manual del SQL (gate B1). `pg_dump` previo obligatorio.

### 2.3 Semántica de filas y regla de exclusión (B2)

| Fila | Significado |
|---|---|
| `(usuario, mantenimientos, NULL)` | Módulo **completo** (todos sus submódulos) |
| `(usuario, mantenimientos, preventivos)` | **Solo** ese submódulo |

**B2 — exclusión completo ↔ submódulo (server-side, no por índice):** por `(usuario, módulo)`
existe **o UNA fila NULL o N filas de submódulo, NUNCA ambas**. El servicio, en la MISMA
transacción: al asignar "módulo completo" borra las filas de submódulo de ese módulo; al asignar
submódulos borra la fila NULL. Los índices parciales de B1 no impiden la coexistencia — la
garantiza el servicio (ver [tasks.md](./tasks.md) T018/T025).

---

## 3. Seeds (ADITIVOS, idempotentes, por NOMBRE — I1)

Los ids son `serial`: **se resuelven por NOMBRE**, nunca hardcodeados.

| Entidad | Nombre(s) | Padre |
|---|---|---|
| `Modulo` | `configuracion` (solo rol 1) | — |
| `Submodulo` | `empresas`, `apis` | `configuracion` |
| `Submodulo` | `preventivos`, `correctivos` | `mantenimientos` |
| `Submodulo` (catálogo asignable, sin pantalla) | `alistamiento-diario`, `autorizaciones-nna`, `novedades-*` | 006/007/008 |

---

## 4. Estado y transiciones (empresa)

```
[Activa] --(rol 1 desactiva: tpv_estado=false + usn_estado=false del admin)--> [Inactiva]
[Inactiva] --(rol 1 reactiva)--> [Activa]         # reversible, sin pérdida de datos
```

- NIT **inmutable** tras el alta. Rol **inmutable**. Sin borrado físico (aditivo/reversible).
- Cambio de token: transacción que actualiza `tpv_token` + `usn_token_autorizado` del admin; los
  operadores (rol 3) lo **heredan** por join (sin fila propia).

---

## 5. Correo (no persistente)

La interfaz de correo (`src/lib/correo/`) NO toca BD. El envío va **FUERA** de la transacción de
alta: un fallo de Resend nunca revierte empresa/usuario. Ver plan §3–§4.
