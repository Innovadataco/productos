# Quickstart: Validación del Módulo de Reportes

**Prerequisites**: Fase 1 completada y validada (autenticación, parámetros, Docker PostgreSQL con pgvector)

---

## 1. Verificar pgvector

```bash
docker compose exec db psql -U proteccion -d proteccion_infantil -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Esperado**: `CREATE EXTENSION` (sin error).

---

## 2. Instalar dependencias nuevas

```bash
npm install pg-boss
```

---

## 3. Migrar base de datos

```bash
npx prisma migrate dev --name reportes_fase2
npx prisma db seed   # Agrega plataformas y parámetros nuevos
```

---

## 4. Iniciar servidor y worker

Terminal 1 (servidor web):
```bash
npm run dev
```

Terminal 2 (worker pg-boss):
```bash
pm2 start scripts/worker-reportes.mjs --name "reportes-worker"
```

---

## 5. Validar escenarios end-to-end

### Escenario A: Crear reporte anónimo

```bash
curl -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -d '{"identificador":"+573001234567","plataforma":"whatsapp","texto":"Este número contactó a mi hija ofreciendo regalos.","fechaIncidente":"2026-07-10T14:30:00Z","ciudad":"Bogotá","pais":"Colombia"}'
```

**Esperado**: `201` con `numeroSeguimiento` y estado `PENDIENTE`.

---

### Escenario B: Worker procesa el reporte

```bash
# Esperar 30-60 segundos para que el worker procese
curl http://localhost:5005/api/reportes/seguimiento/RPT-ABC123
```

**Esperado**: `200` con estado `CLASIFICADO` o `REVISION_MANUAL`.

---

### Escenario C: Panel admin lista reportes

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -c cookies.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'

curl http://localhost:5005/api/admin/reportes?page=1&limit=10 \
  -b cookies.txt
```

**Esperado**: `200` con array de reportes, incluyendo clasificación IA.

---

### Escenario D: Corrección de clasificación

```bash
curl -X PATCH http://localhost:5005/api/admin/reportes/[id]/clasificacion \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"categoria":"SUPLANTACION_IDENTIDAD","motivo":"El texto describe suplantación, no ofrecimiento"}'
```

**Esperado**: `200` con `datasetRegistrado: true`.

---

### Escenario E: Deduplicación autenticada

```bash
# Login como parent
curl -X POST http://localhost:5005/api/auth/login \
  -c parent.txt \
  -d '{"email":"parent@ejemplo.com","password":"Password123"}'

# Primer reporte
curl -X POST http://localhost:5005/api/reportes \
  -b parent.txt \
  -d '{"identificador":"+573009876543","plataforma":"instagram","texto":"Usuario insistente pidiendo fotos.","fechaIncidente":"2026-07-10T10:00:00Z","ciudad":"Medellín","pais":"Colombia"}'

# Segundo reporte del mismo identificador (dentro de 30 días)
curl -X POST http://localhost:5005/api/reportes \
  -b parent.txt \
  -d '{"identificador":"+573009876543","plataforma":"instagram","texto":"Otra vez el mismo usuario.","fechaIncidente":"2026-07-11T10:00:00Z","ciudad":"Medellín","pais":"Colombia"}'
```

**Esperado**: Segundo request retorna `429` con `code: DUPLICATE_REPORT`.

---

### Escenario G: Anonimización automática de PII

```bash
# Crear reporte con PII en el texto
curl -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -d '{"identificador":"+57300PII01","plataforma":"whatsapp","texto":"Mi hija María del colegio San José recibió mensajes de este número ofreciéndole regalos.","fechaIncidente":"2026-07-10T10:00:00Z","ciudad":"Bogotá","pais":"Colombia"}'

# El worker procesa el reporte automáticamente
curl http://localhost:5005/api/reportes/seguimiento/RPT-PII01
```

**Esperado**:
- Worker detecta PII (`contienePii=true`, `piiDetectada:["María","colegio San José"]`)
- Worker anonimiza el texto automáticamente (reemplaza nombres/colegios por etiquetas como `[NOMBRE]`, `[COLEGIO]`)
- Estado final pasa a `CLASIFICADO`
- `textoOriginal` se preserva en el campo `textoOriginal` del reporte
- `texto` público queda con la versión anonimizada
- El reporte **SÍ** cuenta para el umbral de visibilidad pública (está clasificado)
- Si el servicio de anonimización falla, el reporte queda en `REVISION_MANUAL` con `processingError` registrado

---

### Escenario F: Visibilidad condicional (umbral + ratio autenticados)

```bash
# Crear 3 reportes anónimos sobre el mismo identificador
for i in 1 2 3; do
  curl -X POST http://localhost:5005/api/reportes \
    -d "{\"identificador\":\"+57300ANON\",\"plataforma\":\"tiktok\",\"texto\":\"Reporte anónimo número $i sobre comportamiento sospechoso.\",\"fechaIncidente\":\"2026-07-10T10:00:00Z\",\"ciudad\":\"Cali\",\"pais\":\"Colombia\"}"
done

# Consultar (fase 3 no implementada, pero verificar en BD)
```

**Esperado**: `IdentificadorReportado.esVisiblePublicamente = false` porque 0% autenticados < 50% mínimo.

---

## 6. Verificar build

```bash
npm run build
```

**Esperado**: Compila sin errores de TypeScript.

---

## 7. Detener worker

```bash
pm2 stop reportes-worker