# SPEC-924 · Higiene del índice de specs: notas retroactivas y Status faltantes

**Status**: IMPLEMENTADO

**Prioridad:** sin deploy (docs).
**Rama:** `work/pi-SPEC-924-guardia-spec-existe` desde `origin/main`.

## Qué queda

- `specs/921-build-heap-ci/spec.md`: nota retroactiva de SPEC-921 (heap del build de CI).
- Línea `**Status**: IMPLEMENTADO` en 915/916/918 (el índice los marcaba «⚠️ sin Status»).

## Qué se retiró (VEREDICTO del CEO)

El encargo original pedía un guardia en `verificar_base` que exigiera `specs/N-<slug>/spec.md`
con Status para toda rama `work/pi-SPEC-N-*`. Se construyó y se **retiró** antes del merge:
contradice el contrato vigente (AGENTS.md: `specs/NNN-slug/` es un home **OPCIONAL** de notas,
ceremonia retirada el 03-10). Con el guardia, los PR de solo tests de Calidad (p. ej. #920)
quedaban en rojo. SPEC-921 sin `spec.md` cumplía el contrato. AGENTS.md no se toca.
