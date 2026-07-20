# Research: Accesibilidad (WCAG 2.2)

**Date**: 2026-07-20
**Feature**: specs/049-accesibilidad-wcag/spec.md

---

## Criterios WCAG 2.2 aplicables

| Criterio | Nivel | Aplicación en este spec |
|----------|-------|--------------------------|
| 1.1.1 Non-text Content | A | `aria-label` para íconos informativos; `aria-hidden` para decorativos. |
| 1.4.1 Use of Color | A | Badges de riesgo con texto/forma además del color. |
| 1.4.3 Contrast (Minimum) | AA | 4.5:1 texto normal, 3:1 texto grande sobre glass/fondos. |
| 1.4.11 Non-text Contrast | AA | Foco visible y controles con contraste suficiente. |
| 2.1.1 Keyboard | A | Todos los controles operables con teclado. |
| 2.4.3 Focus Order | A | Orden de foco lógico. |
| 2.4.7 Focus Visible | AA | Anillo/borde de foco en todos los controles. |
| 2.5.5 Target Size | AAA | Targets táctiles ≥ 44×44 px (objetivo). |
| 4.1.2 Name, Role, Value | A | Controles con nombre accesible. |

---

## Decisions

### D1: Auditoría manual con scripts locales

**Decision**: Medir el contraste con scripts locales (luminance WCAG) en lugar de depender de axe/Lighthouse en el entorno de build.

**Rationale**: El entorno de desarrollo no tiene configurado un runner de Lighthouse automatizado. Los scripts de Python/Node aplican la misma fórmula de luminancia relativa y permiten verificar las combinaciones exactas de Tailwind usadas en el proyecto.

### D2: No agregar dependencias de accesibilidad

**Decision**: Usar atributos HTML nativos (`aria-label`, `aria-hidden`, `aria-expanded`, `role`) y estilos CSS/Tailwind para foco y contraste.

**Rationale**: El sistema de diseño es ligero. Agregar `@axe-core/react` o `eslint-plugin-jsx-a11y` aumenta el build sin aportar valor inmediato; los cambios se pueden verificar con inspección de código y tests de renderizado.

### D3: Ajustes de color mínimos

**Decision**: Oscurecer o aclarar únicamente los colores de texto/fondo que fallen el contraste, manteniendo la identidad visual del sistema.

**Rationale**: Cumplir 1.4.3 sin rediseñar. Por ejemplo, `text-accent` en modo claro se ajusta a `sky-700` si `sky-600` falla, y los botones con fondo cian se oscurecen hasta que el texto blanco alcance 4.5:1.

### D4: Targets táctiles sin romper layout

**Decision**: Garantizar `min-h-[44px] min-w-[44px]` en botones icon-only y controles principales; para botones con texto ya se revisa que el padding implícito cumpla.

**Rationale**: 2.5.5 es criterio AAA, pero se adopta como objetivo sin modificar drásticamente el diseño existente.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Instalar `eslint-plugin-jsx-a11y` | Aumenta dependencias; los cambios son puntuales y verificables manualmente. |
| Usar `@axe-core/react` en runtime | Requiere DOM y no aporta en build/CI; se deja como mejora futura. |
| Cambiar todo el sistema de colores | Violación del alcance: "no rediseños masivos". |

---

## Open Questions (0 remaining)

All resolved. Scope is limited to UI accessibility fixes.
