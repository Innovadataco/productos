# Tasks: SPEC-128 — Reconciliación de grants del comité

**Estado**: PENDIENTE — compuerta §4.

Las tareas (`TNNN`) se generan con `/speckit.tasks` **tras la aprobación de ZEUS** del
spec.md y plan.md de esta carpeta (instructivo 002-PI-043, cadena de comandos:
specify → plan → PARA). Este archivo existe como marcador para la disciplina de specs
(`src/lib/specs-discipline.test.ts` exige su presencia); no contiene tareas aún.

Punto de decisión reservado a ZEUS en la compuerta: mecanismo para las BD existentes
(FR-004, Opciones A/B/C del plan.md). Nada se implementa ni ejecuta contra BD viva sin
esa aprobación.

Orden previsto por el plan (se materializará en TNNN al aprobarse):

1. Test de verificación del seed: comité solo `comite_bandeja`, ADMIN conserva todo,
   catálogo intacto (TDD, SC-001/002).
2. `clavesPorRol.COMITE_VALIDACION = ["comite_bandeja"]` en `prisma/seed.ts` (FR-001/003).
3. Regenerar `docs/architecture/02-roles-capacidades.md` (FR-006).
4. Gate: suite completa + `tsc --noEmit` + `build` + `arch:check` (FR-007).
5. Documentar la decisión de ZEUS sobre BD existentes y, si aplica, su ejecución (FR-004).
6. Validación con `quickstart.md` y cierre (cierre.md + sección Implementación en spec.md).
