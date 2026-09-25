# SPEC-730 · El padre elige y ve sus citas en el MISMO calendario visual del profesional

**Status**: DESARROLLO

**Origen:** Jelkin probando (24-09), radicado por el CEO. **Carril:** Dev 1 (dueño del calendario de SPEC-714) · Diseño. **Radicado:** `RADICADO-SPEC-730-2026-09-24.md`. **Coordina con:** SPEC-732 (unificación del calendario del profesional) — comparten la rejilla; se extrae UNA vez.

## Por qué nace

El padre elegía franja en una **lista** («Franjas libres») y veía «Mis citas» como una **lista** de tarjetas. Jelkin pidió el **mismo formato visual** del calendario del profesional (SPEC-714). El calendario ya es un solo componente reutilizable (`CalendarioProfesional`); reusarlo bien = extraer su **rejilla presentacional**, no meter al padre por el shell de escritura del profesional (arrastraría publicar/bloquear/responder + choque de voz padre=tú).

## Qué se hace

1. **Extracción de la rejilla compartida** (`src/components/modules/calendario/`): `fechas.ts` (geometría + `estiloBloque` + `posicionBogota`), `Rejilla.tsx` (`RejillaCalendario` presentacional, neutra, genérica sobre el bloque; overlays y gestos opcionales), `NavCalendario.tsx` + `useCalendarioNav.ts`. Voz NEUTRA (fuera de `profesional/` y `padre/`).
2. **Refactor del profesional SIN cambio de conducta:** `CalendarioProfesional` compone `RejillaCalendario` e inyecta su bloque (`BloqueFranja`, voz usted) y sus overlays (muro de vigencia · día bloqueado). Se re-verifican los candados de SPEC-714.
3. **Padre — elegir franja:** `RejillaElegirFranja` reemplaza el `<ul>` de `SolicitarCitaPanel`; mapea `GET /publico/profesionales/:id/franjas` a la rejilla; el toque fija `franjaSel` (el resto del flujo intacto). Solo lectura salvo esa selección.
4. **Padre — «Mis citas»:** `RejillaMisCitas` reemplaza `MisCitasList`; el padre ve solo sus citas en la rejilla y cada bloque ENLAZA al detalle existente (`/dashboard/padre/citas/[id]`, donde ya viven estado, contacto H-2 y —cuando entre SPEC-708— enlace/dirección). No reconstruye panel.

El padre **no publica ni edita franjas**. Estado de cita = proceso (cielo/ámbar/pino/tinta, CERO rubí).

## Candado

`calendario-padre.candado.test.tsx`: las dos superficies del padre renderizan la rejilla compartida (columnas `[data-col]`), no una lista; el bloque de elegir-franja es un botón que selecciona, el de «Mis citas» un enlace al detalle. Mutación: volver cualquiera a una `<ul>`/tarjetas quita `[data-col]` → rojo. Los candados de SPEC-714 (API de franjas, voz usted, materializar) siguen verdes (refactor sin conducta).

## Impacto en arquitectura: 

Sin modelo ni endpoints nuevos. Se extrae un componente presentacional compartido (`components/modules/calendario`) del que ahora dependen el profesional y las dos superficies del padre; se elimina `MisCitasList` (lo reemplaza `RejillaMisCitas`). La ventana visible fija (7am–9pm) no oculta nada: el profesional publica dentro de esa banda (confirmado con el CEO; una franja fuera sería un bug del lado profesional, a marcar aparte).
