# Implementation Plan: Home dashboard proactivo del área padre

**Branch**: `work/pi-SPEC-309-home-padre-proactivo` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/304-home-padre-proactivo/spec.md`

## Summary

Reemplazar el placeholder del home del padre por un dashboard proactivo Server Component que muestre saludo/fecha, resumen del círculo, semáforo, timeline, sugerencia proactiva y accesos rápidos. Los datos se orquestan desde `src/lib/padre/` con queries propias; no se importan directamente los bloques 305-308. Se expone `GET /api/padre/home` para tests y reutilización.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16 App Router

**Primary Dependencies**: React 19, Tailwind CSS, Prisma, Zod, date-fns-tz

**Storage**: PostgreSQL 16 (modelos `Usuario`, `ContactoConfianza`, `IdentificadorContacto`, `Reporte`, `Expediente`, `EventoExpediente`, `ParametroSistema`)

**Testing**: Vitest + jsdom + Testing Library; tests de API con `Request` nativo

**Target Platform**: Web

**Performance Goals**: < 200 ms p95 render server; < 150 ms p95 endpoint

**Constraints**: Sin LLM; sin servicios externos; sin modificar `src/lib/ai/**` ni `src/lib/notificaciones/motor.ts`; sin importar directamente SPEC-305-308

**Scale/Scope**: Un padre, hasta 20 contactos; timeline con 5 eventos; semáforo con resumen

## Constitution Check

- Solo texto: el dashboard solo muestra texto, conteos y metadatos; nunca texto original de reportes.
- Presunción de inocencia: el semáforo y la sugerencia usan lenguaje descriptivo ("N reportes registrados", "nivel de atención"); no hay veredictos de personas.
- IA local: no aplica; no se usa IA.
- Canales oficiales: los accesos rápidos incluyen Línea 141 ICBF, CAI Virtual y Te Protejo.
- Disputas: no aplica; solo lectura.

## Project Structure

### Documentation (this feature)

```text
specs/304-home-padre-proactivo/
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
│       ├── home.ts                    # Orquestador de queries del dashboard
│       ├── home.test.ts               # Tests unitarios de la orquestación
│       ├── home-semaforo.ts           # Cálculo propio del semáforo resumido
│       ├── home-semaforo.test.ts
│       ├── home-timeline.ts           # Query propia del timeline
│       ├── home-timeline.test.ts
│       ├── home-sugerencia.ts         # Reglas de sugerencia proactiva
│       └── home-sugerencia.test.ts
├── app/
│   ├── dashboard/
│   │   └── padre/
│   │       ├── page.tsx               # Server Component del home
│   │       └── page.test.tsx          # Test de integración/orquestación
│   └── api/
│       └── padre/
│           └── home/
│               ├── route.ts           # GET /api/padre/home
│               └── route.test.ts
└── components/
    └── modules/
        └── padre/
            ├── HomePadreDashboard.tsx       # Layout del dashboard
            ├── HomePadreDashboard.test.tsx
            ├── ResumenCirculo.tsx           # Widget de resumen
            ├── ResumenCirculo.test.tsx
            ├── SemaforoResumen.tsx          # Widget de semáforo
            ├── SemaforoResumen.test.tsx
            ├── TimelineResumen.tsx          # Widget de timeline
            ├── TimelineResumen.test.tsx
            ├── SugerenciaProactiva.tsx      # Widget de sugerencia
            ├── SugerenciaProactiva.test.tsx
            ├── AccesosRapidos.tsx           # Widget de accesos rápidos
            └── AccesosRapidos.test.tsx
```

**Structure Decision**: Se reutiliza `src/lib/padre/` para la lógica de dominio del rol PARENT. Cada widget tiene su servicio propio para evitar importar directamente SPEC-305-308. Los componentes son presentacionales y testeables; el `page.tsx` los orquesta como Server Component.

## Complexity Tracking

Ninguna violación a la constitución ni reglas duras del proyecto.
