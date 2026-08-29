# Quickstart — Spec 096

## A. Expediente en la Bandeja (US1/US2)

1. Login como admin → Dashboard → Bandeja de reportes.
2. En cualquier fila, junto a "Ver detalle", clic en **"Ver proceso"**.
3. El modal muestra las 10 etapas en 4 fases (Ingesta / Preparación / Evaluación / Cierre), cada una con actividad, evaluación y fecha/hora.
4. En la etapa 7 (Clasificación por rúbrica): matriz modelos×categorías y, por categoría, cada pregunta con su tipo (decisiva/contexto) y el 0/1 de cada modelo; confianza, cascada, latencia y tokens.
5. Al final: análisis interno objetivo y mensaje al padre (borrador, sin botón de enviar).

Por API:

```bash
curl -s http://localhost:5005/api/admin/reportes/<id>/expediente -H "Cookie: $ADMIN_COOKIE" | jq '.etapas | length'   # 10
```

## B. Rúbrica viva (US2)

1. Edita el texto de una pregunta en `ia.rubrica.preguntas` (Configuración o PATCH `/api/config/parametros/ia.rubrica.preguntas`).
2. Reabre el expediente: el texto nuevo aparece sin desplegar.

## C. Instrumentación Capa 2 (US3)

1. Reporta un texto nuevo y déjalo procesar (worker activo).
2. Su expediente muestra detalle por guarda con hora, score de deduplicación y casos RAG.
3. Abre el expediente de un reporte VIEJO (anterior a la spec): las etapas Capa 2 aparecen con la marca "sin instrumentar", sin errores.

```sql
SELECT etapa, veredicto, "latenciaMs", "creadoEn" FROM pasos_procesamiento WHERE "reporteId" = '<id>' ORDER BY "creadoEn";
```

## D. Parametrizable (US4)

```sql
SELECT clave, tipo, "esPublico" FROM "ParametroSistema" WHERE clave IN ('admin.expediente.etapas','mensaje.padre.canales');
-- esperado: 2 filas, JSON, esPublico = false
```

Edita `admin.expediente.etapas` (p. ej. renombra una etapa o cambia su orden) → el expediente lo refleja sin desplegar.

## E. Privacidad (US5)

1. Por defecto el expediente NO muestra textoOriginal, hashes de fuente ni rawResponse (`revelado:false`).
2. Con un usuario SIN el módulo `expediente_revelar_original` (p. ej. OPERADOR): el toggle de revelar no aparece (`puedeRevelar:false`) y `?revelar=true` igualmente omite los campos (200, no 403).
3. Con ADMIN + `?revelar=true`: los campos gated aparecen y existe el audit:

```sql
SELECT accion, "recursoId", "usuarioId", "creadoEn" FROM "AuditLog"
WHERE accion = 'TEXTO_ORIGINAL_REVELADO' AND "recursoId" = '<id>';
```

## F. Síntesis (US6/US7)

- El mensaje al padre NUNCA contiene score ni nivel de riesgo; los canales coinciden con `mensaje.padre.canales`.
- Edita `mensaje.padre.canales` → el borrador refleja los canales nuevos sin desplegar.

## G. Gate

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
./scripts/dev-restart.sh   # healthcheck OK
```
