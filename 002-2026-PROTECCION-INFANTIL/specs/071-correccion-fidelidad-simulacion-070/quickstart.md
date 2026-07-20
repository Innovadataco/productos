# Quickstart: Verificación de fidelidad de la simulación (Spec 071)

**Prerequisites**: Docker, Node.js >=22, `npm`, PostgreSQL levantado, app corriendo en `:5005`, usuario ADMIN creado, `DISABLE_RATE_LIMIT=true` en `.env`.

---

## 1. Preparar el archivo de simulación

Crear `set-fidelidad.csv` con los campos reales de un reporte anónimo:

```csv
texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada
"Este es un texto de prueba con más de veinte caracteres para validar la simulación",whatsapp,contacto_001,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO
"Otro texto de prueba que cumple la longitud mínima requerida por el validador",instagram,usuario_002,2026-02-20T15:30:00Z,Medellín,Colombia,12,CIBERBULLYING
"Texto sin categoría esperada, solo para verificar que el pipeline procesa igual",tiktok,nick_003,2026-03-10T08:00:00Z,Cali,Colombia,,REVISION_MANUAL
```

Equivalente en JSON (`set-fidelidad.json`):

```json
[
  {
    "texto": "Este es un texto de prueba con más de veinte caracteres para validar la simulación",
    "plataforma": "whatsapp",
    "identificador": "contacto_001",
    "fechaIncidente": "2026-01-15T10:00:00Z",
    "ciudad": "Bogotá",
    "pais": "Colombia",
    "edadVictima": 14,
    "categoriaEsperada": "ACOSO"
  },
  {
    "texto": "Otro texto de prueba que cumple la longitud mínima requerida por el validador",
    "plataforma": "instagram",
    "identificador": "usuario_002",
    "fechaIncidente": "2026-02-20T15:30:00Z",
    "ciudad": "Medellín",
    "pais": "Colombia",
    "edadVictima": 12,
    "categoriaEsperada": "CIBERBULLYING"
  },
  {
    "texto": "Texto sin categoría esperada, solo para verificar que el pipeline procesa igual",
    "plataforma": "tiktok",
    "identificador": "nick_003",
    "fechaIncidente": "2026-03-10T08:00:00Z",
    "ciudad": "Cali",
    "pais": "Colombia",
    "categoriaEsperada": "REVISION_MANUAL"
  }
]
```

---

## 2. Login como ADMIN

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c admin-cookies.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'
```

**Esperado**: `200` con `{ user: { rol: "ADMIN" } }`.

---

## 3. Verificar carga y validación del archivo

```bash
curl -X POST http://localhost:5005/api/admin/ia/simulaciones \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt \
  -d '{
    "modelo": "ornith:9b",
    "archivo": "texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada\n\"Este es un texto de prueba con más de veinte caracteres\",whatsapp,contacto_001,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO",
    "formato": "csv"
  }'
```

**Esperado**: `201` con `SimulacionRun` creado, `totalCasos: 1`, estado `PENDIENTE`.

Probar un archivo con error:

```bash
curl -X POST http://localhost:5005/api/admin/ia/simulaciones \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt \
  -d '{
    "modelo": "ornith:9b",
    "archivo": "texto,plataforma,identificador,fechaIncidente,ciudad,pais\n\"corto\",whatsapp,contacto_001,2026-01-15T10:00:00Z,Bogotá,Colombia",
    "formato": "csv"
  }'
```

**Esperado**: `400` con error por línea indicando que el texto es demasiado corto.

---

## 4. Verificar fidelidad: reporte real vs. reporte de simulación

### 4.1 Crear un reporte real por el formulario anónimo

```bash
curl -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -d '{
    "texto": "Este es un texto de prueba con más de veinte caracteres para validar la simulación",
    "plataforma": "whatsapp",
    "identificador": "contacto_real_001",
    "fechaIncidente": "2026-01-15T10:00:00Z",
    "ciudad": "Bogotá",
    "pais": "Colombia",
    "edadVictima": 14
  }'
```

Anotar el `numeroSeguimiento` de la respuesta (ej. `RPT-ABC123`).

### 4.2 Crear una simulación con un único caso con los mismos datos

```bash
curl -X POST http://localhost:5005/api/admin/ia/simulaciones \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt \
  -d '{
    "modelo": "ornith:9b",
    "archivo": "texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada\n\"Este es un texto de prueba con más de veinte caracteres para validar la simulación\",whatsapp,contacto_sim_001,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO",
    "formato": "csv"
  }'
```

Anotar el `id` de la simulación. Esperar a que el worker procese el caso (consultar el detalle hasta que el estado sea `COMPLETADA`).

### 4.3 Comparar ambos reportes en BD

Conectar a la base de datos:

```bash
docker exec -it 002-2026-proteccion-infantil-db-1 psql -U proteccion -d proteccion_infantil
```

Ejecutar la comparación:

```sql
SELECT
  r.identificador,
  r.texto,
  r.fecha_incidente,
  r.ciudad,
  r.pais,
  r.edad_victima,
  r.es_anonimo,
  r.estado
FROM reporte r
WHERE r.identificador IN ('contacto_real_001', 'SIM-{runIdShort}-001')
ORDER BY r.identificador;
```

Reemplazar `SIM-{runIdShort}-001` por el identificador real de la simulación.

**Esperado**: Los campos `texto`, `fecha_incidente`, `ciudad`, `pais`, `edad_victima` y `es_anonimo` deben coincidir. El `estado` puede variar según el modelo, pero debe ser uno de los estados finales (`CLASIFICADO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `DUPLICADO`, `CORREGIDO`).

Verificar transiciones:

```sql
SELECT
  r.identificador,
  t.estado_anterior,
  t.estado_nuevo,
  t.accion
FROM reporte r
JOIN transicion_reporte t ON t.reporte_id = r.id
WHERE r.identificador IN ('contacto_real_001', 'SIM-{runIdShort}-001')
ORDER BY r.identificador, t.creado_en;
```

**Esperado**: Ambos reportes tienen transiciones equivalentes (`PENDIENTE` → estado final). El responsable puede ser `SISTEMA` en ambos casos.

---

## 5. Verificar que `categoriaEsperada` no llega al modelo

Consultar `SimulacionReporte` y `ClasificacionIA`:

```sql
SELECT
  sr.indice,
  sr.categoria_esperada,
  cia.categoria_asignada
FROM simulacion_reporte sr
JOIN reporte r ON r.id = sr.reporte_id
LEFT JOIN clasificacion_ia cia ON cia.reporte_id = r.id
WHERE sr.simulacion_run_id = '{runId}'
ORDER BY sr.indice;
```

**Esperado**: `categoria_esperada` y `categoria_asignada` pueden ser distintas (eso es el acierto/fallo). `categoria_esperada` no debe aparecer en ninguna columna de `Reporte` ni `ClasificacionIA`.

---

## 6. Verificar continuidad ante fallos

Crear un archivo donde el primer caso sea válido y el segundo tenga una plataforma inexistente:

```csv
texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada
"Texto válido para el primer caso",whatsapp,ok_001,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO
"Texto válido pero plataforma inválida",plataforma_inexistente,fallo_002,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO
```

**Esperado**: La carga del archivo se rechaza en la validación antes de lanzar (el parser detecta plataforma inexistente como error por línea). No se crea la simulación.

Para probar fallos durante el pipeline (después de lanzar), se puede usar un caso que genere duplicado o desconectar Ollama temporalmente; la corrida debe continuar y reportar fallos en las métricas.

---

## 7. Ejecutar tests

```bash
npm run test
```

**Esperado**: Los tests de `src/lib/simulacion/parser.test.ts` y `src/lib/simulacion/executor.test.ts` pasan, cubriendo los nuevos campos, errores por línea y continuidad ante fallos. El total de tests no debe bajar.

---

## 8. Verificar build y lint

```bash
npx tsc --noEmit
npm run lint
npm run build
```

**Esperado**: Sin errores de TypeScript ni de lint; build exitoso.

---

## 9. Limpieza de datos de simulación (conservar las 4 cuentas de trabajo)

Para borrar una corrida de simulación sin afectar usuarios:

```sql
-- Reemplazar {runId} por el id de la simulación
DELETE FROM simulacion_reporte WHERE simulacion_run_id = '{runId}';
DELETE FROM simulacion_run WHERE id = '{runId}';

-- Los reportes anónimos asociados (con prefijo SIM-) pueden eliminarse si se desea
DELETE FROM reporte WHERE identificador LIKE 'SIM-%';
```

**No borrar** los usuarios admin, padre, operador ni comité.
