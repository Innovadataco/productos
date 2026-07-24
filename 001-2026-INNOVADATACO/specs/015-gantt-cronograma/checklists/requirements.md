# Specification Quality Checklist: Gantt del cronograma

**Created**: 2026-07-24 · **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] Sin detalles de implementación innecesarios
- [x] Centrada en el valor: ver el cronograma en el tiempo
- [x] Redactada para no técnicos; secciones completas

## Requirement Completeness
- [x] Sin [NEEDS CLARIFICATION]; requisitos verificables; criterios medibles
- [x] Casos límite (sin fechas, hito puntual, entregable sin compromiso, todo el mismo día)
- [x] Alcance delimitado: arrastre fuera (es 016)
- [x] Supuestos: fechaInicio opcional con fallback createdAt; hoy como parámetro

## Preparado para 016
- [x] **La matemática es pura y separada del render** (SC-003): 016 monta el arrastre encima sin
      tocarla. Es la razón de que esta spec exista antes que 016.
- [x] `fechaInicio` persistible: 016 tendrá un inicio real que arrastrar, no un createdAt de sistema

## Disciplina de dependencias
- [x] Cero librerías (RZ-1); SVG/CSS propio, como el Kanban
- [x] Si 016 revela que hace falta una lib, la instrucción es **parar y dejar nota**, no instalar

## Estado
**Aprobada (D-073)**, implementada. Ratificación del CEO por la mañana.
