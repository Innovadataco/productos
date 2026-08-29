# Quickstart — SPEC-303 · Ficha colegio admin Fase 1

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

Guía práctica para validar la Fase 1 antes de emitir REALIZADO. Sigue los candados del instructivo 002-PI-209 §Verificación en vivo esperada.

## Prerrequisitos

- Rama `work/pi-SPEC-303-ficha-colegio-cimiento` con todos los cambios locales.
- BD local levantada (`docker compose up -d db` desde `002-2026-PROTECCION-INFANTIL/`).
- Node ≥ 22, `npm install` corrido.
- Acceso a `pi-vps` para el chequeo BD prod (SC-001 candado obligatorio) o Fábrica lo corre.

## 1. Tests locales

Correr **desde `002-2026-PROTECCION-INFANTIL/`**:

```bash
npx vitest run src/lib/dal/repositories/colegio-actividad.test.ts
```

**Esperado**: verde en los 4 casos (colegio A con múltiples rutas, colegio B con una ruta, colegio C aislado, A/B cross-leak cero).

```bash
npx vitest run src/lib/analytics/hallazgos-colegio
```

**Esperado**: cobertura previa + los 4 nuevos casos (verde limpio, amarillo por 1 hallazgo positivo, rojo por casos_abiertos_alto, rojo por sin_movimiento_dias).

```bash
npx vitest run src/components/modules/admin/ColegiosAnalyticsTable
```

**Esperado**: verde. Verifica leyenda visible, columna "Reportes" con conteo, motivo bajo no-verde.

```bash
npx vitest run src/components/modules/admin/ColegioDetalleSecciones
```

**Esperado**: verde. Sección 3 muestra números reales cuando `total>0`, EmptyState nuevo cuando `total=0`.

## 2. Gate de calidad (constitución §8.3)

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

Todo debe pasar. Cero errores TS. Cero warnings de lint nuevos.

## 3. Verificación en BD prod del caso testigo I-98 (candado SC-001 · obligatorio pre-REALIZADO)

Identificar en prod un colegio con `AlertaColegio > 0`:

```bash
ssh pi-vps 'cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U proteccion -d proteccion_infantil -tc "SELECT c.id, c.nombre, COUNT(a.id) AS alertas FROM \"Colegio\" c JOIN \"AlertaColegio\" a ON a.\"colegioId\" = c.id GROUP BY c.id, c.nombre ORDER BY alertas DESC LIMIT 5;"'
```

Del resultado, tomar el `colegioId` con más alertas (típicamente Sagrado Corazón o similar del caso testigo I-98 con 45 alertas).

Luego correr el criterio equivalente a `actividadDelColegio`:

```bash
COL=<colegioId>
ssh pi-vps "cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U proteccion -d proteccion_infantil -tc \"SELECT COUNT(DISTINCT r.id) FROM \\\"Reporte\\\" r WHERE r.\\\"tenantId\\\" = (SELECT \\\"tenantId\\\" FROM \\\"Colegio\\\" WHERE id = '$COL') OR r.id IN (SELECT \\\"reporteId\\\" FROM \\\"AlertaColegio\\\" WHERE \\\"colegioId\\\" = '$COL') OR (r.identificador, r.\\\"plataformaId\\\") IN (SELECT ie.identificador, ie.\\\"plataformaId\\\" FROM \\\"IdentificadorEstudiante\\\" ie JOIN \\\"Estudiante\\\" e ON e.id = ie.\\\"estudianteId\\\" WHERE e.\\\"colegioId\\\" = '$COL') OR (r.identificador, r.\\\"plataformaId\\\") IN (SELECT identificador, \\\"plataformaId\\\" FROM \\\"IdentificadorProfesor\\\" WHERE \\\"colegioId\\\" = '$COL') OR (r.identificador, r.\\\"plataformaId\\\") IN (SELECT identificador, \\\"plataformaId\\\" FROM \\\"IdentificadorAcudiente\\\" WHERE \\\"colegioId\\\" = '$COL');\""
```

**Esperado**: número > 0 (SC-001). **Si es 0**: HALLAZGO — el diseño está mal. PARA, reporta a Fábrica, NO abras PR sin resolver.

Adjuntá el output exacto (comando + número devuelto) en la señal REALIZADO.

## 4. Verificación local del endpoint (opcional pero recomendado)

```bash
npm run dev
# En otra terminal:
curl -H "Cookie: token=<jwt_admin_local>" http://localhost:5005/api/admin/analytics/colegios | jq '.umbralesSemaforo, (.items | length)'
curl -H "Cookie: token=<jwt_admin_local>" http://localhost:5005/api/admin/analytics/colegios/<colegioId_local> | jq '.actividadReportes'
```

**Esperado**:
- `umbralesSemaforo` con las 8 keys (5 preexistentes + 3 nuevas).
- `actividadReportes` con `{ total, porEstado, casosAbiertos, ultimaActividad, rango }`.

## 5. Verificación en la UI (constitución §8.3 · verificación en vivo)

Levantar `./scripts/dev-restart.sh` y abrir en el navegador:

1. `/dashboard/admin/estadisticas/operacion?tab=colegios` — verificar:
   - Leyenda del semáforo visible sin hover, con 3 estados y umbrales reales.
   - Columna "Reportes" con conteos.
   - Al menos un colegio no-verde muestra la línea de motivo bajo el estado.
2. Click en cualquier colegio con actividad → `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` — verificar:
   - Sección "3. Actividad de reportes" muestra números reales (no "Sin datos").
   - Otras 6 secciones renderizan sin errores (regresión).

## 6. Gate pre-push (candado A-47)

```bash
git fetch origin && git rebase origin/main && git diff --name-status origin/main..HEAD
```

**Esperado** (~15-25 archivos):
- `A src/lib/dal/repositories/colegio-actividad.ts`
- `A src/lib/dal/repositories/colegio-actividad.test.ts`
- `M src/app/api/admin/analytics/colegios/route.ts`
- `M src/app/api/admin/analytics/colegios/[id]/route.ts`
- `M src/components/modules/admin/ColegiosAnalyticsTable.tsx`
- `M src/components/modules/admin/ColegioDetalleSecciones.tsx`
- `M prisma/seed.ts`
- `A specs/303-ficha-colegio-cimiento/**` (7 archivos)
- `M specs/README.md`
- `M .specify/feature.json`
- Opcionales: tests de componentes UI si se crean junto.

Cualquier archivo fuera de este set → HALLAZGO, restaurar y re-correr.

## 7. Push + PR + espera CI verde

```bash
git push
gh pr create --base main --head work/pi-SPEC-303-ficha-colegio-cimiento --title "feat(admin): SPEC-303 · Cimiento de datos + semáforo declarado ficha colegio [002-PI-209]" --body "$(cat <<'EOF'
Cierra bloqueo I-104 (leyenda + columna + motivo) y prepara terreno para I-98 en Fase 2.

Ver spec.md/plan.md/research.md/data-model.md/contracts/quickstart.md.

Refs: instructivo 002-PI-209, brief BRIEF-FICHA-COLEGIO-ADMIN.md §11 SPEC-252.
EOF
)"
```

Esperar `gh pr checks <N>` en verde completo (regla dura §0.0 v6.0).

## 8. Señal REALIZADO a Fábrica PI-1 (`idc-d9`)

Con evidencia:
- Commit hash.
- PR link.
- Output SQL del caso testigo (número devuelto > 0).
- Nota: tests locales verdes + CI verde.

## 9. Post-CUMPLE (Fábrica ejecuta)

- Merge del PR (Fábrica pide a CEO IDC).
- Deploy (CEO IDC o Jelkin).
- SC-005: Fábrica corre SQL sobre BD prod para verificar distribución de colores. Si > 50% en rojo → HALLAZGO, NO se cierra I-104, se abre iteración de afine.
- Cierre I-104 en gestión con evidencia.
- Radicación de Fase 2 SPEC-304 (rediseño 4 bloques · cierra I-98) cuando el caso testigo esté confirmado > 0.

## 10. Rollback (contingencia)

Si post-deploy aparece regresión no cubierta por tests:

1. `git revert <commit-fix>` en main.
2. Push.
3. Los endpoints vuelven al comportamiento pre-fix (siguen mostrando "Sin datos" cuando no cruzan bien, pero no bloquean nada del resto del admin).
4. Reabrir la spec con plan de fix del edge case.

## Referencias

- [spec.md](./spec.md) — US1/US2/US3 y sus Acceptance Scenarios
- [plan.md](./plan.md) — decisiones de arquitectura
- [research.md](./research.md) — verificaciones en fuente y descarte de alternativas
- [data-model.md](./data-model.md) — modelos consumidos + shape del resultado
- [contracts/api-payload.md](./contracts/api-payload.md) — contrato de los dos endpoints
- Instructivo 002-PI-209 §Verificación en vivo esperada
