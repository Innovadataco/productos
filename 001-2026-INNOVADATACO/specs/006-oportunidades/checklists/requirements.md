# Specification Quality Checklist: Oportunidades

**Purpose**: Validar la completitud y calidad de la especificación antes de planificar
**Created**: 2026-07-23
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sin detalles de implementación innecesarios (lenguajes, frameworks, APIs)
- [x] Centrada en el valor para el usuario y la necesidad de negocio
- [x] Redactada para interlocutores no técnicos
- [x] Todas las secciones obligatorias completas

## Requirement Completeness

- [x] No quedan marcadores [NEEDS CLARIFICATION] — resueltos por `/speckit-clarify` (ver abajo)
- [x] Requisitos verificables y sin ambigüedad
- [x] Criterios de éxito medibles, con línea base declarada
- [x] Criterios de éxito independientes de la tecnología
- [x] Todos los escenarios de aceptación definidos
- [x] Casos límite identificados
- [x] Alcance delimitado (Out of Scope + frontera explícita con Base Oficial/RAG y SPEC-007)
- [x] Dependencias y supuestos identificados

## Feature Readiness

- [x] Todo requisito funcional tiene criterio de aceptación
- [x] Las historias cubren los flujos primarios
- [x] La feature satisface los criterios medibles definidos
- [x] No se filtran detalles de implementación a la especificación

## Clarificaciones resueltas (`/speckit-clarify`, CEO, 2026-07-23)

| # | Pregunta | Respuesta del CEO |
|---|---|---|
| Q1 | ¿Qué tipos de oportunidad existen? | **Catálogo CONFIGURABLE** (no enum): set inicial licitación pública, concurso de méritos, contratación directa; el CEO añade/ajusta desde el módulo |
| Q2 | ¿Qué hitos del cronograma importan? | **5 hitos**: apertura, pliegos definitivos, entrega de propuesta, adjudicación, cierre |
| Q3 | ¿Presupuesto único o desglosado? | **Desglosado** (varias partidas con concepto, monto y moneda) |

La respuesta a Q1 elevó "tipos" a **US2 propia** (catálogo configurable con submódulo), no un
simple campo enum: es a la vez petición de negocio y requisito de §0.7.

## Notas

- **Excepción a "sin detalles de implementación"**: la tabla de "estado verificado del código"
  cita modelos y archivos (`LicitacionDocumento`, `WorkspaceContext.tsx:36`). Es la **evidencia**
  del punto de partida, no diseño: lo que ya existe (y lo que no) determina el alcance real —
  p. ej. `LicitacionDocumento` existe pero **sin ruta de subida**, así que el expediente añade
  esa ruta, no el modelo entero.
- **Frontera crítica declarada**: el expediente adjunta, **no** vectoriza. Es la línea que
  separa esta spec de Base Oficial (RZ-3, FR-013, SC-008).
- **Migración con datos vivos**: la tabla tiene semilla (D-048); FR-004 y SC-003 exigen cero
  pérdida. Es el mayor riesgo de la spec y el plan debe tratarlo con cuidado.
- El Kanban de estados es **SPEC-007** (RZ-6): aquí el campo `estado` se conserva pero no se
  rediseña su flujo.
- La spec **no se implementa** hasta la aprobación de ZEUS y Jelkin (§0.1).
