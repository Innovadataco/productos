# Implementation Plan: Notificación enriquecida de Círculo de Confianza

**Branch**: `work/pi-SPEC-308-notificacion-enriquecida-circulo` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/308-notificacion-enriquecida-circulo/spec.md`

## Summary

Reemplazar la alerta ciega del Círculo de Confianza por una notificación contextual que incluya nombre del contacto, identificador, plataforma, categoría, total de reportes y link al expediente. El renderizado vive en `src/lib/notificaciones/plantillas/reporte-circulo.ts`, se expone a través de un nuevo wrapper en `src/lib/email.ts` que usa `programar()` del motor sin modificarlo, y se integra en el flujo existente `notificarCambioCirculoSiCorresponde`.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16 App Router

**Primary Dependencies**: React 19, Tailwind CSS, Prisma, Zod, Resend

**Storage**: PostgreSQL 16 (modelos `ContactoConfianza`, `IdentificadorContacto`, `Reporte`, `Expediente`, `Plataforma`, `NotificacionPlantilla`, `NotificacionRegla`)

**Testing**: Vitest + jsdom + Testing Library; tests de servicio con Prisma

**Target Platform**: Web (Chrome/Firefox/Safari modernos)

**Project Type**: web application

**Performance Goals**: < 200 ms p95 para el renderizado y programación de la alerta

**Constraints**: Sin LLM; sin servicios externos; sin modificar `src/lib/ai/**` ni `src/lib/notificaciones/motor.ts`; sin incluir texto original de reportes ni PII de terceros

**Scale/Scope**: Un padre con hasta 20 contactos; una alerta por contacto/identificador impactado dentro de la ventana de cooldown

## Constitution Check

- **Solo texto**: el email es texto/markdown; no multimedia.
- **Presunción de inocencia**: el copy es descriptivo ("N reportes registrados", "alerta relacionada"), nunca un veredicto sobre el contacto.
- **IA local**: no aplica; no se usa IA.
- **Canales oficiales**: no aplica a esta notificación interna del padre.
- **Disputas**: no aplica; el email no modifica datos ni emite veredicto.
- **No modificar texto original**: el renderizado nunca incluye el texto original del reporte.

## Project Structure

### Documentation (this feature)

```text
specs/308-notificacion-enriquecida-circulo/
├── spec.md              # This spec
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
src/
├── lib/
│   ├── notificaciones/
│   │   └── plantillas/
│   │       ├── reporte-circulo.ts       # Renderizado enriquecido del email
│   │       └── reporte-circulo.test.ts  # Tests unitarios del renderizado
│   ├── email.ts                          # Wrapper enviarAlertaCirculoConfianzaEnriquecida
│   ├── email.test.ts                     # Tests del wrapper (mock de programar)
│   └── dal/services/circulo-confianza/
│       ├── notificaciones.ts             # Integración con el flujo de disparo
│       └── notificaciones.test.ts        # Tests del flujo integrado
prisma/
└── seed.ts                               # Plantilla y regla del evento enriquecido
```

**Structure Decision**: Se reutiliza el patrón de thin wrappers de `src/lib/email.ts` (`enviarAlertaCirculoConfianza`, `enviarAlertaScoreCritico`, etc.) llamando a `programar()`. El renderizado se extrae a `src/lib/notificaciones/plantillas/` para mantener `email.ts` como coordinador y facilitar tests puros. El flujo de disparo se mantiene en `src/lib/dal/services/circulo-confianza/notificaciones.ts` para no dispersar la lógica de negocio del círculo.

## Data Flow

1. Un reporte pasa a estado visible (`CLASIFICADO`, `CORREGIDO`, `REVISION_MANUAL`, `REQUIERE_ANONIMIZACION`).
2. El sistema invoca `notificarCambioCirculoSiCorresponde(reporteId)`.
3. Se buscan contactos activos del padre cuyos identificadores coincidan con el del reporte.
4. Para cada contacto/identificador impactado dentro de la ventana y fuera de cooldown, se resuelven:
   - nombre del contacto (`etiqueta` o fallback),
   - identificador,
   - plataforma (`Plataforma.nombre` u `otraPlataforma`),
   - categoría dominante del reporte o expediente,
   - total de reportes visibles para ese identificador,
   - URL del expediente (`/dashboard/padre/expedientes/[expedienteId]`).
5. Se invoca `enviarAlertaCirculoConfianzaEnriquecida(...)` que delega en `programar()` del motor.
6. El motor renderiza la plantilla `padre.circulo_confianza.reporte_enriquecido.email` con las variables y programa el envío respetando reglas, preferencias y quiet hours.

## Complexity Tracking

Ninguna violación a la constitución ni reglas duras del proyecto.
