# Tasks — SPEC-233 · Vista búsqueda por identificador (padre + admin)

## Fase 1: DAL (métodos aditivos)

- [ ] T001 Agregar `listarExpedientesDePadrePorIdentificador(padreUsuarioId, identificadorReportado, paginacion?)` a `src/lib/dal/repositories/expediente-repository.ts` (orden `fechaApertura` desc, paginación estándar `{ items, pagination }`).
- [ ] T002 Agregar `listarExpedientesPorIdentificadorAnonimo(identificadorReportado)` a `src/lib/dal/repositories/expediente-repository.ts` con `select` explícito: solo `estado`, `scoreGravedadActual`, `fechaApertura`, `fechaCierre`, `numEventos`, `plataformaId` (excluye `padreUsuarioId`, eventos y textos por construcción).
- [ ] T003 Tests de integración de ambos métodos en `src/lib/dal/repositories/expediente-repository.test.ts` (filtro por padre + identificador, orden desc, cero fuga cruzada; select anonimizado sin campos sensibles).

## Fase 2: Vista padre

- [ ] T004 Crear `src/components/modules/padre/IdentificadorBusquedaClient.tsx` (caja de búsqueda con `encodeURIComponent`, lista de expedientes propios con `ExpedienteCard`, estado vacío con CTA a `/dashboard/padre/reportar`; tema `cielo`).
- [ ] T005 Crear `src/app/dashboard/padre/identificador/[nick]/page.tsx` (Server Component; auth cookie `__Host-token`/`token` + `verifyToken` + rol `PARENT`; decodifica `[nick]`; valida no vacío y máx 100 chars con mensaje controlado; lee vía DAL).
- [ ] T006 Editar `src/components/modules/padre/ExpedienteDetalleClient.tsx`: link "Ver todos tus expedientes sobre este identificador" hacia `/dashboard/padre/identificador/[nick]` (con `encodeURIComponent`).

## Fase 3: Vista admin

- [ ] T007 [P] Crear `src/components/modules/admin/IdentificadorAgregadoAnonimo.tsx` (agregado anónimo de `obtenerSenalComunitaria`: totales por estado, categorías, plataformas, países/ciudades, primera/última aparición; "—" por dimensión sin datos; tema `ambar`).
- [ ] T008 [P] Crear `src/components/modules/admin/IdentificadorExpedientesAnonimos.tsx` (lista anonimizada, lenguaje descriptivo "N expedientes registrados sobre este identificador"; nulos como "—").
- [ ] T009 [P] Crear `src/components/modules/admin/IdentificadorAdminClient.tsx` (caja de búsqueda admin que navega con `encodeURIComponent`).
- [ ] T010 Crear `src/app/dashboard/admin/identificador/[nick]/page.tsx` (Server Component; guarda de rol `ADMIN`/`COMITE_VALIDACION`, otros → redirect `/dashboard/admin`; valida `[nick]`; lee vía `obtenerSenalComunitaria` + DAL).

## Fase 4: Tests de componente

- [ ] T011 [P] Test `src/components/modules/padre/IdentificadorBusquedaClient.test.tsx` (estado vacío, orden, links al detalle, búsqueda codificada).
- [ ] T012 [P] Test `src/components/modules/admin/IdentificadorExpedientesAnonimos.test.tsx` (barrido del HTML: sin `padreUsuarioId`, sin emails/teléfonos, nulos como "—", lenguaje descriptivo).
- [ ] T013 Registrar los tests nuevos en `vitest.unit.includes.ts`.

## Fase 5: Gate local

- [ ] T014 `npx tsc --noEmit`
- [ ] T015 `npm run lint -- --no-cache`
- [ ] T016 `npm run arch:check` (lo corre el coordinador al regenerar `docs/architecture/`)
- [ ] T017 `npm run test:unit -- <tests SPEC-233>` + `npm run tokens:check`
- [ ] T018 `npm run build`

Notas: sin cambios de schema ni migraciones; sin endpoints API nuevos; sin tocar `src/lib/ai/**`, `AdminNav`, proxy ni `PadreSideNav`. Los tests de integración con BD los corre el coordinador (BD compartida).
