# Quickstart: SPEC-195 — Motor SPAM + Aprendizaje operativo

## Verificar rúbrica SPAM

1. Correr seed: `npx prisma db seed`
2. Ir a `/dashboard/admin/ia?tab=rubrica`
3. Confirmar que aparece la categoría **SPAM** con 5 preguntas.

## Verificar caché semántico

1. Crear un reporte con texto de spam y resolverlo como `corregir` a una categoría real (o `es_spam`).
2. Crear un segundo reporte con el **mismo texto** contra un identificador distinto.
3. Revisar el expediente: el segundo debe mostrar `cache_humano_hit` y `modeloUsado="cache:humano:<id-primer-reporte>"`.

## Verificar patrón coordinado

1. En < 60 min, crear 5 reportes con el mismo texto contra 5 identificadores distintos.
2. Revisar que los 5 quedan en `REVISION_MANUAL` con `prioridadAlta=true`.
3. Revisar `IncidenteInfra` con señal `patron_coordinado:<hash>`.

## Verificar endpoint resolver-spam

```bash
curl -X POST http://localhost:5005/api/admin/reportes/<id>/resolver-spam \
  -H "Content-Type: application/json" \
  -b "token=<jwt>" \
  -d '{"decision":"es_spam","motivo":"Publicidad confirmada"}'
```

## Verificar panel de análisis

1. Ir a `/dashboard/admin/spam`
2. Confirmar métricas 7/30/90 días, serie temporal y botón "Sugerir al banco".

## Verificar notificación

1. Crear reporte autenticado con usuario de email conocido.
2. Confirmar spam desde el panel.
3. Revisar log/mock de email: asunto neutro, sin texto ni datos sensibles.
