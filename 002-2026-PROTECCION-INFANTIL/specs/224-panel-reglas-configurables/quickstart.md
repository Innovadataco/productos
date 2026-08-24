# Quickstart: SPEC-224 — Panel de reglas configurables

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` con SPEC-220 y SPEC-221 ya implementadas (modelos `ReglaRecomendacion`, `Recomendacion`, worker de evaluación y 7 reglas semilla presentes).
- Postgres del proyecto corriendo (`docker compose up -d db`, puerto 5433).
- Dependencias instaladas (`npm install`) y `.env` configurado (ver `.env.example`).

## 1. Preparar la base de datos

```bash
npx prisma migrate dev      # aplica la migración aditiva de SPEC-224
npx prisma db seed          # siembra analisis.reglas.* y permiso analisis_admin (idempotente)
```

Verificar en `npx prisma studio`:

- `ParametroSistema`: `analisis.reglas.test_timeout_ms` (5000), `analisis.reglas.test_max_filas` (50).
- `PermisoModulo`: clave `analisis_admin` concedida a `ADMIN`.
- Tabla `regla_recomendacion_historial` creada (vacía).

## 2. Levantar la app

```bash
./scripts/dev-restart.sh
```

## 3. Validación manual del panel

Login como ADMIN y abrir `http://localhost:5005/dashboard/admin/analisis/reglas`.

### 3.1 Tabla del catálogo

- [ ] Aparecen las 7 reglas semilla de SPEC-221, todas en modo "Recomienda".
- [ ] Columnas: nombre, categoría, modo, frecuencia, estado, generadas últimos 7 días.
- [ ] Orden por prioridad descendente.

### 3.2 Test SQL en el editor

1. Abrir "Crear regla nueva".
2. Pegar en el editor SQL:

   ```sql
   SELECT s.id AS "suscripcionId", s."fechaFin"
   FROM "suscripciones" s
   WHERE s.estado = 'ACTIVA'
   ```

3. Pulsar **Probar**:
   - [ ] Devuelve muestra de filas reales (máx 50), columnas, conteo y duración en ms.
4. Probar con `DELETE FROM "suscripciones"`:
   - [ ] Rechazado con 400 y mensaje claro, sin ejecutarse.
5. Probar con `SELECT pg_sleep(30)`:
   - [ ] Aborta por timeout (~5 s) con error legible.
6. Escribir plantilla `Llama a {{colegio}} · vence {{fechaFin}}`:
   - [ ] El editor marca `{{colegio}}` como variable sin columna (advertencia) y `{{fechaFin}}` como OK.

### 3.3 Crear y versionar

1. Guardar la regla de prueba (clave `test.vencimientos_7d`, motivo inicial no aplica).
2. Editar `umbralMinimo` con motivo "ajusto umbral tras primera prueba":
   - [ ] `version` pasa de 1 a 2.
   - [ ] `GET /api/admin/analisis/reglas/<id>/historial` muestra la versión 1 con snapshot y motivo.
3. En Prisma Studio, tabla `AuditLog`:
   - [ ] Entradas `REGLA_CREADA`, `REGLA_ACTUALIZADA` y `REGLA_SQL_TEST` (esta última sin filas en metadatos).

### 3.4 Promoción con confirmación fuerte

1. En una regla semilla, pulsar **Cambiar a EJECUTA**:
   - [ ] El diálogo exige escribir `EJECUTA` y un motivo de ≥ 20 caracteres; el botón queda deshabilitado hasta cumplir ambos.
2. Confirmar:
   - [ ] La regla pasa a modo "Ejecuta sola".
   - [ ] `AuditLog` tiene `REGLA_PROMOVIDA_EJECUTA` con `valorAnterior=RECOMIENDA`, `valorNuevo=EJECUTA` y el motivo.
3. Intentar por API sin confirmación:

   ```bash
   curl -b cookies.txt -X POST http://localhost:5005/api/admin/analisis/reglas/<id>/modo \
     -H "Content-Type: application/json" \
     -d '{"modo":"EJECUTA","motivo":"motivo de mas de veinte caracteres"}'
   ```

   - [ ] Retorna 400.
4. Revertir a "Recomienda" con motivo:
   - [ ] `AuditLog` registra `REGLA_REVERTIDA_RECOMIENDA`.

### 3.5 Seguridad perimetral

- [ ] Sin sesión: `GET /api/admin/analisis/reglas` → 401.
- [ ] Sesión con rol `PARENT` → 403.
- [ ] `POST /api/admin/analisis/reglas` con `clave` duplicada → 409.
- [ ] La página no aparece en la navegación de un rol sin el permiso.

## 4. Gate local del mega-lote (I-101)

```bash
npx tsc --noEmit && npm run lint --no-cache \
  && npm run test:unit -- src/lib/analisis src/app/api/admin/analisis \
  && npm run build

git diff --name-status origin/feature/001-scaffolding..HEAD
# Solo archivos de SPEC-224 + SPECs anteriores del lote. Cero D/M ajenos.
```

## 5. Checklist rápido de cierre

- [ ] Migración aditiva aplicada sin errores (cero DROP).
- [ ] Seed idempotente (correr dos veces, mismo resultado).
- [ ] Test SQL: válida OK, mutación rechazada, timeout aborta.
- [ ] Versionado: snapshot + incremento de versión por edición.
- [ ] Promoción: confirmación fuerte + motivo + AuditLog.
- [ ] Tests unitarios/integración verdes; build verde.
- [ ] `./scripts/dev-restart.sh` limpio; un solo worker.
- [ ] Sin cambios en `src/lib/ai/**` ni en rate-limit del reporte público.
