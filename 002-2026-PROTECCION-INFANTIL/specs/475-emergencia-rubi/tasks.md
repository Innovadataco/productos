# SPEC-475 · Tasks

## Hecho (este PR)

- [x] Rama `work/pi-SPEC-475-emergencia-rubi` desde `origin/main` (creada ANTES de la primera edición).
- [x] Verificada en fuente la inversión de `BotonActivarEmergencia` y la reserva §7.1 (precedente SPEC-454).
- [x] Swap: disparador → `<Button variant="danger">` (Fantasma-rubí); confirmar del modal → `<button bg-rubi>` sólido (one-off comentado).
- [x] Cancelar del modal intacto (`variant="outline"`); conducta/fetch/estados/a11y sin cambios.
- [x] Candado `src/lib/rediseno/emergencia-rubi.candado.test.ts` (2 tests, lee fuente por handler, limpia comentarios).
- [x] Verificado por mutación en las dos direcciones (rojo distinto cada una) + restaurado a 2/2 verde.
- [x] Registrado en `vitest.unit.includes.ts`.
- [x] Preflight: lint 0 · tsc 0 · arch:check VERDE · tokens:check 1021/piso 1021 (net-zero, sin tocar piso) · `generar-readme --check` al día · unit 2593/2593.

## Pendiente

- [ ] Commit + push + PR + reportar verde al CEO.
- [ ] **Certificación de Diseño** (vía CEO) — hasta entonces I-320 (parte 1) no cierra.

## Fuera de este PR

- [ ] Otros botones de I-320 → Diseño caso por caso.
- [ ] `CancelarSuscripcion :107/:164` → ya cumplen, no se tocan.
