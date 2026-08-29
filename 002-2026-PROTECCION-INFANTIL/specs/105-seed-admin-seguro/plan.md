# Implementation Plan: SPEC-105 — Seed del admin inicial sin credencial literal (I-31)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/105-seed-admin-seguro/spec.md`

## Summary

Fast-follow crítico I-31: `prisma/seed.ts` siembra el ADMIN de producción con contraseña
LITERAL versionada, `debeCambiarPassword:false` y bloque `update:` que la reescribe a la
pública en cada corrida. Fix: el admin inicial se siembra SOLO desde variable de entorno
(`SEED_ADMIN_PASSWORD` + `SEED_ADMIN_EMAIL`), solo si NO existe (create puro, sin `update`),
con `debeCambiarPassword=true`; sin la variable, el seed omite el admin con log explícito y
no falla. Barrido de credenciales literales en el repo (reporte sin valores), test de
regresión anti-literal y procedimiento escrito de rotación para el CEO (la rotación viva la
ejecuta el CEO personalmente — fuera de alcance).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: Prisma 5.22 (`prisma/seed.ts`, ejecutado con `tsx`), bcryptjs,
Vitest (tests junto al código)

**Storage**: PostgreSQL 16 (modelo `Usuario`)

**Testing**: Vitest (`npm run test`, `.env.test`, fileParallelism: false)

**Target Platform**: Linux server (VPS prod) / macOS dev

**Project Type**: web-service (Next.js App Router; el seed es script de soporte)

**Constraints**: migraciones siempre aditivas; el seed debe seguir siendo idempotente para
el resto de entidades (upserts existentes NO se tocan — solo cambia el bloque del admin);
sin valores de secretos en git/logs/reportes; despliegue diferido al lote que autorice ZEUS.

**Scale/Scope**: un bloque del seed + una variable de entorno + 1 script de barrido + 1 test
+ 1 documento de procedimiento.

## Constitution Check

*GATE: verificado antes de Fase 0 y tras el diseño (2026-07-27).*

- **Secrets solo por variables de entorno, nunca en el código** (constitution/AGENTS):
  el objetivo MISMO de la spec. CUMPLE por diseño.
- **Regla dura I-22 (spec 099)**: ningún valor de secreto en commits/cierres/specs/chat; el
  barrido reporta ubicación y tipo, nunca valores. CUMPLE.
- **Migraciones aditivas, nunca destructivas**: la spec no toca schema ni datos; el seed
  nuevo nunca pisa credenciales existentes. CUMPLE.
- **Canales oficiales / PII / presunción de inocencia**: no aplica (sin cambios de dominio).

Sin violaciones que justificar.

## Diseño

1. **FR-001/FR-002/FR-003/FR-004 (seed)**: en `prisma/seed.ts` reemplazar el bloque del
   admin: leer `SEED_ADMIN_EMAIL` (default `soporte@innovadataco.com` — el email NO es
   secreto) y `SEED_ADMIN_PASSWORD` (sin default). Si la contraseña falta, está vacía o
   mide menos que la política (`security.password_min_length`, fallback 12), log
   `[SEED] Admin omitido: SEED_ADMIN_PASSWORD no definida o débil` y continuar. Si existe:
   `findUnique` por email → si ya existe el usuario, NO tocarlo (log `existente, sin
   cambios`); si no existe, `create` con `debeCambiarPassword: true`. Eliminar el bloque
   `update:` y el literal. Documentar la variable en `.env.example` / `.env.production.example`
   (nombre + comentario, SIN valor).
2. **FR-005 (barrido)**: script `scripts/barrido-credenciales.ts` (o documento equivalente)
   que recorre el repo (excluye `node_modules`, `.next`, `.git`) buscando patrones de
   credencial literal (`password`, `passwd`, `secret`, `token`, `_key` seguidos de literal
   no-placeholder). Salida: archivo:línea + tipo + clasificación (real vs placeholder:
   `*_example`, `*.test.*`, `docs/` con valores evidentemente ficticios, `cambiar-en-*`).
   Reporte en `cierre.md` SIN valores.
3. **FR-006 (test de regresión)**: test (p.ej. `prisma/seed-security.test.ts`) que (a)
   escanea `prisma/seed.ts` y falla si encuentra una contraseña literal (patrón de string
   asignada a `password`/`adminPassword` que no venga de `process.env`), y (b) verifica por
   inspección del código que el bloque del admin no tiene `update:` (fuente de verdad del
   anti-pisado) — complementado por el comportamiento FR-002 validable en el quickstart.
4. **FR-007 (procedimiento CEO)**: `docs/runbook.md` (o `docs/configuracion/`) con el paso a
   paso de rotación de la credencial viva de prod (cómo fijar `SEED_ADMIN_PASSWORD` en el
   entorno del VPS antes de un seed futuro, cómo cambiar la contraseña del admin desde la
   UI/forzar reseteo) — sin valores.
5. **Alcance explícito**: NO se toca el motor (SPEC-104 va después), NO se rota la
   credencial viva (CEO, Metodología §7), NO se despliega (lo gatea ZEUS).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Dev nuevo sin la variable se queda sin admin | Log explícito + quickstart documenta cómo definirla en dev |
| El barrido publique un valor por accidente | El reporte escribe solo ubicación/tipo; clasificación placeholder con justificación |
| Romper la idempotencia del resto del seed | Solo cambia el bloque del admin; upserts de parámetros/permisos intactos; suite completa en el gate |
| Otros usuarios del seed con credencial (colegio/operador/comité) | Entran al barrido como hallazgos; su tratamiento se reporta a ZEUS (no se decide en esta spec) |

## Project Structure

### Documentation (this feature)

```text
specs/105-seed-admin-seguro/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── checklists/
│   └── requirements.md  # Validación de la spec
└── cierre.md            # Al cerrar (pendiente)
```

### Source Code (repository root)

```text
prisma/
└── seed.ts                       # bloque del admin: env-only, create-only, debeCambiarPassword=true
scripts/
└── barrido-credenciales.ts       # FR-005 (nuevo)
docs/
└── runbook.md                    # FR-007: procedimiento de rotación para el CEO
.env.example                      # nombre de la variable documentado (sin valor)
.env.production.example           # idem
```

**Structure Decision**: proyecto único Next.js; el cambio es un bloque del seed + un script
+ un test colocalizado + docs. Sin contratos externos (no aplica `contracts/`).
