# Data Model: Accesibilidad (WCAG 2.2)

**Date**: 2026-07-20
**Feature**: specs/049-accesibilidad-wcag/spec.md

---

## Schema Changes

**No hay cambios en el esquema de Prisma ni en las tablas de datos.**

Este spec es un saneamiento de la capa de presentación. Todos los cambios se realizan en componentes React, estilos CSS/Tailwind y atributos HTML accesibles.

---

## Entidades afectadas (solo UI)

| Entidad UI | Tipo | Cambio previsto |
|------------|------|-----------------|
| `RiskBadge` | Componente | Incluir texto de nivel y punto con alternativa textual. |
| `Button` | Componente | Foco visible, target táctil, ajuste de contraste. |
| `GlassCard` / `.glass` | Componente / utilidad | Verificar contraste del texto sobre el fondo. |
| `ThemeToggle` | Componente | Validar `aria-label` dinámico. |
| `NavHeader` | Componente | `aria-label` en controles de ícono. |
| `AuditLogViewer` | Componente | `aria-label` en botón de detalle. |
| `AdminNav` / `LandingHero` / `LandingFeatures` / `CanalesOficiales` | Componentes | `aria-hidden` en íconos decorativos. |

---

## Relaciones

Ninguna. Este spec no introduce ni modifica relaciones de datos.
