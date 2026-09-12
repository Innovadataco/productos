# SPEC-656 · Tasks

## Mecanismo (sustancia acordada · copy-independiente)
- [x] T1 · `clasificarVacioDirectorio` pura (`src/lib/padre/directorio-vacio.ts`): 0 verificados → `estructural`, jamás `por-filtro`.
- [x] T2 · Candado de unidad (`directorio-vacio.candado.test.ts`) + entrada en `vitest.unit.includes.ts`. Verificado por mutación (mapear el caso sin-inventario a `por-filtro` lo pone en rojo).
- [x] T3 · `PerfilProfesionalRepository.contarActivos(ahora)` reusando `vigenciaVigente` (mismo predicado que `listarActivos`).
- [x] T4 · `GET /api/padre/profesionales` devuelve `hayVerificados` (recuento solo si la lista filtrada sale vacía).
- [x] T5 · `tsc` 0.

## Forma (copy de Diseño: FORMA-SPEC656 v2.0)
- [x] T6 · Copy de Diseño recibido (estructural 3 capas + por-filtro, v2.0).
- [x] T7 · `DirectorioProfesionales`: lee `hayVerificados`, ramifica con `clasificarVacioDirectorio`; estructural = lead-in + `<CanalesOficiales/>` + encuadre «estamos sumando» + (si hay expediente) descargar el informe; oculta los filtros. Por-filtro = «ninguno coincide con estos filtros» + sugerencias + `<Button>` Quitar filtros (no raw, SPEC-633).
- [x] T8 · Candado de render (FR-005): la señal del total voltea la copy; estructural=canales sin filtros, por-filtro=reset sin 141/promesa. Verificado por mutación (severar `hayVerificados` tumba el caso por-filtro).
- [x] T8b · Re-anclado el control positivo de voz (SPEC-527) al nuevo copy tuteo («Prueba con…»).

## Decisión / cierre
- [x] T9 · VEREDICTO CEO: «avísame cuando haya» DIFERIDO — capa 2 = SOLO encuadre, sin promesa «te avisamos» ni botón. Razón: mecanismo nuevo (persistencia + disparo) + proveedor de correo sobre-cupo (el aviso no saldría) ⇒ prometerlo sería I-397 doble. Queda «pendiente ratificación Diseño» en el PR; entra entero cuando el mecanismo y el correo vuelvan.
- [x] T10 · Preflight VERDE: tsc 0 · lint 0 · arch:check · tokens:check · unidad 403/3092 · specs-discipline 8/8.
- [ ] T11 · PR. Merge por el CEO tras firmas (Diseño re-firma contra el head del PR).

## Verificación en vivo (antes de decir REALIZADO)
- [ ] T12 · En la app desplegada, con rol padre y **0 verificados en prod hoy**: la pantalla del directorio muestra el vacío estructural (no el que culpa), con los canales oficiales. Reportar qué se vio.
