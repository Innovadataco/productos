# Specification Quality Checklist: Gantt interactivo

**Created**: 2026-07-24 · **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] Sin detalles de implementación innecesarios; centrada en mover fechas donde se ven
- [x] Redactada para no técnicos; secciones completas

## Requirement Completeness
- [x] Sin [NEEDS CLARIFICATION]; requisitos verificables; criterios medibles
- [x] Casos límite (borde del lienzo, fin<inicio, dependencia circular, referencia colgada)
- [x] Alcance delimitado: reprogramación en cascada fuera; solo señalar (RZ-5)

## Se apoya en 015, no la rompe
- [x] La math de 015 (`gantt.ts`) queda **intacta**; la inversa va en `ganttInteractivo.ts` (SC-003)
- [x] Persiste por las rutas existentes de entregables/hitos, que ya auditan

## Disciplina y seguridad
- [x] Cero dependencias (RZ-1); puntero nativo, como el Kanban
- [x] Las pruebas que mutan datos van con **dato desechable** o rollback, nunca contra datos del
      CEO (RZ-4 / D-039)
- [x] Migración aditiva y ensayada

## Estado
**Aprobada (D-073)**, implementada. Verificación de arrastre en el contenedor: bloque 4.
