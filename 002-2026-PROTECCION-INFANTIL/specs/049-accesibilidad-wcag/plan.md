# Implementation Plan: Accesibilidad (WCAG 2.2)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/049-accesibilidad-wcag/spec.md`

---

## Summary

Aplicar un saneamiento de accesibilidad sobre el sistema de diseño existente del Producto 002. El trabajo se limita a tres historias de usuario: nombres accesibles para íconos/estado, contraste medido y corregido, y navegación por teclado con foco visible y targets táctiles. No se agregan endpoints ni se modifica el esquema de datos.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Next.js 16 App Router |
| **Primary Dependencies** | React 19, Tailwind CSS 3.4, Vitest + jsdom |
| **Testing** | Vitest + `@testing-library/react`, auditoría manual con scripts de contraste |
| **Target Platform** | Web (desktop y móvil) |
| **Performance Goals** | Sin impacto de performance; cambios son estáticos de HTML/CSS |
| **Constraints** | Sin dependencias nuevas, sin migraciones, sin cambios de datos |

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | No se introduce multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No se alteran datos de reportes |
| §1.4 Umbral parametrizable | ✅ Pass | No se tocan parámetros de negocio |
| §2.1 Stack heredado | ✅ Pass | Solo cambios de UI en React/Tailwind |
| §3.1 TypeScript strict | ✅ Pass | No se usa `any` nuevo |
| §3.4 Códigos HTTP correctos | ✅ Pass | No hay endpoints nuevos |
| §3.5 Logs y auditoría | ✅ Pass | No se alteran logs |
| §6.1 JWT en cookie httpOnly | ✅ Pass | No se toca auth |
| §6.3 Datos sensibles encriptados | ✅ Pass | No se tocan datos sensibles |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/049-accesibilidad-wcag/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Referencias WCAG 2.2 y herramientas
├── data-model.md        # Sin cambios de schema (solo UI)
├── quickstart.md        # Validación de accesibilidad
├── checklists/
│   └── requirements.md  # Checklist de calidad
└── tasks.md             # Tareas por US
```

### Source Code (repository root)

```text
src/
├── components/ui/
│   ├── Button.tsx          # Ajustar foco, contraste y target
│   ├── ThemeToggle.tsx     # Ya accesible; validar
│   ├── Badge.tsx           # Usado por RiskBadge
│   ├── GlassCard.tsx       # Sin cambios lógicos
│   ├── Select.tsx          # Ícono decorativo
│   └── Input.tsx           # Foco visible
├── components/modules/
│   ├── RiskBadge.tsx       # Texto + forma, no solo color
│   ├── NavHeader.tsx       # aria-label en controles de ícono
│   ├── AuditLogViewer.tsx  # aria-label en botón Ver/Ocultar
│   ├── AdminNav.tsx        # Íconos decorativos con aria-hidden
│   ├── LandingHero.tsx     # Íconos decorativos
│   ├── LandingFeatures.tsx # Íconos decorativos
│   ├── CanalesOficiales.tsx# Íconos decorativos
│   ├── ScoreDisplay.tsx    # Foco en expansible
│   ├── ConfirmacionReporte.tsx # Ícono decorativo
│   └── ia/IaDocsPanel.tsx  # Íconos decorativos
└── app/globals.css         # Ajustes de contraste y foco
```

---

## Complexity Tracking

No constitution violations. No complexity justification needed.
