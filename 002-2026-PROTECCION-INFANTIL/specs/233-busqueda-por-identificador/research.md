# Investigación — SPEC-233

## Fuentes revisadas

- `INSTRUCTIVO-002-PI-133-BUSQUEDA-POR-IDENTIFICADOR.md` (alcance, candados, señales).
- `BRIEF-MODULO-PADRE-v2-EXPEDIENTE.md` §3 (terminología), §4 (sistema visual), §11.2 (vista padre), §11.3 (vista admin), §13 (Ley 1581), §16 (fuera de alcance v1).
- `.specify/memory/constitution.md` §1.3 (presunción de inocencia), §1.6 (Ley 1581).
- `specs/232-vista-padre-expedientes/` (formato de referencia y cadena de dependencias).

## Incógnitas resueltas contra el código real

### 1. ¿Existen métodos DAL para listar expedientes por identificador?
No. `ExpedienteRepository` (`src/lib/dal/repositories/expediente-repository.ts:201-248`) solo tiene `listarExpedientesDePadre` (por `padreUsuarioId`, sin filtro de identificador) y `obtenerExpedientePorId`. Se agregan 2 métodos aditivos:
- `listarExpedientesDePadrePorIdentificador` (padre: `where { padreUsuarioId, identificadorReportado }`, orden `fechaApertura` desc). El índice `@@index([identificadorReportado])` ya existe en el modelo (`prisma/schema.prisma:2128`).
- `listarExpedientesPorIdentificadorAnonimo` (admin: `select` explícito sin `padreUsuarioId` ni relaciones).

### 2. ¿Cómo autentican las páginas padre existentes?
Patrón en `src/app/dashboard/padre/expedientes/page.tsx:8-23` y `[id]/page.tsx:8-24`: cookie `__Host-token`/`token` → `verifyToken` → exigir `payload.rol === "PARENT"` → redirect `/login`. Se replica idéntico.

### 3. ¿Cómo se restringe la vista admin a ADMIN/COMITE_VALIDACION?
El layout admin (`src/app/dashboard/admin/layout.tsx:10-24`) admite `ADMIN`, `OPERADOR` y `COMITE_VALIDACION`; la guarda fina se hace en la página leyendo `payload.rol` y redirigiendo a `/dashboard/admin` si es `OPERADOR` (mismo espíritu que `ADMIN_ONLY_ROUTES` en `src/lib/proxy.ts:205`). No se toca el proxy: `/dashboard/admin/**` ya está cubierto (`src/lib/proxy.ts:159,164,231`) y `/dashboard/padre/**` es ruta de usuario final permitida a `PARENT` (`src/lib/proxy.ts:136-138,164-165`).

### 4. ¿De dónde sale el agregado anónimo admin?
`obtenerSenalComunitaria` (`src/lib/expediente/compilacion/queries/senal-comunitaria.ts:128-148`, SPEC-234): lee `SenalComunitariaCache` vía `SenalComunitariaRepository.obtenerPorIdentificador` (`src/lib/dal/repositories/senal-comunitaria-repository.ts:31-33`) y, si falta o está invalidada, recalcula al vuelo. Retorna totales por estado, `categoriasFrecuenciaJson`, `paisesJson`, `ciudadesJson`, `plataformasJson`, `primeraAparicionEn`, `ultimaAparicionEn` — todo agregado, cero textos ni identidades, alineado con §13 del brief.

### 5. ¿Existe ya una vista admin de detalle de expediente para el botón "Ver detalle"?
No. `src/app/dashboard/admin/` tiene `comite/`, `monitoreo/`, `operadores/`, etc., pero ninguna ruta de expedientes. El botón del brief §11.3 queda fuera de v1 (deuda hacia SPEC-237).

### 6. ¿Hay helpers de formato y labels ya cerrados?
Sí: `src/lib/padre/expediente-ui.ts` expone `LABELS_ESTADO`, `LABELS_SCORE`, `COLORES_SCORE`, `diasDesdeUltimaActividad` (timezone Bogotá, `date-fns-tz`). Se reutilizan sin duplicar.

### 7. ¿Qué campos tiene `Expediente` para las cards?
`prisma/schema.prisma:2100-2130`: `id`, `padreUsuarioId`, `identificadorReportado`, `plataformaId` (nullable), `fechaApertura`, `fechaCierre`, `estado`, `scoreGravedadActual`, `numEventos`, `ultimoEventoEn`, `expedienteRelacionadoAnteriorId` (cadena histórica; v1 solo ordena por fecha, la cadena explícita se puede explotar en v2).

### 8. ¿El sidebar padre necesita item nuevo?
No. `PadreSideNav` (`src/components/modules/padre/PadreSideNav.tsx:51-59`) tiene los 7 items cerrados de SPEC-231; la búsqueda por identificador es una vista de drill-down (entrada por detalle de expediente + caja de búsqueda en la propia vista), no un item de menú.

## Alternativas consideradas

| Alternativa | Descartada por |
|---|---|
| Endpoint API `GET /api/*/identificador/[nick]` + fetch cliente | Duplica validación de sesión y serialización; el patrón SPEC-232 (Server Component + DAL) ya está aprobado y en prod. |
| Reutilizar `listarExpedientesDePadre` y filtrar en memoria | Rompe paginación y trae datos innecesarios; el filtro debe vivir en la query. |
| Vista admin con expedientes completos y enmascaramiento en UI | Viola Ley 1581 por construcción: el dato sensible no debe salir de la capa de datos. |
| Item en `AdminNav` como entrada a la búsqueda admin | `AdminNav` consume permisos granulares por módulo; agregar item amplía alcance y riesgo de colisión. |
