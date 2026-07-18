> # Data Model — Anonimización reforzada + encriptación del original

**Date**: 2026-07-18
**Feature**: specs/025-anonimizacion-reforzada/spec.md

---

## Modelos existentes (campos usados)

### `Reporte`

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `texto` | String @db.Text | Copia anonimizada que circula: se clasifica, entra al RAG, la ven operador/comité |
| `textoOriginal` | String? @db.Text | Texto fiel del denunciante; se cifra con AES-256-GCM |
| `estado` | `EstadoReporte` | Posibles estados `REQUIERE_ANONIMIZACION`, `CLASIFICADO`, `CORREGIDO` |
| `esAnonimo` | Boolean | Indica si el reporte fue anónimo |
| `usuarioId` | String? | FK al denunciante (solo admin bajo autorización estricta) |

### `ClasificacionIA`

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `contienePii` | Boolean | Flag de detección de PII |
| `piiDetectada` | String[] | Lista de entidades PII detectadas |

### `DatasetEntrenamiento`

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `texto` | String @db.Text | Siempre la versión anonimizada |
| `textoAnonimizado` | Boolean | Flag para confirmar que fue anonimizado antes de entrenar |

---

## Nuevos campos (propuestos)

### `Reporte`

| Campo | Tipo | Notas |
|-------|------|-------|
| `anonimizacionValidadaPorId` | String? | FK → `Usuario.id` (operador que validó) |
| `anonimizacionValidadaEn` | DateTime? | Timestamp de validación |

```prisma
model Reporte {
  // ... campos existentes ...
  anonimizacionValidadaPorId String?
  anonimizacionValidadaEn    DateTime?

  anonimizacionValidadaPor Usuario? @relation(fields: [anonimizacionValidadaPorId], references: [id], name: "AnonimizacionesValidadas")
}
```

**Relación inversa en `Usuario`**:
```prisma
model Usuario {
  // ... campos existentes ...
  anonimizacionesValidadas Reporte[] @relation("AnonimizacionesValidadas")
}
```

---

## Nuevo enum de `AccionAudit`

| Valor | Uso |
|-------|-----|
| `TEXTO_ORIGINAL_REVELADO` | Cada vez que un usuario autorizado accede al texto original cifrado |
| `ANONIMIZACION_VALIDADA` | Operador valida que la anonimización es correcta |
| `ANONIMIZACION_RECHAZADA` | Operador solicita ajuste de anonimización |

---

## Encriptación de `textoOriginal`

- Al crear el reporte, `textoOriginal` se cifra con `encryptParameter()` de `src/lib/param-encryption.ts` (AES-256-GCM, prefijo `enc:`).
- Al leer, `decryptParameter()` descifra bajo autorización estricta y se registra `TEXTO_ORIGINAL_REVELADO` en `AuditLog`.
- El campo cifrado sigue siendo `String @db.Text`; el contenido comienza con `enc:`.

---

## Migración

`20260718xx_add_anonimizacion_validacion`

```sql
ALTER TABLE "Reporte" ADD COLUMN "anonimizacionValidadaPorId" TEXT;
ALTER TABLE "Reporte" ADD COLUMN "anonimizacionValidadaEn" TIMESTAMP(3);
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_anonimizacionValidadaPorId_fkey"
  FOREIGN KEY ("anonimizacionValidadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Reporte_anonimizacionValidadaPorId_idx" ON "Reporte"("anonimizacionValidadaPorId");

ALTER TYPE "AccionAudit" ADD VALUE 'TEXTO_ORIGINAL_REVELADO';
ALTER TYPE "AccionAudit" ADD VALUE 'ANONIMIZACION_VALIDADA';
ALTER TYPE "AccionAudit" ADD VALUE 'ANONIMIZACION_RECHAZADA';
```

---

## Invariantes

- `textoOriginal` nunca se expone en APIs públicas ni en endpoints de operador/comité.
- `texto` (anonimizado) es la única versión que circula en clasificación, RAG, consulta pública y dataset.
- Ningún endpoint de operador/comité retorna `email`, `nombre` o `telefono` del denunciante.
- Cada revelación de `textoOriginal` genera `AuditLog` con `accion = TEXTO_ORIGINAL_REVELADO`.
- La validación de anonimización solo puede ser realizada por OPERADOR o ADMIN.
