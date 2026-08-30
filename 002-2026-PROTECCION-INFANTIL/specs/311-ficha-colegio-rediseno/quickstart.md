# Quickstart — SPEC-311 · Ficha colegio admin Fase 2

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

Guía práctica para validar Fase 2 antes de emitir REALIZADO.

## Prerrequisitos

- Rama `work/pi-SPEC-311-ficha-colegio-rediseno` con todos los cambios locales.
- BD local levantada (`docker compose up -d db`).
- `npm install` corrido.
- Acceso a `pi-vps` para SC-009 (colegio más grande de prod).

## 1. Tests locales

Correr **desde `002-2026-PROTECCION-INFANTIL/`**:

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/dal/repositories/analytics-colegio
```

Esperado: verde. Cubre invariantes `distribucionRol.suma === total`, `operadoresAsignados` DISTINCT, `lineaTiempo.picoActividad`, `serieMensual` ordenada ASC.

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/components/modules/admin/ColegioDetalleSecciones
```

Esperado: verde. Cubre:
- SC-011: Bloque A aparece primero (`querySelector` orden en el árbol).
- SC-007: Bloque A tiene 3 KPIs + operadores + CTA con `href*="colegioId="`.
- SC-006: los 7 campos originales aparecen en el DOM del rediseño (no se pierde información).
- Regresión: 4 bloques presentes en orden A→D.

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/components/modules/admin/ColegioLineaTiempo
```

Esperado: verde. Cubre:
- Renderiza 4 hitos ordenados temporalmente izquierda-a-derecha.
- Sin reportes → 2 hitos (`ingreso` + `hoy`).
- Altura < 100 px (test de estilo o snapshot).

## 2. Gate calidad (constitución §8.3 + candado 24 D-55)

```bash
npx tsc --noEmit
npm run lint -- src/lib/dal/repositories/analytics-colegio.ts src/lib/dal/repositories/analytics-colegio-types.ts src/components/modules/admin/ColegioDetalleSecciones.tsx src/components/modules/admin/ColegioLineaTiempo.tsx 2>&1 | grep -E "error|✖" | head
npm run test
(set -a; source .env.test; set +a; npm run build 2>&1 | tail -5)
```

Todo debe pasar. Cero errores TS. Cero errores lint nuevos en los archivos tocados (`grep error` explícito · aprendizaje SPEC-303 D-55).

## 3. SC-009 · Rendimiento < 800 ms colegio más grande

Identificar en prod el colegio con más volumen:

```bash
ssh pi-vps 'docker exec pi-db psql -U proteccion -d proteccion_infantil -c "SELECT c.id, c.nombre, COUNT(DISTINCT r.id) AS reportes FROM \"Colegio\" c LEFT JOIN \"AlertaColegio\" a ON a.\"colegioId\" = c.id LEFT JOIN \"Reporte\" r ON r.\"tenantId\" = c.\"tenantId\" OR r.id = a.\"reporteId\" GROUP BY c.id, c.nombre ORDER BY reportes DESC LIMIT 3;"'
```

Con el colegio más grande, medir el endpoint en local contra fixture equivalente:

```bash
# Local: crear fixture con volumen similar en la BD de dev, luego:
time curl -s -H "Cookie: token=<jwt_admin_dev>" http://localhost:5005/api/admin/analytics/colegios/<colegioId_local> -o /dev/null
```

Esperado: **< 800 ms** total (fetch + response). Pegar tiempo real en el mensaje pre-REALIZADO.

Si supera 800 ms:
- Revisar plan de queries adicionales (todas en `Promise.all`).
- Considerar agrupar `serieMensual` por trimestre si > 60 meses (D6 research).
- Si sigue, reportar HALLAZGO a Fábrica antes de REALIZADO.

## 4. SC-008 · Contraste AA

```bash
node scripts/contrast_check.js
```

Debe pasar sin regresión respecto a Fase 1. Los 4 bloques nuevos usan tokens PI `pino`/`ambar`/`rubi`/`papel` — heredan el contraste ya validado.

## 5. Verificación en vivo local (constitución §8.3)

```bash
./scripts/dev-restart.sh
```

Abrir en el navegador:
- `/dashboard/admin/estadisticas/operacion/colegios/<colegioId_local>` con un colegio que tenga actividad histórica.
- Verificar visualmente los 4 bloques A→D en orden.
- Click en `[Ver casos abiertos]` → navega a `/dashboard/admin/reportes?colegioId=...` (SC-013).
- Click en `[Ver alertas]` → navega a `/dashboard/admin/alertas?colegioId=...` (SC-013).

Documentar hallazgos en el mensaje pre-REALIZADO.

## 6. Gate pre-push (candado A-47)

```bash
git fetch origin && git rebase origin/main && git diff --name-status origin/main..HEAD
```

Esperado (~10-15 archivos):
- `M src/lib/dal/repositories/analytics-colegio.ts`
- `M src/lib/dal/repositories/analytics-colegio-types.ts`
- `M src/components/modules/admin/ColegioDetalleSecciones.tsx`
- `A src/components/modules/admin/ColegioLineaTiempo.tsx`
- `A src/components/modules/admin/ColegioLineaTiempo.test.tsx` (si aplica)
- `M src/components/modules/admin/ColegioDetalleSecciones.test.tsx` (o `A` si no existía)
- `A specs/311-ficha-colegio-rediseno/**` (7 archivos spec-kit)
- `M specs/README.md`
- `M .specify/feature.json`

Cualquier archivo fuera de este set → HALLAZGO, restaurar y re-correr.

## 7. Push + PR + espera CI verde

```bash
git push
gh pr create --base main --head work/pi-SPEC-311-ficha-colegio-cimiento --title "feat(admin): SPEC-311 · Ficha colegio Fase 2 · rediseño 4 bloques A→D [002-PI-210]" --body "..."
```

Esperar `gh pr checks <N>` en verde completo (regla dura §0.0 v6.0 · aprendizaje SPEC-303: `npm run lint -- <archivo>` + grep `error` explícito antes de reportar CUMPLE local).

## 8. Señal REALIZADO a Fábrica PI-1 (`idc-d9`)

Con evidencia:
- Commit hash.
- PR link.
- Tiempo real SC-009 (< 800 ms).
- Nota tests verdes + CI verde.
- Screenshot opcional del rediseño con datos reales.

## 9. Post-CUMPLE (Fábrica ejecuta)

- Merge y deploy autorizados (D-94 + D-24).
- Fábrica verifica tabla §6b post-deploy + inspección visual 4 bloques.
- Fábrica cierra I-98 con evidencia dura.

## 10. Rollback (contingencia)

Si post-deploy aparece regresión:
1. `git revert <commit>` en main.
2. Push.
3. La ficha vuelve al comportamiento Fase 1 (7 secciones planas · sigue funcionando).
4. Reabrir spec.

## Referencias

- [spec.md](./spec.md) — US1-US4, FR-001-020, SC-001+006-013
- [plan.md](./plan.md) — decisiones D1-D7
- [research.md](./research.md) — verificaciones V1-V7
- [data-model.md](./data-model.md) — algoritmos de derivación
- [contracts/payload-extension.md](./contracts/payload-extension.md) — contrato aditivo
- Instructivo 002-PI-210 §Verificación en vivo esperada
