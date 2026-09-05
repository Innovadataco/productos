# SPEC-460 · El acento por territorio — `--accent` por rol

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: hallazgo en SPEC-454 + README-desarrollo del Sistema de Diseño («un solo botón primario, cuatro colores según el layout»). Sigue a Button (454). Autoridad de forma: **Diseño certifica**.

## Para qué

El Button de SPEC-454 lee `--accent` con fallback pino. Esta spec **enciende el color del acento por territorio** que el Button ya sabe leer: ámbar-ink (IDC/admin) · pino (colegio) · cielo (padre + profesional). Antes `--accent` no existía en ningún lado y la familia Tailwind `accent` estaba fija a pino.

## Diseño técnico (un triplet por tema alimenta ambos mundos)

`--accent-rgb` es el triplet RGB que cambia por tema; de él se derivan:
- `--accent: rgb(var(--accent-rgb))` — el **color** que consume el Button del Sistema de Diseño.
- la familia Tailwind `accent-{50..700}` = `rgb(var(--accent-rgb) / <alpha-value>)` — para los usos con escala y alpha.

Un solo triplet por tema, sin duplicar. Los consumidores legacy de `accent-*` (3 usos) siguen resolviendo — ahora por rol, sin migrarlos.

## Cambios

- **`src/app/globals.css`**:
  - `:root` declara `--accent-rgb: var(--pino-rgb)` (default) y `--accent: rgb(var(--accent-rgb))`. Las pantallas sin tema (login, portada) quedan en pino, sin cambio visual.
  - `.theme-colegio` → pino · `.theme-padre` → cielo (se les suma `--accent-rgb`).
  - **Nuevos** `.theme-admin` (ámbar-ink) y `.theme-profesional` (cielo), con el patrón completo de los otros (`.text-accent`, `.text-gradient`, `.accent-gradient`, `.ring-accent`, `.ring-accent-input`, `.bg-page`).
- **`tailwind.config.ts`**: la familia `accent` deja de ser pino fijo; resuelve `--accent-rgb`.
- **`src/app/dashboard/admin/layout.tsx`**: aplica `theme-admin`.
- **`src/app/dashboard/profesional/layout.tsx`**: aplica `theme-profesional`.

## Decisión de contraste

El acento de admin es **ámbar-ink** (`#8a5c06`, 5.11:1), no el ámbar crudo (`#a9700c`, 3.69:1 — no cumple como texto, §3.1). Vale como fondo del Primario (texto papel encima) y como texto del Fantasma.

## Candados

- **`src/app/dashboard/accent-por-rol.candado.test.ts`** (8 tests unit): `:root` declara default + `--accent` derivado; cada tema fija su `--accent-rgb` (colegio pino, padre cielo, admin ámbar-ink, profesional cielo); admin usa ámbar-ink y NO ámbar crudo; la familia Tailwind `accent` sigue `--accent-rgb` (no pino fijo); los 4 layouts aplican su tema. **Verificado por mutación**: cambiar admin a ámbar crudo mata el candado.
- `tokens:check` no sube (1021).

## Impacto en arquitectura:

- Cierra el ciclo de Button: el mueble ya leía `--accent`; ahora el color existe por territorio. El mecanismo reusa el patrón de temas por clase (`.theme-*`) que ya tenían colegio y padre; suma los dos que faltaban (admin, profesional).
- La familia Tailwind `accent` pasa de constante a variable por tema — cambio transparente para los ~156 usos de `text-accent`/`ring-accent` (clases custom, ya por tema) y los 3 de `accent-{escala}` (ahora por rol).

## Certificación (la da Diseño)

Cada territorio muestra su acento (admin ámbar, colegio pino, padre y profesional cielo). Hasta el ✅ de Diseño no se marca cerrado. Verde en CI no cierra un rediseño.

## Referencias

- **SPEC-454** — el Button que lee `--accent`.
- **README-desarrollo** «Los cuatro acentos, en Tailwind».
- **Sistema §3.2** (color por audiencia) · **§3.1** (ámbar-ink por contraste).
- Rama apilada sobre `work/pi-SPEC-454-button-sistema-diseno`; se rebasa sobre main cuando 454 mergee.
