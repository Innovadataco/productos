> # Data Model — Pipeline de spam + prioridad + reintentos

**Date**: 2026-07-18
**Feature**: specs/026-pipeline-spam-prioridad/spec.md

---

## Enum modificado: `CategoriaConducta`

```prisma
enum CategoriaConducta {
  CONTACTO_INSISTENTE
  SOLICITUD_MATERIAL
  OFRECIMIENTO_REGALOS
  SUPLANTACION_IDENTIDAD
  SOLICITUD_ENCUENTRO
  COMPARTIMIENTO_SEXUAL
  OTRO
  EXTORSION
  CONTENIDO_GENERADO_IA
  DIFUSION_NO_CONSENTIDA
  DOXING
  SPAM
}
```

---

## Modelos existentes (campos usados)

### `Reporte`

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `estado` | `EstadoReporte` | `POSIBLE_SPAM`, `REVISION_MANUAL`, `CLASIFICADO` |
| `prioridadAlta` | Boolean | Indica prioridad alta (autenticado o keyword de riesgo) |
| `esAnonimo` | Boolean | Determina prioridad base |
| `keywordsDetectadas` | String[] | Keywords de alto riesgo que elevan prioridad |

### `ClasificacionIA`

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `categoria` | `CategoriaConducta` | Puede ser `SPAM` |
| `confianza` | Float | Umbral de spam configurable |

### `DatasetEntrenamiento`

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `texto` | String @db.Text | Ejemplos de spam anonimizados |
| `clasificacionCorrecta` | `CategoriaConducta` | `SPAM` para ejemplos de spam |
| `fuente` | String | `"spam_revisado"` |

---

## Nueva tabla: `ReintentoReporte`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | Identificador único |
| `reporteId` | String | FK → `Reporte.id` | Reporte afectado |
| `intento` | Int | | Número de intento (1, 2, 3...) |
| `exitoso` | Boolean | default false | `true` si el intento terminó en éxito |
| `error` | String? | `@db.Text` | Mensaje/error del intento |
| `creadoEn` | DateTime | `@default(now())` | Timestamp |

```prisma
model ReintentoReporte {
  id        String   @id @default(cuid())
  reporteId String
  intento   Int
  exitoso   Boolean  @default(false)
  error     String?  @db.Text
  creadoEn  DateTime @default(now())

  reporte Reporte @relation(fields: [reporteId], references: [id], onDelete: Cascade)

  @@index([reporteId])
  @@index([creadoEn])
}
```

**Relación inversa en `Reporte`**:
```prisma
model Reporte {
  // ... campos existentes ...
  reintentos ReintentoReporte[]
}
```

---

## Parámetros nuevos en `ParametroSistema`

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `clasificacion.umbral_spam` | FLOAT | 0.7 | Confianza mínima para considerar `SPAM` |
| `worker.max_reintentos` | INTEGER | 3 | Máximo de reintentos ante fallo (se define en Spec 027, se consume aquí) |

---

## Migraciones

1. `20260718xx_add_spam_categoria`
   - `ALTER TYPE "CategoriaConducta" ADD VALUE 'SPAM'`.
2. `20260718xx_add_reintento_reporte`
   - CREATE TABLE `ReintentoReporte`.
   - FK e índices.

---

## Invariantes

- `SPAM` no se muestra al público.
- Reporte clasificado como `SPAM` por IA pasa a `POSIBLE_SPAM` o `REVISION_MANUAL` para revisión humana.
- La heurística rápida de ingreso solo juzga volumen (ráfagas/fingerprint), nunca contenido.
- Cada intento de procesamiento se registra en `ReintentoReporte`.
