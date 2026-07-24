# Implementation Plan: Oportunidades (evolución de Licitaciones)

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `006-oportunidades`) | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/006-oportunidades/spec.md` (Status: **Aprobada 2026-07-23, D-056**, por ZEUS
y Jelkin, con las decisiones de negocio del CEO ya incorporadas).

## Summary

Convertir "Licitación" en "Oportunidad" —un concepto más amplio— sin perder datos vivos. La
licitación pública pasa a ser **un tipo** dentro de un **catálogo configurable**
(`TipoOportunidad`); `numero` y `fechaApertura` dejan de ser obligatorios y su exigencia la
fija el **tipo** (banderas configurables, nunca un `if` por nombre — §0.7). Se enriquece la
oportunidad con cronograma (5 hitos), presupuesto **desglosado** por partidas, ciudad de
ejecución e info ampliada de la entidad. Se añade un **expediente** de documentos adjuntos
(PDF/Excel) que **no** pasa por el RAG. El listado deja de crear; la creación se queda en su
tab. **No es trabajo pesado.**

## Decisión de identidad técnica (SC-011) — la clave del riesgo

SC-011 autoriza **conservar el identificador técnico interno** si el plan lo justifica.
**Se conserva**: el modelo Prisma sigue llamándose `Licitacion` (tabla `licitaciones`), las
rutas siguen en `/api/licitaciones`, el id de submódulo no cambia. Se renombra **solo el
texto visible** a "Oportunidad(es)" (SC-011, SC-017) y se añade el concepto nuevo donde
importa: el catálogo `TipoOportunidad`.

**Por qué**: el foco de este turno es **cero pérdida de datos** sobre una tabla viva con
semilla. Renombrar el modelo Prisma y las rutas multiplicaría el diff (cada `prisma.licitacion`,
cada consumidor de `/api/licitaciones`) y el riesgo de migración, a cambio de una coherencia
de nombres internos que no ve el usuario. El renombre que el negocio pidió es **conceptual y
de cara al usuario**; eso se cumple entero. Un renombre físico de modelo/rutas, si ZEUS lo
quiere, es un frente propio de bajo valor y alto riesgo, mejor separado de esta migración.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10, React 19.2.4, Prisma 5.22.0, Vitest 4.1.9

**Storage**: PostgreSQL 16 (puerto host 5435). Tabla `licitaciones` **con datos vivos y
semilla** (entidades, estados). La migración es aditiva salvo relajar dos `NOT NULL`.

**Testing**: Vitest en entorno `node`, sin BD ni Ollama (mocks spec 002). Línea base: **249
pruebas en 36 archivos**.

**Constraints**: cero `any` nuevos; cero fugas de `err.message`; gate `npx tsc --noEmit`;
toda ruta con `verifyAuth` + `apiError`; el expediente **no** vectoriza; staging explícito;
puertos 5005/5433/5010/5434 y el RAG intactos.

**Scale/Scope**: 1 migración, ~1 modelo evolucionado + 2 nuevos, ~4 rutas API tocadas + 2
nuevas, seed extendido, UI del módulo (textos + quitar botón).

## Constitution Check

*GATE inicial y re-check post-diseño: **PASS**.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada (D-056); plan y análisis antes de implementar. |
| §0.2 Pruebas | ✅ Toda ruta tocada o nueva con test Vitest; suite verde sin infraestructura. |
| §0.3 Tipado / errores | ✅ Filtros `where` tipados con Prisma; `apiError` en todas; cero `any`. |
| §0.5 Aislamiento | ✅ Solo `001-`. Sin tocar RAG/Base Oficial ni otros productos. No hay trabajo pesado. |
| §0.7 Configurabilidad | ✅ **La obligatoriedad de campos es una propiedad del tipo en BD/UI**, no código con nombres de tipo cableados. El catálogo de tipos es configurable como entidades y estados. |
| §5.1 Rutas públicas | ✅ Toda ruta nueva exige `verifyAuth` (spec 005). |
| §2.6 Subida de archivos | ✅ El expediente valida tipo (PDF/Excel) y tamaño (413), sanea nombre, no expone rutas. |

**Sin violaciones.** Complexity Tracking vacío.

## Cambios exactos por bloque

### Bloque 0 · Esquema y migración (el riesgo — ensayo en BD desechable primero, D-039)

**Modelo `TipoOportunidad`** (nuevo catálogo configurable):

```prisma
model TipoOportunidad {
  id                Int      @id @default(autoincrement())
  key               String   @unique
  nombreOficial     String
  exigeNumero       Boolean  @default(false)
  exigeFechaApertura Boolean @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  oportunidades     Licitacion[]
}
```

`exigeNumero`/`exigeFechaApertura` son **la propiedad configurable** que sustituye cualquier
`if (tipo === "licitacion")`. La UI podrá editarlas.

**`Licitacion`** (evoluciona, tabla intacta):
- `numero String?` y `fechaApertura DateTime?` — **relajar `NOT NULL`** (era obligatorio).
- `tipoId Int?` → FK a `TipoOportunidad` (nullable en el paso 1 de la migración para poder
  backfillear; ver abajo). Nuevo `@@index([tipoId])`.
- `ciudadEjecucion String?` (nuevo).
- **Cronograma**: `fechaApertura` (ya existe, ahora opcional) es el hito *apertura*; se añaden
  `fechaPliegosDefinitivos DateTime?`, `fechaEntregaPropuesta DateTime?`,
  `fechaAdjudicacion DateTime?`, `fechaCierre DateTime?`. Cinco hitos, todos opcionales.
- `presupuesto` → relación con `PartidaPresupuesto[]`.
- `@@unique([numero, fechaApertura])`: **se conserva**; con ambos nullable, Postgres permite
  múltiples `NULL`, así que la unicidad solo ata a las que tienen ambos (las licitaciones
  públicas). Se **documenta** en el esquema (FR-006), no queda accidental.

**`PartidaPresupuesto`** (nuevo, presupuesto desglosado):

```prisma
model PartidaPresupuesto {
  id           String     @id @default(cuid())
  licitacionId String
  concepto     String
  monto        Decimal    @db.Decimal(18, 2)
  moneda       String     @default("COP")
  licitacion   Licitacion @relation(fields: [licitacionId], references: [id], onDelete: Cascade)
  @@index([licitacionId])
}
```

**`EntidadLicitacion`** (info ampliada, aditiva y opcional): `nit String?`, `sitioWeb String?`,
`telefono String?`, `direccion String?`, `ciudad String?`. Todos opcionales → no rompe filas
existentes.

**`LicitacionDocumento`** (expediente): ya existe con `licitacionId` CASCADE. Se reutiliza tal
cual; solo se le da la **ruta de subida** que no tenía (bloque 3).

**Migración `add_oportunidades` — orden seguro sobre datos vivos:**
1. `CREATE TABLE "TipoOportunidad"` + añadir columnas nuevas a `licitaciones` y
   `EntidadLicitacion` (todas nullable o con default) + `CREATE TABLE "PartidaPresupuesto"`.
2. **Sembrar los 3 tipos** dentro de la migración (o inmediatamente después vía seed): licitación
   pública (`exigeNumero=true, exigeFechaApertura=true`), concurso de méritos y contratación
   directa (ambos `false`).
3. **Backfill**: `UPDATE "licitaciones" SET "tipoId" = (id de licitación pública) WHERE "tipoId" IS NULL`.
   Así toda oportunidad existente queda como "licitación pública" conservando su `numero` y
   `fechaApertura` (FR-004).
4. Relajar `numero`/`fechaApertura` a `NULL` **después** del backfill (no antes, para no perder
   la señal de qué era obligatorio).
5. `tipoId` puede quedar nullable a nivel de esquema (una oportunidad sin tipo es un dato
   inválido de negocio, pero la FK nullable evita romper la migración; la validación de la ruta
   exige `tipoId`).

> **RZ-4 / SC-003**: se cuenta `SELECT count(*)` de `licitaciones`, `LicitacionStatus` y
> `EntidadLicitacion` **antes y después** en la BD desechable; deben coincidir. Solo tras eso se
> aplica a la viva con `migrate deploy`, sin bajar el stack.

### Bloque 1 · Catálogo de tipos (US2)

- **`GET/POST /api/licitaciones/tipos`** (nueva ruta, patrón de `entidades`/`estados`): listar y
  crear tipos, con `verifyAuth` + `apiError`. El POST acepta `key`, `nombreOficial`,
  `exigeNumero`, `exigeFechaApertura`.
- **Seed** (`scripts/seed.mjs`): `sembrarPorClave(prisma.tipoOportunidad, ...)` con los 3 tipos,
  idempotente (patrón D-048). El README de arranque limpio suma este catálogo.
- **UI**: submódulo "Tipos" en `SUBMODULES.licitaciones`, con su tab (reutilizando el patrón de
  Entidades/Estados).

### Bloque 2 · Validación por tipo + enriquecimiento (US1, US3)

- **`POST /api/licitaciones`**: la validación deja de exigir `numero`/`fechaApertura` siempre.
  Pasa a: exigir `titulo` y `tipoId`; y exigir `numero`/`fechaApertura` **solo si** el tipo
  referenciado tiene `exigeNumero`/`exigeFechaApertura` (se lee el tipo de BD). Migra el `catch`
  al contrato `apiError` (hoy usa `console.error` + json crudo). Acepta y persiste los campos
  nuevos (cronograma, ciudad, partidas).
- **`PATCH /api/licitaciones/[id]`**: admite editar los campos nuevos; misma validación por tipo.
- **Partidas**: se crean/actualizan junto con la oportunidad (anidado) o por su relación; el
  total se calcula al leer. Monto validado como número ≥ 0; moneda por defecto `COP`.
- **`GET`**: incluye `tipo`, `partidas`, cronograma, ciudad y la entidad ampliada en la
  respuesta.

### Bloque 3 · Expediente (US4) — SIN RAG

- **`POST /api/licitaciones/[id]/documentos`** (nueva): sube un archivo asociado a la
  oportunidad. Valida **tipo** (PDF, `.xlsx`, `.xls`) y **tamaño** (límite con `413`), sanea el
  nombre (`${Date.now()}_${saneado}`), guarda en `uploads/`, crea una fila
  `LicitacionDocumento`. **No** extrae texto, **no** encola, **no** llama al pipeline de
  embeddings (FR-013). `verifyAuth` + `apiError`.
- **`GET /api/licitaciones/[id]/documentos`**: lista el expediente (nombre, tipo, fecha).
- **`DELETE`** del documento o CASCADE al borrar la oportunidad (ya existe la FK CASCADE).
- **Reutiliza** la mecánica de `documents/route.ts` (File de formData, saneo, escritura) pero
  **recorta** todo lo de RAG. La validación de tipo/tamaño se hace **bien** aquí (la de
  documents no la tenía).

### Bloque 4 · Interfaz (US5)

- **Quitar** el botón "Nueva" de `ListadoSubmodulo` (`LicitacionesTab.tsx:220`). La creación
  permanece en `NuevaSubmodulo`.
- **Renombrar textos** visibles "Licitación(es)" → "Oportunidad(es)" en el módulo
  (`LicitacionesTab.tsx`, `LicitacionForm.tsx`, `LicitacionCard.tsx`, `WorkspaceContext.tsx`
  títulos de submódulo). El **formulario** solo cambia textos (RZ-5) y suma los campos nuevos.
- El campo **tipo** aparece en el formulario de creación (selector del catálogo).

### Bloque 5 · Pruebas

- Extender `licitaciones/route.test.ts` y `[id]/route.test.ts`: creación sin numero/fecha para
  tipo que no los exige (SC-001); rechazo para tipo que sí (SC-002); campos nuevos persistidos.
- Nuevos `tipos/route.test.ts` y `[id]/documentos/route.test.ts`: 401 sin sesión, contrato de
  error, validación de tipo/tamaño, y **que el expediente no toca `documentoChunk`** (SC-008,
  con el mock: `expect(prisma.documentoChunk.create).not.toHaveBeenCalled()`).

## Orden de implementación (sin turno)

1. Esquema + migración → **ensayo en BD desechable, verificar SC-003 (cero pérdida)**.
2. Catálogo de tipos (ruta + seed + test).
3. Validación por tipo + enriquecimiento en `licitaciones` (rutas + tests).
4. Expediente (rutas + tests, sin RAG).
5. UI (quitar botón, renombrar textos, sumar campos).
6. Gates: suite ≥ 249, `tsc`, `eslint`, aislamiento. Aplicar migración a la viva **solo tras**
   el ensayo verde.

## Verificación por requisito (resumen; detalle en quickstart.md)

| FR | Cómo se verifica |
|---|---|
| FR-001/FR-004 | migración en desechable: filas conservadas, existentes = "licitación pública" |
| FR-002/FR-003 | ruta de tipos; validación lee `exigeNumero`/`exigeFechaApertura`, sin nombres cableados |
| FR-005 | seed idempotente: 3 tipos, segunda pasada no duplica |
| FR-006 | comentario en el esquema sobre el `@@unique` con nullables |
| FR-007…FR-010 | pruebas de creación con cronograma/partidas/ciudad; entidad ampliada en GET |
| FR-011…FR-015 | pruebas del expediente: tipos aceptados/rechazados, 413, CASCADE, sin chunk |
| FR-013/SC-008 | `expect(prisma.documentoChunk.create).not.toHaveBeenCalled()` |
| FR-016/FR-017 | grep del botón fuera del listado; grep de "Licitación" en textos = 0 |
| FR-019/FR-020 | cada ruta con `verifyAuth`+`apiError`; `tsc` y `eslint` limpios |
| SC-003 | conteo antes/después en desechable y en la viva |

## Riesgos

- **R-01 · Pérdida de datos en la migración** (el riesgo central, RZ-4). Mitigación: orden
  seguro (crear → sembrar → backfill → relajar NOT NULL), **ensayo en BD desechable** con
  conteo antes/después (SC-003), y solo entonces `migrate deploy` en la viva sin bajar el
  stack. `down -v` prohibido.
- **R-02 · Relajar `NOT NULL` antes del backfill** dejaría oportunidades sin tipo. Mitigación:
  el backfill de `tipoId` va **antes** de relajar; el orden está fijado.
- **R-03 · El expediente se cuela al RAG.** Mitigación: la ruta del expediente **no importa**
  nada del pipeline; el test lo blinda (SC-008).
- **R-04 · Churn del renombrado** rompe un consumidor. Mitigación: se conserva el identificador
  técnico (SC-011); solo cambian textos, acotando el diff.
- **R-05 · `Decimal` de Prisma en las pruebas** puede complicar aserciones. Mitigación: los
  tests comparan sobre string/number normalizado; el total se calcula en la ruta, no en el
  cliente.

## Complexity Tracking

Sin violaciones. La única decisión que parece desviación —conservar el nombre técnico
`Licitacion`— está **autorizada por SC-011** y es la que minimiza el riesgo de la migración
sobre datos vivos.
