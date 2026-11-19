# SPEC-935 · El rector lee los casos del comité (I-448) + integrantes sin recargar (I-449)

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-935-comite-rector-lectura-y-alta` desde `origin/main` (970d1ec4).

## I-448 · el rector LEE los casos de su colegio

VEREDICTO CEO: el menú (SPEC-173) y `comite/casos` (`ROLES_BANDEJA`) ya admitían al rector; solo la API de lista +
detalle había quedado en `COMITE_CONVIVENCIA` → el rector veía la pantalla y un error.

- `src/lib/colegio/comite-lectura.ts` → `colegioLecturaCasosComite(user)`: comité → `comiteColegioId`; rector
  (`SCHOOL_ADMIN`) → `colegioId`; otro rol → 403. El colegio sale de la sesión.
- `GET /api/colegio/comite/solicitudes` y `GET …/[id]` lo usan (siguen con `assertModulo("colegios_comite_bandeja")`,
  que el rector ya tiene en `seed-modulos-grants`). Caso de otro colegio → 404 (el servicio compara
  `solicitud.colegioId`).
- **Escritura sin cambios:** notas, análisis (PUT), recomendar informe y cierre/firma siguen en
  `verifyAuth("COMITE_CONVIVENCIA")` → el rector recibe 403.
- **UI:** el formulario «Agregar nota» de `CasoDetalle` no estaba gateado → el rector lo habría visto y recibido 403.
  Ahora va detrás de `puedeResolver` (la bitácora se sigue leyendo). Los demás controles de escritura ya lo estaban.
- El test viejo `solicitudes/route.test.ts` exigía «SCHOOL_ADMIN → 403» (el contrato contrario): se reescribió al
  contrato nuevo.

## I-449 · tras crear la cuenta del comité, el formulario de integrantes aparece sin recargar

`comite/integrantes/page.tsx` (server) muestra `IntegrantesList` solo si la `cuenta` que leyó existe;
`ComiteCuentaCard` creaba la cuenta en su estado local y la página no se enteraba. Ahora, al crear con éxito, la
tarjeta llama `router.refresh()` (re-render del server conservando el estado de la tarjeta).

## Candados

- `src/app/api/colegio/comite/solicitudes/rector-lectura.candado.test.ts` (integración, rutas reales + BD): rector
  lee los suyos (lista sin ajenos + detalle) → 200 · rector de otro colegio → 404 · rector escribe (nota, análisis,
  recomendar, cierre) → 403 y el caso queda PENDIENTE · PARENT → 403. Mutación probada: volver la lista a
  `verifyAuth("COMITE_CONVIVENCIA")` → rojo.
- `src/components/modules/colegio/comite/comite-rector-alta.candado.test.tsx` (unit): crear con éxito → `refresh()`;
  con error → no; los formularios de escritura de `CasoDetalle` están detrás de `puedeResolver`. Mutación probada:
  quitar el `refresh()` → rojo.
