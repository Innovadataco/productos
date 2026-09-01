# Specification Quality Checklist: SPEC-340 · Mis reportes y el expediente · el hilo

**Purpose**: Validar la especificación antes de planear
**Created**: 01-09-2026
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sin detalles de implementación en requisitos y criterios (las tablas del «Problema» citan archivos como EVIDENCIA de verificación en fuente, exigida por AGENTS.md)
- [x] Centrada en el valor para el padre
- [x] Legible por alguien que no programa
- [x] Secciones obligatorias completas

## Requirement Completeness

- [x] Sin marcadores [NEEDS CLARIFICATION] — las 4 decisiones abiertas se resolvieron con el CEO el 01-09 (auto-cierre, partición, cola, reescritura de #202)
- [x] Requisitos verificables (FR-001 a FR-020)
- [x] Criterios medibles (SC-001 a SC-009), sin tecnología
- [x] Escenarios de aceptación en las 9 historias
- [x] Casos borde: mismo día, sin clasificar, dos pestañas, contraseña errada, disputa, una ciudad, mismo minuto, expediente legado, camino sin terminar
- [x] Alcance acotado — A-7 enumera lo que va a SPEC-341 y lo que quedó fuera de A-68
- [x] Supuestos A-1 a A-9

## Feature Readiness

- [x] Cada FR tiene escenario o criterio que lo cubre
- [x] Las historias cubren el §6 del brief (verificación esperada del CEO)
- [x] La regla dura del brief («nada se cierra nunca» · sin plantillas interpretativas · solo ciudades) está en FR-011/012/019 y SC-007

## Riesgos anotados para `/speckit-plan`

1. **Derogar dentro de la transacción del alta de reportes** — el código más caliente del producto, arreglado ayer (#202). Reescritura con las pruebas de TODA la cadena (candado 24).
2. **El step-up de contraseña** toca autenticación — el umbral se valida en servidor, y el error no puede alimentar el contador de bloqueo de cuenta de forma sorpresiva.
3. **La inmutabilidad del registro de informes** debe ser real (sin ruta de borrado/edición), no cosmética.
4. **A-3 por verificar en plan**: si `InformeConsolidado` (flujo comité) sirve para el historial del padre o si su acople con comité obliga a un modelo propio.

## Notes

- Ningún ítem incompleto.
