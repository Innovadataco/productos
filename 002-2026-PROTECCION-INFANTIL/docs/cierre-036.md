# Cierre — Spec 036: Consistencia y limpieza

**Rama**: `feature/001-scaffolding`  
**Fecha**: 2026-07-19  
**Estado**: COMPLETADO

## User Stories implementadas

| US | Descripción | Commit |
|----|-------------|--------|
| US1 | Renombrar `apeaciones` / `apealaciones` → `apelaciones` en rutas, módulo, imports, URLs, tests y scripts. | `chore: renombrar apeaciones -> apelaciones` |
| US2 | Reemplazar voseo en UI y mensajes de API por tono neutro. | `style: reemplazar voseo por tono neutro en UI y mensajes de API` |
| US3 | Crear `src/lib/logger.ts` con niveles y reemplazar `console.log` de `src/lib`. | `refactor: reemplazar console.log de libs por logger con niveles` |
| US4 | Buscador por `numeroSeguimiento` e `identificador` en bandeja admin. | `feat: buscador por numero seguimiento e identificador en bandeja admin` |
| US5 | Agregar `eval-results/` a `.gitignore` y limpiar archivos trackeados. | `chore: agregar eval-results a .gitignore y limpiar archivos trackeados` |

## Archivos principales tocados

- `src/app/api/apelaciones/**` (renombrado desde `apeaciones`)
- `src/app/api/admin/apelaciones/**` (renombrado desde `admin/apeaciones`)
- `src/lib/apelaciones.ts` (renombrado desde `apealaciones.ts`)
- `src/lib/proxy.ts`
- `src/components/modules/AdminApelaciones.tsx`
- `src/app/apelar/page.tsx`
- `scripts/job-apelaciones-vencimiento.ts`
- `scripts/smoke-apelaciones.ts`
- `src/lib/logger.ts` (nuevo)
- `src/lib/queue.ts`, `src/lib/email.ts`, `src/lib/sms.ts`, `src/lib/circulo-confianza.ts`, `src/lib/rate-limit.ts`, `src/lib/queue-metrics.ts`, `src/lib/apelaciones.ts`, `src/lib/ai/*.ts`
- `src/lib/validators.ts`
- `src/app/api/admin/reportes-revision/route.ts`
- `src/app/api/admin/reportes-revision/route.test.ts` (nuevo)
- `src/components/modules/AdminReportesTable.tsx`
- `.env.example`
- `.gitignore`
- `specs/036-consistencia-limpieza/spec.md`

## Validación automática

```bash
rm -rf .next
npx tsc --noEmit
npm run test
npm run build
./scripts/dev-restart.sh
```

Resultados:

- `npx tsc --noEmit`: 0 errores.
- `npm run test`: 78 archivos de test, 412 tests pasando.
- `npm run build`: exitoso.
- `./scripts/dev-restart.sh`: app levantada en puerto 5005 con un solo worker; healthcheck OK.

## Quickstart manual

- US1: `grep -R "apeaciones\|apealaciones" src/ scripts/ --include="*.ts" --include="*.tsx"` → 0 coincidencias.
- US2: `grep -R "revisá\|clasificá\|gestioná\|mostrá\|copiá\|seleccioná\|guardá\|verificá\|escribí\|esperá\|intentá\|ingresá\|solicitá\|actualizá\|creá\|agregá\|consultá" src/ --include="*.tsx" --include="*.ts"` → 0 coincidencias en strings de UI/mensajes.
- US3: `grep -R "console.log" src/lib` → solo `src/lib/logger.ts`.
- US4: Prueba manual con ADMIN/OPERADOR en `/dashboard/admin`; el campo `q` filtra por seguimiento e identificador y se refleja en URL.
- US5: `touch eval-results/test-ignore.json && git status` → el archivo no aparece como untracked; `rm eval-results/test-ignore.json`.

## Deuda técnica

1. **Buscador admin**: implementado con `contains` case-insensitive de Prisma. Para grandes volúmenes se recomienda migrar a índice GIN trigram o full-text.
2. **Logger local**: sin sink externo (Sentry, etc.). Integración postergada a fase de monitoreo operativo.
3. **Tuteo informal**: algunos textos de email y páginas públicas usan "tú". El spec 036 cubrió solo voseo; normalizar a usted queda como mejora futura de UX.
4. **Archivos eval-results históricos**: se eliminaron del índice de Git pero se conservan en disco. Si se desea eliminarlos también del disco, hacerlo manualmente.

## Checklist de cierre

- [x] Spec-Kit completo (todos los artefactos + checklist validado).
- [x] Commit + push a `feature/001-scaffolding`: un commit por User Story + uno de docs.
- [x] Deploy limpio con `./scripts/dev-restart.sh`.
- [x] Probar con `specs/036-consistencia-limpieza/quickstart.md`.
- [x] Documentar: `docs/cierre-036.md` + sección Implementación en `spec.md`.
- [x] Registro de deuda técnica.
