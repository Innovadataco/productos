# Implementation Plan: SPEC-258 — Plantillas de correo del onboarding de colegio

**Branch**: `work/002-PI-rescate-pagos` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Sembrar en `NotificacionPlantilla` la plantilla `colegio.creado.email` y las otras del flujo institucional que falten (activación, bienvenida, recordatorio) con `upsert(create/update:{})`. Cero migración. El motor de notificaciones deja de descartar los envíos.

## Technical Context

**Language/Version**: TypeScript 5
**Primary Dependencies**: Prisma 5.22, Vitest
**Storage**: PostgreSQL 16
**Testing**: test de integración que crea un colegio y verifica que la fila `notificaciones` queda con `plantillaClave='colegio.creado.email'` y estado no-descartada.
**Target Platform**: server-side / seed
**Project Type**: web-service
**Performance Goals**: N/A
**Constraints**: Cero migración de esquema; patrón anti-I-100; el texto legal/comercial de la plantilla es responsabilidad de ZEUS/CEO — ODIN lo copia literal desde el brief o pide `NEEDS CLARIFICATION` si no está.
**Scale/Scope**: 1 bloque nuevo en `seed.ts` (~40-80 líneas por plantilla).

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| §4.5 Aditivas | ✅ | Solo `upsert`. |
| SPEC-201/247 vivo | ✅ | Se respeta. |
| Candado motor IA | ✅ | No aplica. |

## Project Structure

```text
specs/258-plantillas-onboarding-colegio/
├── spec.md
├── plan.md
├── research.md    # verifica qué plantillas existen ya, qué faltan
└── tasks.md

prisma/seed.ts    # bloque "Plantillas onboarding colegio (SPEC-258)"

src/lib/notificaciones/plantilla-onboarding-colegio.test.ts   # integración
```

**Structure Decision**: Option 1. Todo el cambio vive en el seed y en un test.

## Decisiones técnicas (para auditoría de ZEUS)

### Decisión 1 — El texto de la plantilla lo redacta ZEUS/CEO
ODIN NO redacta contenido legal ni comercial. Fase 0 revisa si el texto está en el brief o en el repo de gestión; si no está, se emite `NEEDS CLARIFICATION` y se pausa antes de sembrar. Alternativa descartada: usar placeholder — dejaría al CEO recibiendo correos genéricos, defecto peor que el actual.

### Decisión 2 — Idempotente-respetuoso siempre (`update: {}`)
Ningún deploy futuro pisa ediciones del CEO desde `/dashboard/admin/notificaciones`. Patrón replicado de las plantillas de `consentimiento.aceptado` que ya funcionan.

### Decisión 3 — Se revisan las plantillas hermanas
Fase 0 lista TODAS las plantillas del flujo de onboarding institucional. Se siembran todas juntas en el mismo commit — el brief §7 lo pide explícitamente ("se revisa si faltan otras plantillas del mismo flujo").

## Complexity Tracking

Ninguna violación.
