# Quickstart: Validación de la mejora del prompt del clasificador (Spec 050)

**Prerequisites**: Docker, Node.js >=22, `npm`, PostgreSQL levantado, Ollama disponible con los modelos a evaluar, app corriendo en `:5005`, usuario ADMIN creado.

---

## 1. Definir el set de referencia validado por humanos

El criterio de aceptación depende de un set de referencia con etiquetas humanas. Opciones:

- **Opción A (preferida)**: usar `casoEval` del Laboratorio IA que haya sido etiquetado y aprobado por el equipo humano (operador/comité).
- **Opción B**: extraer reportes reales cuyas clasificaciones hayan sido corregidas por operador/comité y que ahora tengan `estado = CORREGIDO` o `TransicionReporte.responsableTipo = OPERADOR/COMITE`.

El set debe incluir casos positivos y negativos de `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE`, y una muestra representativa de las otras 10 categorías para detectar regresiones.

---

## 2. Medir baseline

Antes de cambiar el prompt, ejecutar el eval con el prompt actual:

```bash
# Desde el Centro de Control IA → Laboratorio, o con el eval runner
npx tsx scripts/eval-classifier-baseline.ts \
  --modelo ornith:9b \
  --fixture path/to/fixture-validado.json \
  --output eval-results/baseline-prompt-actual.json
```

Si no existe el script, usar el Laboratorio IA (`/dashboard/admin/ia`) para correr una evaluación con el fixture validado y exportar el CSV/JSON.

Guardar las métricas por categoría, especialmente:

- `SOLICITUD_MATERIAL`: recall, precision, error_silencioso.
- `CONTACTO_INSISTENTE`: recall, precision, error_silencioso.
- Otras 10 categorías: recall, precision.

---

## 3. Aplicar el nuevo prompt (tras aprobación del plan)

Modificar `src/lib/ai/classifier.ts` reemplazando el `basePrompt` en `buildSystemPrompt` por el texto propuesto en `spec.md`.

```bash
npm run build
./scripts/dev-restart.sh
```

---

## 4. Medir con el nuevo prompt

Ejecutar exactamente la misma evaluación del paso 2, pero con el nuevo prompt:

```bash
npx tsx scripts/eval-classifier-baseline.ts \
  --modelo ornith:9b \
  --fixture path/to/fixture-validado.json \
  --output eval-results/baseline-prompt-mejorado.json
```

---

## 5. Comparar métricas

Generar un diff de las métricas:

```bash
npx tsx scripts/eval-compare-prompts.ts \
  --antes eval-results/baseline-prompt-actual.json \
  --despues eval-results/baseline-prompt-mejorado.json
```

**Criterios de aceptación tentativos** (a confirmar con el owner):

- `SOLICITUD_MATERIAL` recall: sube al menos 15 puntos porcentuales respecto al baseline.
- `CONTACTO_INSISTENTE` recall: sube al menos 15 puntos porcentuales respecto al baseline.
- Otras 10 categorías: recall/precisión no caen más de 5 puntos porcentuales.
- Error silencioso global no aumenta.
- Latencia p95 no aumenta más del 15%.

---

## 6. Ejemplos puntuales de validación manual

Usar el sandbox del Laboratorio IA o una llamada directa a `/api/admin/ia/sandbox` para clasificar textos puntuales y verificar que el nuevo prompt asigna la categoría esperada.

```bash
curl -X POST http://localhost:5005/api/admin/ia/sandbox \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt \
  -d '{
    "modelo": "ornith:9b",
    "texto": "te compro un celular si me mandas fotos",
    "temperature": 0.7
  }'
```

**Esperado**: `categoria` = `SOLICITUD_MATERIAL` (no `OFRECIMIENTO_REGALOS`).

```bash
curl -X POST http://localhost:5005/api/admin/ia/sandbox \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt \
  -d '{
    "modelo": "ornith:9b",
    "texto": "Hola, ¿cuántos años tenés? ¿en qué curso estás? Hablame por privado, no le digas a tus papás",
    "temperature": 0.7
  }'
```

**Esperado**: `categoria` = `CONTACTO_INSISTENTE` (con confianza adecuada).

---

## 7. Si no hay set de referencia humano

Si no se dispone de un set validado por humanos, no aplicar el prompt. Documentar el bloqueador y retomar cuando se cuente con el insumo.

---

## 8. Rollback

Si las métricas empeoran o hay regresión:

```bash
git revert <commit-del-prompt>
./scripts/dev-restart.sh
```

---

## Notes

- Los comandos `eval-classifier-baseline.ts` y `eval-compare-prompts.ts` son propuestas; si no existen, usar el Laboratorio IA y exportar manualmente.
- La validación con datos humanos es un requisito de aceptación; no se puede omitir.
