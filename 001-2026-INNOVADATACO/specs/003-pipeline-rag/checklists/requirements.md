# Specification Quality Checklist: Pipeline RAG

**Purpose**: Validar la completitud y calidad de la especificación antes de planificar
**Created**: 2026-07-23 (retroactivo: la spec es de 2026-07-22, el checklist es norma nueva
desde la spec 005)
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
- [x] Alcance delimitado (sección *Out of Scope* + separación recuperación/generación)
- [x] Dependencias y supuestos identificados

## Feature Readiness

- [x] Todo requisito funcional tiene criterio de aceptación
- [x] Las historias cubren los flujos primarios
- [x] La feature satisface los criterios medibles definidos
- [x] No se filtran detalles de implementación a la especificación

## Enmienda D-029…D-032 (2026-07-23)

Verificaciones propias de esta enmienda:

- [x] FR-001 declara estructural/1800 **medidos** y solape 200 **no medido**, sin
  presentarlo como justificado (D-029). Cita `research.md` §1 y `RESULTADOS.md`.
- [x] FR-026 separa el texto vectorizado del almacenado; prefijo configurable y **apagado
  por defecto** (D-030, D-031).
- [x] FR-021 extendido: cada fragmento registra **modelo + enriquecimiento**, la búsqueda
  filtra por ambos y el contador de pendientes cubre las dos causas (D-030).
- [x] FR-027 fija que la rama **FTS indexa `contenido` plano**, nunca el enriquecido.
- [x] FR-028 exige corregir la fuga de etiqueta del banco (D-032): `documentoEsperado`
  opaco, título aparte con calidad realista.
- [x] `questions.json._estado` actualizado: línea base firmada por el CEO (D-034), **no**
  criterio de aceptación mientras la fuga siga.
- [x] SC-020…SC-024 añadidos para hacer verificables las cuatro decisiones.

## Notas

- **Excepción a "sin detalles de implementación"**: FR-028 cita `enrich.mjs:62`. Es la
  **evidencia** de la fuga, no diseño: sin ella el defecto no sería auditable.
- **Fuera de esta enmienda**: la corrección real de la fuga (reescribir `documentoEsperado`
  a id opaco en las 22 preguntas y `enrich.mjs`) es **tarea de implementación**, no de la
  spec. Aquí solo se especifica y se declara el estado del banco.
- La spec sigue en **Draft**: no se implementa hasta que ZEUS y Jelkin la aprueben (§0.1).
