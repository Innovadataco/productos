# Checklist de Calidad de la Especificación: Padre v2 · Modelos Expediente + Evento

**Purpose**: Validar la completitud y calidad de la especificación antes de pasar a la implementación.
**Created**: 2026-08-22
**Feature**: [specs/230-padre-v2-modelos-expediente-evento/spec.md](../spec.md)

## Calidad del Contenido

- [ ] La especificación no incluye detalles de implementación (lenguajes, frameworks, APIs) en las User Stories ni en los requisitos de negocio.
- [ ] Está enfocada en el valor para el usuario padre/madre/tutor y en la protección infantil.
- [ ] Es comprensible para stakeholders no técnicos en las secciones de User Stories y criterios de éxito.
- [ ] Contiene todas las secciones obligatorias: User Stories priorizadas, Requisitos Funcionales numerados, Entidades Clave, Criterios de Éxito medibles, Supuestos y Edge Cases.

## Completitud de Requisitos

- [ ] No quedan marcadores `[NEEDS CLARIFICATION]` en ninguna sección.
- [ ] Los requisitos funcionales son testables, atómicos y no ambiguos.
- [ ] Los criterios de éxito son medibles y agnósticos de tecnología.
- [ ] Cada User Story P1/P2 incluye al menos dos escenarios de aceptación con Given/When/Then.
- [ ] Los edge cases están identificados: orden secuencial monotónico bajo concurrencia, hidratación async de `categoriaDetectada`/`confianzaClasificacion`, expediente relacionado anterior inexistente, cierre por inactividad, límite de aclaraciones y rate limit de eventos.
- [ ] El alcance está claramente acotado:
  - **Dentro**: modelos `Expediente` y `EventoExpediente`, enums `EstadoExpediente`/`ScoreGravedad`, extensión de `TipoRevisionComite`, seed idempotente de 18 parámetros `padre.*`, repositorio DAL `expediente-repository.ts`, tests unitarios del repo e idempotencia del seed.
  - **Fuera**: UI, sidebar, páginas `/dashboard/padre/*`, motor IA (`src/lib/ai/**`) y modificación del modelo `Reporte`.
- [ ] Se documentan dependencias y supuestos: existencia de `Usuario`, `Reporte` y `ParametroSistema`; migraciones aditivas; frontera DAL Q-3.

## Preparación de la Feature

- [ ] Todos los requisitos funcionales tienen criterios de aceptación claros.
- [ ] Las User Stories cubren los flujos primarios: crear expediente, agregar evento, listar expedientes de un padre y obtener expediente por ID.
- [ ] Los criterios de éxito reflejan los resultados medibles definidos en la especificación.
- [ ] No hay fugas de detalles de implementación en la especificación, salvo la nota necesaria sobre la frontera DAL.

## Alineación con la Constitución del Proyecto

- [ ] §1.2 Solo texto: los modelos `Expediente`/`EventoExpediente` no almacenan ni procesan fotos, video, audio ni otros multimedia.
- [ ] §1.3 Presunción de inocencia: el lenguaje de la especificación es descriptivo/estadístico ("reportes registrados", "eventos asociados") y no emite veredictos sobre personas.
- [ ] §1.4 Ley 1581 de 2012: la existencia de expedientes no bloquea el derecho del titular del identificador a solicitar revisión, anonimización o eliminación.
- [ ] §2.1 Stack heredado: no se introducen nuevas librerías de autorización, ORM ni frameworks.
- [ ] §3.5 Logs y auditoría: toda mutación sobre expedientes/eventos genera un registro en `AuditLog` sin incluir el texto completo del reporte.

## Notas

- Este checklist asume que existen `spec.md`, `plan.md`, `data-model.md` y `quickstart.md` en `specs/230-padre-v2-modelos-expediente-evento/`.
- El seed idempotente anti-I-100 de los 18 parámetros `padre.*` debe estar documentado en `data-model.md` con su tipo, categoría y visibilidad.
- La extensión del enum `TipoRevisionComite` con `CONSOLIDACION_EXPEDIENTE` debe reflejarse en `data-model.md` y en el plan de migración aditivo.
- **Hallazgo preliminar**: en la rama base local no se encontró definido `TipoRevisionComite` en `prisma/schema.prisma`. Si persiste al implementar, la migración deberá crearlo aditivamente antes de extenderlo; ZEUS debe validar este desvío mínimo en la compuerta.
