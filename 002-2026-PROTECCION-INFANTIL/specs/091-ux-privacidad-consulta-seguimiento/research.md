# Research — 091-ux-privacidad-consulta-seguimiento

**Fecha**: 2026-07-24 · **Autor**: ODIN

## R1 — POST sin romper la API: handler compartido

`resolverConsulta(request, identificador)` contiene toda la lógica (contrato de la 089 intacto); `GET` (compat de API) y `POST` (cliente web) solo parsean y delegan. El cliente web usa siempre POST: el identificador viaja en el cuerpo y nunca queda en historial/logs/caché de URLs. El POST valida con el mismo Zod (400 si falta o es inválido).

## R2 — Transporte del RPT sin URL: sessionStorage, no estado del router

El número RPT es un token de seguimiento (menos sensible que el identificador reportado, pero enlaza al reporte). Se transporta por `sessionStorage["seguimiento.rpt"]`: el home lo escribe y navega a `/seguimiento` limpio; `SeguimientoClient` lo lee al montar y lo **elimina** inmediatamente (un solo uso). Fallback: `?numero=` sigue funcionando para compatibilidad con enlaces ya compartidos. Alternativa descartada: POST también para seguimiento — el flujo RPT ya es inline en la página y no amerita cambiar el contrato GET de la API de seguimiento en esta spec.

## R3 — Animación de una sola corrida sin librerías

Keyframes CSS inline (`et-spin`, `et-arrow` con delays escalonados, `et-check` con rebote 0→1.15→1) con `animation-iteration-count: 1` + `forwards`. El test verifica `1 forwards` y la ausencia de `infinite`. Se renderiza al revelar el estado (llegada de `data`), no en bucle.
