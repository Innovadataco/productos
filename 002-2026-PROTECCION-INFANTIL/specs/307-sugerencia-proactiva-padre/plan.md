# Implementation Plan: Sugerencia proactiva para el área del padre

**Branch**: `work/pi-SPEC-307-sugerencia-proactiva-padre` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/307-sugerencia-proactiva-padre/spec.md`

## Summary

Añadir una sugerencia contextual en el home del área del padre que simule una recomendación inteligente usando únicamente reglas simples sobre queries a la base de datos. No se utiliza LLM ni se modifica el motor de notificaciones. La sugerencia se expone a través de `GET /api/padre/home/sugerencia` y se renderiza con el componente `SugerenciaProactiva`.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16 App Router

**Primary Dependencies**: React 19, Tailwind CSS, Prisma, Zod

**Storage**: PostgreSQL 16 (modelos `Usuario`, `ContactoConfianza`, `IdentificadorContacto`, `Reporte`, `Expediente`, `NotificacionPadre`)

**Testing**: Vitest + jsdom + Testing Library; tests de API con `Request` nativo

**Target Platform**: Web (Chrome/Firefox/Safari modernos)

**Project Type**: web application

**Performance Goals**: < 200 ms p95 para círculo de hasta 20 contactos

**Constraints**: Sin LLM; sin servicios externos; sin modificar `src/lib/ai/**` ni `src/lib/notificaciones/motor.ts`

**Scale/Scope**: Un padre con hasta 20 contactos; ventana de 7 días para el recordatorio de inactividad

## Constitution Check

- Solo texto: la sugerencia solo muestra texto generado por reglas; nunca texto original de reportes.
- Presunción de inocencia: el mensaje es descriptivo/estadístico ("N reportes en revisión", "todo está tranquilo"), nunca un veredicto.
- IA local: no aplica; no se usa IA.
- Canales oficiales: no aplica a esta vista.
- Disputas: no aplica; solo lectura.

## Project Structure

### Documentation (this feature)

```text
specs/307-sugerencia-proactiva-padre/
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
│       ├── sugerencia.ts              # Motor de reglas de sugerencia proactiva
│       ├── sugerencia.test.ts         # Tests unitarios del motor de reglas
│       └── sugerencia.types.ts        # Tipos Zod/TS de entrada/salida
├── app/
│   └── api/
│       └── padre/
│           └── home/
│               └── sugerencia/
│                   ├── route.ts       # GET /api/padre/home/sugerencia
│                   └── route.test.ts  # Tests unitarios del endpoint
└── components/
    └── modules/
        └── padre/
            ├── SugerenciaProactiva.tsx      # Tarjeta de sugerencia
            └── SugerenciaProactiva.test.tsx # Tests unitarios del componente
```

**Structure Decision**: Se reutiliza la capa `src/lib/padre/` para lógica de dominio del rol PARENT, siguiendo el patrón de `src/lib/padre/semaforo.ts`. El motor de reglas es puro (sin side effects) para facilitar tests. El endpoint delega la autenticación a `verifyAuth` y la consulta de datos al servicio. El componente es cliente porque requiere interacción (enlace/botón de acción).

## Complexity Tracking

Ninguna violación a la constitución ni reglas duras del proyecto.
