# Quickstart: Simulación de carga y comparación de modelos (Spec 070)

*(Se ejecutará tras la aprobación humana del plan e implementación del spec.)*

## Requisitos previos

- Aplicación corriendo en `:5005` con `./scripts/dev-restart.sh`.
- `DISABLE_RATE_LIMIT=true` en `.env` para evitar que el anti-abuso corte la inyección de volumen.
- Usuario `ADMIN` autenticado.
- Ollama local con al menos un modelo de clasificación (ej. `ornith:9b`) y un modelo de embeddings (ej. `nomic-embed-text`).

## 1. Preparar archivo de casos

Crear un archivo CSV con las columnas:

```csv
texto,plataforma,identificador,categoriaEsperada
"Texto de ejemplo de ciberbullying",instagram,usuario123,CIBERBULLYING
"Otro texto de prueba",tiktok,usuario456,ACOSO
```

O un JSON equivalente:

```json
[
  { "texto": "Texto de ejemplo...", "plataforma": "instagram", "identificador": "usuario123", "categoriaEsperada": "CIBERBULLYING" },
  { "texto": "Otro texto...", "plataforma": "tiktok", "identificador": "usuario456", "categoriaEsperada": "ACOSO" }
]
```

## 2. Acceder al submódulo Simulación

1. Iniciar sesión como `ADMIN`.
2. Navegar a `/dashboard/admin/ia?tab=eval`.
3. Seleccionar la pestaña "Simulación" (4ª pestaña).

## 3. Crear y lanzar una simulación

1. En la vista de listado, presionar "Nueva simulación".
2. Subir el archivo CSV/JSON.
3. Verificar que el sistema valida los casos y muestra el total.
4. Seleccionar un modelo de Ollama en el selector.
5. Presionar "Lanzar".
6. Confirmar que se crea un `SimulacionRun` en estado `PENDIENTE` o `EN_PROGRESO`.

## 4. Monitorear en vivo

1. Abrir el detalle de la corrida recién creada.
2. Verificar que se muestra `X de N` casos procesados, tiempo transcurrido y estado.
3. Confirmar que el progreso se actualiza automáticamente (polling).
4. Probar el botón "Cancelar" y verificar que la corrida pasa a `CANCELADA`.

## 5. Revisar resultados

1. Tras `COMPLETADA`, abrir la pestaña "Resultados por caso".
2. Verificar tabla con categoría asignada, confianza, estado final, latencia y acierto.
3. Abrir "Análisis agregado".
4. Verificar % de aciertos, precisión/recall por categoría, matriz de confusión, falsos negativos y latencia p50/p95.

## 6. Comparar corridas

1. Volver a la vista de listado.
2. Seleccionar dos corridas completadas.
3. Presionar "Comparar".
4. Verificar tabla comparativa por índice de caso y resumen de métricas.
5. Probar "Repetir con otro modelo" para lanzar la misma simulación con otro modelo.

## 7. Exportar resultados

1. En el detalle de una corrida completada, presionar "Exportar CSV".
2. Verificar que el archivo contiene una fila por caso.
3. Repetir con "Exportar JSON" y verificar el array + métricas agregadas.

## 8. Limpieza de datos descartables

Para borrar los datos de una corrida de prueba sin afectar las cuentas de trabajo:

```sql
-- Obtener el id de la corrida
SELECT id FROM simulacion_runs WHERE modelo = 'ornith:9b' ORDER BY created_at DESC LIMIT 1;

-- Borrar relaciones (los reportes anónimos asociados quedan como datos históricos)
DELETE FROM simulacion_reportes WHERE simulacion_run_id = '<id>';
DELETE FROM simulacion_runs WHERE id = '<id>';
```

**Nunca borrar** las cuentas de trabajo: `admin@proteccion.local`, `padre@...`, `operador@...`, `comite@...`.

## 9. Tests

```bash
npx vitest run src/app/api/admin/ia/simulaciones/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/cancelar/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/resultados/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/export/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/comparar/route.test.ts
```

## 10. Validación final

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
./scripts/dev-restart.sh
```

