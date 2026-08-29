# Implementation Plan: Semáforo por hijo/familiar del círculo de confianza

**Branch**: `work/pi-SPEC-305-semaforo-circulo-confianza` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/305-semaforo-circulo-confianza/spec.md`

## Summary

Añadir un indicador de riesgo tipo semáforo (verde/ámbar/rojo) por cada contacto del círculo de confianza de un padre. El cálculo es puramente query-based (sin LLM) y se expone a través de un API route propio; el componente visual se usa en el home del padre y en la página del círculo de confianza.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16 App Router

**Primary Dependencies**: React 19, Tailwind CSS, Prisma, Zod

**Storage**: PostgreSQL 16 (modelos `ContactoConfianza`, `IdentificadorContacto`, `Reporte`, `Expediente`)

**Testing**: Vitest + jsdom + Testing Library; tests de API con `Request` nativo

**Target Platform**: Web (Chrome/Firefox/Safari modernos)

**Project Type**: web application

**Performance Goals**: < 300 ms p95 para círculo de 20 contactos

**Constraints**: Sin LLM; sin servicios externos; sin modificar `src/lib/ai/**` ni `src/lib/notificaciones/motor.ts`

**Scale/Scope**: Un padre con hasta 20 contactos; reportes de hasta 30 días para rojo

## Constitution Check

- Solo texto: el semáforo no muestra texto original de reportes.
- Presunción de inocencia: el indicador es descriptivo/estadístico ("N reportes registrados"), nunca un veredicto.
- IA local: no aplica; no se usa IA.
- Canales oficiales: no aplica a esta vista.
- Disputas: no aplica; solo lectura.

## Project Structure

### Documentation (this feature)

```text
specs/305-semaforo-circulo-confianza/
├── spec.md              # This spec
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
src/
├── lib/
│   └── padre/
│       ├── semaforo.ts              # Lógica pura de cálculo del semáforo
│       └── semaforo.test.ts         # Tests unitarios del cálculo
├── app/
│   └── api/
│       └── padre/
│           └── circulo-confianza/
│               └── semaforo/
│                   └── route.ts     # GET /api/padre/circulo-confianza/semaforo
│                   └── route.test.ts
└── components/
    └── modules/
        └── padre/
            ├── SemaforoCirculo.tsx       # Componente de lista/tarjetas
            ├── SemaforoCirculo.test.tsx  # Tests de renderizado
            └── SemaforoItem.tsx          # Tarjeta individual de contacto
```

**Structure Decision**: Se reutiliza la capa `src/lib/padre/` para lógica de dominio del rol PARENT, siguiendo el patrón de `src/lib/padre/expediente-ui.ts`. El API route está bajo `src/app/api/padre/` y los componentes bajo `src/components/modules/padre/`.

## Complexity Tracking

Ninguna violación a la constitución ni reglas duras del proyecto.
