# Research: Espacio de gestión — cartera, detalle y Riesgos

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

## D1 · Reutilizar `GestionPm2` moviéndolo de contenedor

`GestionPm2` nació dentro del modal `ProjectForm` (SPEC-008), pero es un componente autónomo
`({ proyectoId })`. Sacarlo a un submódulo no exige tocarlo: se renderiza en el detalle. La
alternativa —duplicar la gestión en dos sitios— es justo la interactividad confusa que I-011
enseñó a evitar, así que el modal **deja** de mostrarla.

## D2 · Riesgos sobre `PanelColeccion`, no un componente nuevo

`PanelColeccion` es genérico por diseño (SPEC-008): recibe la descripción de campos y hace
listar/añadir/borrar. Riesgos tiene esa forma exacta (descripción + tres selects + texto). Un
componente propio sería duplicar lo genérico. Se usa tal cual, con `campos` describiendo
probabilidad/impacto/estado como selects.

## D3 · Agregados derivados, no persistidos

Presupuesto total, avance y riesgos abiertos son **cálculos** sobre datos que cambian
constantemente (una partida nueva, un entregable al 80%, un riesgo cerrado). Persistirlos
obligaría a recalcular en cada mutación y se desincronizarían al primer olvido. Se derivan al
leer, en `src/lib/cartera.ts` (puro, testeado). Mismo criterio que la indexabilidad de la
spec 013 y el total de presupuesto de la spec 006.

## D4 · Avance agregado = media simple

"Promedio ponderado por entregable" sin un campo de peso solo puede ser la media del `avance`
de los entregables (cada uno pesa 1). Se documenta en la función. Pesos reales (por esfuerzo,
por presupuesto de la partida asociada) serían un campo nuevo y otra spec: no se inventa.

## D5 · Endpoint propio de cartera

Añadir agregados a `GET /api/projects` penalizaría al tablero de fases y a la página de
proyectos, que solo necesitan el arreglo plano. `GET /api/projects/cartera` los calcula aparte.
En Next.js el segmento estático `cartera` gana al dinámico `[id]`, así que no colisionan.

## Abierto

- Paginar la cartera cuando crezca (§3.3). Con 1 proyecto vivo no es urgente.
- Pesos por entregable para el avance agregado, si el negocio los pide.
