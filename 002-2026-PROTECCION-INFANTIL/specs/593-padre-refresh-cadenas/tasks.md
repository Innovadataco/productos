# Tasks — SPEC-593 · Panel del padre: refresco en vivo + rediseño «Otros reportes»

## Fase 1 — Refresco en vivo del detalle (a)
- [x] T001 · `cargar` estable: `router.push` en `pushRef` (ref actualizado en efecto), deps `[reporteId]`; estado de carga derivado (`data === null && error === ""`) — `src/components/modules/MisReporteDetalle.tsx`
- [x] T002 · Polling cada 15 s SOLO mientras `data?.reporte.enProceso`, con cleanup del interval (parar en estado final y al desmontar) — `src/components/modules/MisReporteDetalle.tsx`
- [x] T003 · Fallo de tick de polling sin efecto visual si ya hay datos (`dataRef`); éxito limpia error previo — `src/components/modules/MisReporteDetalle.tsx`
- [x] T004 · Tarjeta «Estamos procesando tu reporte»: indicador pulsante, aviso de actualización automática, `aria-live="polite"`; se conserva el texto neutro de respaldo — `src/components/modules/MisReporteDetalle.tsx`

## Fase 2 — Rediseño del bloque «Otros reportes» (b)
- [x] T010 · Tarjeta del bloque: título «Otros reportes sobre este identificador» + badge contador (singular/plural, oculto en empty state) — `src/components/modules/padre/MisReportesCadenas.tsx`
- [x] T011 · Frase de acompañamiento con identificador en negrita (singular/plural) — `src/components/modules/padre/MisReportesCadenas.tsx`
- [x] T012 · Eventos en filas limpias: fecha-hora, «· ciudad», clasificación en badge; se retira «anónimo/otro padre» — `src/components/modules/padre/MisReportesCadenas.tsx`
- [x] T013 · Nota de privacidad en texto secundario; se elimina el párrafo motivacional del acordeón — `src/components/modules/padre/MisReportesCadenas.tsx`

## Fase 3 — Tests y compuertas
- [x] T020 · Test polling: refresca a los 15 s, corta en estado final (fake timers antes del render; conteo de fetches) — `src/components/modules/MisReporteDetalle.test.tsx`
- [x] T021 · Test unmount: ningún fetch de polling tras el desmontaje — `src/components/modules/MisReporteDetalle.test.tsx`
- [x] T022 · Tests del bloque: contenido (contador/fecha/lugar/clasificación), singular, privacidad y ausencia de copy motivacional, empty state — `src/components/modules/padre/MisReportesCadenas.test.tsx` (nuevo)
- [x] T023 · Compuertas: `tsc --noEmit`, ESLint, vitest unit + integration de archivos tocados, `npm run build` — VERDES
