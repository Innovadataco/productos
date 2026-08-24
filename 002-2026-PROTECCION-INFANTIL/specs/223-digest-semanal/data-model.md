# Modelo de datos: SPEC-223 — Digest semanal al CEO

## 1. Principios aplicados

- **Migraciones aditivas**: todo es `ADD`/`CREATE`; cero `DROP`, cero cambios de tipo destructivos, cero borrado de datos.
- **Timestamptz(6)** en campos de timestamp nuevos; BD en UTC, cómputo en America/Bogota (D-69).
- **Terminología criolla**: estados y acciones en español, consistente con `EstadoNotificacion`, `EstadoPago`, etc.
- **Cero PII**: el digest persiste solo JSON agregado de negocio; nunca textos de reportes ni identificadores reportados.

## 2. Entidad central: `DigestSemanal`

**Propietario del modelo**: el brief la define en §5.5 y la asigna a SPEC-220 ("Modelos §5.1–5.7"). Esta spec la CONSUME. **Plan B**: si al implementar SPEC-223 el modelo aún no existe en la rama del mega-lote, esta spec lo crea con migración aditiva exactamente como sigue (y SPEC-220 lo omite para no duplicar):

```prisma
model DigestSemanal {
  id             String    @id @default(cuid())
  periodo        String    // semana ISO Bogotá: "2026-W34"
  destinatarioId String    // usuarioId del admin destinatario
  generadoEn     DateTime  @default(now()) @db.Timestamptz(6)
  enviadoEn      DateTime? @db.Timestamptz(6)
  top5Decisiones Json      // [{ titulo, descripcion, accion }]
  kpisSemana     Json      // { recaudoUSD, recaudoCOP, nuevas, canceladas, churnRate, scorePromedio }
  kpisVsPrevia   Json      // deltas vs semana anterior (mismas claves; null si no hay base)
  enlacePanel    String
  estado         String    @default("GENERADO") // GENERADO | ENVIADO | FALLIDO
  motivoFallo    String?   // truncado a 500 chars
  createdAt      DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @db.Timestamptz(6)

  @@unique([periodo, destinatarioId])
  @@index([periodo])
  @@map("digest_semanal")
}
```

Notas de diseño sobre el brief §5.5:

- `estado` pasa a valores criollos en mayúsculas (`GENERADO | ENVIADO | FALLIDO`) por consistencia con `EstadoNotificacion` (D-71).
- Se añade `motivoFallo` (el brief no lo lista) para que el reintento y el diagnóstico no dependan de logs efímeros; es aditivo y nullable.
- `destinatarioId` referencia lógica a `Usuario.id` (admin). Si un destinatario configurado es un email sin usuario en BD, no se crea fila `DigestSemanal` para él (no hay `destinatarioId`); su envío queda en los metadatos del `AuditLog` del digest del sistema. Esto preserva la unicidad `(periodo, destinatarioId)` como mecanismo de idempotencia.
- La relación FK formal a `Usuario` queda a criterio de SPEC-220 si ella crea el modelo (relation inversa aditiva); el plan B de esta spec la incluye solo si se autoriza en la compuerta, para no tocar el modelo `Usuario`.

## 3. Valores aditivos del enum `AccionAudit` (esta spec sí los migra)

```sql
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_DIGEST_GENERADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_DIGEST_ENVIADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_DIGEST_FALLIDO';
```

Se insertan con `logAudit` existente: `tipoRecurso: "DigestSemanal"`, `recursoId: digest.id`, `usuarioId: null`, `ipAddress: "worker"`, `metadatos` con agregados (`periodo`, `destinatarios`, `programadas`, `motivo`).

## 4. Entidades leídas (sin cambios de modelo)

| Entidad | Campos usados | Uso |
|---|---|---|
| `Recomendacion` (SPEC-221) | `estado`, `prioridad`, `titulo`, `descripcion`, `accionSugerida`, `generadaEn` | Top 5: `estado = PENDIENTE`, `ORDER BY prioridad DESC, generadaEn DESC`, take 5 |
| `ScoreCliente` (SPEC-220) | `suscripcionId`, `periodo`, `scoreTotal` | Ganadores/perdedores (top 3 / bottom 3 del período) y `scorePromedio` |
| `Anomalia` (SPEC-225, opcional) | `severidad`, `descripcion`, `detectadaEn` | Sección anomalías (`detectadaEn` en ventana); vacía si el modelo no existe |
| `Suscripcion` (`schema.prisma:723`) | `createdAt`, `canceladaEn`, `estado`, `tipoTitular` | `nuevas` = count `createdAt` en ventana; `canceladas` = count `canceladaEn` en ventana |
| `Pago` (`schema.prisma:759`) | `estado`, `fechaAutorizacion`, `montoNetoUSD`, `montoLocalPagado`, `monedaLocal` | `recaudoUSD` = sum `montoNetoUSD` donde `estado = AUTORIZADO` y `fechaAutorizacion` en ventana; `recaudoCOP` = sum `montoLocalPagado` donde `monedaLocal = 'COP'` |
| `NotificacionRegla` / `NotificacionPlantilla` (`schema.prisma:2311,2329`) | — | Filas sembradas para el evento `analisis.digest.semanal` (ver §5) |
| `ParametroSistema` (`schema.prisma:592`) | — | Filas sembradas `analisis.digest.*` (ver §6) |

**Definiciones de KPI (documentadas aquí como contrato del módulo):**

- `churnRate` = `canceladas_semana / suscripciones_activas_al_inicio_de_la_ventana` (null si el denominador es 0).
- `scorePromedio` = promedio de `ScoreCliente.scoreTotal` del período mensual vigente (null si no hay snapshots).
- `kpisVsPrevia`: mismo cálculo sobre la ventana `[desde - 7d, desde)`; delta absoluto para conteos y puntos porcentuales para tasas.

## 5. Catálogo Motor Notif sembrado (aditivo, idempotente)

Evento y reglas (modelo de `NotificacionRegla`, `schema.prisma:2329`):

| Campo | EMAIL | IN_APP |
|---|---|---|
| `evento` | `analisis.digest.semanal` | `analisis.digest.semanal` |
| `rol` | `ADMIN` | `ADMIN` |
| `offset` | `0m` | `0m` |
| `canal` | `EMAIL` | `IN_APP` |
| `plantillaClave` | `analisis.digest.semanal.email` | `analisis.digest.semanal.in_app` |
| `obligatoria` | `false` | `false` |
| `activa` | `true` | `true` |

Plantillas (`NotificacionPlantilla`, `schema.prisma:2311`): dos filas (`clave` por canal), `cuerpoMarkdown` con la estructura de `plan.md` §5, `variablesSchema` documentando las variables (`periodo`, `fechaInicio`, `fechaFin`, `top5Decisiones`, `tablaKpis`, `numAnomalias`, `anomalias`, `ganadoresPerdedores`, `recomendacionesSistema`, `enlacePanel`). Seed por `upsert` sobre `clave` — idempotente, sin pisar ediciones del admin salvo en primera creación (criterio: `create` si no existe, no `update`, para respetar el editor de plantillas de SPEC-202).

## 6. Parámetros `ParametroSistema` sembrados (prefijo `analisis.digest.*`)

| Clave | Tipo | Categoría | Default | Descripción |
|---|---|---|---|---|
| `analisis.digest.enabled` | BOOLEAN | SYSTEM | `true` | Apaga/prende el job sin deploy |
| `analisis.digest.dia_semana` | INTEGER | SYSTEM | `1` | Día cron (1 = lunes) |
| `analisis.digest.hora_bogota` | INTEGER | SYSTEM | `8` | Hora America/Bogota |
| `analisis.digest.destinatarios_emails` | STRING | SYSTEM | `""` | Correos separados por coma; vacío = todos los ADMIN activos |

Los parámetros base del módulo (`analisis.anomalias.crecimiento_pct_umbral`, etc., brief §5.7) los siembra SPEC-220; esta spec solo usa `crecimiento_pct_umbral` para las recomendaciones del sistema, con fallback al default `25` si aún no existe.

## 7. Índices

- `@@unique([periodo, destinatarioId])` en `DigestSemanal` (idempotencia).
- `@@index([periodo])` para historial por semana.
- Las lecturas sobre `Pago` usan el índice existente `@@index([estado, fechaReporte])` como parcial; si el volumen lo exige se evalúa `@@index([estado, fechaAutorizacion])` aditivo en la implementación (se documenta en `tasks.md`).

## 8. Migración propuesta (aditiva)

```sql
-- 1. Enum (siempre, generada por prisma migrate):
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_DIGEST_GENERADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_DIGEST_ENVIADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_DIGEST_FALLIDO';

-- 2. Tabla DigestSemanal: SOLO si SPEC-220 no la creó antes (plan B §2).
--    Se genera con `npx prisma migrate dev` a partir del bloque Prisma de §2.
```

## 9. Notas de implementación

- El JSON persistido en `DigestSemanal` es la fuente para reenvíos y para el historial; las variables de la plantilla se derivan del mismo objeto para que email y BD nunca diverjan.
- Ningún campo del digest incluye textos de reportes, identificadores reportados ni datos de menores: los nombres visibles son de clientes B2B (colegios / titulares de suscripción), alcance ADMIN.
- Retención: los digest son agregados sin PII; no requieren purga en v1 (criterio distinto a `ScoreCliente`, cuya retención 24m es de SPEC-220).
