# Research — SPEC-234 · Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia

## Stack existente relevante

- **PDF**: `pdfmake` ^0.3.11 y `@react-pdf/renderer` ^4.6.0 ya están en `package.json`. `pdfmake` se usa en SPEC-140/SPEC-151 para PDFs institucionales.
- **Colas**: `pg-boss` ^12.26.0 para workers. Patrón de advisory lock en `scripts/worker-reportes.mjs`.
- **Workers separados**: `docker-compose.prod.yml` ya define `pi-worker`, `pi-monitor` y `pi-simulador-abuso` con `TZ=America/Bogota` (implícito o heredado del contenedor).
- **Rate-limit**: `src/lib/rate-limit.ts` usa PostgreSQL con ventana fija; se puede añadir scope `verificar_pdf`.
- **DAL**: frontera Q-3 vigente; repositorios en `src/lib/dal/repositories/`.
- **Modelos base**: SPEC-230 introdujo `Expediente`, `EventoExpediente`, `EstadoExpediente`, `ScoreGravedad` y parámetros `padre.score.*` / `padre.patron.*`.

## Decisiones de investigación

### ¿Librería PDF nueva?

No. Se reutiliza `pdfmake` por consistencia con el resto del proyecto y porque genera buffers deterministas al controlar metadatos y fuentes.

### ¿Cómo hacer el hash reproducible?

`pdfmake` incluye `creationDate`/`modDate` en metadatos del PDF. Fijando esos valores al timestamp de generación (truncado a segundos) e inyectando el mismo timestamp en tests, el buffer es idéntico para el mismo contenido.

### ¿Cómo invalidar la caché de señal comunitaria?

Opciones evaluadas:

1. **Polling simple** con advisory lock: simple, sin dependencias, alineado con otros workers.
2. **pg-boss jobs**: más reactivo pero introduce acoplamiento y requiere más código.

Se elige la opción 1 para cumplir "event-based simple" sin bloquear SPEC-236.

### ¿Hash del identificador en caché?

Para cumplir Ley 1581 se almacena `identificadorHash` (SHA-256). La compilación calcula el hash a partir de `Expediente.identificadorReportado`. No se guarda el identificador en claro ni `reporteId` en la caché.

### ¿Score lineal vs no lineal?

Se elige fórmula lineal ponderada porque es transparente, parametrizable y fácil de auditar. Cualquier ajuste no lineal requeriría ratificación de ZEUS.

## Referencias

- `src/lib/rate-limit.ts`
- `src/lib/queue.ts`
- `scripts/worker-reportes.mjs`
- `scripts/worker-supervisor.mjs`
- `docker-compose.prod.yml`
- `specs/230-padre-v2-modelos-expediente-evento/data-model.md`
