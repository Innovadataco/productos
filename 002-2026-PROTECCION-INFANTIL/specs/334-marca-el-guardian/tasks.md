# Tasks: SPEC-334 · El Guardián (header + favicon)

**Branch**: `work/pi-SPEC-334-marca-guardian` · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Phase 1: Setup
- [x] T001 Worktree + npm ci (D-82) · base main 478cc4769
- [x] T002 Leer MARCA-EL-GUARDIAN.md completo; confirmar tokens del sistema (--pino/cielo/ambar-rgb claro+oscuro) y el logoHref/I-38 del header

## Phase 2: Componente + animación
- [x] T003 `Guardian.tsx`: SVG §8, tallas (viva/reducida/minima), estados (calma/alerta), ids únicos (useId)
- [x] T004 `globals.css`: keyframes + clases + [data-estado=alerta] + prefers-reduced-motion (§8/§7)

## Phase 3: Header + favicon
- [x] T005 `NavHeader`: swap a `<Guardian/>` conservando logoHref/destinoLogo (I-38); quitar ShieldIcon muerto
- [x] T006 `app/icon.svg`: talla mínima, una tinta (favicon)

## Phase 4: Tests + verificación
- [x] T007 `Guardian.test.tsx` (hueco, tallas 8/4/0, ámbar sin rojo, ids) + registro en manifest
- [x] T008 nav-logo/NavHeader verdes (I-38 intacto)
- [x] T009 Job `verificaciones` + `specs-discipline` + `test:unit`
- [x] T010 Fila 334 en `specs/README.md` · commit · push · PR

## Phase 5: Cierre
- [ ] T011 Evidencia navegador (claro/oscuro + clic por rol) — CEO/Calidad post-deploy
- [ ] T012 Follow-up: rasterizar PNG de PWA desde el SVG (herramienta de imagen)

## Fuera de alcance
- LandingHero / íconos decorativos · §9 del brief (respiro, impresión, sobre foto).
