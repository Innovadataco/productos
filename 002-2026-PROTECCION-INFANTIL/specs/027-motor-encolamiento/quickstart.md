> # Quickstart — Motor de encolamiento

## Escenario A: Encolar reporte con prioridad alta (autenticado)

**Prerrequisitos**: Usuario PARENT autenticado; cola configurada.

1. Crear reporte autenticado vía `POST /api/reportes`.

**Validación**:
- `Reporte.estado = PENDIENTE`.
- En pg-boss, el job tiene `priority = 10`.

**Esperado**: `201`; job encolado con prioridad alta.

---

## Escenario B: Encolar reporte anónimo con prioridad baja

**Prerrequisitos**: Sin sesión.

1. Crear reporte anónimo.

**Validación**:
- Job en pg-boss con `priority = 1`.

**Esperado**: `201`; procesado después de los autenticados.

---

## Escenario C: Anónimo con keyword de alto riesgo sube a prioridad alta

**Prerrequisitos**: Keyword "doxing" configurada en `src/lib/ai/keywords-riesgo.ts`.

1. Crear reporte anónimo con texto que incluya "doxing".

**Validación**:
- `Reporte.keywordsDetectadas` incluye "doxing".
- `Reporte.prioridadAlta = true`.
- Job con `priority = 10`.

**Esperado**: Prioridad igual a autenticado.

---

## Escenario D: Reintentos ante fallo de Ollama

**Prerrequisitos**: Worker corriendo; Ollama caído temporalmente.

1. Crear reporte.
2. El worker intenta procesar y falla.

**Validación**:
- Se crean filas en `ReintentoReporte` con `exitoso = false` e `error` descriptivo.
- El job se reintenta según `worker.retry_delay_segundos` y backoff.

**Esperado**: Al menos 3 intentos registrados antes de DLQ.

---

## Escenario E: Agotar reintentos envía a revisión manual

**Prerrequisitos**: `worker.max_reintentos = 3`; error persistente.

1. Crear reporte que siempre falle (ej. identificador inválido forzado o stub de prueba).

**Validación**:
- `ReintentoReporte` tiene 4 filas (intento inicial + 3 reintentos).
- Último intento `exitoso = false`.
- `Reporte.estado = REVISION_MANUAL`.
- `Reporte.processingError` no vacío.

**Esperado**: Operador puede ver el historial y decidir.

---

## Escenario F: Backpressure bajo saturación

**Prerrequisitos**: `worker.max_pendientes = 5`; procesamiento lento.

1. Crear 10 reportes rápidamente.

**Validación**:
- Los primeros 5 se encolan en pg-boss.
- Los siguientes 5 quedan en `Reporte.estado = PENDIENTE` sin job asociado.
- Cuando baja la carga, un job periódico (o hook al completar) encola los pendientes.

**Esperado**: No se colapsa la GPU ni la cola.

---

## Escenario G: Concurrencia configurable

**Prerrequisitos**: Admin autenticado.

1. Cambiar `worker.concurrencia` a 1.
2. Crear 3 reportes.

**Validación**: El worker procesa un solo reporte a la vez.

**Esperado**: Cambio de configuración afecta inmediatamente al worker.

---

## Escenario H: Éxito no genera más reintentos

**Prerrequisitos**: Reporte que procesa correctamente.

1. Crear reporte.
2. Worker procesa con éxito.

**Validación**:
- Se crea fila en `ReintentoReporte` con `exitoso = true`.
- No hay reintentos adicionales.

**Esperado**: `Reporte.estado = CLASIFICADO`.
