# Implementation Plan: SPEC-128 — Reconciliación de grants del comité

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/128-reconciliacion-grants-comite/spec.md` (instructivo 002-PI-043, radica ZEUS; D-43, supersede la cláusula "no reconciliar" de D-41)

## Summary

Fix de coherencia: `clavesPorRol.COMITE_VALIDACION` (`prisma/seed.ts:1265`) queda en
`["comite_bandeja"]`; salen `comite` y `comite_auditoria`, que mapean a rutas ADMIN_ONLY
que la puerta niega al comité. Los módulos NO se borran del catálogo (ADMIN los usa). El
backfill del seed no revoca grants ya creados: la spec propone el mecanismo para las BD
existentes (producción incluida) y **ZEUS decide en la compuerta — no se implementa sin
aprobación**. D-41 intacta en su núcleo: no se toca navegación ni allowlist de la Aserción B.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: ninguna nueva — Prisma 5.22.0 (el seed ya lo usa), tsx (scripts)

**Storage**: PostgreSQL 16 — solo cambia el DEFAULT que el seed escribe en `PermisoModulo`
para BD fresca; ninguna migración de schema

**Testing**: Vitest — verificación del seed sobre la PostgreSQL de pruebas del repo
(`npm run test`, `.env.test`); `arch:check` para la línea base regenerada

**Target Platform**: script de seed (dev/CI), misma BD `pgvector/pgvector:pg16`

**Project Type**: fix de datos por defecto (seed) + regeneración de línea base

**Performance Goals**: N/A

**Constraints**: `prisma/seed.ts` SOLO la línea `COMITE_VALIDACION` de `clavesPorRol`
(candado del instructivo); `nav-items.ts` y `permisos-catalogo.ts` NO se tocan; el test
`aislamiento.test.ts` no se debilita; migraciones/seed no destructivos — el backfill
mantiene su semántica "crear faltantes, nunca revocar"

**Scale/Scope**: 1 línea de seed + tests de verificación + 1 artefacto regenerado +
propuesta documentada para BD existentes (sin implementar en esta fase)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Solo texto / sin multimedia**: OK.
- **Presunción de inocencia**: OK — no toca superficie pública.
- **IA local**: OK — sin IA.
- **Disputas (Ley 1581)**: OK — el comité conserva su bandeja de apelaciones
  (`comite_bandeja`), que es su función.
- **Migraciones aditivas / no destructivo**: OK — no hay migración; el seed solo crea
  faltantes y sigue sin revocar nada. La revocación en BD existentes (si ZEUS la aprueba)
  será un paso explícito, documentado y ejecutado por humano, no parte del seed.
- **TypeScript estricto**: OK — cambio de literal en un `Record<string, string[]>`.
- **Metodología Spec-Kit**: OK — spec + plan; compuerta §4 respetada; la decisión sobre BD
  existentes queda EXPLÍCITAMENTE para ZEUS (FR-004), no se decide aquí.

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/128-reconciliacion-grants-comite/
├── plan.md              # This file
├── research.md          # Phase 0 output (defecto, alternativas, opciones para BD existentes)
├── quickstart.md        # Phase 1 output (verificación de los criterios del instructivo)
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Phase 2 (speckit-tasks) — TRAS aprobación de ZEUS (compuerta §4)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   └── seed.ts                  # TOCAR SOLO clavesPorRol.COMITE_VALIDACION (línea 1265)
├── docs/architecture/
│   └── 02-roles-capacidades.md  # REGENERADO (tabla módulo → rol) — nunca editado a mano
└── scripts/arch/                # SE USA, no se toca
```

**Structure Decision**: cambio mínimo en el seed (una entrada del `Record`). La verificación
se apoya en la PostgreSQL de pruebas existente; si la suite ya tiene un test del seed que
cubra grants por rol, se extiende ahí; si no, se añade un test acotado junto al seed
(`prisma/seed-security.test.ts` es el precedente de tests contra el seed).

## Diseño (Phase 1)

### Cambio en el seed

```typescript
const clavesPorRol: Record<string, string[]> = {
    ADMIN: modulosSeed.map((m) => m.clave),
    SCHOOL_ADMIN: ["colegios", "colegios_gestion", "colegios_auditoria"],
    OPERADOR: ["bandeja_reportes"],
    // D-43: el comité solo recibe su bandeja; "comite" y "comite_auditoria" mapean a
    // rutas ADMIN_ONLY (proxy.ts ADMIN_ONLY_ROUTES) que la puerta le niega (I-39/D-41).
    COMITE_VALIDACION: ["comite_bandeja"],
};
```

- `ADMIN` sigue derivando su lista de `modulosSeed` completo → conserva `comite` y
  `comite_auditoria` sin tocar nada más.
- La semántica del backfill (crear faltantes, nunca revocar) NO cambia.

### Verificación (tests)

1. Seed sobre BD de pruebas limpia → `PermisoModulo` de COMITE_VALIDACION = exactamente
   `{comite_bandeja}` (activo).
2. ADMIN = conjunto completo de claves de `modulosSeed`.
3. `Modulo` conserva `comite` y `comite_auditoria`.
4. `aislamiento.test.ts` corre verde sin modificarse (la puerta no cambia).

### Regeneración de la línea base

`npx tsx scripts/arch/generar-roles-capacidades.ts` regenera
`docs/architecture/02-roles-capacidades.md`: la tabla módulo → rol deja de listar
`comite`/`comite_auditoria` para COMITE_VALIDACION. `03-pantallas.md` no cambia (la puerta
no se toca). `npm run arch:check` VERDE en el mismo commit.

### BD existentes — PROPUESTA (ZEUS decide en la compuerta; NO implementada)

El cambio gobierna BD fresca. Las BD vivas (dev de la Mac, producción del VPS) conservan
los grants muertos. Opciones:

- **Opción A (recomendada) — script puntual de revocación**: `scripts/revocar-grants-comite-muertos.ts`
  (tsx, idempotente): desactiva (o elimina) los `PermisoModulo` de COMITE_VALIDACION sobre
  los módulos `comite` y `comite_auditoria`, con consulta de verificación antes/después y
  salida de conteo. Se ejecuta manualmente por entorno con el `DATABASE_URL` correspondiente
  (mismo patrón operativo que otros scripts puntuales del repo, p. ej. `aplicar-adjudicacion-095.ts`).
  Preferir `activo = false` sobre `DELETE`: revocable y audit-friendly (no destructivo).
- **Opción B — paso manual documentado**: SQL puntual documentado en el cierre de la spec,
  ejecutado por el responsable del despliegue en cada entorno. Menos trazable que A.
- **Opción C — no tocar BD existentes**: aceptar la divergencia como dato inerte (D-41 ya
  oculta las tabs; la puerta ya niega las rutas). Válida pero deja el default histórico
  contradictorio en producción, exactamente lo que D-43 mandó reconciliar.
- **Descartada — que el seed revoque**: convertiría el backfill en destructivo, cambia la
  semántica del seed y excede el candado ("seed.ts SOLO clavesPorRol").

**Pendiente de decisión de ZEUS**: mecanismo (A/B/C) y momento (¿junto al próximo deploy?).
Hasta entonces, nada se ejecuta contra BD viva y el cierre de la spec documentará la
decisión tomada.

## Research resumido (Phase 0 → research.md)

Decisión: retirar los dos grants muertos del default (D-43 literal). Alternativas
descartadas: borrar los módulos del catálogo (rompe ADMIN); dejarlo como está (la D-43 lo
descartó); reconciliar por la vía de abrir rutas al comité (fuga; contradice la puerta y
"el comité no se autogestiona"). Detalle en [research.md](research.md).

## Quickstart (validación) → [quickstart.md](quickstart.md)

Los criterios 3, 4 y 5 del instructivo 002-PI-043 que aplican a esta spec se verifican ahí
paso a paso (BD fresca, artefactos regenerados, aserciones A/B verdes).

## Contracts

N/A — no expone endpoints; la "interfaz" es el contenido por defecto de `PermisoModulo`,
cubierto por los tests de verificación y el quickstart.

## Constitution Check (post-diseño)

Re-evaluado tras Phase 1: sin cambios — ninguna violación. Un literal de seed, tests de
verificación, un artefacto regenerado y una propuesta documentada que espera decisión.

## Complexity Tracking

Sin violaciones de constitución que justificar.
