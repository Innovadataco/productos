# SPEC-454 · Tasks

## Hecho (este PR)

- [x] Worktree `.worktrees/pi-SPEC-454` desde `origin/main f7c61ec5e` + `npm install`.
- [x] Leído Sistema de Diseño §7.1/§5/§3, plan maestro §4, README-desarrollo, receta de firma del `sistema-vivo.html`.
- [x] Medido en fuente el uso de las 5 variantes (default 252, outline 90, ghost 30, secondary 26, danger 16) → API estable, no colapsar 5→3.
- [x] Candado de conducta `Button.test.tsx` (9 tests) contra el Button viejo, ANTES de la piel.
- [x] Escaladas a Diseño las 4 decisiones de forma + alcance (canal vía CEO). Sin adivinar.
- [x] Piel en `globals.css` (`.btn-ds*`): Primario con firma (gradiente `--pi-accent` + grano + órbita), Fantasma, Fantasma-rubí, Sutil, disabled, `prefers-reduced-motion` + `hover:none` apagan la firma.
- [x] `Button.tsx` mapea las 5 variantes a las clases; retirados los 17 crudos; spinner con `aria-hidden`.
- [x] Candados de firma (mapeo + estructura CSS, 9 tests) — verificado por mutación (quitar la órbita mata el candado).
- [x] Piso `tokens:check` 1038 → 1021 (la caída que exige el radicado).
- [x] Preflight: tsc + eslint + tokens:check + arch:check + `generar-readme --check` + suite unit (302 archivos, 2585 tests).

## Pendiente

- [ ] Commit + push + PR + reportar verde al CEO.
- [ ] **Certificación de Diseño** (vía CEO) — hasta entonces la ola NO cierra en el inventario.

## Fuera de este PR

- [ ] SPEC-460 · `--accent` por rol en los 4 layouts + soltar el pino fijo de tailwind.
- [ ] Excepción `secondary` acción-única → reportar al CEO cuando aparezca en el barrido.
- [ ] Badge → Alerta → GlassCard/Modal (siguientes olas, por palanca).
