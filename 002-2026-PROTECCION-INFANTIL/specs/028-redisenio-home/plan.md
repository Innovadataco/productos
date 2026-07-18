# Implementation Plan: Rediseño del Home (Landing)

**Branch**: `[028-redisenio-home]` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-redisenio-home/spec.md`

---

## Summary

Reordenar la landing page para que, de un vistazo, el usuario distinga los dos caminos principales: reportar (acción principal) y consultar (acción secundaria), con accesos secundarios a registro y dashboard público. Todo se implementa en componentes existentes, sin cambiar lógica de negocio ni endpoints.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / React 19 / Next.js 16.2.10 |
| **Dependencies** | Tailwind CSS 3.4, componentes internos (`GlassCard`, `Button`) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target** | `/` (home page) |
| **Constraints** | Sin dependencias nuevas, sin modificar `ConsultaForm`, sin afectar rutas de backend |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Landing es contenido textual + iconos SVG inline |
| §1.3 Presunción de inocencia | ✅ Pass | No se expone información de identificadores |
| §1.4 Umbral parametrizable | ✅ Pass | No se modifica lógica de consulta |
| §2.1 Stack heredado | ✅ Pass | Next.js App Router + Tailwind |
| §3.1 TypeScript strict | ✅ Pass | Sin `any` |
| §3.4 Códigos HTTP | ✅ Pass | Sin cambios de backend |
| §3.5 Logs y auditoría | ✅ Pass | Sin cambios de datos |
| §6.1 JWT en cookie | ✅ Pass | No se toca auth |

---

## Project Structure

### Documentation

```text
specs/028-redisenio-home/
├── spec.md
├── plan.md
├── quickstart.md
└── cierre.md (al finalizar)
```

### Source Code

```text
src/components/modules/
├── LandingHero.tsx          # <- modificado: nuevo layout y textos
├── HomePageClient.tsx       # <- sin cambios (salvo ajuste de margen si hace falta)
├── ConsultaForm.tsx         # <- sin cambios
└── ConsultaResultado.tsx    # <- sin cambios
```

---

## Design Decisions

- **Layout**: grid de 1 columna en móvil, 2 columnas en `sm`. La acción principal ocupa una columna y es visualmente prominente con fondo de acento (`bg-white` sobre gradiente azul). La acción secundaria usa fondo claro/transparente con borde.
- **Iconos**: SVG inline para no agregar librerías externas. Iconos: escudo (título), bandera (reportar), lupa (consultar), usuario-plus (registro), gráfico (estadísticas).
- **Accesibilidad**: cada enlace tiene texto visible; los iconos son decorativos (`aria-hidden`). La acción principal usa alto contraste (texto azul sobre fondo blanco); la secundaria usa texto blanco sobre fondo translúcido.
- **Tono**: español neutral, textos aprobados por el owner, sin voseo.

---

## Complexity Tracking

No se añade complejidad de negocio. Es un cambio de presentación acotado.
