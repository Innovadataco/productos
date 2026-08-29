# Specification Quality Checklist: Gestión — cartera, detalle y Riesgos

**Created**: 2026-07-24 · **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] Sin detalles de implementación innecesarios
- [x] Centrada en el valor: mirar la cartera de un vistazo, gestionar con espacio
- [x] Redactada para interlocutores no técnicos
- [x] Todas las secciones obligatorias completas

## Requirement Completeness
- [x] No quedan marcadores [NEEDS CLARIFICATION]
- [x] Requisitos verificables; criterios de éxito medibles
- [x] Casos límite (proyecto sin entregables, 0 proyectos, modal duplicado)
- [x] Alcance delimitado (Gantt fuera; es 015/016)
- [x] Supuestos identificados (avance = media simple; presupuesto = planeado)

## Reutilización, no reescritura (RZ-2)
- [x] `GestionPm2` se mueve de contenedor, no se reescribe
- [x] Riesgos va sobre `PanelColeccion` genérico (para eso se hizo)
- [x] El modal deja de duplicar la gestión (I-011)

## Feature Readiness
- [x] Todo FR con criterio de aceptación
- [x] Migración aditiva ensayada (SC-001)
- [x] Agregados en función pura testeada (FR-006)

## Estado
**Aprobada (D-073)**, implementada en el turno. Ratificación del CEO por la mañana.
