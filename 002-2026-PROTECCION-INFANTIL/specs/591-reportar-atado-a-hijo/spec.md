# SPEC-591 · Reportar atado a hijo/familiar (decisión CEO)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden CEO (Jelkin), 06-09-2026. Rama `work/pi-SPEC-589-591-ajustes-padre`.

## Impacto en arquitectura: no

El contrato de `POST /api/reportes` gana un campo opcional (`hijoId`) cuya obligatoriedad depende de la sesión; no hay endpoints ni rutas nuevas. Migración 100 % aditiva.

## El problema

Cualquier padre autenticado podía reportar cualquier situación, sin relación con sus fichas «A quién protego». Decisión EXACTA del CEO (Jelkin, 06-09-2026): **«el padre que está autenticado SOLO puede reportar situaciones de sus hijos; si quiere anónimo, cierra sesión y reporta»**. El modelo `Hijo` ES la ficha de hijos/familiares (SPEC-325) — no hay otro modelo de familiares.

## Alcance

- **Modelo `Reporte`**: se agrega `hijoId String?` con relación a `Hijo` (`onDelete: SetNull`) e índice. **SetNull es deliberado**: el reporte es evidencia — si el padre borra o inactiva la ficha, el reporte sobrevive desvinculado; una acción sobre la lista del padre no puede destruir la evidencia que ya existía.
- **API `POST /api/reportes`**: el schema Zod acepta `hijoId` opcional; la regla se aplica SIEMPRE en el servidor (nunca se confía en el cliente):
  - Padre autenticado (sesión PARENT) → `hijoId` OBLIGATORIO: 400 «Elige a quién va dirigido el reporte.» si falta; 403 único (no distingue existencia, para no enumerar fichas ajenas) si la ficha no existe o no es suya; 409 si es suya pero está inactiva.
  - Anónimo → `hijoId` PROHIBIDO: 400 «Los reportes anónimos no pueden vincularse a una ficha.»
  - La resolución ocurre ANTES de los rate limits: un 400/403 claro no gasta cuota.
- **Pipeline**: `ReporteCreationService.crear` y el factory `crearReporteConTexto` reciben `hijoId`; worker, clasificación y dedup no cambian.
- **Wizard (modo autenticado)**: paso inicial «¿A quién va dirigido?» con las fichas ACTIVAS del padre (GET `/api/padre/hijos`, ya existente), nombre + apellidos; sin selección no avanza. En modo anónimo el paso no existe y el flujo queda idéntico. Si no tiene fichas activas, la pantalla lo dirige a registrar una y recuerda la opción anónima (cerrar sesión). La selección viaja en el borrador de sessionStorage.
- **Visualización**: «Mis reportes» (tarjetas por cadena) muestra «dirigido a …» en cada evento; el detalle privado muestra «Dirigido a …» bajo la fecha. Ambos desde el DAL (`hijoNombre` en `EventoCadenaDto`, `ReporteListItemDto` y `ReporteDetallePadreDto`).

## Functional Requirements

- **FR-001**: El sistema DEBE exigir al padre autenticado que elija una de sus fichas «A quién protego» activas para reportar, rechazando con 400 la ausencia, con 403 la ficha ajena o inexistente y con 409 la ficha inactiva.
- **FR-002**: El sistema DEBE rechazar con 400 cualquier reporte anónimo que intente vincular una ficha, y DEBE persistir `Reporte.hijoId` solo tras validar titularidad y estado.
- **FR-003**: El sistema DEBE sobrevivir la desvinculación: borrar o inactivar la ficha del menor NUNCA debe borrar el reporte (FK `onDelete: SetNull`).
- **FR-004**: El wizard DEBE mostrar el paso «¿A quién va dirigido?» solo en modo autenticado, listando solo fichas activas, sin permitir avanzar sin selección; en modo anónimo el flujo no cambia.
- **FR-005**: El listado de «Mis reportes» y el detalle privado DEBEN mostrar a qué ficha va dirigido cada reporte (nombre legible, null cuando no aplica).

## Criterios de aceptación

- [x] Migración aditiva aplica en BD de test; `prisma generate` regenera el cliente con `Reporte.hijoId`.
- [x] Tests nuevos en verde: 400 sin hijoId, 403 con ficha ajena, 409 con ficha inactiva, 201 con vínculo persistido, 400 anónimo con hijoId, 201 anónimo sin vínculo (regresión), `hijoNombre` en cadenas.
- [x] Tests existentes ajustados en verde: atomicidad (SPEC-137), vinculación de cadena (SPEC-340), prioridad alta, duplicado con oferta, vigencia (SPEC-356) — todos crean ficha y envían `hijoId`.
- [x] `tsc --noEmit` verde; ESLint verde en archivos tocados.
- [x] `npm run arch:check` verde (artefacto 01-modelo-datos regenerado).

## Implementación

- Migración: `prisma/migrations/20260908005736_spec591_reporte_atado_a_hijo/migration.sql` (aplicada vía `prisma migrate deploy` contra la BD de test; `migrate dev` no corre en entorno no interactivo).
- Schema: `prisma/schema.prisma` — `Reporte.hijoId` + relación `hijo` (SetNull, con comentario del porqué) + `@@index([hijoId])`; relación inversa `Hijo.reportes`.
- Validación: `src/lib/validators.ts` (`hijoId` opcional en `crearReporteSchema`) y `src/app/api/reportes/route.ts` (`resolverHijoDelReporte` + etiqueta «A quién va dirigido» en el mensaje de error).
- DAL: `src/lib/dal/services/hijos/hijos.ts` (`obtenerHijoDePadre`, siempre acotado por padre — regla del módulo); `src/lib/dal/services/reporte-creation.ts` y `crear-reporte-con-texto.ts` reciben el vínculo.
- Consulta: `src/lib/dal/repositories/reporte.ts` (`INCLUDE_CON_DETALLE` incluye `hijo`); `src/lib/dal/types/reporte.ts` y `reporte-query.ts` (`hijoNombre` en listado y detalle); `cadenas-padre.ts` (`hijoNombre` por evento).
- UI: `src/components/modules/ReporteStepHijo.tsx` (nuevo), `ReporteWizard.tsx` (paso inicial solo autenticado, pasos corridos, `hijoId` en el POST y en el borrador), `src/lib/reportar-handoff.ts`, `src/components/modules/padre/MisReportesCadenas.tsx`, `src/components/modules/MisReporteDetalle.tsx`.
- Tests: `src/app/api/reportes/route.test.ts` (6 nuevos + 5 ajustados), `route-atomicidad.test.ts`, `route-expediente-vinculacion.test.ts`, `src/lib/dal/services/cadenas-padre.test.ts`.
- Línea base: `docs/architecture/01-modelo-datos.md` regenerado.

## Deuda / notas

- La obligatoriedad aplica solo al reporte NUEVO desde el wizard autenticado. Los flujos internos que crean reportes por otros canales (simulador de abuso, seeds) no pasan por la ruta pública y no quedan atados — decisión deliberada.
- La ficha inactiva exige «reactívala o elige otra»: el padre puede reactivar desde «A quién protego» (el cupo se vuelve a contar).
- Si en el futuro el CEO permite reportar «por cualquier menor», la regla vive en un solo lugar (`resolverHijoDelReporte`) y el wizard solo esconde el paso.
