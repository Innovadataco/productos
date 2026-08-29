# Quickstart: SPEC-221 — Motor de reglas de recomendación

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` actualizada, con SPEC-220 ya implementado (parámetros `analisis.*` base).
- Postgres corriendo: `docker compose up -d db` (contenedor `002-2026-proteccion-infantil-db-1`, puerto 5433).
- Dependencias instaladas (`npm install`) y `.env` completo (ver `.env.example`).

## 1. Preparar la base de datos

```bash
npx prisma migrate dev      # aplica la migración aditiva (tablas + enums)
npx prisma db seed          # siembra 7 reglas + 3 parámetros analisis.recomendaciones.*
```

## 2. Verificar seed

```bash
npx prisma studio
```

- `ParametroSistema`: deben existir `analisis.recomendaciones.frecuencia_evaluacion_min` (60), `analisis.recomendaciones.expiracion_dias` (7), `analisis.recomendaciones.statement_timeout_ms` (5000).
- `ReglaRecomendacion`: 7 filas con claves `vencimiento.T_menos_7`, `mora.T_mas_30`, `padres_de_colegio_no_renovado`, `crecimiento_ciudad_anomalo`, `cliente_puntual_ahora_atrasado`, `alta_freemium_expira_manana`, `nuevo_referido_registrado_sin_pagar_7d`; todas `modo = RECOMIENDA`, `activa = true`.
- Repetir `npx prisma db seed` y confirmar que sigue habiendo 7 reglas (idempotencia).

## 3. Crear datos candidatos de prueba

Con Prisma Studio o un script, crear:

- Una `Suscripcion` `ACTIVA`, `tipoTitular = COLEGIO`, con `fechaFin` a 5 días en el futuro (candidata de `vencimiento.T_menos_7`).
- Una `Suscripcion` `esFreemium = true` con `freemiumFechaFin` a 12 horas (candidata de `alta_freemium_expira_manana`).

## 4. Levantar app y worker

```bash
./scripts/dev-restart.sh
```

El script debe matar y levantar también `worker-analisis-reglas.mjs` (verificar en la salida "Procesos:"). Arranque manual alternativo:

```bash
node --env-file-if-exists=.env --import tsx scripts/worker-analisis-reglas.mjs
```

Para prueba rápida, bajar en BD la `frecuenciaMin` de `vencimiento.T_menos_7` a 1 (minuto) antes de levantar.

## 5. Verificar generación de recomendaciones

Tras el primer ciclo de evaluación (≤ 2 min con `frecuenciaMin = 1`):

```sql
SELECT titulo, estado, prioridad, sujeto_tipo, sujeto_id, expira_en
FROM recomendaciones
ORDER BY generada_en DESC;
```

- Debe haber una `Recomendacion` PENDIENTE por cada candidato creado en §3, con `titulo` renderizado (sin placeholders `{{...}}` visibles si la query expone todas las variables).
- Esperar un segundo ciclo y confirmar que NO aparecen duplicados para el mismo `(reglaId, sujetoId)`.

## 6. Verificar sandbox SQL

```bash
# Cambiar temporalmente la query de una regla de prueba a algo peligroso:
# UPDATE reglas_recomendacion SET sql_query = 'DELETE FROM usuarios' WHERE clave = '...';
```

- En el siguiente tick, el log del worker (`/tmp/` o consola) debe mostrar el rechazo de validación y las demás reglas deben seguir evaluándose.
- Verificar `AuditLog` con el intento registrado.
- Restaurar la regla con `npx prisma db seed` o manualmente.

## 7. Probar el endpoint de resolución

```bash
# Login como admin
curl -c cookies.txt -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}'

# Resolver como APLICADA (200)
curl -b cookies.txt -X POST http://localhost:5005/api/admin/analisis/recomendaciones/REC_ID/resolver \
  -H "Content-Type: application/json" \
  -d '{"estado":"APLICADA","motivo":"Llamé al rector, renueva mañana"}'

# Repetir (409, ya resuelta)
curl -b cookies.txt -X POST http://localhost:5005/api/admin/analisis/recomendaciones/REC_ID/resolver \
  -H "Content-Type: application/json" \
  -d '{"estado":"IGNORADA"}'
```

Verificar en BD: `estado = APLICADA`, `resueltaEn`, `resueltaPorAdminId`, `motivoResolucion` y fila en `AuditLog` con acción `RECOMENDACION_RESUELTA`.

## 8. Verificar expiración

```sql
-- Forzar una recomendación vencida:
UPDATE recomendaciones SET expira_en = NOW() - INTERVAL '1 hour'
WHERE id = 'REC_ID';
```

Tras el siguiente tick del worker: `estado = EXPIRADA`, `motivoResolucion = 'EXPIRACION_AUTOMATICA'`. Re-ejecutar el tick y confirmar que no cambia nada (idempotente).

## 9. Verificar unicidad del worker

```bash
# Con el worker ya corriendo, intentar levantar otro:
node --env-file-if-exists=.env --import tsx scripts/worker-analisis-reglas.mjs
echo $?   # debe ser 2
```

## 10. Gate local

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run test -- src/lib/analisis src/app/api/admin/analisis
npm run build
./scripts/dev-restart.sh
```

## 11. Checklist rápido de cierre

- [ ] Migración aditiva aplicada sin errores (cero DROP).
- [ ] Seed idempotente: 7 reglas `RECOMIENDA` + 3 parámetros.
- [ ] Motor genera recomendaciones y deduplica por `(reglaId, sujetoId)`.
- [ ] Sandbox rechaza SQL no-read-only y sigue con las demás reglas.
- [ ] Worker: instancia única (exit 2), expiración idempotente.
- [ ] Regla `EJECUTA` genera sin ejecutar acción (`ejecutadaAutomatica = false`).
- [ ] Endpoint: 200/400/403/404/409 según matriz + `AuditLog`.
- [ ] Gate local verde.
