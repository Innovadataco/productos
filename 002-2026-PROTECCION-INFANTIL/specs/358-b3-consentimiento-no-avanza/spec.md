# SPEC-358 · B3 · "Acepto" del consentimiento no avanza (A-70 · tanda 1)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-2 · **Origen**: A-70 · B3 (recorrido de Jelkin en prod `e137caab`)

## El problema

El clic en "Acepto" no avanzaba: la puerta de entrada del producto quedaba
trabada. Traza reportada: 401 en `/api/me` tras aceptar.

## La causa raíz (reproducida en navegador, no supuesta)

El endpoint y la sesión están sanos — `POST /api/consentimiento/aceptar` responde
201 y `/api/me` sigue en 200. Lo que fallaba es **anterior al clic**: el botón
"Acepto" nunca se habilitaba.

El gate de "leíste el documento" dependía **únicamente** de un
`IntersectionObserver` sobre un centinela de 8 px con `threshold: 0.5`.
Verificado en el navegador: con el documento scrolleado al 100 % (3079/3079), las
dos casillas marcadas y el centinela **completamente dentro** del área visible,
el observer no reportó intersección — ni el del componente ni uno nuevo creado a
mano con el mismo root y threshold. Con el botón deshabilitado y sin más camino,
el usuario queda trabado en la primera pantalla.

**Por qué la suite no lo vio:** el test del componente *mockeaba* el
`IntersectionObserver` y siempre lo hacía disparar. Verde con el producto roto.

## Requisitos

- **FR-001**: El botón DEBE habilitarse cuando el usuario llega al final del
  documento, sin depender de que un `IntersectionObserver` dispare.
- **FR-002**: Si el documento no desborda su contenedor (documento corto,
  pantalla alta), no hay nada que bajar: el candado no puede trabar.
- **FR-003**: El candado NO se debilita: con el documento sin leer el botón
  sigue deshabilitado, y una medición vacía (`clientHeight === 0`, contenedor
  aún sin pintar u oculto) no concluye nada.
- **FR-004**: Los tests DEBEN cubrir el caso con un observer que nunca dispara.

## Impacto en arquitectura:

Ninguno. Cambio local de un componente cliente; sin API, sin esquema, sin
migraciones.
