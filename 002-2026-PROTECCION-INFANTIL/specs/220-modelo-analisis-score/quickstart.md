# Quickstart: SPEC-220 — Modelo Análisis + score de valor de cliente

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` actualizada.
- Docker con Postgres corriendo (`docker compose up -d db`).
- Dependencias instaladas (`npm install`).
- `.env` configurado (ver `.env.example`).
- SPEC-206 (`SesionLog`) y SPEC-210 (`Suscripcion`/`Plan`) ya aplicados en la base.

## 1. Preparar la base de datos

```bash
npx prisma migrate dev     # aplica la migración aditiva analisis_modelo_score
npx prisma db seed         # siembra los 13 parámetros analisis.*
```

Verificar que la migración es aditiva (sin `DROP` ni `ALTER` destructivo):

```bash
git diff --name-only prisma/migrations
# Revisar el migration.sql generado: solo CREATE TYPE / CREATE TABLE / CREATE INDEX /
# ALTER TYPE ... ADD VALUE / ADD CONSTRAINT.
```

## 2. Verificar parámetros y modelos

```bash
npx prisma studio
```

- `ParametroSistema`: deben existir las 13 claves `analisis.*` (12 del brief + `analisis.score.retencion_meses`) con sus defaults.
- Tablas nuevas: `score_clientes`, `reglas_recomendacion`, `recomendaciones`, `digest_semanal`, `anomalias` (vacías).

Repetir `npx prisma db seed` y confirmar que no duplica parámetros (idempotente).

## 3. Sembrar datos de prueba del score

Con Prisma Studio o un script:

1. Crear/tomar una suscripción `ACTIVA` tipo COLEGIO (con `colegioId` cuyo colegio tenga `tenantId`).
2. Crear en el mes actual: 2 `Reporte` con ese `tenantId` (`eliminado = false`), 1 `AlertaColegio`, 1 `SeguimientoCaso`, 3 `SesionLog` con ese `tenantId`.
3. Crear/tomar una suscripción `ACTIVA` tipo PADRE (con `usuarioId`); crear 1 `Reporte` con ese `usuarioId` y 1 `Expediente` con `padreUsuarioId` y `fechaApertura` en el mes actual.

## 4. Ejecutar el recálculo

```bash
# Levantar el worker (instancia única)
TZ=America/Bogota node --import tsx scripts/worker-analisis-score.mjs
```

O invocar el handler una vez si el worker soporta `--run-once`. Verificar en BD:

```sql
SELECT "suscripcionId", periodo, "componenteReportes", "componenteCasos",
       "componenteAlertas", "componenteSesiones", "scoreTotal", "percentilEnCohorte"
FROM score_clientes
WHERE periodo = to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM');
```

Resultado esperado con pesos default:

- Colegio: `scoreTotal = 2×3 + 1×5 + 1×2 + 3×1 = 16` y pesos snapshot 3/5/2/1.
- Padre: `scoreTotal = 1×3 + 1×5 + 0×2 + 0×1 = 8` (alertas = 0 en v1).
- Re-ejecutar el recálculo: las mismas filas se actualizan, no se duplican.

## 5. Verificar la ficha de cliente

```bash
./scripts/dev-restart.sh
```

1. Login como ADMIN y abrir `http://localhost:5005/dashboard/admin/pagos/cliente/<suscripcionId>`.
2. Debe verse la card "Score de valor este mes": total, desglose Reportes/Casos/Alertas/Sesiones con peso aplicado y percentil (si la cohorte tiene más de un miembro).
3. La sección de histórico lista hasta 12 períodos.
4. Abrir la ficha de una suscripción sin score: la card muestra el estado vacío neutral, sin error.

## 6. Probar la purga de retención

```sql
-- Insertar un snapshot de hace 25 meses
INSERT INTO score_clientes (id, "suscripcionId", periodo, "pesoReportes", "pesoCasos",
  "pesoAlertas", "pesoSesiones", "scoreTotal", "calculadoEn")
VALUES ('test-purga-1', '<suscripcionId>', '2024-07', 3, 5, 2, 1, 10, now());
```

Correr el worker. Verificar:

- La fila `test-purga-1` fue eliminada.
- Existe un `AuditLog` con `accion = ANALISIS_SCORE_PURGA` y metadatos `{ filasEliminadas, periodoLimite }`.
- Los snapshots del mes actual siguen intactos.
- Re-correr: no se genera un segundo `AuditLog` (nada que borrar).

## 7. Verificar instancia única del worker

```bash
# Con el worker ya corriendo, en otra terminal:
node --import tsx scripts/worker-analisis-score.mjs
# Debe salir con código 2: "Lock de instancia ya está en uso"
echo $?   # 2
```

## 8. Gate local obligatorio

```bash
npx tsc --noEmit && npm run lint --no-cache && npm run test:unit && npm run build
git diff --name-status origin/feature/001-scaffolding..HEAD
./scripts/dev-restart.sh
```

## 9. Checklist rápido de cierre

- [ ] Migración aditiva aplicada (cero `DROP`).
- [ ] 13 parámetros `analisis.*` sembrados, seed idempotente.
- [ ] Recálculo produce un snapshot por suscripción activa, upsert sin duplicados.
- [ ] Fórmula con pesos default exacta: `3R + 5C + 2A + 1S`; pesos guardados en la fila.
- [ ] Percentil calculado por cohorte; cohorte unitaria → null.
- [ ] Card visible solo para ADMIN en la ficha; estado vacío neutral sin score.
- [ ] Purga elimina > 24 meses con `AuditLog`, conserva el resto, idempotente.
- [ ] Worker instancia única (exit 2) y cron en `America/Bogota`.
- [ ] Servicio `pi-analisis-score` añadido a `docker-compose.prod.yml`.
- [ ] Gate local verde + `dev-restart.sh` limpio.
- [ ] No se tocó `src/lib/ai/**` ni el rate-limit del reporte público.
