# Specification Quality Checklist: Proyectos PM2

**Purpose**: Validar la completitud y calidad de la especificación antes de planificar
**Created**: 2026-07-24
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
- [x] Alcance delimitado (Out of Scope + dependencia de SPEC-007 declarada)
- [x] Dependencias y supuestos identificados

## Feature Readiness

- [x] Todo requisito funcional tiene criterio de aceptación
- [x] Las historias cubren los flujos primarios
- [x] La feature satisface los criterios medibles definidos
- [x] No se filtran detalles de implementación a la especificación

## Clarify resuelto (`/speckit-clarify`, CEO, 2026-07-24)

| # | Pregunta | Respuesta del CEO |
|---|---|---|
| Q1 | Campos mínimos de un entregable | **Los cuatro**: nombre y descripción, estado/avance, fecha compromiso, responsable |
| Q2 | Presupuesto: ¿partidas como Oportunidades u otro? | **Partidas + planeado vs ejecutado** (control de gasto PM2) |
| Q3 | Datos de un recurso | **Todos**: nombre y rol, tipo (humano/material), costo/tarifa, disponibilidad/asignación |

La respuesta a Q2 diferencia el presupuesto de proyecto del de Oportunidades: mismo patrón de
partidas, pero con monto **planeado** y **ejecutado** por partida, y **desviación** calculada.

## Notas

- **Dependencia explícita de SPEC-007**: US2 (Kanban de fases) reutiliza el `KanbanBoard`. Si
  SPEC-007 no está implementada al arrancar, US2 se bloquea; US1 y el resto no. Es la razón del
  orden 007 → 008.
- **Diferencia deliberada con SPEC-007**: las fases PM2 son **fijas** (metodología), no un
  catálogo configurable como los estados de oportunidad.
- **Corte de prioridades propuesto** (US1/US2 P1; US3/US5 P2; US4/US6 P3): ZEUS puede ajustarlo al
  aprobar; la spec lo declara como propuesta, no como hecho.
- **Excepción a "sin detalles de implementación"**: la tabla de estado del código cita el modelo
  `Proyecto` y la ausencia de rutas `[id]`. Es la **evidencia** del gap (editar es imposible), no
  diseño.
- La spec **no se implementa** hasta la aprobación de ZEUS y Jelkin (§0.1).
