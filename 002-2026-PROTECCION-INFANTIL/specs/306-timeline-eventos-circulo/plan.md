# Implementation Plan: Timeline de eventos del círculo de confianza

**Branch**: `work/pi-SPEC-306-timeline-eventos-circulo` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/306-timeline-eventos-circulo/spec.md`

## Summary

Añadir una línea de tiempo de eventos de los últimos 30 días asociados a los identificadores del círculo de confianza de un padre. El endpoint devuelve reportes visibles + eventos de expediente, con severity derivada de categorías/score. El componente visual se usa en el home del padre y permite abrir el expediente relacionado.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16 App Router

**Primary Dependencies**: React 19, Tailwind CSS, Prisma, Zod

**Storage**: PostgreSQL 16 (modelos `ContactoConfianza`, `IdentificadorContacto`, `Reporte`, `Expediente`, `EventoExpediente`)

**Testing**: Vitest + jsdom + Testing Library; tests de API con `Request` nativo

**Target Platform**: Web (Chrome/Firefox/Safari modernos)

**Project Type**: web application

**Performance Goals**: < 300 ms p95 para círculo de 20 contactos y 200 eventos en 30 días

**Constraints**: Sin LLM; sin servicios externos; sin modificar `src/lib/ai/**` ni `src/lib/notificaciones/motor.ts`

**Scale/Scope**: Un padre con hasta 20 contactos; eventos de hasta 30 días

## Constitution Check

- Solo texto: el timeline no muestra texto original de reportes; solo metadatos (categoría, fecha, severity).
- Presunción de inocencia: el lenguaje es descriptivo/estadístico ("N reportes registrados", "evento en expediente"), nunca un veredicto.
- IA local: no aplica; no se usa IA.
- Canales oficiales: no aplica a esta vista.
- Disputas: no aplica; solo lectura.

## Project Structure

### Documentation (this feature)

```text
specs/306-timeline-eventos-circulo/
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
│       ├── timeline-circulo.ts              # Lógica pura de ensamblado del timeline
│       └── timeline-circulo.test.ts         # Tests unitarios del ensamblado
├── app/
│   └── api/
│       └── padre/
│           └── circulo-confianza/
│               └── timeline/
│                   ├── route.ts             # GET /api/padre/circulo-confianza/timeline
│                   └── route.test.ts        # Tests de integración del endpoint
└── components/
    └── modules/
        └── padre/
            ├── TimelineEventosCirculo.tsx       # Componente de timeline
            ├── TimelineEventosCirculo.test.tsx  # Tests de renderizado
            ├── TimelineEventoItem.tsx           # Ítem individual de evento
            └── TimelineEventoItem.test.tsx      # Tests del ítem
```

**Structure Decision**: Se reutiliza la capa `src/lib/padre/` para lógica de dominio del rol PARENT, siguiendo el patrón de `src/lib/padre/expediente-ui.ts`. El API route está bajo `src/app/api/padre/circulo-confianza/` y los componentes bajo `src/components/modules/padre/`. La integración en el home padre se deja fuera del MVP de la SPEC para no bloquear el componente reusable.

## Complexity Tracking

Ninguna violación a la constitución ni reglas duras del proyecto.
