# Research — 002-llegadas-doble-token

> Artefacto completado retroactivamente (I-11, 2026-07-23) al tocar llegadas por D-021 (spec
> 005-A). Registra las decisiones que la implementación (ya cerrada y probada) tomó en su momento,
> verificadas contra el código vigente; el delta D-021 queda al final.

## R1. Reuso íntegro del andamiaje de despachos (001-US2)

- **Decisión:** las llegadas reutilizan `ClienteSupertransporte` (stub/real con doble gate),
  `TokenProveedorStore`, `construirCabeceras` (3 cabeceras + herencia rol 3) y el patrón
  table-driven de cola. Solo cambian tabla, endpoint externo, extractor de id y campos propios.
- **Racional:** segundo dominio transaccional idéntico en forma; duplicar maquinaria habría
  divergido validaciones y guardarraíles.
- **Alternativas:** generalizar una "cola genérica" — descartado (sobre-abstracción prematura con
  dos casos); implementación independiente — descartado (drift).

## R2. Columnas de cola ADITIVAS sobre la tabla legacy

- **Decisión:** `tbl_llegadas_solicitudes` del legacy NO tiene columnas de cola (verificado en su
  migración; HANDOFF §9 #9). El 003 añade `lle_sol_estado/reintentos/rol_id/siguiente_intento`
  de forma aditiva con índice `(estado, siguiente_intento)`.
- **Racional:** espejo del ALTER que despachos sí tiene en el legacy; constitución §1.2.

## R3. Un solo worker, dos pasadas (hoy tres)

- **Decisión:** no se creó un segundo proceso: `scripts/worker.mjs` ganó la pasada de llegadas
  bajo el MISMO advisory lock (30032026). (Desde 005-A son tres pasadas: + mantenimientos.)
- **Racional:** regla "un solo proceso/worker" (AGENTS §6, constitución §1.5-R3).

## R4. Regla tipo 1/tipo 2 (verificada con el CEO — HANDOFF §10.9)

- **Decisión:** llegada **tipo 1** exige `idDespacho` (se reporta contra la salida previa);
  **tipo 2** lo prohíbe (cierre de operación sin salida registrada). Referencia lógica sin FK.
- **Racional:** el CEO confirmó el flujo (2026-07-22); el 003 ya lo implementaba correctamente
  (`llegadas/route.ts`).

## R5. Delta D-021 (aplicado en 005-A, 2026-07-23)

- `POST /api/integracion/llegadas` gana **intento de envío inmediato con caída a cola** (helper
  compartido `envio-inmediato.ts`); la respuesta 202 informa el estado resultante.
- `MAX_REINTENTOS`/`BACKOFF` dejaron de ser constantes: env `COLA_MAX_REINTENTOS`/
  `COLA_BACKOFF_MIN` (D-019b), compartidas por las 3 colas.
- El endpoint quedó protegido por el **guard de módulo `llegadas`** (D-017).
