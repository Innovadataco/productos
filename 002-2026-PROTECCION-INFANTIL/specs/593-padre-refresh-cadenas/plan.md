# SPEC-593 · Plan — Panel del padre: refresco en vivo + rediseño «Otros reportes»

Ver `spec.md` (FR-001–FR-005) y `tasks.md` (fases y tareas).

## Contexto y decisión

Hallazgos mostrados EN VIVO por el CEO (Jelkin, 07-09-2026) en `https://pi.innovadataco.com/mis-reportes` y el detalle de un reporte: (1) la clasificación no aparece sin salir y volver a entrar; (2) el bloque «Otros reportes» «debe ser más claro». Dos cambios de UI, sin tocar API ni schema.

## Enfoque técnico

- **(a) Refresco en vivo** — patrón existente `AnalisisExpediente` (SPEC-341): `useEffect` que arma `setInterval(cargar, 15_000)` solo cuando `data?.reporte.enProceso` y limpia en el cleanup. `enProceso` ya viene del DAL (`mapEstadoUsuario`, true para PENDIENTE/PROCESANDO/REVISION_MANUAL/POSIBLE_SPAM/REQUIERE_ANONIMIZACION/DUPLICADO/desconocido). La señal de «estado final» es la misma que ya usa la UI para el badge.
  - `cargar` se vuelve estable: `router.push` en un ref (`pushRef`), deps `[reporteId]`. Sin esto, cada render re-creaba `cargar` y re-disparaba el efecto de carga (detectado en test: doble fetch).
  - Estado de carga derivado (`data === null && error === ""`) en vez de `setLoading` sincrónico en el efecto (regla React del proyecto).
  - Fallo de un tick de polling: se traga (conserva lo mostrado); error solo si no hay datos aún (`dataRef`).
  - Mensaje «Estamos procesando tu reporte» con indicador pulsante y `aria-live="polite"`: la llegada de la clasificación se anuncia solo.
- **(b) Rediseño del bloque** — mismo DTO (`otrosReportes: { id, creadoEn, pais, ciudad, categoriaLabel, esAnonimo }`). Nada nuevo del servidor:
  - Header: título + badge contador (singular/plural), oculto en empty state.
  - Frase «Una persona más reportó a **{identificador}**.» / plural, con negrita en los datos.
  - Eventos: fila con fecha-hora (`fmtFechaHora`, ya existente), «· ciudad» y clasificación en badge redondo.
  - Se retira la etiqueta «anónimo/otro padre» (derivada de `esAnonimo`): la regla de privacidad dice «nunca quién reportó».
  - Nota de privacidad en `text-xs text-subtle`.
  - Se elimina el párrafo motivacional final del acordeón (copy del mockup que no aplica al bloque).

## Riesgos y mitigaciones

- **Re-render loop por `cargar` inestable**: mitigado con `pushRef` + deps mínimas; blindado con test que cuenta fetches (1 carga inicial, sin re-disparos).
- **Polling zombie tras navegar fuera**: cleanup del `useEffect` + test de unmount con fake timers (0 fetches post-desmontaje).
- **Flicker de loading en cada tick**: el refresco no toca estado de carga; solo el primer render muestra el skeleton.
- **Test con fake timers**: el interval DEBE crearse ya bajo fake timers (activarlos antes del render); si se activan después, el interval real queda fuera de control.
- **Privacidad**: sin cambios de datos; el test blinda ausencia de «anónimo/otro padre» y de cualquier texto ajeno.
