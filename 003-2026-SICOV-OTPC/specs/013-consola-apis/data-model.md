# Data Model — 013 Consola de APIs (Fase 1)

**Fecha**: 2026-07-23 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

**Principio (constitución §1.2)**: cambio **ADITIVO**. La spec 013 crea **UNA tabla nueva propia
del 003** (`tbl_api_llamadas`, prefijo `apl_` — no existe en el legacy) para la bitácora de la
consola. Reusa el guard de submódulo y el módulo `configuracion`/submódulo `apis` de la spec 009
(no resiembra — ver [009/data-model.md](../009-configuracion-empresas-usuarios/data-model.md)).

---

## 1. Entidad NUEVA — `ApiLlamada` (`tbl_api_llamadas`)

Bitácora de la consola de APIs. **Fase 1: todas las filas `modo = "stub"`.** En Fase 2, las
llamadas reales caen en la MISMA tabla con el mismo esquema (sin reestructura).

```prisma
/// Bitácora de la consola de APIs (spec 013). Fase 1: todas las filas modo=stub.
model ApiLlamada {
  id          Int       @id @default(autoincrement()) @map("apl_id")
  usuarioId   Int       @map("apl_usuario_id")
  rolId       Int?      @map("apl_rol_id")
  nitEfectivo String?   @map("apl_nit_efectivo") @db.VarChar(30)
  operacion   String    @map("apl_operacion") @db.VarChar(60)
  modo        String    @map("apl_modo") @db.VarChar(10)       // "stub" | "real"
  metodo      String?   @map("apl_metodo") @db.VarChar(10)     // GET | POST ...
  endpoint    String?   @map("apl_endpoint") @db.VarChar(255)  // path externo declarado (no secreto)
  request     Json?     @map("apl_request") @db.JsonB          // REDACTADO RECURSIVO + truncado 8 KB
  respuesta   Json?     @map("apl_respuesta") @db.JsonB        // truncada 8 KB
  status      Int?      @map("apl_status")
  duracionMs  Int?      @map("apl_duracion_ms")
  error       String?   @map("apl_error") @db.Text
  creado      DateTime? @default(now()) @map("apl_creado") @db.Timestamptz()

  @@index([creado])
  @@index([operacion])
  @@index([modo])
  @@map("tbl_api_llamadas")
  @@schema("sicov")
}
```

### Notas de columnas (correcciones ZEUS)

- **`request` / `respuesta` → `@db.JsonB`** (no `@db.Json`): indexable y más eficiente para la
  bitácora. (ZEUS-003)
- **Redacción RECURSIVA antes de persistir**: claves sensibles (`clave`, `contrasena`, `token`,
  `tokenAutorizado`, `Authorization`, …) → `"***"` recorriendo objetos y arrays anidados a
  cualquier profundidad; truncado a **8 KB** por columna jsonb. Nunca se persisten valores de
  tokens/cabeceras — solo sus NOMBRES. (ZEUS-003 + §1.3)
- **`modo`** se toma de `modoIntegracion()` (`stub`/`real`); Fase 1 siempre `stub`.
- Fechas en `America/Bogota` (`@db.Timestamptz()`).

### Migración

`add_consola_apis` — solo `CREATE TABLE` + índices (`--create-only` + revisión, `pg_dump` previo).
Puede aplicarse en la MISMA tanda de datos que 009.

---

## 2. Entidad de código (NO BD) — Catálogo de operaciones

Constante tipada en `src/lib/consola-apis/catalogo.ts` (no persistida):

| Campo | Tipo | Nota |
|---|---|---|
| `clave` | string | id estable de la operación |
| `titulo` | string | rótulo UI |
| `metodo` | `"GET" \| "POST"` | método HTTP externo |
| `pathExterno` | string | path declarado (no secreto) |
| `cabeceras` | string[] | **solo NOMBRES**, jamás valores |
| `ejemplo` | object | payload de ejemplo editable |
| `ejecutor` | enum | `postTransaccional` \| `postMantenimiento` \| `getMantenimiento` \| `consultarIntegradora` \| `consultarRutasActivas` \| `consultarAutorizaciones` |
| `opciones` | object? | p. ej. `conVigiladoId` |
| `pendiente` | boolean? | 006/007/008: listadas, NO ejecutables |

`FASE_CONSOLA = 1` (constante en el mismo archivo): candado de fase en CÓDIGO. El mapeo
`ejecutor → método` de `ClienteSupertransporte` es una tabla, no un switch disperso.

---

## 3. Relación con 009

- **Reusa** (no crea): guard `requiereModulo(u,"configuracion","apis")`, módulo `configuracion`
  y submódulo `apis` sembrados por 009 (resueltos por NOMBRE).
- **Independiente**: la migración `add_consola_apis` no depende de la de 009; el orden lógico es
  009 Foundational → 013 (por el guard y el seed del submódulo `apis`).
