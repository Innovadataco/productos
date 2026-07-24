# Specification Quality Checklist: Kanban de Oportunidades

**Purpose**: Validar la completitud y calidad de la especificación antes de planificar
**Created**: 2026-07-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sin detalles de implementación innecesarios (lenguajes, frameworks, APIs)
- [x] Centrada en el valor para el usuario y la necesidad de negocio
- [x] Redactada para interlocutores no técnicos
- [x] Todas las secciones obligatorias completas

## Requirement Completeness

- [x] No quedan marcadores [NEEDS CLARIFICATION]
- [x] Requisitos verificables y sin ambigüedad
- [x] Criterios de éxito medibles, con línea base declarada
- [x] Criterios de éxito independientes de la tecnología
- [x] Todos los escenarios de aceptación definidos
- [x] Casos límite identificados
- [x] Alcance delimitado (Out of Scope + frontera con SPEC-008)
- [x] Dependencias y supuestos identificados

## Feature Readiness

- [x] Todo requisito funcional tiene criterio de aceptación
- [x] Las historias cubren los flujos primarios
- [x] La feature satisface los criterios medibles definidos
- [x] No se filtran detalles de implementación a la especificación

## Clarify (2026-07-24)

`/speckit-clarify` no encontró preguntas de negocio abiertas: el encargo de ZEUS es completo
(columnas del catálogo, mover=persistir+auditoría, componente reutilizable). Las decisiones de
diseño que quedaban —optimista vs bloqueante, librería de arrastre, reemplazar vs añadir
submódulo— son de plan, no de negocio, y se marcaron como tales. No se inventaron reglas de
transición entre estados: se declaran fuera de alcance.

## Notas

- **Decisión de diseño elevada a US propia (US3)**: el tablero es un **componente reutilizable**
  desacoplado de oportunidades, porque SPEC-008 lo reusará para fases. Es la razón de que esta
  spec vaya antes que SPEC-008. SC-008 lo hace verificable (el componente no importa el dominio).
- **Frontera con SPEC-008**: esta spec entrega el `KanbanBoard` genérico + el adaptador de
  oportunidades; SPEC-008 escribe su propio adaptador (fases) sobre el mismo componente.
- La spec **no se implementa** hasta la aprobación de ZEUS y Jelkin (§0.1).
