# Tasks — SPEC-303 · Ficha colegio admin Fase 1 (002-PI-209)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Data**: [data-model.md](./data-model.md) · **Contract**: [contracts/api-payload.md](./contracts/api-payload.md) · **Quickstart**: [quickstart.md](./quickstart.md)

**Branch**: `work/pi-SPEC-303-ficha-colegio-cimiento` · **Base**: `main` @ `cc391ff32` (spec+plan commit `6a93a3e8a` post-rebase)

## Overview

Cimiento de datos de la ficha del colegio del admin y semáforo declarado en el listado. Cierra I-104 (Fase 1) y prepara terreno para I-98 (Fase 2). Se crea el repo único `ColegioActividadRepository`, se amplían dos endpoints admin de forma aditiva, se añaden 3 keys al namespace `analytics.colegios.*` en `ParametroSistema`, y se acotan cambios UI en 2 componentes.

**Total de tareas**: 22 · **MVP**: US1 (Fase 3 · repo + endpoint detalle + sección 3 ficha) + US2 (Fase 4 · endpoint listado + tabla) · **US3** (afine sin deploy) se cierra por consecuencia de US1+US2 sin código nuevo dedicado.

**Tests obligatorios** (spec §6): 4 integración repo + 1 unit fórmula semáforo + 1 componente listado + 1 A/B multi-tenant SC-010 + 1 regresión ficha = 8 tests.

---

## Phase 1 · Setup

- [X] T001 Verificar estado base del worktree: `pwd` == `.worktrees/pi-SPEC-303-ficha-colegio-cimiento`, `git branch --show-current` == `work/pi-SPEC-303-ficha-colegio-cimiento`, `git log -1 --format=%H` == `6a93a3e8a` (commit spec+plan), y `git diff --name-status origin/main..HEAD` reporta solo los 9 archivos doc-only. `.github/workflows/**`, `src/**` y `prisma/**` sin cambios pendientes.
- [X] T002 Confirmar en fuente los valores exactos del enum `Expediente.estado` en `002-2026-PROTECCION-INFANTIL/prisma/schema.prisma`. Registrar en el bloque `## Decisión T002` (comentario en `tasks.md` al pie) el valor terminal exacto (`'cerrado'` vs `'CERRADO'` vs `'FINALIZADO'` etc.) para uso en `casosAbiertos`. Si `Expediente` no tiene campo `estado` o su convención es distinta, marcar HALLAZGO y ajustar D5 del research antes de continuar.

## Phase 2 · Foundational

*No aplica.* US1 y US2 pueden ejecutarse en paralelo por archivos distintos. La ÚNICA dependencia real cruzada es que el endpoint del listado (US2) necesita reutilizar el mismo repo `ColegioActividadRepository` creado en US1, pero la firma pública queda cerrada por [contracts/api-payload.md](./contracts/api-payload.md) desde el arranque — permite empezar US2 en paralelo importando el repo (aún vacío) con el shape acordado. Alternativa serial: cerrar T003-T004 (creación + tests del repo) antes de arrancar US2.

## Phase 3 · User Story 1 — Ficha muestra actividad real (P1)

**Story goal**: la sección "3. Actividad de reportes" del `ColegioDetalleClient` deja de decir "Sin datos" para un colegio con historial (caso testigo I-98).

**Independent test**: sembrado el fixture "Colegio A con 5 AlertaColegio + rector con 3 reportes + 2 estudiantes con identificadores en 2 reportes", ejecutar `actividadDelColegio(A.id, últimos 30d)` devuelve `total >= 5` sin duplicados. En navegador, la ficha de A muestra números reales.

### Repositorio y tests

- [X] T003 [US1] Crear `002-2026-PROTECCION-INFANTIL/src/lib/dal/repositories/colegio-actividad.ts` con clase `ColegioActividadRepository` siguiendo convención (`constructor(tx?: Prisma.TransactionClient) { this.db = tx ?? prisma; }`). Exportar tipo público `ActividadDelColegio` con shape de [data-model.md §2](./data-model.md). Método `actividadDelColegio(colegioId: string, rango: { desde: Date; hasta: Date }): Promise<ActividadDelColegio>`. Implementar **estrategia B** (Prisma paralelo · research §D4): 3 `findMany` en `Promise.all` sobre las 3 rutas (A tenantId, B joins IdentificadorEstudiante+Estudiante/Profesor/Acudiente por (identificador, plataformaId), C via AlertaColegio.reporteId), deduplicar en memoria por `Reporte.id` usando `Map<string, Reporte>`, computar `total`, `porEstado`, `casosAbiertos` (query separada: alertas del colegio en `nueva|vista|escalada` + expedientes activos según valor decidido en T002), `ultimaActividad` (MAX createdAt). Validar `rango.desde <= rango.hasta` con `AppError(400)` y `colegioId` existente con `AppError(404)`. Cero `any`, tipar filtros con `Prisma.ReporteWhereInput`. Multi-tenant: filtro explícito `colegioId` en cada rama.
- [X] T004 [US1] Crear `002-2026-PROTECCION-INFANTIL/src/lib/dal/repositories/colegio-actividad.test.ts` con `beforeEach(await resetDatabase())` y fábricas de `@/lib/reporte-test-utils` (`crearColegioConAdmin`, `crearEstudiante`, `crearIdentificadorEstudiante`, `crearIdentificadorProfesor`, `crearAcudienteEstudiante`, helpers para `Reporte` y `AlertaColegio`). Casos: (a) Colegio A con múltiples rutas cumpliendo → `total` = suma sin duplicados, `casosAbiertos` = alertas abiertas + expedientes activos; (b) Colegio B con solo ruta A (rector con 1 reporte) → `total = 1`; (c) Colegio C aislado → `total = 0`, `casosAbiertos = 0`, `ultimaActividad = null`; (d) reporte alcanzable por A+C → aparece 1 sola vez (dedup); (e) rango inválido `desde > hasta` → `AppError(400)`.

### Endpoint detalle

- [X] T005 [US1] Modificar `002-2026-PROTECCION-INFANTIL/src/app/api/admin/analytics/colegios/[id]/route.ts` (endpoint detalle): mantener el bloque `colegio` actual sin cambios; añadir en la respuesta los bloques `actividadReportes` (invocando `new ColegioActividadRepository().actividadDelColegio(id, rango)` con `rango` derivado de `analytics.colegios.periodo_default_dias` leído de `ParametroSistema`) y `umbralesSemaforo` (lectura de las 8 keys `analytics.colegios.*` con defaults en código si alguna key falta — defensa en profundidad, research §Deuda técnica). Respuesta según [contracts/api-payload.md §Endpoint 2](./contracts/api-payload.md). Manejo de errores conforme constitución §3.4.

### Sección 3 ficha

- [X] T006 [US1] Modificar `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioDetalleSecciones.tsx` sección "3. Actividad de reportes" (línea ~109 actual con `EmptyState "Sin datos"`): consumir el nuevo bloque `actividadReportes` del payload. Mostrar `total`, resumen mínimo `porEstado`, `casosAbiertos` y `ultimaActividad` con formato legible. Cuando `total = 0` legítimo, mostrar EmptyState nuevo con `title="Aún no hay actividad registrada"` — nunca más "Sin datos". Otras 6 secciones INTACTAS. Sin `Math.random` en render, sin `setState` sincrónico en `useEffect`.
- [X] T007 [US1] Crear (o extender existente si aplica) test de regresión para `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioDetalleSecciones.test.tsx`: renderizar con mock del payload en dos escenarios — (a) `actividadReportes.total > 0` → sección 3 muestra los números y NO muestra EmptyState "Sin datos"; (b) `actividadReportes.total = 0` → sección 3 muestra el nuevo EmptyState "Aún no hay actividad registrada". Verificar que las 7 secciones renderizan sin errores.

## Phase 4 · User Story 2 — Listado con leyenda + columna Reportes + motivo (P1)

**Story goal**: en `/dashboard/admin/estadisticas/operacion?tab=colegios`, el ADMIN ve la leyenda de los 3 estados con umbrales reales, una columna "Reportes" con conteos, y una línea de motivo bajo cada colegio no-verde. Cierra I-104.

**Independent test**: en navegador, cargar el listado con 3 colegios sembrados de 3 colores distintos. Verificar leyenda inline visible sin hover, columna "Reportes" con conteos correctos, motivo bajo no-verdes. Ejecutar `scripts/contrast_check.js` — cumplen AA.

### Endpoint listado

- [X] T008 [US2] Modificar `002-2026-PROTECCION-INFANTIL/src/app/api/admin/analytics/colegios/route.ts` (endpoint listado): conservar la respuesta actual con `items` y `pagination`; añadir a cada item los campos `totalReportes` (obtenido via `Promise.all(items.map(colegio => new ColegioActividadRepository().actividadDelColegio(colegio.id, rango).then(r => r.total)))` con `rango` derivado de `analytics.colegios.periodo_default_dias`) y `motivoNoVerde` (string breve ≤ 60 chars derivado del hallazgo con mayor peso — reutilizar la lógica de `hallazgos-colegio.ts` sin modificarla; formatear el motivo aquí en el endpoint, no en la fórmula). Añadir bloque `umbralesSemaforo` idéntico al del detalle (T005). Respuesta según [contracts/api-payload.md §Endpoint 1](./contracts/api-payload.md).

### Componente listado

- [X] T009 [US2] Modificar `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegiosAnalyticsTable.tsx`: (a) añadir arriba de `<table>` un componente `SemaforoLeyenda` inline con 3 líneas (verde/amarillo/rojo) leyendo umbrales del prop `umbralesSemaforo` (formato: "🔴 Requiere acción · más de {casos_abiertos_alto} casos abiertos o {casos_sin_movimiento_dias} días sin movimiento"). Siempre visible, sin hover requerido. Asociación `aria-describedby` con la tabla; (b) añadir columna nueva "Reportes" con el valor `item.totalReportes`; (c) para cada fila con estado no-verde, mostrar bajo el badge de estado (existente `semaforoBadge()`) una `<p>` con texto pequeño = `item.motivoNoVerde`. Filas verdes SIN línea de motivo; (d) los badges deben usar tokens PI `pino`/`ambar`/`rubi` (verificar en tokens del proyecto — si `semaforoBadge()` ya mapea a `success/warning/danger`, confirmar que estos aliases resuelven a los tokens PI correctos; sin `Badge variant` directo con color crudo).
- [X] T010 [P] [US2] Crear `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegiosAnalyticsTable.test.tsx` (o extender el existente): mockear payload con 3 colegios (1 verde, 1 amarillo con motivo "3 casos en espera", 1 rojo con motivo "7 casos sin movimiento hace más de 14 días") + `umbralesSemaforo` completo. Verificar: (a) la leyenda inline se renderiza y contiene los strings con los valores `5` y `14` de los umbrales del mock; (b) la columna "Reportes" muestra los conteos exactos; (c) filas no-verdes tienen `<p>` con el motivo, filas verdes NO tienen ese elemento; (d) `aria-describedby` presente enlazando leyenda ↔ tabla.

## Phase 5 · User Story 3 — Umbrales editables sin deploy (P2)

**Story goal**: el CEO cambia una key `analytics.colegios.casos_abiertos_alto` en `ParametroSistema` y los endpoints devuelven el nuevo valor sin restart. El seed conserva ajustes custom (upsert anti-I-100).

**Independent test**: (a) BD limpia + seed → key creada con default 5; (b) UPDATE SQL directo a 3; (c) seed corre de nuevo → key sigue en 3; (d) GET al endpoint → payload trae 3.

- [X] T011 [US3] Modificar `002-2026-PROTECCION-INFANTIL/prisma/seed.ts` añadiendo 3 upsert al bloque de `analytics.colegios.*` (líneas ~1969-1985) usando el patrón exacto existente `{ where: { clave }, update: {}, create: { clave, valor, ... } }` (anti-I-100 SPEC-187): `analytics.colegios.casos_abiertos_alto` (valor 5), `analytics.colegios.casos_sin_movimiento_dias` (valor 14), `analytics.colegios.porcentaje_procesado_min` (valor 0.7). Formato del `valor` (número vs string vs JSON) según convención vigente del seed (verificar los 5 upsert existentes y replicar exactamente).
- [X] T012 [US3] Crear test unitario `002-2026-PROTECCION-INFANTIL/prisma/seed.test.ts` (o extender existente si aplica) que corra el seed dos veces con un update manual entre corridas y verifique que el valor custom (3) sobrevive al segundo seed. Si crear un test de seed no es idiomático en el proyecto, cubrir con un test integrado en `colegio-actividad.test.ts` que después de sembrar valores custom via `parametroSistema.upsert` directo, invoque el endpoint (o el helper que lee params) y devuelva el valor custom.

## Phase 6 · Polish & Verification

- [X] T013 Verificar accesibilidad AA (SC-008): correr `scripts/contrast_check.js` si existe sobre las 3 celdas de estado del semáforo (background/foreground de `pino`/`ambar`/`rubi` en tema claro y oscuro). Si el script no cubre esos tokens directamente, computar los ratios manualmente y adjuntar en el mensaje pre-REALIZADO. Todos deben cumplir 4.5:1 mínimo.
- [X] T014 Verificar performance del método (SC-009): correr localmente `actividadDelColegio` sobre el colegio con más volumen en BD de dev (o en su defecto contra la sembra más grande del test integración). Medir con `console.time`/`console.timeEnd` o `EXPLAIN ANALYZE` de las queries generadas. Si supera 800 ms, HALLAZGO — evaluar migración a estrategia A (research §D4) y re-medir. Documentar el número real en el mensaje pre-REALIZADO.
- [X] T015 Gate de calidad (constitución §8.3): correr desde `002-2026-PROTECCION-INFANTIL/` los 4 comandos secuencialmente: `npx tsc --noEmit` (cero errores), `npm run lint` (cero errores nuevos), `npm run test` (todos pasan · nuevos incluidos), `npm run build` (compila). Si alguno falla, PARA — no commitear ni pushear código roto.
- [X] T016 **FR-005 CRÍTICO · verificación en BD prod del caso testigo I-98** (candado obligatorio pre-REALIZADO): correr por `ssh pi-vps` el SQL del [quickstart.md §3](./quickstart.md). Adjuntar output exacto (comando + número devuelto) en el mensaje pre-REALIZADO. **Si `COUNT(*) = 0` → HALLAZGO, PARA, NO abrir PR sin resolver.**
- [X] T017 Verificación en vivo local (constitución §8.3): correr `./scripts/dev-restart.sh` y navegar a: (a) `/dashboard/admin/estadisticas/operacion?tab=colegios` — leyenda visible + columna Reportes + motivo bajo no-verdes; (b) ficha de un colegio con actividad — sección 3 muestra números reales, otras 6 intactas; (c) ficha de un colegio sin actividad — sección 3 muestra "Aún no hay actividad registrada" (no "Sin datos"). Documentar en el mensaje si se encontraron regresiones o findings de UX.
- [ ] T018 Commit único del código con mensaje claro (constitución §8.2 · español, imperativo). Stage: `git add src/lib/dal/repositories/colegio-actividad.ts src/lib/dal/repositories/colegio-actividad.test.ts src/app/api/admin/analytics/colegios/route.ts src/app/api/admin/analytics/colegios/[id]/route.ts src/components/modules/admin/ColegiosAnalyticsTable.tsx src/components/modules/admin/ColegiosAnalyticsTable.test.tsx src/components/modules/admin/ColegioDetalleSecciones.tsx src/components/modules/admin/ColegioDetalleSecciones.test.tsx prisma/seed.ts prisma/seed.test.ts` (según qué archivos hayan sido tocados/creados realmente). También stage de `tasks.md` con checkboxes actualizados. Commit message referenciando spec + closes I-104 + preview I-98 Fase 2.
- [ ] T019 Gate pre-push (candado A-47): `git fetch origin && git rebase origin/main && git diff --name-status origin/main..HEAD`. Esperado ~15-25 archivos (9 doc-only + código nuevo/modificado según T003-T012). Verificar que NO aparecen archivos en `src/lib/ai/**`, `scripts/deploy-prod.sh`, `.github/workflows/verificar-base-pr.yml`, `prisma/schema.prisma`. Si aparecen, HALLAZGO — restaurar y re-correr.
- [ ] T020 Push + `gh pr create --base main --head work/pi-SPEC-303-ficha-colegio-cimiento` con título "feat(admin): SPEC-303 · Cimiento de datos + semáforo declarado ficha colegio [002-PI-209]" y body citando spec.md + closes I-104 + preview Fase 2.
- [ ] T021 Esperar `gh pr checks <N>` completo verde (regla dura §0.0 v6.0). Ningún check en pending ni failure antes de emitir REALIZADO.
- [ ] T022 Señal REALIZADO a Fábrica PI-1 (`idc-d9`) con: commit hash · PR link · output SQL del caso testigo I-98 (T016) · resultado performance T014 · notas de accesibilidad T013 · findings de UX de T017 si los hubo. Formato: `desarrollo-1: 002-PI-209 · REALIZADO · commit <hash> · PR #<N> · <N> tests verdes + caso testigo BD prod > 0 · gh pr checks verde · <fecha>`.

---

## Dependencies

- **T001-T002** (Setup) preceden a todo.
- **T003** [US1] precede a **T004**, **T005**, **T006**, **T008** (repo es la fuente).
- **T004** [US1] independiente entre sí (test junto al repo).
- **T005** [US1] precede a **T006** y **T007** (endpoint sirve el payload que el componente consume).
- **T008** [US2] independiente de T005-T006 (archivo distinto) pero depende de T003 (importa el repo).
- **T009** [US2] depende de **T008** (consume el payload nuevo).
- **T010** [P] [US2] paralelo con T009 (archivo distinto).
- **T011-T012** [US3] independientes de US1/US2 (seed y test aparte). Idealmente correr T011 antes que los tests de integración T004 para asegurar defaults sembrados en la BD de test.
- **T013-T017** (Polish) requieren código de US1+US2+US3 completo.
- **T018-T022** cierre secuencial (commit → gate → push → PR → CI verde → REALIZADO).

## Parallel opportunities

- **T004 + T010** (tests) pueden crearse en paralelo con la implementación (TDD suave). Fábrica no impone TDD estricto.
- **T005 + T008** (endpoints distintos) pueden editarse en paralelo si el repo T003 ya está listo.
- **T011 + T003/T004** (seed vs repo) son archivos totalmente distintos.

## Independent test criteria (resumen)

| Story | Criterio de test independiente |
|---|---|
| US1 | Fixture "Colegio A" con 5 alertas + rector + identificadores enrolados → `actividadDelColegio(A.id, últimos 30d).total >= 5`. En navegador ficha de A muestra números reales en sección 3. |
| US2 | Listado carga 3 colegios de 3 colores. Leyenda visible sin hover con umbrales reales, columna Reportes con conteos, motivo bajo no-verdes, `contrast_check.js` AA. |
| US3 | Seed dos veces con update custom entre corridas → valor custom sobrevive. Endpoint devuelve valor custom sin restart. |

## MVP scope

**MVP = US1 + US2** (Phase 3 + Phase 4). US3 (Phase 5) es tarea muy pequeña (3 upserts + 1 test) que es aceptable incluir en el mismo PR.

## Implementation strategy

1. **T001-T002** primero — validar terreno y decidir `Expediente.estado` terminal.
2. **T003 + T011** en paralelo — crear repo + sembrar params (bloquean US1 y las lecturas de umbrales respectivamente).
3. **T004** en paralelo con **T005** — test del repo + endpoint detalle.
4. **T006 + T007** — sección 3 ficha + regresión.
5. **T008 + T009 + T010** — endpoint listado + tabla + test.
6. **T012** — test seed idempotencia.
7. **T013-T017** — polish y verificación.
8. **T018-T022** — commit → push → PR → CI verde → REALIZADO.

**Punto de retorno**: si T016 (caso testigo BD prod) devuelve 0, PARA y reporta HALLAZGO a Fábrica antes de abrir PR.
