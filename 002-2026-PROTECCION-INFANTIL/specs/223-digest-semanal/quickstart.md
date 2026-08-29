# Quickstart: SPEC-223 — Digest semanal al CEO

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` actualizada, con SPEC-220 y SPEC-221 implementadas (modelos `ScoreCliente`, `Recomendacion`; `DigestSemanal` si no la creó esta spec por plan B).
- Motor Notificaciones operativo (SPEC-201..204, ya en prod) y worker `pi-notificaciones` corriendo para el envío real.
- Docker con Postgres corriendo (`docker compose up -d db`), `npm install`, `.env` completo (ver `.env.example`).

## 1. Preparar la base de datos

```bash
npx prisma migrate dev     # aplica enum AccionAudit aditivo (+ DigestSemanal si plan B)
npx prisma db seed         # siembra analisis.digest.*, evento, reglas y plantillas
```

## 2. Verificar seed

En Prisma Studio (`npm run db:studio`):

- `ParametroSistema`: existen `analisis.digest.enabled` (`true`), `analisis.digest.dia_semana` (`1`), `analisis.digest.hora_bogota` (`8`), `analisis.digest.destinatarios_emails` (`""`).
- `NotificacionRegla`: dos filas con `evento = analisis.digest.semanal` (canales `EMAIL` e `IN_APP`, `obligatoria = false`).
- `NotificacionPlantilla`: `analisis.digest.semanal.email` y `analisis.digest.semanal.in_app` con cuerpo en español.

Volver a correr `npx prisma db seed` y confirmar que no duplica nada (idempotencia).

## 3. Levantar app y worker

```bash
./scripts/dev-restart.sh
```

Verificar en los logs del worker que se registró el schedule:

```text
[...] schedule analisis-digest-semanal registrado: cron "0 8 * * 1" tz America/Bogota
```

## 4. Sembrar datos de prueba de la semana anterior

Con Prisma Studio o un script de seed de desarrollo, crear en la ventana de la semana anterior (lunes-domingo Bogotá):

- 2 suscripciones nuevas (`Suscripcion.createdAt` en la ventana) y 1 cancelada (`canceladaEn` en la ventana).
- 3 pagos `AUTORIZADO` con `fechaAutorizacion` en la ventana (mezclar COP y otra moneda para ver ambos recaudos).
- 6 `Recomendacion` en estado `PENDIENTE` con prioridades distintas (10..90) — el top 5 debe excluir la de menor prioridad.
- 1 `Recomendacion` `APLICADA` — no debe salir en el top 5.
- Snapshots `ScoreCliente` del período (al menos 5, para ver top 3 / bottom 3).
- Un usuario ADMIN activo con email real de prueba (o el tuyo).

## 5. Ejecutar el digest manualmente

El schedule corre solo los lunes; para validar hoy, forzar una corrida:

```bash
# Opción A: endpoint/script de desarrollo si se expone (ver tasks.md)
# Opción B: ejecutar el módulo directamente
node --import tsx -e "import('./src/lib/analisis/digest-semanal.ts').then(m => m.ejecutarDigestSemanal()).then(r => console.log(r))"
```

Resultado esperado: `{ ejecutada: true, periodo: "2026-Wnn", generados: N, enviados: N, fallidos: 0, omitidos: 0 }`.

## 6. Verificar resultados

```sql
-- Digest persistido (una fila por destinatario, sin duplicados)
SELECT periodo, "destinatarioId", estado, "enviadoEn" FROM digest_semanal ORDER BY "generadoEn" DESC;

-- Notificaciones encoladas por el motor (EMAIL + IN_APP por destinatario)
SELECT evento, canal, "destinatarioEmail", estado FROM notificaciones
WHERE evento = 'analisis.digest.semanal' ORDER BY "createdAt" DESC;

-- Auditoría SYSTEM
SELECT accion, "tipoRecurso", "usuarioId", metadatos FROM audit_logs
WHERE accion LIKE 'ANALISIS_DIGEST_%' ORDER BY "creadoEn" DESC;
-- usuarioId debe ser NULL en todas
```

Abrir el email recibido: asunto `Resumen semanal PI · 2026-Wnn · Top 5 decisiones para esta semana`, 6 secciones, enlace al panel funcional, canales oficiales al pie.

## 7. Probar idempotencia y casos borde

1. **Re-ejecución**: correr el paso 5 otra vez → `enviados: 0, omitidos: N`; cero filas nuevas en `digest_semanal`.
2. **Reintento de fallido**: cambiar un digest a `estado = 'FALLIDO'` en BD, re-ejecutar → se regenera y envía solo ese.
3. **Opt-out**: en `/dashboard/perfil/notificaciones`, apagar `analisis.digest.semanal · email`; re-ejecutar con digest en FALLIDO → el digest queda `ENVIADO` y solo hay notificación `IN_APP`.
4. **Destinatarios por parámetro**: poner dos correos en `analisis.digest.destinatarios_emails`, re-ejecutar → llega a esos correos. Dejar uno mal formado (`"correo-malo"`) → warn en log, el otro llega.
5. **Sin destinatarios**: param vacío y sin usuarios ADMIN activos → `AuditLog` `ANALISIS_DIGEST_FALLIDO` con motivo `sin_destinatarios`, el job termina sin excepción.
6. **Apagado**: `analisis.digest.enabled = false` → el handler retorna `ejecutada: false` con log informativo.
7. **Frontera de semana**: un pago con `fechaAutorizacion` el domingo 23:59 Bogotá cuenta en la semana que cierra; uno el lunes 00:01 cuenta en la siguiente (cubierto por tests, verificable en los JSON persistidos).

## 8. Gate de calidad

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run test -- src/lib/analisis
npm run test:unit
npm run build
./scripts/dev-restart.sh
```

## 9. Checklist rápido de cierre

- [ ] Migración aditiva aplicada (enum + tabla si plan B), cero destructivas.
- [ ] Seed idempotente (params + evento + reglas + plantillas).
- [ ] Schedule registrado con cron derivado de parámetros y `tz: America/Bogota`.
- [ ] Digest generado con las 6 secciones y KPIs correctos.
- [ ] Envío solo vía `motor.programar` (EMAIL + IN_APP), opt-out respetado.
- [ ] Idempotencia por `(periodo, destinatarioId)` verificada.
- [ ] `AuditLog` SYSTEM con `usuarioId = null` y solo metadatos agregados.
- [ ] Cero textos de reportes / identificadores / PII de menores en el digest.
- [ ] Tests de frontera de semana (23:59/00:01, cambio de año ISO) en verde.
- [ ] Gate local completo en verde.
