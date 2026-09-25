# Plan · SPEC-730 · El calendario del padre (reusar la rejilla de SPEC-714)

## Estructura de PR (acordada con el CEO)

UN PR: la extracción de la rejilla compartida + los dos usos del padre (la extracción entra con su primer consumidor, sin código muerto). **SPEC-732** (unificar calendario/citaciones del profesional) va en un PR aparte, encima de main ya con 730 — así la rejilla se refactoriza una sola vez.

## Paso 1 · Extraer la rejilla (paso seguro, sin cambio de conducta)

- `src/components/modules/calendario/fechas.ts` — geometría pura (movida de `profesional/calendario/fechas.ts`) + `estiloBloque` + `posicionBogota` (ISO → fecha+minutos Bogotá, cliente-seguro).
- `Rejilla.tsx` — `RejillaCalendario<T>` presentacional: riel de horas + columnas por día + posición del bloque; overlays y gestos OPCIONALES; genérica sobre el bloque; voz neutra. `BellIcon`.
- `NavCalendario.tsx` + `useCalendarioNav.ts` — nav semana/día neutra.
- `profesional/calendario/Rejilla.tsx` — queda solo lo del profesional: `BloqueFranja` (estados + quitar, voz usted) y `OverlayDiaProfesional` (muro + día bloqueado).
- `CalendarioProfesional.tsx` — compone `RejillaCalendario` (inyecta bloque + overlays + gestos + popovers como children). Conserva `instanteDesdeHoraBogota` y los literales `POST/DELETE /api/profesional/franjas` (candados 714).

## Paso 2 · Padre (los dos usos)

- `RejillaElegirFranja.tsx` + rewire de `SolicitarCitaPanel` (fuera la `<ul>`, el chip «Solo esta semana», `finDeSemana` y el orden lineal; el toque fija `franjaSel`).
- `RejillaMisCitas.tsx` + rewire de `citas/page.tsx`; se elimina `MisCitasList.tsx`.

## Paso 3 · Candados

- Nuevo `calendario-padre.candado.test.tsx` (mutación-verificado).
- Actualizados: `spec712-pedir-cita` (§3 lista→rejilla), `boton-frontera` (mueve la deuda del tile de franja), `superficie-invertida-i381` (marca de raíz → `RejillaMisCitas`).

## Preflight

`tsc` · `eslint` · candados de 714 (calendario, voz usted, materializar, dashboard-profesional-forma) · candados del padre (boton-frontera, superficie-invertida, mis-citas, voz-tu-padre) · nuevo candado 730 · `arch:check` · `specs-discipline`. Sin tocar `specs/README.md`.

## Coordinación

- Diseño certifica contra el mockup del profesional (FORMA-CALENDARIO-PROFESIONAL).
- Ventana 7am–9pm OK para el padre (CEO). Si el crear-franja del profesional permitiera algo fuera de 7–9, es bug del lado profesional → se marca aparte, no se resuelve acá.
- CEO mergea (yo nunca). Después arranca SPEC-732 sobre este main.
