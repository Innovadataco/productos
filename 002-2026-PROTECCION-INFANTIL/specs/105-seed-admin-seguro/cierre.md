# Cierre — SPEC-105: Seed del admin inicial sin credencial literal (I-31)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA, **SIN DESPLEGAR** (lo autoriza el CEO en el próximo lote).

## Lo hecho (por US)

- **US1 (P1)**: `prisma/seed.ts` — el admin inicial se siembra SOLO desde `SEED_ADMIN_PASSWORD`
  (sin default; `SEED_ADMIN_EMAIL` con default no secreto). `create` puro con chequeo de
  existencia: el seed **nunca pisa una credencial rotada** (eliminados el literal y el bloque
  `update:`). `debeCambiarPassword: true`. Sin la variable (o débil: < `security.password_min_length`,
  hoy 8) omite con log y el resto del seed completa. Variables documentadas en `.env.example`
  y `.env.production.example` (sin valores; sustituyen a `ADMIN_PASSWORD`/`ADMIN_EMAIL`,
  que estaban documentadas pero nunca cableadas al seed).
  **Validación en vivo (BD dev)**: existente → "sin cambios" y hash intacto; sin variable →
  omite; débil → omite; create con email temporal → `rol=ADMIN, debeCambiar=true`.
- **US2 (P2) — barrido**: `scripts/barrido-credenciales.ts` (exit 1 si hay hallazgos reales;
  reporta archivo:línea + tipo, NUNCA valores). **Resultado: 0 credenciales literales
  reales; 50 placeholders** (fixtures `*.test.ts`, `test-setup.ts`/`reporte-test-utils.ts`
  con valores dummy, plantillas `.env*.example`, ejemplos de docs/runbook). La única real
  era la de I-31, ya eliminada.
- **US3 (P3)**: `prisma/seed-security.test.ts` (4 tests: sin literal fuera de `process.env`,
  sin `update:` en el bloque, `debeCambiarPassword: true`, rama de omisión presente).
  Verificado rojo con un literal reintroducido y verde restaurado.
- **FR-007**: procedimiento de rotación para el CEO en `docs/runbook.md` §12b (rotación de la
  credencial viva + cuándo definir `SEED_ADMIN_PASSWORD` en el VPS). La rotación viva la
  ejecuta el CEO personalmente (§7) — fuera de alcance.

## Gate

tsc ✅ · lint ✅ (0 errores; warnings preexistentes) · **925/925 tests** ✅ (4 nuevos) · build ✅.

## Notas

- El admin dev existente (sembrado por el seed viejo) conserva `debeCambiarPassword=false`:
  el seed nuevo no lo toca; su rotación es la del CEO (§12b del runbook).
- `minLength` se lee de `security.password_min_length` con fallback 12 (en una base vacía el
  parámetro aún no existe al correr el bloque del admin).
- `specs-discipline` verde; carpeta completa (spec/plan/research/data-model/quickstart/
  tasks/checklists/cierre).

## Deuda

- Ninguna nueva.
