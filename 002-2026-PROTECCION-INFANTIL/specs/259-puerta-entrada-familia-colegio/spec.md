# Feature Specification: SPEC-259 — Puerta de entrada: selección familia / colegio (I-117)

**Feature Branch**: `work/002-PI-rescate-pagos`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: se agrega una **página de selección** en `src/app/registro/inicio/page.tsx` (nueva) que ofrece dos caminos con el sistema de diseño de PI — Familia (`cielo`) va a `/registro`, Colegio (`pino`) va a `/registro-colegio`. Se actualiza `src/app/login/page.tsx:68` para que el enlace "¿No tienes cuenta?" apunte a `/registro/inicio` en lugar de `/registro`. `src/app/registro/page.tsx` (formulario de familia) y `src/app/registro-colegio/page.tsx` (formulario de colegio, SPEC-240) se conservan sin cambios. Sistema visual: Instrument Serif+Sans, anillos de protección, radios 16/12/22, solo tokens semánticos (SPEC-157/FR-007). Contraste AA verificado con `scripts/contrast_check.js`.

**Input**: `/registro-colegio` existe y funciona (SPEC-240) pero es inalcanzable desde la UI (grep sobre `src/`: cero enlaces). El único acceso a registro desde `login/page.tsx:68` apunta a `/registro`, que presenta directo el formulario de familia. Todo el onboarding institucional queda huérfano.

**Dependencias**: ninguna dura. `/registro-colegio` ya existe.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El visitante anónimo elige familia o colegio (Priority: P1)

Como visitante en `/login`, quiero que al pulsar "Regístrate" llegue a una pantalla que me pregunte si soy familia o colegio, y me lleve al formulario correcto.

**Independent Test**: navegar como anónimo desde `/login` → click "Regístrate" → aterriza en `/registro/inicio` → dos tarjetas visibles (Familia · Colegio) → click "Registrar colegio →" → aterriza en `/registro-colegio`.

**Acceptance Scenarios**:
1. **Given** el visitante en `/login`, **When** pulsa "Regístrate", **Then** navega a `/registro/inicio` y ve dos tarjetas con verbos en imperativo ("Crear mi cuenta →" / "Registrar colegio →").
2. **Given** el visitante en `/registro/inicio`, **When** pulsa "Crear mi cuenta →", **Then** navega a `/registro` (formulario de familia, sin cambios).
3. **Given** el visitante en `/registro/inicio`, **When** pulsa "Registrar colegio →", **Then** navega a `/registro-colegio` (formulario de colegio, sin cambios).
4. **Given** la pantalla `/registro/inicio`, **When** un usuario ya tiene cuenta, **Then** ve un enlace "¿Ya tienes cuenta? Inicia sesión" que va a `/login`.

### User Story 2 — Contraste AA verificado (Priority: P1)

Como responsable del sistema de diseño, quiero que los dos tokens (`cielo` y `pino`) usados en tarjetas y botones cumplan contraste AA con su texto.

**Independent Test**: correr `scripts/contrast_check.js` sobre la ruta `/registro/inicio` (o los pares de color declarados en la pantalla) → PASS AA.

**Acceptance Scenarios**:
1. **Given** la paleta viva (`cielo`, `pino`, `papel`, `tinta`), **When** se ejecuta el checker de contraste, **Then** todos los pares texto-fondo en la nueva pantalla superan AA (≥ 4.5:1 texto normal, ≥ 3:1 texto grande).

### Edge Cases

- ¿Y si un `SCHOOL_ADMIN` autenticado navega a `/registro/inicio`? — la página es pública y muestra las dos opciones; sin redirect forzado (no es un anti-patrón: es coherente que un usuario logueado la vea si comparte el link).
- ¿Y mobile? — mobile-first: las dos tarjetas apilan verticalmente en < 768 px, horizontales en ≥ 768.
- ¿Y accesibilidad de teclado? — cada tarjeta es un `<Link>` con `role` implícito, `aria-label` con el verbo, foco visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir la página nueva `src/app/registro/inicio/page.tsx` con la puerta de selección (mockup del brief §6).
- **FR-002**: La tarjeta Familia DEBE usar tokens `cielo` (fondo/border/anillo) y el verbo "Crear mi cuenta →", con destino `/registro`.
- **FR-003**: La tarjeta Colegio DEBE usar tokens `pino` y el verbo "Registrar colegio →", con destino `/registro-colegio`.
- **FR-004**: Ambas tarjetas DEBEN mostrar un **anillo de protección** SVG (patrón vivo del producto, no adorno nuevo).
- **FR-005**: La tipografía DEBE ser **Instrument Serif** para "¿Quién eres?" y "Protección Infantil" y **Instrument Sans** para el resto (subtítulo, cuerpo, botones).
- **FR-006**: Los radios DEBEN ser 16 (tarjeta grande) / 12 (interior) / 22 (botones), coherentes con el resto del sistema.
- **FR-007**: `src/app/login/page.tsx` DEBE actualizar el `<Link href="/registro">` (línea 68) a `<Link href="/registro/inicio">`. Ningún otro cambio en `login/page.tsx`.
- **FR-008**: Al pie de la pantalla DEBE aparecer "¿Ya tienes cuenta? Inicia sesión" con enlace a `/login`.
- **FR-009**: NO se toca `src/app/registro/page.tsx` (formulario familia queda sin cambios).
- **FR-010**: NO se toca `src/app/registro-colegio/page.tsx` (formulario colegio queda sin cambios).
- **FR-011**: Solo tokens semánticos (`cielo`, `pino`, `papel`, `tinta`, `ambar` si aplica) — cero color crudo (SPEC-157/FR-007, no subir el ratchet).
- **FR-012**: Diseño mobile-first: en < 768 px las tarjetas apilan verticalmente; en ≥ 768 px van lado a lado.
- **FR-013**: Contraste AA verificado con `scripts/contrast_check.js` (SC-009).

### Key Entities

- **`src/app/registro/inicio/page.tsx`**: nueva Server Component (puede ser estática, sin auth).

## Success Criteria *(mandatory)*

- **SC-008 (brief)**: `/registro` (o el path de la puerta) muestra la pantalla de selección con los dos caminos; el de colegio lleva a `/registro-colegio`.
- **SC-009 (brief)**: contraste AA verificado.

## Assumptions

- `Instrument Serif` e `Instrument Sans` ya están cargadas globalmente en el layout raíz (verificar en Fase 0; si no, se agregan al `<head>` del layout de esta ruta).
- El SVG de anillo de protección existe como componente reutilizable en `src/components/ui/Anillo.tsx` o similar.
- El path `/registro/inicio` NO colisiona con nada existente (Fase 0 confirma).
- El brief §6 dice literalmente "familia → `/registro`" y "el enlace de login apunta a la nueva pantalla de selección" — se resuelve la ambigüedad manteniendo `/registro` como formulario familia (sin cambios) y creando `/registro/inicio` como puerta, según Decisión 1 del plan.
