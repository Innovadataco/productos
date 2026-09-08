# SPEC-596 · Plan — Rediseño del resultado vacío de la consulta pública

Ver `spec.md` (decisión CEO, FR-001–FR-005) y `tasks.md` (fases y tareas).

## Contexto y decisión

El CEO (Jelkin, 06-09-2026) ordenó en su recorrido: (1) quitar del resultado
vacío de la consulta el bloque de canales oficiales y el CTA «Reportar una
conducta»; (2) hacer protagonista visual de esa pantalla la tarjeta de
«Señales de alerta y qué puedes hacer» (expandida, con los 5 ítems de señales
y los 3 de acciones); (3) que el diseño sea más visual e importante que el
estado actual.

## Enfoque técnico

- **UI-only, un solo componente**: `ConsultaVaciaBloque` pasa de
  «enlace + modal + CTA + canales» a «disclaimer + tarjeta protagonista
  expandida». Sin estado, sin router, sin fetch: componente presentacional.
- **Contenido intacto por contrato**: los ítems siguen viniendo del DTO
  `bloqueVacia` (parámetros curados `consulta.vacia.*`); la API no cambia y la
  degradación limpia se conserva (sección ausente = no renderizada).
- **Prop `identificador` eliminado**: solo existía para el handoff del CTA;
  sus dos montajes (`ConsultaEnriquecidaClient`, `LandingHero`) se actualizan.
- **Tokens de marca**: la tarjeta usa ambar/papel/tinta/pino (acento de
  prevención, no alarma), sin color crudo; `aria-labelledby` para la región.
- **Constitución**: los canales oficiales se quedan donde la constitución los
  exige — flujos de reporte (`/reportar` monta `CanalesOficiales`) y portada
  (candado SPEC-456). Ningún candado se afloja: `canales-oficiales-neutro`
  protege colores del componente, no su ubicación, y queda verde sin tocarlo.

## Riesgos y mitigaciones

- **Pérdida del acceso a reportar desde la consulta**: aceptada por el CEO;
  quien quiere reportar entra por «Reportar» en la navegación. Deuda
  documentada en spec.md (vía de retiro futura: handoff sessionStorage, nunca
  query string — candado `url-privacy`).
- **Evento analítico huérfano**: `consulta_vacia_cta_reportar` queda sin
  emisor; se conserva el endpoint y su test (contrato estable) y se documenta
  la limpieza futura acoplada.
- **Accesibilidad sin modal**: la tarjeta visible de entrada mejora el flujo
  de lectura; la región lleva nombre accesible y los bullets son decorativos
  (`aria-hidden`).
