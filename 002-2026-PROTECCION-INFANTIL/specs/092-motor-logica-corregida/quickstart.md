# Quickstart — Spec 092: Motor — lógica corregida

## A. Decisivas vs contexto (US1)

1. Reportar: "Un adulto le pidió fotos íntimas a mi hija de 12 años" (sin mencionar intercambio).
2. Antes: OTRO → revisión (fallaba la pregunta de contexto "a cambio"). Ahora: SOLICITUD_MATERIAL se cumple (las 2 decisivas: pide material + es íntimo) → procesado con esa conducta.
3. En `clasificacion_rubrica_votos.preguntasJson` se ven las decisivas cumplidas.

## B. Embudo permisivo (US2)

- La medición del banco: `npx tsx scripts/medir-embudo-092.ts` → reporta descartes erróneos (`scripts/simulacion/medicion-embudo-092.json`).

## C. Todas las conductas (US3)

- Un reporte con 2 conductas (p. ej. regalos + contacto insistente): la respuesta muestra `categoriasPresentes` con ambas; la UI las lista todas (no una "principal").

## D. Guardas baratas (US4)

- Reportar 4+ veces el mismo identificador en minutos (ráfaga) o un texto con dirección+celular (doxing): el reporte va directo a REVISION_MANUAL con prioridad, SIN llamadas a los modelos (ver en logs: no hay llamadas a Ollama para ese reporte).

## E. Longitud mínima (US5)

- Cambiar `reportes.spam.min_text_length` en Configuración (p. ej. 30): el wizard y el backend (400) aplican el nuevo valor sin redeploy.

## F. Validación del banco (US6)

```bash
npx tsx scripts/eval-rubrica-banco.ts 200   # ~3h secuencial; resultados en scripts/simulacion/resultados-rubrica-090.json
```

## G. Gate

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```
