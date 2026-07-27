# Implementation Plan: Spec 103 — Fix fuga de PII en seguimiento público (I-28)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

## Diseño

1. **FR-1**: en `route.ts` del seguimiento, construir el objeto `clasificacion` sin
   `piiDetectada` (solo campos no sensibles + `contienePii`).
2. **FR-2**: quitar el campo del tipo de la respuesta en `SeguimientoClient.tsx`.
3. **FR-3**: grep de `piiDetectada` en `src/app/api/**` clasificando cada ocurrencia:
   escritura BD (procesar, worker-secret) OK; lectura admin gateada OK; cualquier otra
   respuesta no-admin → corregir y reportar.
4. **FR-4**: en `rate-limit.ts`, parametrizar el comportamiento ante fallo del store:
   default fail-open (comportamiento actual del resto de scopes) y fail-closed para
   `seguimiento` y `login` (mapa de scopes o parámetro por scope, lo más simple que
   respete el patrón existente).
5. **Tests**: regresión del endpoint (sin `piiDetectada`, con `contienePii`) y fail-closed
   del scope `seguimiento` (store caído → `allowed:false`).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Romper el front de seguimiento | El front ya solo usa `contienePii` (verificado en la incidencia); test de regresión |
| Fail-closed bloquee login/seguimiento ante fallo transitorio de BD | Es la decisión de seguridad explícita (I-28); se documenta en el cierre |
| Tocar procesar/admin por error | Barrido con lista explícita de ocurrencias permitidas |

## Despliegue

**DIFERIDO** (guarda de la tarea): implementar + commitear, sin deploy. Validación interina
= tests verdes + revisión de diff por ZEUS.
