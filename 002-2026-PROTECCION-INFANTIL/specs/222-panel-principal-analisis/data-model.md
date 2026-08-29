# Modelo de datos: SPEC-222 — Panel principal Análisis (Dinero vs Valor)

## 1. Principio rector

**Sin cambios de modelo propios.** Esta spec es una capa de lectura/agregación: consume modelos entregados por SPEC-206, SPEC-210/214/215, SPEC-220, SPEC-221 y SPEC-225. No crea tablas, no altera columnas, no añade enums.

Los únicos cambios de datos posibles son **seeds aditivos opcionales** en `ParametroSistema` (ver §4). Cero migraciones destructivas; de hecho, cero migraciones en el escenario base.

## 2. Entidades consumidas (solo lectura salvo indicación)

### 2.1 `ScoreCliente` (entregada por SPEC-220 · brief §5.2)

| Campo | Uso en SPEC-222 |
|-------|-----------------|
| `suscripcionId` | Join con `Suscripcion` para score por fila y dispersión. |
| `periodo` (`"YYYY-MM"`, Bogotá) | Filtro del snapshot vigente del período seleccionado. |
| `scoreTotal` | Eje Y de la dispersión; score promedio por granularidad. |
| `componente*` | No usado en el panel (el desglose vive en la vista cliente, SPEC-220). |
| `percentilEnCohorte` | Tooltips opcionales de la dispersión. |

Regla: filas sin snapshot del período se excluyen de promedios y dispersión (nunca score 0 silencioso).

### 2.2 `Recomendacion` (entregada por SPEC-221 · brief §5.4) — lectura + transición de estado

| Campo | Uso en SPEC-222 |
|-------|-----------------|
| `titulo`, `descripcion`, `categoria`, `prioridad` | Render de cards del Top 5. |
| `estado` (`PENDIENTE\|APLICADA\|IGNORADA\|EXPIRADA`) | Filtro del Top 5; transición a `APLICADA`/`IGNORADA` vía endpoint de resolución. |
| `expiraEn` | Defensa adicional: no mostrar vencidas aunque el worker no las haya marcado. |
| `generadaEn` | Desempate `prioridad DESC, generadaEn ASC`. |
| `sujetoTipo`/`sujetoId`, `datosContexto`, `accionSugerida` | Enlaces de drill y acciones `tel:`/`mailto:` de la card. |
| `resueltaEn`, `resueltaPorAdminId`, `motivoResolucion` | Escritura al resolver (única mutación de esta spec). |

### 2.3 `Anomalia` (entregada por SPEC-225 · brief §5.6) — solo lectura

`tipo`, `severidad` (`BAJA|MEDIA|ALTA`), `descripcion`, `sujetoTipo`/`sujetoId`, `detectadaEn`, `resueltaEn`. Filtro: `resueltaEn IS NULL`. Guard de tabla ausente → `[]`.

### 2.4 Modelos de pagos existentes (SPEC-210/214/215)

- **`Suscripcion`** (`prisma/schema.prisma:723`): eje de agregación — `tipoTitular`, `estado`, `colegioId`, `usuarioId`, `fechaInicio` (cohorte), `esFreemium` + pagos (canal), `codigoReferidoUsado` (canal), `paisCliente` (única geografía de padres).
- **`Pago`** (`schema.prisma:759`): recaudo = `SUM(montoNetoUSD)` con `estado = AUTORIZADO` en rango; LTV = promedio histórico por suscripción.
- **`Plan`** (`schema.prisma:677`): granularidad Plan (`duracion`, `tipoTitular`) y MRR (`precioBaseUSD / meses(duracion)`).
- **`BonoAplicado`** (`schema.prisma:819`) y **`CodigoReferidoUso`** (`schema.prisma:834`): clasificación de canal con precedencia documentada (FR-018).

### 2.5 Modelos operativos existentes

- **`Colegio`** (`schema.prisma:873`): `paisId`, `ciudadId`, `nombre` — niveles País/Ciudad/Colegio.
- **`SesionLog`** (`schema.prisma:640`): MAU = `COUNT(DISTINCT usuarioId)` con actividad en período.
- **`Pais` / `Ciudad`**: etiquetas de los niveles geográficos.

### 2.6 `AuditLog` (existente)

Única escritura además de la resolución: acción de auditoría por recomendación resuelta (adminId, recomendacionId, acción, motivo). Sin texto sensible. Si el enum de acciones no tiene valor adecuado, se añade de forma **aditiva** (`ALTER TYPE ... ADD VALUE IF NOT EXISTS 'RECOMENDACION_RESUELTA'`) — la única migración posible de esta spec.

## 3. Índices

No se requieren índices nuevos: las consultas apoyan en índices existentes (`Suscripcion(estado, fechaFin)`, `Suscripcion(tipoTitular, estado)`, `Pago(suscripcionId, createdAt)`, `Pago(estado, fechaReporte)`, `SesionLog(usuarioId, iniciadaEn)`), más los que SPEC-220/221/225 definan para sus tablas (`ScoreCliente(suscripcionId, periodo)` único, `Recomendacion(estado, prioridad, generadaEn)`, `Anomalia(severidad, detectadaEn)`).

## 4. Seeds aditivos opcionales (`ParametroSistema`)

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `analisis.panel.umbral_monto_usd` | FLOAT | *(vacío = mediana)* | Corte fijo del eje X de cuadrantes; si existe, reemplaza la mediana |
| `analisis.panel.umbral_score` | FLOAT | *(vacío = mediana)* | Corte fijo del eje Y de cuadrantes |
| `analisis.panel.dispersion_max_puntos` | INTEGER | 500 | Límite de puntos de la dispersión antes de truncar |

Upsert por `clave`, categoría `SYSTEM`, idempotente, en `prisma/seed.ts`. Si ZEUS decide cuadrantes solo por mediana, este seed no se siembra.

## 5. Cumplimiento

- **Sin PII de reportes**: los agregados operan sobre suscripciones/pagos/sesiones/scores; ninguna query toca `Reporte.textoOriginal`, identificadores reportados ni denunciantes.
- **Presunción de inocencia**: los scores son métricas comerciales de uso del servicio visibles solo para `ADMIN` (brief §6.3, M5); no se exponen al cliente ni se presentan como calificación de personas.
- **Retención**: los snapshots de `ScoreCliente` los gobierna SPEC-220 (24 meses, param `analisis.score.retencion_meses`); esta spec no purga nada.
