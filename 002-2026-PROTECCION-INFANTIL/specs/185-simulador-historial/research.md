# Research: SPEC-185 — Historial y sugerencias del simulador de abusos

## Hallazgos del CEO en prod (2026-08-20)

1. **Falta de historial**: la UI del simulador solo tenía el form de lanzamiento. Las corridas quedaban en BD pero no había forma de listarlas ni revisar resultados pasados.
2. **Colisión de defaults**: los 5 escenarios compartían la misma IP default (`192.0.2.10`). Al lanzar el escenario 1 (robot inundando, N=50), la IP alcanzó su cuota horaria de rate-limit. Los escenarios 2-5 rebotaron 429 desde el primer reporte.
3. **Bug I-64**: `scripts/simulador-abuso.mjs:184` llamaba `repo.actualizarEstado(runId, estadoFinal, new Date())`. El repositorio expandía `{ fechaFin: new Date() }` en el `data` de Prisma, pero `SimulacionAbusoRun` no tiene columna `fechaFin`. Prisma arrojó error y el catch del worker marcó la corrida como `FALLIDA`, aunque los 50 reportes se habían enviado correctamente.

## Estado del código (verificado en fuente)

- `src/lib/anti-abuso/simulador.ts`: genera payloads con `IP_DEFAULT = "192.0.2.10"`, `IDENTIFICADOR_DEFAULT = "3001234567"`, `PLATAFORMA_DEFAULT = "whatsapp"` para todos los escenarios.
- `scripts/simulador-abuso.mjs`: función `ejecutarSimulacion` guarda conteos en `resultadosJson` pero no detalle por request ni percentiles.
- `src/lib/dal/repositories/simulacion-abuso.ts`: `actualizarEstado` acepta `fechaFin?: Date` y lo incluye en el update.
- `prisma/schema.prisma`: modelo `SimulacionAbusoRun` no tiene `fechaFin`.
- `src/components/modules/AdminAntiAbusoSimulador.tsx`: componente monolítico con formulario y polling; sin historial ni sub-tabs.

## Opciones consideradas

### Opción A: Añadir `fechaFin` al modelo
- **Pros**: semántica clara de cuándo terminó la corrida.
- **Contras**: requiere migración aditiva; `actualizadoEn` ya cambia solo cuando el worker actualiza, y al finalizar es la última actualización.
- **Veredicto provisional**: descartada para esta spec; se usa `actualizadoEn`.

### Opción B: Página dedicada para detalle vs modal
- **Página**: rutas limpias, link directo.
- **Modal**: menos rutas, mantiene contexto del tab Simulador.
- **Veredicto provisional**: modal recomendado.

### Opción C: Guardar detalle por reporte en JSON vs tabla nueva
- **JSON en `resultadosJson`**: sin migración, tamaño acotado (<=200 items).
- **Tabla nueva `SimulacionAbusoDetalle`**: normalizada, pero requiere migración y más código.
- **Veredicto provisional**: JSON en `resultadosJson`.

### Opción D: Selección automática de usuario PARENT vs parámetro configurable
- **Automática**: buscar último PARENT activo. Riesgo de elegir usuario equivocado.
- **Parámetro `simulacion.spam.usuario_id`**: explícito, seguro, configurable por entorno.
- **Veredicto provisional**: parámetro configurable.
