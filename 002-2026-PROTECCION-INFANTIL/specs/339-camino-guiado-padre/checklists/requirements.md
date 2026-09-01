# Specification Quality Checklist: SPEC-339 · El camino guiado del padre

**Purpose**: Validar que la especificación está completa antes de planear
**Created**: 31-08-2026
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs) en requisitos y criterios
- [x] Centrada en el valor para el padre y para el negocio
- [x] Legible por alguien que no programa
- [x] Todas las secciones obligatorias completas

**Nota justificada**: las secciones «Problema» e «Impacto en arquitectura» sí nombran archivos y modelos. Es deliberado y lo exige `AGENTS.md`: son la evidencia de que lo afirmado está verificado en fuente, no la especificación del comportamiento. Los FR y los SC están libres de implementación.

## Requirement Completeness

- [x] No quedan marcadores [NEEDS CLARIFICATION] — las cuatro dudas se resolvieron con el CEO el 31-08 (19:24 y 19:34)
- [x] Requisitos verificables y sin ambigüedad
- [x] Criterios de éxito medibles
- [x] Criterios de éxito independientes de la tecnología
- [x] Escenarios de aceptación definidos para las seis historias
- [x] Casos borde identificados (enlace usado/vencido, borrar el único menor, documento repetido, plan vencido, roles ajenos, registro de colegio)
- [x] Alcance acotado — lo excluido está enumerado en A-7
- [x] Dependencias y supuestos identificados (A-1 a A-10)

## Feature Readiness

- [x] Cada requisito funcional tiene su escenario de aceptación
- [x] Las historias cubren el recorrido completo: puerta → camino → menores → plan → cierre → móvil
- [x] Los criterios de éxito cubren lo que el CEO va a recorrer en el navegador (brief §6)
- [x] La especificación no filtra decisiones de implementación en sus requisitos

## Riesgos anotados para `/speckit-plan`

1. **D-4 cambia el esquema de los menores.** Entra aquí porque hoy cuesta cero (0 fichas compartidas en producción, confirmado por el CEO). Es el punto más delicado del PR y va con su propia migración y sus propias pruebas.
2. **El portero del camino toca `middleware.ts`**, que gobierna el acceso de todos los roles. Un error ahí no rompe una pantalla: cierra la aplicación. Las pruebas deben cubrir explícitamente que los roles que no son padre quedan intactos.
3. **El registro por enlace convive con el código de 6 dígitos** del colegio sobre el mismo formulario. Separar sin romper el camino del colegio es requisito, no cortesía.
4. **La base de datos local está por detrás de `main`**: hay que ponerla al día antes de probar nada.

## Notes

- Los ítems incompletos exigirían actualizar la especificación antes de `/speckit-plan`. No quedó ninguno.
