# Implementation Plan: Rediseño completo del Home (Landing)

**Branch**: `[028-redisenio-home]` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-redisenio-home/spec.md`

---

## Summary

Rediseño completo de la landing page para centrarla exclusivamente en dos acciones: reportar y consultar. La tarjeta "Crear un reporte" ofrece dos botones: reportar anónimo (directo al wizard) y reportar con cuenta (login + redirect). El buscador de identificador y su resultado se mueven dentro de la tarjeta "Consultar". Se corrige el acceso anónimo a `/reportar` ajustando `src/proxy.ts`. Se eliminan distracciones del home y se conservan los canales oficiales.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / React 19 / Next.js 16.2.10 |
| **Dependencies** | Tailwind CSS 3.4, componentes internos (`Button`, `Input`, `ConsultaForm`, `ThemeToggle`) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target** | `/` (home page) y `/reportar` |
| **Constraints** | Sin dependencias nuevas, sin modificar endpoints, sin afectar auth (salvo ajuste de rutas en proxy) |

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
src/
├── proxy.ts                       # <- modificado: /reportar pública para anónimos
└── components/modules/
    ├── NavHeader.tsx              # <- modificado: quitar Consultar/Reportar del menú
    ├── LandingHero.tsx            # <- modificado: tarjeta Crear un reporte con dos botones + buscador/resultado
    ├── HomePageClient.tsx         # <- modificado: contenedor simplificado
    ├── LandingFooter.tsx          # <- modificado: copyright Innovadataco
    ├── ConsultaForm.tsx           # <- modificado: modo compact (preexistente)
    ├── LandingFeatures.tsx        # <- sin cambios, pero ya no se usa en el home
    ├── CanalesOficiales.tsx       # <- sin cambios
    └── ConsultaResultado.tsx    # <- sin cambios (usado en la vista completa /consulta)
```

---

## Design Decisions

- **Barra superior**: solo logo, "Dashboard", "Iniciar sesión" y toggle de tema. Se eliminan "Consultar" y "Reportar" de escritorio y móvil porque ya son las tarjetas del hero.
- **Hero**: grid `sm:grid-cols-[1fr_1.25fr]` con tarjeta "Crear un reporte" (fondo blanco) y tarjeta "Consultar" (glass, más ancha).
- **Tarjeta "Crear un reporte"**:
  - Botón principal "Reportar anónimo" (azul/accent, ícono ojo tachado) → `/reportar`.
  - Botón secundario "Reportar con mi cuenta" (fondo claro con borde, ícono usuario) → `/login?redirect=/reportar` (el login ya soporta redirect).
- **Acceso anónimo a `/reportar`**: se agregó `/reportar` a `PUBLIC_ROUTES` y se quitó de `USER_FINAL_ROUTES` en `src/proxy.ts`. El wizard sigue bloqueando a cuentas internas (bug 021).
- **Buscador integrado**: `ConsultaForm` en modo `compact` dentro de la tarjeta "Consultar".
- **Resultado dentro de la tarjeta**: `LandingHero` recibe el estado de la consulta y renderiza loading/error/resultado dentro de la tarjeta.
- **Eliminación de distracciones**: se remueve `LandingFeatures` del home y los accesos secundarios del hero.
- **Canales oficiales**: se conservan en el home.
- **Footer**: copyright actualizado a "Innovadataco" y eliminación del enlace "Reportar".
- **Iconos**: SVG inline para escudo, bandera, ojo tachado, usuario y lupa; sin nuevas dependencias.
- **Accesibilidad**: iconos decorativos con `aria-hidden`, textos visibles, contraste en ambos temas.
- **Tono**: español neutral, sin voseo, textos aprobados por el owner.

---

## Complexity Tracking

No se añade complejidad de negocio. Es un cambio de presentación acotado que reutiliza componentes existentes y ajusta la protección de rutas.
