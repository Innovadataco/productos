# Quickstart: SPEC-226 — Ejecución de acciones automáticas

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` actualizada, con SPEC-221 (modelo + worker de reglas) ya integrado.
- Docker con Postgres corriendo (`docker compose up -d db`), `npm install` hecho, `.env` configurado (ver `.env.example`).
- Motor Notificaciones operativo (SPEC-201..204) y módulo Bonos (SPEC-216) — ambos en prod.

## 1. Preparar la base de datos

```bash
npx prisma migrate dev        # aplica la migración aditiva de EjecucionAccion + enums + AccionAudit
npx prisma db seed            # siembra parámetros y eventos/plantillas Motor Notif (idempotente)
npx prisma db seed            # segunda corrida: no debe duplicar nada (SC-007)
```

## 2. Verificar seed

En Prisma Studio (`npx prisma studio`):

- `ParametroSistema`: `ratelimit.analisis_accion.window_seconds` (3600), `ratelimit.analisis_accion.max_requests` (20), `analisis.acciones.alertas_destinatarios` (`[]`).
- `NotificacionRegla`/`NotificacionPlantilla`: eventos `analisis.alerta.admin` y `analisis.operador.asignacion` con plantilla `es`.

## 3. Levantar app

```bash
./scripts/dev-restart.sh
```

## 4. Probar ejecución automática (vía worker de reglas)

```bash
# 1. Crear en BD una regla modo EJECUTA con accionEjecutable = "crear_bono" y
#    accionParametros = {"tipoBono":"DESCUENTO_PCT","valor":20,"vigenciaDias":15}
# 2. Crear datos candidatos que disparen su sqlQuery (ej. suscripción por vencer)
# 3. Correr un tick del worker de reglas (SPEC-221)
```

Verificar:

```sql
SELECT id, estado, "ejecutadaAutomatica" FROM recomendaciones ORDER BY "generadaEn" DESC LIMIT 1;
-- estado = 'APLICADA', ejecutadaAutomatica = true

SELECT "tipoAccion", estado, resultado FROM ejecuciones_accion ORDER BY "ejecutadaEn" DESC LIMIT 1;
-- tipoAccion = 'CREAR_BONO', estado = 'EJECUTADA', resultado.bonoId presente

SELECT nombre, tipo, valor, "vigenciaInicio", "vigenciaFin", activo FROM bonos_promocionales ORDER BY "createdAt" DESC LIMIT 1;
-- nombre con prefijo de la regla, vigenciaFin = vigenciaInicio + 15 días (hora Bogotá)

SELECT accion, "tipoRecurso", "recursoId" FROM audit_logs ORDER BY "createdAt" DESC LIMIT 1;
-- accion = 'ANALISIS_ACCION_EJECUTADA', metadatos con reglaId y recomendacionId
```

## 5. Probar rate-limit por regla

```bash
# Bajar el límite temporalmente:
# UPDATE parametros_sistema SET valor = '2' WHERE clave = 'ratelimit.analisis_accion.max_requests';
# Disparar 3 ejecuciones de la misma regla en la misma hora
```

Verificar que la tercera `EjecucionAccion` queda `FALLIDA` con `motivoFallo = 'rate_limit_regla'` y que NO se creó un tercer bono. Restaurar el parámetro a `20`.

## 6. Probar endpoints admin

```bash
# Login admin
curl -c cookies.txt -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}'

# Aplicar manualmente una sugerencia PENDIENTE (debe dar 200)
curl -b cookies.txt -X POST http://localhost:5005/api/admin/analisis/recomendaciones/REC_ID/aplicar

# Revertir la ejecución (debe dar 200; el bono queda activo=false)
curl -b cookies.txt -X POST http://localhost:5005/api/admin/analisis/recomendaciones/REC_ID/revertir \
  -H "Content-Type: application/json" \
  -d '{"motivo":"Prueba de rollback manual"}'

# Revertir de nuevo (debe dar 409)
curl -b cookies.txt -X POST http://localhost:5005/api/admin/analisis/recomendaciones/REC_ID/revertir \
  -H "Content-Type: application/json" \
  -d '{"motivo":"Segunda vez"}'

# Con usuario no admin (debe dar 403)
```

## 7. Probar asignar_operador y crear_alerta

```bash
# Regla EJECUTA con accionEjecutable = "asignar_operador", accionParametros = {"estrategia":"menor_carga"}
# Regla EJECUTA con accionEjecutable = "crear_alerta", accionParametros = {"severidad":"ALTA","mensaje":"Prueba"}
# Correr tick del worker de reglas
```

Verificar: `EjecucionAccion.resultado.operadorId` presente; notificación programada al operador (`notificaciones` con evento `analisis.operador.asignacion`); alerta admin programada (evento `analisis.alerta.admin`).

## 8. Ejecutar gate local

```bash
npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- src/lib/analisis src/app/api/admin/analisis && npm run build
git diff --name-status origin/feature/001-scaffolding..HEAD   # solo archivos del lote, cero D/M ajenos
```

## 9. Checklist rápido de cierre

- [ ] Migración aditiva aplicada sin errores (cero DROP).
- [ ] Seed idempotente (dos corridas sin duplicados).
- [ ] `crear_bono` crea `BonoPromocional` con vigencia Bogotá y nombre trazable.
- [ ] `enviar_notificacion` y `crear_alerta` pasan solo por `programar()` del Motor Notif.
- [ ] `asignar_operador` registra operador y notifica.
- [ ] Rate-limit por regla rechaza sin efectos colaterales.
- [ ] `aplicar` (200/403/404/409) y `revertir` (200/409) responden con códigos canónicos.
- [ ] Rollback desactiva bono / cancela notificación / desasigna operador.
- [ ] Toda ejecución en `AuditLog` con regla origen.
- [ ] Un fallo de handler no detiene el tick del worker.
- [ ] `src/lib/ai/**` y Motor Notif sin modificaciones de código.
- [ ] Gate local verde + `dev-restart.sh` limpio.
