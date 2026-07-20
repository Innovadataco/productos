# Quickstart: Simulación de carga y comparación de modelos (Spec 070)

## Requisitos previos

- Aplicación corriendo en `:5005` con `./scripts/dev-restart.sh`.
- `DISABLE_RATE_LIMIT=true` en `.env` para evitar que el anti-abuso corte la inyección de volumen.
- Usuario `ADMIN` autenticado.
- Ollama local con al menos un modelo de clasificación (ej. `ornith:9b`) y un modelo de embeddings (ej. `nomic-embed-text`).
- Worker único activo (`npm run worker` o vía `dev-restart.sh`).

## 1. Preparar archivo de casos

Crear un archivo CSV con las columnas:

```csv
texto,plataforma,identificador,categoriaEsperada
"Texto de ejemplo de intercambio inapropiado con longitud suficiente",instagram,usuario123,SOLICITUD_ENCUENTRO
"Otro texto de prueba con longitud suficiente para la validación",tiktok,usuario456,OTRO
```

O un JSON equivalente:

```json
[
  { "texto": "Texto de ejemplo de intercambio inapropiado con longitud suficiente", "plataforma": "instagram", "identificador": "usuario123", "categoriaEsperada": "SOLICITUD_ENCUENTRO" },
  { "texto": "Otro texto de prueba con longitud suficiente para la validación", "plataforma": "tiktok", "identificador": "usuario456", "categoriaEsperada": "OTRO" }
]
```

- `texto`: obligatorio, 20-5000 caracteres.
- `plataforma`: obligatorio, debe existir en la tabla de plataformas.
- `identificador`: obligatorio, 3-100 caracteres.
- `categoriaEsperada`: opcional, categoría canónica (string). Si no se carga, no se calcula acierto para ese caso.
- Máximo 200 casos por corrida.

## 2. Acceder al submódulo Simulación

1. Iniciar sesión como `ADMIN`.
2. Navegar a `/dashboard/admin/ia?tab=eval`.
3. Seleccionar la pestaña "Simulación" (4ª pestaña).

## 3. Crear y lanzar una simulación

1. En la vista de listado, presionar "Nueva simulación".
2. Subir el archivo CSV/JSON.
3. El cliente valida el archivo y muestra errores por línea si los hay.
4. Confirmar que se muestra el total de casos válidos y pasar al paso 2.
5. Seleccionar un modelo de Ollama en el selector (modelos de embeddings no aparecen).
6. Presionar "Lanzar".
7. El sistema crea un `SimulacionRun` en estado `PENDIENTE` y encola un job `simulacion-run` en `pg-boss`.
8. El worker crea los reportes anónimos (`SIM-{runIdShort}-{indice}`) y los encola con `modeloClasificacion` sobreescrito por el modelo elegido.

## 4. Monitorear en vivo

1. Abrir el detalle de la corrida recién creada.
2. Verificar que se muestra `X de N` casos procesados, tiempo transcurrido y estado.
3. Confirmar que el progreso se actualiza automáticamente (polling cada 3 segundos).
4. El estado pasa a `EN_PROGRESO` cuando el worker empieza a crear reportes; cuando todos los reportes alcanzan un estado final, pasa a `COMPLETADA`.
5. Probar el botón "Cancelar" y verificar que la corrida pasa a `CANCELADA`. Los jobs ya encolados siguen su curso.

## 5. Revisar resultados

1. Tras `COMPLETADA`, abrir la pestaña "Resultados por caso".
2. Verificar tabla con índice, identificador, categoría esperada, categoría asignada, confianza, estado final, latencia y acierto.
3. Abrir "Análisis agregado".
4. Verificar % de aciertos, precisión/recall por categoría, matriz de confusión, falsos negativos críticos y latencia p50/p95.
5. Verificar distribución de estados finales (`CLASIFICADO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, etc.).

## 6. Comparar corridas

1. Volver a la vista de listado.
2. Seleccionar dos corridas completadas.
3. Presionar "Comparar".
4. Verificar tabla comparativa por índice de caso (modelo A vs modelo B) y resumen de métricas (accuracy, latencia p50/p95, aciertos/fallos, estados).
5. Probar "Repetir con otro modelo" para lanzar el mismo set de casos con otro modelo.

## 7. Exportar resultados

1. En el detalle de una corrida completada, presionar "Exportar CSV".
2. Verificar que el archivo contiene una fila por caso con índice, identificador, categoría esperada, asignada, confianza, estado, latencia, modelo y acierto.
3. Repetir con "Exportar JSON" y verificar el array de casos + objeto `metricas`.
4. La exportación está deshabilitada mientras la corrida está `PENDIENTE` o `EN_PROGRESO`.

## 8. Limpieza de datos descartables

Para borrar los datos de una corrida de prueba sin afectar las cuentas de trabajo:

```sql
-- Obtener el id de la corrida
SELECT id FROM simulacion_runs WHERE modelo = 'ornith:9b' ORDER BY created_at DESC LIMIT 1;

-- Borrar relaciones (los reportes anónimos asociados quedan como datos históricos descartables)
DELETE FROM simulacion_reportes WHERE simulacion_run_id = '<id>';
DELETE FROM simulacion_runs WHERE id = '<id>';

-- Opcional: borrar reportes anónimos de simulación viejos (no afecta cuentas de trabajo)
DELETE FROM reportes WHERE identificador LIKE 'SIM-%' AND creado_en < NOW() - INTERVAL '7 days';
```

**Nunca borrar** las cuentas de trabajo: `admin@proteccion.local`, `padre@...`, `operador@...`, `comite@...`.

## 9. Tests

```bash
npx vitest run src/lib/simulacion/parser.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/cancelar/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/resultados/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/analisis/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/[id]/export/route.test.ts
npx vitest run src/app/api/admin/ia/simulaciones/comparar/route.test.ts
```

## 10. Validación final

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
npx prisma migrate deploy
./scripts/dev-restart.sh
```
