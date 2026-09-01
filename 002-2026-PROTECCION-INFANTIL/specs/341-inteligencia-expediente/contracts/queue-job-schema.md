# Contract · Cola pg-boss `padre.analisis.expediente`

## Nombre lógico

`padre.analisis.expediente`

## Payload

```jsonc
{
  "expedienteId": "cuid...",
  "hashCadena": "a1b2c3...",         // el hash calculado al momento de encolar
  "alcance": "PADRE_COMPLETO" | "COLEGIO_BLINDADO",
  "disparador": "APERTURA" | "ACTUALIZAR",
  "solicitadoEn": "2026-09-01T09:00:00-05:00"
}
```

## Opciones al enviar

- `priority`: valor de `padre.analisis.prioridad` (default 5).
  **Estrictamente MENOR** que `queue.clasificacion.prioridad` (default 10)
  — verificado en runtime por el helper `sendAnalisisExpediente()` que aborta
  si la relación no se cumple (garantía SC-008).
- `singletonKey`: `${expedienteId}:${hashCadena}` — pg-boss deduplica jobs
  vivos con la misma llave (idempotencia FR-007).
- `retryLimit`: 0 — sin reintentos automáticos (R-2).
- `expireInSeconds`: `padre.analisis.tiempo_estimado_seg * 3` (FR-008).

## Idempotencia

- **A nivel de cola**: `singletonKey` evita encolar dos veces mientras un job
  con la misma `(expedienteId, hashCadena)` esté vivo.
- **A nivel de modelo**: antes de escribir un `AnalisisExpediente` con
  `estado=PUBLICADO`, el worker verifica que NO exista otro publicado con
  el mismo `hashCadena` para ese expediente. Si existe (dos aperturas casi
  simultáneas), el segundo se marca `FALLIDO` con motivo `duplicado_hash` y
  no publica.

## Handler del worker

```text
1. Toma el job.
2. Toma pg_try_advisory_lock(123456799). Si falla → retorna, otro proceso corre.
3. Carga Expediente con sus eventos + identificadores del padre + hijo cruzado.
4. Llama `armar-payload.ts` con el `alcance` del job.
5. Llama `llamarOllamaStructured<AnalisisSalida>(payload, prompt, modelo)`.
6. Ejecuta `validar-salida.ts` (anti-frases-pre-horneadas).
7. Persiste `AnalisisExpediente` con `estado=PUBLICADO` y `versionSecuencial = MAX(vigentes)+1`.
8. Suelta el advisory-lock.
```

Si en cualquier paso 3–7 hay error:
- Persiste el `AnalisisExpediente` con `estado=FALLIDO` y `motivoFallo`.
- Suelta el advisory-lock.
- No relanza excepción para no dejar el job pendiente en pg-boss.

## Métricas registradas

Cada corrida del worker registra en `logger`:
- `job.id`, `expedienteId`, `alcance`, `latenciaMs`, `estado_final`,
  `tokensPrompt`, `tokensResponse`.
- Motivo del fallo (si aplica).
