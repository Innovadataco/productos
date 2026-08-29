# Quickstart: SPEC-227 — Historial de recomendaciones y métricas de tuning

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` con SPEC-221 implementada (modelos `ReglaRecomendacion`/`Recomendacion` y reglas semilla existen).
- Postgres corriendo (`docker compose up -d db`), `npm install` hecho, `.env` con `DATABASE_URL` y `ANALISIS_EXPORT_SALT` definida.

## 1. Preparar datos

```bash
npx prisma migrate dev      # solo si SPEC-221 trajo migraciones pendientes
npx prisma db seed          # parámetros analisis.recomendaciones.* + módulo analisis_recomendaciones
```

Sembrar un dataset de prueba (Prisma Studio o script): 1 regla "Llamar a clientes que vencen esta semana" con 10 sugerencias — 2 `APLICADA`, 8 `IGNORADA`, `resueltaEn` entre 2 y 48 h después de `generadaEn`; más 3 `PENDIENTE` de otra regla.

## 2. Levantar la app

```bash
./scripts/dev-restart.sh
```

## 3. Validar la vista

1. Login como `ADMIN` → abrir `http://localhost:5005/dashboard/admin/analisis/recomendaciones`.
2. Verificar la tabla: columnas sugerencia, regla, categoría, prioridad, estado (badge), generada, resuelta; orden descendente por fecha.
3. Filtro por regla → solo las de esa regla; paginación recalculada.
4. Filtro estado "Ignorada" → solo las 8.
5. Rango de fechas cubriendo solo parte del dataset → subconjunto correcto (incluye la frontera del día "hasta" a las 23:59 Bogotá).
6. KPIs: total generadas 13, tasa de aplicación 20 %, tasa de ignorada 80 %, tiempo promedio de resolución coherente con el dataset.
7. Bloque "Por regla": la regla con 80 % de ignorada aparece destacada en `rubi` con "revisar umbral" (supera el default 70 %).
8. Login como `OPERADOR` → la entrada de nav no aparece y la URL responde 403/redirige.

## 4. Validar endpoints

```bash
# Login admin y cookie
curl -c cookies.txt -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin>","password":"<password>"}'

# Lista filtrada
curl -b cookies.txt "http://localhost:5005/api/admin/analisis/recomendaciones?estado=IGNORADA&page=1&pageSize=25"

# Métricas
curl -b cookies.txt "http://localhost:5005/api/admin/analisis/recomendaciones/metricas?desde=2026-08-01&hasta=2026-08-31"

# Export CSV
curl -b cookies.txt -OJ "http://localhost:5005/api/admin/analisis/recomendaciones/export"
```

Verificar el CSV: encabezado exacto (`recomendacion_id,regla_clave,regla_nombre,categoria,prioridad,estado,generada_en,resuelta_en,tiempo_resolucion_horas,ejecutada_automatica,sujeto_tipo,sujeto_hash`), sin nombres/emails/teléfonos en ninguna celda, `sujeto_hash` estable al exportar dos veces. Verificar en `AuditLog` la fila de exportación con filtros y conteo.

## 5. Gate local del mega-lote (I-101)

```bash
npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- src/lib/dal/services/analisis-recomendaciones src/app/api/admin/analisis src/app/dashboard/admin/analisis && npm run build
git diff --name-status origin/feature/001-scaffolding..HEAD   # solo archivos del SPEC actual + anteriores del lote
```

## 6. Checklist rápido de cierre

- [ ] Seed idempotente ejecutado (parámetros + módulo).
- [ ] Lista, métricas y export responden 200 a ADMIN, 403 a otros roles.
- [ ] Tasas cuadran con el dataset sembrado (denominador = resueltas).
- [ ] Regla sobre el umbral destacada en la vista.
- [ ] CSV sin PII, hash estable, AuditLog registrado.
- [ ] Tope de export responde 413.
- [ ] Frontera de fechas en día calendario Bogotá.
- [ ] Terminología UI: "Sugerencia", "Pendiente/Aplicada/Ignorada/Expirada", sin voseo.
- [ ] Gate local verde.
