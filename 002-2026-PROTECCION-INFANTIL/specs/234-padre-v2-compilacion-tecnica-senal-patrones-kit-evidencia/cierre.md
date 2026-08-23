# Cierre — SPEC-234 · Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia

**Rama**: `work/002-pi-134`
**Estado al cierre**: implementación completa, gate local verde, sin push.
**Instrutivo**: 002-PI-134.

---

## Qué se entregó

Se implementó la capa de compilación técnica del módulo Padre v2 sobre SPEC-230:

- Modelos Prisma y migraciones aditivas para `InformeConsolidado`, `SenalComunitariaCache`, `PatronExpediente` y el enum `TipoPatronExpediente`.
- Seed idempotente del parámetro `padre.senal_comunitaria.refresh_min`.
- Tres repositorios DAL con tests de integración.
- Servicio de compilación (`compilarExpediente`) con queries SQL puras, 4 reglas N1, score parametrizado y template markdown.
- Kit de evidencia PDF determinista con `pdfmake`, hash SHA256 reproducible y endpoint público `GET /api/publico/verificar-pdf/[hash]` con rate-limit.
- Worker `pi-senal-comunitaria` (advisory lock propio, polling, recálculo SQL puro) y su servicio Docker.
- Tests de privacidad/esquema que garantizan ausencia de PII en agregados y entregables.
- Ajustes de arquitectura: excepción para `SenalComunitariaCache` como huérfano permitido y regeneración de `docs/architecture/`.

---

## Archivos tocados

### Modificados

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `docker-compose.prod.yml`
- `src/lib/rate-limit.ts`
- `scripts/arch/excepciones.json`
- `docs/architecture/01-modelo-datos.md`
- `docs/architecture/02-roles-capacidades.md`
- `docs/architecture/06-stack.md`
- `specs/234-padre-v2-compilacion-tecnica-senal-patrones-kit-evidencia/spec.md`
- `specs/234-padre-v2-compilacion-tecnica-senal-patrones-kit-evidencia/tasks.md`

### Nuevos

- `prisma/migrations/20260823010000_padre_v2_compilacion_senal_patrones/migration.sql`
- `prisma/migrations/20260823010100_padre_v2_audit_informe_pdf/migration.sql`
- `src/lib/dal/repositories/informe-consolidado-repository.ts`
- `src/lib/dal/repositories/informe-consolidado-repository.test.ts`
- `src/lib/dal/repositories/senal-comunitaria-repository.ts`
- `src/lib/dal/repositories/senal-comunitaria-repository.test.ts`
- `src/lib/dal/repositories/patron-expediente-repository.ts`
- `src/lib/dal/repositories/patron-expediente-repository.test.ts`
- `src/lib/expediente/compilacion/compilar-expediente.ts`
- `src/lib/expediente/compilacion/compilar-expediente.test.ts`
- `src/lib/expediente/compilacion/queries/agregar-categorias.ts`
- `src/lib/expediente/compilacion/queries/agregar-categorias.test.ts`
- `src/lib/expediente/compilacion/queries/senal-comunitaria.ts`
- `src/lib/expediente/compilacion/queries/senal-comunitaria.test.ts`
- `src/lib/expediente/compilacion/reglas/aceleracion.ts`
- `src/lib/expediente/compilacion/reglas/aceleracion.test.ts`
- `src/lib/expediente/compilacion/reglas/progresion.ts`
- `src/lib/expediente/compilacion/reglas/progresion.test.ts`
- `src/lib/expediente/compilacion/reglas/perpetrador-serial.ts`
- `src/lib/expediente/compilacion/reglas/perpetrador-serial.test.ts`
- `src/lib/expediente/compilacion/reglas/multiplataforma.ts`
- `src/lib/expediente/compilacion/reglas/multiplataforma.test.ts`
- `src/lib/expediente/compilacion/score/calcular-score.ts`
- `src/lib/expediente/compilacion/score/calcular-score.test.ts`
- `src/lib/expediente/compilacion/template/renderizar-markdown.ts`
- `src/lib/expediente/compilacion/template/renderizar-markdown.test.ts`
- `src/lib/expediente/pdf/generar-pdf.ts`
- `src/lib/expediente/pdf/generar-pdf.test.ts`
- `src/lib/expediente/senal-comunitaria/refrescar-pendientes.ts`
- `src/lib/expediente/senal-comunitaria/refrescar-pendientes.test.ts`
- `src/lib/expediente/privacidad/padre-v2-privacidad.test.ts`
- `src/app/api/publico/verificar-pdf/[hash]/route.ts`
- `src/app/api/publico/verificar-pdf/[hash]/route.test.ts`
- `src/lib/seed-senal-comunitaria.test.ts`
- `scripts/worker-senal-comunitaria.mjs`
- `specs/234-padre-v2-compilacion-tecnica-senal-patrones-kit-evidencia/cierre.md` (este archivo)

---

## Gate local

| Paso | Comando | Resultado |
|---|---|---|
| Tipado | `npx tsc --noEmit` | ✅ sin errores |
| Lint | `npm run lint --no-cache` | ✅ 0 errores (warnings preexistentes) |
| Arquitectura | `npm run arch:check` | ✅ verde |
| Tests | `npm run test` | ✅ verde — 274 archivos passed / 1 skipped (275), 1559 tests passed / 1 skipped (1560), 830.12 s |
| Build | `npm run build` | ✅ sin errores |
| Deploy limpio | `./scripts/dev-restart.sh` | ⏭️ no ejecutado (fase desarrollo) |

> Los comandos se corrieron con `PATH="/Users/idc/.hermes/node/bin:$PATH"`; los tests con `DATABASE_URL="postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil_test"`.

---

## Notas y deuda técnica

- Se omitió la relación `InformeConsolidado.aclaraciones` porque el modelo `AclaracionExpediente` no existe aún; queda pendiente para SPEC-236.
- Las queries de compilación importan el singleton Prisma desde `@/lib/dal/prisma.ts` para respetar la frontera DAL (Q-3) y pasar `arch:check`/`dal-frontera.test.ts` sin ensanchar la allowlist de heredados.
- El worker de señal comunitaria usa polling simple; la evolución a invalidación por cola `pg-boss` queda para SPEC-236.
- No se realizó `git commit` ni `git push` por instrucción explícita de ZEUS en este ciclo.

---

## Señal a ZEUS

`002-PI-134 · REALIZADO · <sin-hash-porque-no-se-hizo-push> · implementación completa, gate verde, pendiente commit/push`

Nota: no se ejecutó `./scripts/dev-restart.sh` ni se hizo push; el diff está listo en el working tree de `work/002-pi-134`.
