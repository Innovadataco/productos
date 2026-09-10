# Data model — SPEC-606

## Tabla nueva: `CodigoStepUp` (migración `20260909170000_spec606_stepup_codigo_email`, aditiva)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | `cuid()` |
| `usuarioId` | TEXT FK → `Usuario.id` | `ON DELETE CASCADE`, índice `CodigoStepUp_usuarioId_idx` |
| `codigoHash` | TEXT | sha-256 hex del código de 6 dígitos. NUNCA el plano |
| `vigenteHasta` | TIMESTAMPTZ(6) | `creadoEn` + `padre.texto.codigo_minutos` (default 10) |
| `intentos` | INTEGER default 0 | fallos de verificación; al llegar a 5 el código se consume |
| `consumidoEn` | TIMESTAMPTZ(6) NULL | marca de un solo uso (verificado o bloqueado por intentos) |
| `creadoEn` | TIMESTAMPTZ(6) default now() | el cooldown de reenvío (60 s) mira esta fecha del código más reciente |

Invariantes (aplicación, servicio `stepup-codigo`):
- UN solo código vigente por usuario: cada solicitud expira los anteriores no consumidos en la misma transacción.
- Un solo uso: el canje es un `UPDATE ... WHERE consumidoEn IS NULL` (carrera cerrada).
- Sin regla de correo activa, la fila recién creada se BORRA (fail-closed 502 sin cobrar cooldown).

## Enum `AccionAudit` (aditivo, `ADD VALUE IF NOT EXISTS`)

- `STEP_UP_CODIGO_SOLICITADO` — metadatos: `{ codigoHash }`
- `STEP_UP_CODIGO_VERIFICADO` — metadatos: `{ codigoHash }`
- `STEP_UP_CODIGO_FALLIDO` — metadatos: `{ motivo: "incorrecto"|"expirado"|"bloqueado", codigoStepUpId, intentos }`

NUNCA se audita el código en claro ni el texto del reporte.

## Parámetro nuevo (seed aditivo, upsert por clave)

- `padre.texto.codigo_minutos` = `10` (INTEGER, categoría SYSTEM): vigencia del código.

## Sin cambios destructivos

No se toca ninguna tabla/columna/índice existente. Los 5 índices críticos fuera del schema (AGENTS.md) quedan intactos; el guardián `npm run indices:check` no requiere cambios (esta spec no crea índices HNSW/GIN/GIST/trgm).
