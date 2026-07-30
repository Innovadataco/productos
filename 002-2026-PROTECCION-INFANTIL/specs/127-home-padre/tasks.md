# Tasks: SPEC-127 — Home del padre

**Estado**: PENDIENTE — compuerta §4.

Las tareas (`TNNN`) se generan con `/speckit.tasks` **tras la aprobación de ZEUS** del
spec.md y plan.md de esta carpeta (instructivo 002-PI-043, cadena de comandos:
specify → plan → PARA). Este archivo existe como marcador para la disciplina de specs
(`src/lib/specs-discipline.test.ts` exige su presencia); no contiene tareas aún.

Orden previsto por el plan (se materializará en TNNN al aprobarse):

1. Test de regresión del camino PARENT (TDD, FR-004).
2. Caso `PARENT → /dashboard` en `homeForRole` (FR-001/002/003).
3. Regenerar `docs/architecture/03-pantallas.md` (FR-005).
4. Gate D-36: suite completa + `tsc --noEmit` + `build` + `arch:check` (FR-006).
5. Validación con `quickstart.md` y cierre (cierre.md + sección Implementación en spec.md).
