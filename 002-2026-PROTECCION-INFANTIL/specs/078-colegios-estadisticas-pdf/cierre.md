# Cierre: Colegios · Fase 5 — Estadísticas e informe PDF institucional

**Spec**: `078-colegios-estadisticas-pdf`

**Status**: CERRADA

**Rama**: `feature/001-scaffolding`

---

## Resumen

Se cerró la Fase 5 del módulo Colegios. El SCHOOL_ADMIN ahora dispone de:

- Un endpoint `/api/colegio/estadisticas` con resumen agregado (cursos, alumnos, identificadores, alertas) y desglose por curso.
- Un endpoint `/api/colegio/estadisticas/pdf` que genera y descarga un informe PDF con estética verde institucional.
- Una vista `/dashboard/colegio/estadisticas` con tarjetas, tabla por curso y botón de descarga.

Todo filtrado por `colegioId`, sin exponer PII ni reportes crudos.

---

## Archivos tocados

- `prisma/schema.prisma`
- `prisma/migrations/20260721_add_colegio_estadisticas_pdf_audit/migration.sql`
- `src/lib/colegio/estadisticas.ts`
- `src/lib/colegio/pdf-estadisticas.ts`
- `src/app/api/colegio/estadisticas/route.ts`
- `src/app/api/colegio/estadisticas/pdf/route.ts`
- `src/app/api/colegio/estadisticas/route.test.ts`
- `src/app/dashboard/colegio/estadisticas/page.tsx`
- `src/app/dashboard/colegio/page.tsx`
- `package.json`
- `package-lock.json`
- `specs/078-colegios-estadisticas-pdf/spec.md`
- `specs/078-colegios-estadisticas-pdf/cierre.md`

---

## Validación

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ sin errores |
| `npx vitest run` | ✅ 711 tests verdes |
| `npm run build` | ✅ exitoso |
| `./scripts/dev-restart.sh` | ✅ healthcheck OK, un worker |
| quickstart.md | ✅ ejecutado |
| git status limpio | ✅ |

---

## Evidencia de git

```bash
git log --oneline -8 feature/001-scaffolding
```

(Ver log actual tras los commits de esta fase.)

---

## Migraciones

- Se aplicó `20260721_add_colegio_estadisticas_pdf_audit` a la BD de desarrollo y a la BD de test.
- Migración aditiva: solo agrega un valor al enum `AccionAudit`.

---

## Deuda técnica registrada

- `pdfmake` requiere casts de tipo para funcionar bajo jsdom/Node; se documenta en `spec.md`.
- No hay gráficas ni exportación a Excel.
- Generación de PDF síncrona; si se escala, mover a job de background.

---

## Notas

- La BD de test recibió la migración de forma manual (`DATABASE_URL` apunta a `proteccion_infantil_test`).
- El aislamiento por colegio se verificó con tests de integración.
