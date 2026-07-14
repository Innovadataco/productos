# Implementation Plan: Frontend Público y Flujo de Reporte

**Branch**: `feature/003-frontend-publico` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-frontend-publico/spec.md`

## Summary

Implementar la interfaz web pública del módulo de reportes comunitarios: página de inicio con consulta de identificadores, flujo de reporte en 4 pasos (anónimo o autenticado), autenticación de padres, panel "Mis reportes", y seguimiento por número. Todo conectado a las API routes reales existentes, siguiendo la dirección visual del prototipo (glassmorphism, animaciones suaves, paleta oklch) y las reglas duras de la constitución (sin multimedia, presunción de inocencia, canales oficiales visibles).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2.4

**Primary Dependencies**: Next.js 16.2.10 App Router, Tailwind CSS 3.4, Zod (validación cliente), next/font

**Storage**: N/A (frontend-only feature, consume APIs existentes)

**Testing**: Vitest + jsdom + @testing-library/react

**Target Platform**: Web (mobile-first responsive)

**Project Type**: web-application (frontend within existing Next.js monorepo)

**Performance Goals**: < 2s initial load en 3G simulada, < 3s respuesta de consulta

**Constraints**: Sin librerías de UI externas, sin localStorage para datos sensibles, cookie httpOnly para auth

**Scale/Scope**: ~10 pantallas principales, ~15 componentes React, 1 hook nuevo (useApi), 1 contexto (AuthContext)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| Sin multimedia (§1.2) | ✅ PASS | FR-021 explícito: ningún input de archivo |
| Presunción de inocencia (§1.3) | ✅ PASS | Lenguaje estadístico en UI; "Sin reportes registrados" |
| Canales oficiales visibles (§1.1) | ✅ PASS | Componente CanalesOficiales en consulta y reporte |
| Cookie httpOnly (§6.1) | ✅ PASS | Auth via /api/me + cookie; no localStorage |
| No NextAuth.js (§2.1) | ✅ PASS | Auth manual existente (jose + bcryptjs) |
| Tailwind único (§7.3) | ✅ PASS | Sin Material-UI, Chakra, shadcn/ui |
| Mobile-first (§7.3) | ✅ PASS | Diseño optimizado viewport < 768px |

## Project Structure

### Documentation (this feature)

```text
specs/003-frontend-publico/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ui-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                    # 01 Inicio + consulta (reemplaza placeholder)
│   ├── layout.tsx                  # Fuentes Plus Jakarta Sans + DM Mono
│   ├── reportar/
│   │   └── page.tsx                # 07 Nuevo reporte (wizard 4 pasos)
│   ├── login/
│   │   └── page.tsx                # 04 Login
│   ├── registro/
│   │   └── page.tsx                # 05 Registro + 06 Verificación
│   ├── seguimiento/
│   │   └── page.tsx                # 08 Seguimiento por número
│   ├── mis-reportes/
│   │   └── page.tsx                # 09 Panel padre
│   ├── api/reportes/mis-reportes/  # NEW endpoint backend
│   │   └── route.ts
│   └── ...
├── components/
│   ├── modules/
│   │   ├── ConsultaForm.tsx        # Formulario de búsqueda
│   │   ├── ConsultaResultado.tsx   # 02 Resultado de consulta
│   │   ├── CanalesOficiales.tsx    # Línea 141, CAI, Te Protejo
│   │   ├── ReporteWizard.tsx       # Wizard 4 pasos
│   │   ├── ReporteStepPlataforma.tsx
│   │   ├── ReporteStepUbicacion.tsx
│   │   ├── ReporteStepDescripcion.tsx
│   │   ├── ReporteStepConfirmar.tsx
│   │   ├── ConfirmacionReporte.tsx # 08 Confirmación
│   │   ├── SeguimientoForm.tsx
│   │   ├── MisReportesList.tsx
│   │   ├── LoginForm.tsx
│   │   ├── RegistroForm.tsx
│   │   └── VerificacionForm.tsx
│   └── ui/                         # Componentes base reutilizables
│       ├── GlassCard.tsx           # Card con glassmorphism
│       ├── Input.tsx               # Input con estilos del proyecto
│       ├── Button.tsx
│       └── Select.tsx
├── lib/
│   ├── hooks/
│   │   └── useApi.ts               # Fetch con loading/error/retry
│   └── contexts/
│       └── AuthContext.tsx         # Auth state + user
├── styles/
│   └── (Tailwind config en tailwind.config.ts)
└── ...
```

**Structure Decision**: Single project (Next.js App Router). La estructura sigue las convenciones del proyecto existente: páginas en `app/`, componentes en `components/`, utilidades en `lib/`.

## Complexity Tracking

> No violations requiring justification. All decisions align with constitution.