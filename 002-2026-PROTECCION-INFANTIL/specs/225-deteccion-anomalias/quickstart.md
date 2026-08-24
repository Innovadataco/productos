# Quickstart: SPEC-225 — Detección de anomalías dinero-vs-valor

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` actualizada (mega-lote 220–227).
- Postgres corriendo: `docker compose up -d db`.
- Dependencias instaladas: `npm install`.
- `.env` configurado (ver `.env.example`).

## 1. Migrar y sembrar

```bash
npx prisma migrate dev
npx prisma db seed
```

Verificar en Prisma Studio (`npx prisma studio`):

- Tabla `anomalias` existe.
- `ParametroSistema` contiene las 10 claves `analisis.anomalias.*`.
- `NotificacionRegla` contiene `analisis.anomalia.detectada` (ADMIN, EMAIL + IN_APP).
- `NotificacionPlantilla` contiene `analisis.anomalia.detectada.email` y `.in_app`.

## 2. Levantar app y workers

```bash
./scripts/dev-restart.sh
```

Debe levantar también UN `worker-anomalias.mjs` (verificar en la salida de procesos y en `/tmp/worker-anomalias-002.log`).

## 3. Probar detección con dataset controlado

Crear datos de prueba (Prisma Studio o script):

1. **Mora anómala MEDIA**: suscripción ACTIVA con 2 pagos AUTORIZADO puntuales y `fechaFin` hace 16 días, sin renovación.
2. **Mora anómala ALTA**: igual pero `fechaFin` hace 31 días.
3. **Cancelación colegio grande**: colegio con 51 filas `Reporte` y suscripción con `canceladaEn` = ahora.
4. **Cancelaciones masivas**: 6 suscripciones con `canceladaEn` dentro de las últimas 24h.

Ejecutar un tick manual:

```bash
TZ=America/Bogota node --env-file-if-exists=.env --import tsx scripts/worker-anomalias.mjs --run-once
```

Verificar:

```sql
SELECT tipo, severidad, sujeto_tipo, sujeto_id FROM anomalias ORDER BY detectada_en DESC;
```

- Caso 1 → `PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL`, severidad `MEDIA`.
- Caso 2 → mismo tipo, severidad `ALTA`.
- Caso 3 → `CANCELACION_COLEGIO_GRANDE`, `ALTA`.
- Caso 4 → `CANCELACIONES_MASIVAS_24H`, `ALTA` (una sola fila).

## 4. Probar deduplicación

Ejecutar `--run-once` una segunda vez sin resolver nada: el conteo de anomalías no cambia.

## 5. Probar alertas al CEO

Con un usuario ADMIN activo con email real (o `ethereal`/buzón de pruebas):

1. Las anomalías ALTA del paso 3 deben haber generado filas en `notificaciones` con `evento = 'analisis.anomalia.detectada'` (una por canal por admin).
2. La anomalía MEDIA (caso 1) NO genera notificación.
3. Cambiar `analisis.anomalias.email_inmediato_habilitado` a `false`, resolver las anomalías, forzar otra ALTA y correr el tick: no se programa email.
4. Devolver el parámetro a `true`.

## 6. Probar la API admin

```bash
# Login como admin
curl -c cookies.txt -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin>","password":"<password>"}'

# Listar solo ALTA abiertas
curl -b cookies.txt "http://localhost:5005/api/admin/analisis/anomalias?severidad=ALTA&estado=ABIERTAS"

# Detalle
curl -b cookies.txt http://localhost:5005/api/admin/analisis/anomalias/<ID>

# Resolver
curl -b cookies.txt -X PATCH http://localhost:5005/api/admin/analisis/anomalias/<ID> \
  -H "Content-Type: application/json" \
  -d '{"notaResolucion":"Gestionada por teléfono"}'

# Resolver de nuevo → 409
# Con sesión de otro rol → 403; sin cookie → 401
```

Tras resolver, otro `--run-once` puede volver a detectar la condición (nueva fila): comportamiento esperado.

## 7. Probar instancia única

```bash
TZ=America/Bogota node --env-file-if-exists=.env --import tsx scripts/worker-anomalias.mjs
echo $?   # debe ser 2 si dev-restart ya levantó uno
```

## 8. Gate local

```bash
npx tsc --noEmit
npm run lint --no-cache
npm run test:unit -- src/lib/analisis src/app/api/admin/analisis
npm run build
git diff --name-status origin/feature/001-scaffolding..HEAD   # solo archivos del mega-lote
```

## 9. Checklist rápido de cierre

- [ ] Migración aditiva aplicada (cero DROP).
- [ ] Seed idempotente (correrlo dos veces no duplica parámetros, regla ni plantillas).
- [ ] 6 reglas detectan con dataset a favor y no detectan con dataset en contra.
- [ ] Deduplicación por anomalía abierta verificada.
- [ ] ALTA → email+in-app; MEDIA/BAJA → sin email; kill-switch funciona.
- [ ] API 200/400/401/403/404/409 según caso; `AuditLog` de resolución registrado.
- [ ] UN solo worker; segundo arranque sale con código 2.
- [ ] `datosContexto` sin PII ni texto de reportes.
- [ ] Gate local verde.
