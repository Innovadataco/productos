# Quickstart: Validación de la capa de datos / servicios (DAL)

**Prerequisites**: Docker, Node.js >=22, `npm`, base de datos PostgreSQL levantada.

> Este quickstart se ejecuta **después de la aprobación del plan** (`/speckit.implement`), cuando el código del DAL esté implementado. Mientras el spec esté `PLANEADO`, solo sirve como referencia de los escenarios que deben validarse.

---

## 1. Iniciar PostgreSQL y migrar

```bash
docker compose up -d db
npx prisma migrate dev
npx prisma db seed
```

Verificar: `docker compose ps` muestra `db` en estado `healthy`.

---

## 2. Verificar que las rutas no importan Prisma directamente

```bash
# Reporte: debe retornar 0 coincidencias tras la migración del módulo
grep -r "from \"@/lib/prisma\"" src/app/api/reportes/ || true
grep -r "import.*prisma.*from.*@/lib/prisma" src/app/api/reportes/ || true

# Consulta pública: debe retornar 0 coincidencias tras la migración del módulo
grep -r "from \"@/lib/prisma\"" src/app/api/consulta/ || true
```

**Esperado**: 0 imports de `prisma` en las rutas migradas.

---

## 3. Escenarios de validación del módulo Reporte

### Escenario A: Crear un reporte anónimo

```bash
curl -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -d '{"identificadorValor":"+573001234567","identificadorTipo":"numero","plataformaKey":"WhatsApp","texto":"Contacto insistente","ciudad":"Bogotá","pais":"CO","esAnonimo":true}'
```

**Esperado**: `201` con `numeroSeguimiento` y sin exposición de datos internos de Prisma.

### Escenario B: Listar "mis reportes" autenticado

```bash
# 1. Login como parent
# 2. Listar reportes
curl -b cookies.txt http://localhost:5005/api/reportes/mis-reportes
```

**Esperado**: `200` con `items` y `pagination`; cada ítem es un DTO de dominio.

### Escenario C: Seguimiento por número

```bash
curl http://localhost:5005/api/reportes/seguimiento/NUMERO_SEGUIMIENTO
```

**Esperado**: `200` con DTO de seguimiento; `404` si no existe.

### Escenario D: Procesamiento de un reporte (worker interno)

```bash
curl -X POST http://localhost:5005/api/reportes/procesar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WORKER_SECRET" \
  -d '{"reporteId":"ID_DEL_REPORTE"}'
```

**Esperado**: `200` y el reporte cambia a estado procesado/clasificado; pipeline orquestado por `ReporteProcessingService`.

---

## 4. Escenarios de validación del módulo Consulta pública

### Escenario E: Consulta pública sin autenticación

```bash
curl "http://localhost:5005/api/consulta?valor=+573001234567&tipo=numero"
```

**Esperado**: `200` con resumen agregado si supera el umbral; `200` con datos vacíos si no.

### Escenario F: Detalle autenticado

```bash
curl -b cookies.txt "http://localhost:5005/api/consulta/detalle?valor=+573001234567&tipo=numero"
```

**Esperado**: `200` con detalle de reportes como DTOs de dominio.

---

## 5. Verificaciones técnicas

### Tests

```bash
npm run test
```

**Meta**: Todos los tests de Reporte y Consulta pública pasan; no hay regresiones en otros módulos.

### Build

```bash
rm -rf .next
npm run build
```

**Esperado**: Compila sin errores de TypeScript.

### Lint

```bash
npm run lint
```

**Esperado**: 0 errores.

---

## 6. Verificación de no regresión en SPEC-050/060

```bash
git diff --name-only
```

**Esperado**: Ningún archivo de `specs/050-pendientes-afinamiento/` ni `specs/060-*` aparece modificado (si existiera). El diff se limita a `specs/053-capa-datos-servicios/` y `src/lib/dal/` / `src/app/api/**` según corresponda.

---

## 7. Checklist de cierre funcional

- [ ] Las rutas de Reporte no importan `prisma`.
- [ ] Las rutas de Consulta pública no importan `prisma`.
- [ ] Los servicios de Reporte aceptan `tx` opcional.
- [ ] Los DTOs de dominio se usan en las respuestas HTTP.
- [ ] `npm run test` pasa sin regresiones.
- [ ] `npm run build` compila.
- [ ] `npm run lint` pasa.
- [ ] SPEC-050 y SPEC-060 no se modificaron.
