# Quickstart: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif

## Prerrequisitos

- Rama actualizada de `work/002-pi-padre-lote-core`.
- PR #83 (Motor Notif) mergeado (la feature no puede push final sin él).
- Docker con contenedor de Postgres corriendo (`docker compose up -d db`).
- Dependencias instaladas (`npm install`).
- Variables de entorno en `.env` (ver `.env.example`).

## 1. Preparar la base de datos

```bash
# Aplicar migraciones aditivas de SPEC-234 y SPEC-236
npx prisma migrate dev

# Sembrar parámetros y eventos/templates de Motor Notif
npx prisma db seed
```

## 2. Verificar parámetros creados

```bash
npx prisma studio
# Buscar en ParametroSistema:
#   padre.expediente.consolidacion_min_reportes
#   padre.expediente.motor.tick_min
#   padre.expediente.auto_cierre_meses
#   padre.expediente.retencion_cerrados_meses
```

## 3. Levantar app y worker

```bash
# Limpieza de build y arranque limpio
./scripts/dev-restart.sh
```

El script debe levantar la app y UN worker de reportes. El worker de expediente se levanta manualmente en desarrollo:

```bash
TZ=America/Bogota node --import tsx scripts/worker-expediente-motor.mjs
```

## 4. Probar transiciones manuales

### 4.1 Crear expediente de prueba

Usa Prisma Studio o un script para crear un `Expediente` en estado `ACTIVO` con `numEventos = 0`.

### 4.2 Llamar al endpoint de transición

```bash
# Obtener cookie de admin primero (login)
curl -c cookies.txt -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}'

# Intentar transición inválida (debe fallar con 409)
curl -b cookies.txt -X POST http://localhost:5005/api/interno/expediente/EXP_ID/transicionar \
  -H "Content-Type: application/json" \
  -d '{"estadoDestino":"CONSOLIDANDO","motivo":"Prueba"}'

# Agregar eventos hasta superar consolidacion_min_reportes y reintentar (debe dar 200)
```

## 5. Probar worker

### 5.1 Auto-cierre por inactividad

```bash
# Actualizar expediente para que ultimoEventoEn sea hace 7 meses
# Esperar un tick o forzar ejecución
TZ=America/Bogota node --import tsx scripts/worker-expediente-motor.mjs --run-once
```

Verificar en BD:

```sql
SELECT id, estado, auto_cerrado_por_inactividad FROM expedientes WHERE id = 'EXP_ID';
-- estado = 'CERRADO', auto_cerrado_por_inactividad = true
```

### 5.2 SLA vencido

```bash
# Crear expediente PENDIENTE_COMITE con createdAt hace 49h y scoreGravedadActual = AMARILLO
# Ejecutar worker --run-once
```

Verificar evento `expediente.comite.sla_vencido` publicado.

### 5.3 Subida a ROJO

```bash
# Crear expediente AMARILLO, simular recálculo de score a ROJO en últimas 24h
# Ejecutar worker --run-once
```

Verificar evento `expediente.gravedad.subio_a_rojo`.

### 5.4 Retención

```bash
# Crear expediente CERRADO hace 25 meses con eventos e informe
# Ejecutar worker --run-once
```

Verificar que `texto`, `resumen_texto_generado` y `pdf_url` ahora son `[retenido]`.

## 6. Probar Motor Notif

```bash
# Verificar eventos creados
npx prisma studio
# Tablas: EventoNotificacion, NotificacionTemplate

# Verificar que existen las 11 claves
```

## 7. Ejecutar tests

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run test -- src/lib/expediente
npm run test -- src/app/api/interno/expediente
npm run build
```

## 8. Validar en producción (cuando aplique)

```bash
# Desplegar con docker-compose.prod.yml
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Verificar que pi-expediente-motor está corriendo con TZ correcto
docker exec pi-expediente-motor date
# Debe mostrar hora de America/Bogota
```

## 9. Checklist rápido de cierre

- [ ] Migraciones aplicadas sin errores.
- [ ] Seed idempotente ejecutado.
- [ ] Endpoint retorna 200/403/409 según corresponda.
- [ ] Worker cierra inactividad, vigila SLA, detecta ROJO y purga retención.
- [ ] 11 eventos/templates existen en Motor Notif.
- [ ] Tests pasan.
- [ ] Build verde.
- [ ] `dev-restart.sh` limpio.
- [ ] PR #83 mergeado antes del push final.
