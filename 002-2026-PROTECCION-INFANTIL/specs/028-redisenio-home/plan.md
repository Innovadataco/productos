# Implementation Plan: Rediseño del Home (Landing) con buscador integrado

**Branch**: `[028-redisenio-home]` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-redisenio-home/spec.md`

---

## Summary

Reordenar la landing page para que, de un vistazo, el usuario distinga los dos caminos principales: reportar (acción principal) y consultar (acción secundaria con buscador integrado en la tarjeta). Eliminar el bloque de consulta separado que existía debajo del hero. Mantener accesos secundarios a registro y dashboard público. Todo se implementa en componentes existentes, sin cambiar lógica de negocio ni endpoints.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / React 19 / Next.js 16.2.10 |
| **Dependencies** | Tailwind CSS 3.4, componentes internos (`Button`, `Input`, `ConsultaForm`, `ConsultaResultado`) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target** | `/` (home page) |
| **Constraints** | Sin dependencias nuevas, sin modificar endpoints, sin afectar auth |

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
├── spec.md              # Feature specification
├── plan.md              # This file
├── quickstart.md        # Escenarios de validación
└── cierre.md            # Reporte de cierre
```

### Source Code

```text
src/components/modules/
├── LandingHero.tsx          # <- modificado: nuevo layout, textos, iconos y buscador integrado
├── HomePageClient.tsx       # <- modificado: pasa onSearch a LandingHero, muestra resultados, elimina sección #consultar
├── ConsultaForm.tsx         # <- modificado: modo compact opcional (sin label)
├── ConsultaResultado.tsx    # <- sin cambios
├── LandingFeatures.tsx      # <- sin cambios
├── CanalesOficiales.tsx     # <- sin cambios
└── LandingFooter.tsx        # <- sin cambios
```

---

## Design Decisions

- **Layout**: grid de 1 columna en móvil, `sm:grid-cols-[1fr_1.25fr]` en escritorio. La tarjeta de consulta es más ancha para acomodar el input y botón.
- **Buscador integrado**: `ConsultaForm` reutilizado con nueva prop `compact` que oculta el label. El placeholder y el botón "Buscar" se mantienen.
- **Resultados**: `HomePageClient` conserva el estado de `useApi` y renderiza loading/error/resultado debajo del hero, reemplazando el bloque `#consultar`.
- **Iconos**: SVG inline para escudo, bandera, lupa, usuario-plus y gráfico de barras; sin nuevas dependencias.
- **Accesibilidad**: cada enlace tiene texto visible; los iconos son decorativos (`aria-hidden`).
- **Tono**: español neutral, textos aprobados por el owner, sin voseo.

---

## Complexity Tracking

No se añade complejidad de negocio. Es un cambio de presentación acotado que reutiliza componentes existentes.
