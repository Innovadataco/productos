# Tasks — SPEC-311 · Ficha colegio admin Fase 2 · Rediseño 4 bloques A→D (002-PI-210)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Data**: [data-model.md](./data-model.md) · **Contract**: [contracts/payload-extension.md](./contracts/payload-extension.md) · **Quickstart**: [quickstart.md](./quickstart.md)

**Branch**: `work/pi-SPEC-311-ficha-colegio-rediseno` · **Base**: `main` @ `7e96e305b` (spec+plan commit `4a83c5968` post-rebase)

## Overview

Rediseño estructural de la ficha del colegio del admin. 7 secciones planas → 4 bloques A→D con propósito. Payload ampliado aditivamente en `analytics-colegio.ts` invocando `ColegioActividadRepository` Fase 1 SIN modificarlo. Nuevo componente `ColegioLineaTiempo.tsx`.

**Total de tareas**: 20 · **MVP**: US1+US2+US4 (P1) · **US3 (P2)** puede diferirse pero es tarea chica.

**Nota crítica D4** (Fábrica confirmó pre-tasks): rutas `/dashboard/admin/reportes` y `/dashboard/admin/alertas` **NO existen**. En T005 (implementación CTAs Bloque A) evalúo Opción A/B/C y documento la decisión aquí.

---

## Phase 1 · Setup

- [X] T001 Verificar estado base del worktree: `pwd` == `.worktrees/pi-SPEC-311-ficha-colegio-rediseno`, `git branch --show-current` == `work/pi-SPEC-311-ficha-colegio-rediseno`, `git log -1 --format=%H` == `4a83c5968`, y `git diff --name-status origin/main..HEAD` reporta solo los 9 archivos doc-only. Cero cambios pendientes en `src/`.
- [X] T002 Verificar en fuente qué rutas admin existen para los CTAs del Bloque A (candado 17 D-98 preventivo): `find src/app/dashboard/admin -maxdepth 3 -name page.tsx | grep -E "(reportes|alertas|spam)"`. Registrar la lista real y evaluar Opción A (reabrir §4), B (adaptar CTAs a rutas existentes como `admin/spam?colegioId=` y `admin/estadisticas/operacion?tab=colegios&colegioId=`), C (expander inline sin navegación). Decisión y justificación se escribe en la nota `## Decisión T002` al pie de este `tasks.md` antes de arrancar T005.

## Phase 2 · Foundational

*No aplica.* Los cambios se componen sobre el payload y componente existentes. US1/US2/US3/US4 pueden avanzar en paralelo por dependencias débiles.

## Phase 3 · User Story 1 — Bloque A accionable (P1)

**Story goal**: `[Ver casos abiertos]` + `[Ver alertas]` + operadores + KPIs + semáforo aparecen PRIMERO. Cierra 70% del valor.

**Independent test**: colegio con `casosAbiertos > 0`, `semaforo != verde`, 2 operadores. Verificar: Bloque A primero, 3 KPIs, 2 CTAs con href correcto, motivo bajo semáforo.

### Backend (payload)

- [X] T003 [US1] Ampliar `002-2026-PROTECCION-INFANTIL/src/lib/dal/repositories/analytics-colegio-types.ts` con los 4 campos aditivos en `ColegioDetalleResponse`: `distribucionRol`, `operadoresAsignados`, `lineaTiempo`, `serieMensual`. Shape exacto según [data-model.md §2](./data-model.md).
- [X] T004 [US1] Ampliar `002-2026-PROTECCION-INFANTIL/src/lib/dal/repositories/analytics-colegio.ts` `detalleColegio()`: añadir al `Promise.all` existente 4 llamadas nuevas — (a) `actividadDelColegio(colegio.id, {desde: colegio.creadoEn, hasta: now})` para all-time; (b) query DISTINCT `Usuario` con alertas asignadas para `operadoresAsignados`; (c) query separada con IDs de reportes vigentes para clasificación de rol reportante (`distribucionRol`); (d) agregación in-memory de `serieMensual` + `lineaTiempo.picoActividad` desde reportes all-time. Cero cambio en `colegio-actividad.ts`. Cero N+1 (todo paralelo).

### UI Bloque A

- [X] T005 [US1] Modificar `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioDetalleSecciones.tsx` insertando el Bloque A como PRIMER GlassCard del render. Contenido: (i) 3 KPIs con `<div>` grid (casos abiertos · total reportes rango · % procesados); (ii) 2 CTAs `<Link>` con hrefs según decisión T002 (Opción A/B/C · si B: `admin/spam?colegioId=` y `admin/estadisticas/operacion?tab=colegios&colegioId=`; si C: componentes internos expandibles con lista de reportes/alertas del colegio); (iii) `<ul>` de operadores asignados con nombre + email (fallback "Sin operadores asignados"); (iv) Badge del semáforo con `motivoNoVerde` bajo cuando no-verde. Tokens PI, ícono+texto, sin `Math.random` en render.

### Tests US1

- [X] T006 [US1] Crear/extender `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioDetalleSecciones.test.tsx` con casos: (a) Bloque A es el primer GlassCard en el render (assert `container.querySelectorAll('.glass-card')[0]` contiene el h2 del Bloque A); (b) 3 KPIs presentes con números del mock (`casosAbiertos: 3`, `total: 45`, `porcentajeProcesado: 92`); (c) 2 CTAs con `href*="colegioId="` (SC-007+SC-013); (d) 2 operadores del mock renderizan nombre + email; (e) fallback "Sin operadores asignados" cuando `operadoresAsignados: []`; (f) motivo bajo semáforo cuando `semaforo: 'amarillo'` y `motivoNoVerde: '3 casos abiertos'`.

## Phase 4 · User Story 2 — Bloque B analítico (P1)

**Story goal**: Reutiliza TendenciaReportes + BarChart + distribución por rol. Segundo bloque visible.

**Independent test**: colegio con 6+ meses de reportes. Verificar 3 gráficas correctas.

- [X] T007 [US2] Modificar `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioDetalleSecciones.tsx` añadiendo el Bloque B como SEGUNDO GlassCard. Contenido: (i) título `B. Cómo se comporta`; (ii) `<RitmoMensual puntos={serieMensualAsPuntoTendencia} />` (adaptar `serieMensual` al shape `PuntoTendencia` de `colegio-resumen`; si el shape no es directo, transformar en línea con `.map(m => ({fecha: m.anioMes, total: m.total}))` o similar); (iii) `<BarChart data={porEstadoAsBarChartData} ariaLabel="Distribución por estado" />` derivado de `actividadReportesCruzada.porEstado`; (iv) distribución por rol como `<BarChart data={distribucionRolAsBarChartData} ariaLabel="Quién reporta" />` con 4 barras (padre/estudiante/profesor/anónimo).
- [X] T008 [US2] Extender `ColegioDetalleSecciones.test.tsx` con: (a) Bloque B es el segundo GlassCard del render; (b) los 3 elementos gráficos existen (verificar por `data-testid` o className); (c) invariante `distribucionRol.suma === actividadReportesCruzada.total`; (d) EmptyState neutral cuando `serieMensual: []` (sin actividad).

## Phase 5 · User Story 3 — Bloque C línea de tiempo (P2)

**Story goal**: 4 hitos (`fechaRegistro`, `primerReporte`, `picoActividad`, `hoy`) horizontal, < 100 px altura.

**Independent test**: colegio con 3+ meses de historia. Verificar 4 marcadores + orden temporal.

- [X] T009 [US3] Crear `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioLineaTiempo.tsx` como componente client-side con prop `{ lineaTiempo: LineaTiempo }` (tipo importado de `analytics-colegio-types.ts`). Renderizar SVG horizontal simple (~ 60 líneas): línea horizontal con 4 marcadores en posición temporal proporcional entre `fechaRegistro` (0%) y `hoy` (100%). Cada marcador con label debajo (fecha corta legible). Edge case: si `primerReporte === null`, mostrar solo 2 marcadores (`ingreso` y `hoy`) con etiqueta neutral "Sin reportes registrados aún" entre ellos. Altura máx `max-h-24` (96 px). Tokens PI + contraste AA.
- [X] T010 [US3] Modificar `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioDetalleSecciones.tsx` añadiendo el Bloque C como TERCER GlassCard. Contenido: título `C. Línea de tiempo (desde el ingreso)` + `<ColegioLineaTiempo lineaTiempo={detalle.lineaTiempo} />`.
- [X] T011 [US3] Crear `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioLineaTiempo.test.tsx` con casos: (a) 4 hitos renderizan con mock all-time; (b) 2 hitos + etiqueta "Sin reportes registrados aún" con `primerReporte: null`; (c) altura DOM del root elemento < 100 px (assert `getBoundingClientRect().height` o estilo `max-h-24`).

## Phase 6 · User Story 4 — Bloque D referencia · SC-006 nada se pierde (P1)

**Story goal**: Reordenar las 5 secciones de referencia (info básica, tamaño, comité, hallazgos, comparación) en el 4º bloque. Assert que NINGÚN campo original se pierde.

**Independent test**: comparación campo a campo antes/después. 100% campos presentes.

- [X] T012 [US4] Modificar `002-2026-PROTECCION-INFANTIL/src/components/modules/admin/ColegioDetalleSecciones.tsx` reorganizando el resto del componente: los GlassCards que hoy son "1. Información básica", "2. Métricas de tamaño", "4. Comité de Convivencia", "6. Hallazgos", "7. Comparación con la media" pasan a ser HIJOS de un solo GlassCard wrapper "D. Ficha y contexto" (título único; subtítulos internos preservados). Sección "5. Alertas" existente se REMUEVE del render (queda cubierta por el CTA `[Ver alertas]` del Bloque A). Sección "3. Actividad de reportes" (Fase 1) se REEMPLAZA por el Bloque A completo (contenido nuevo, ya cubierto por T005). Ninguna otra información se pierde.
- [X] T013 [US4] Extender `ColegioDetalleSecciones.test.tsx` con test SC-006 exhaustivo: enumerar campos de las 7 secciones actuales (`representanteLegalNombre`, `representanteLegalEmail`, `direccion`, `fechaRegistro`, `alumnos`, `profesores`, `cursos`, `materias`, `integrantesActivos`, `casosEscalados`, `casosResueltos`, `positivos`, `negativos`, `mediana`, etc.) y assert que TODOS aparecen en el render del componente rediseñado con un colegio mock completo.

## Phase 7 · Polish & Verification

- [X] T014 Ejecutar tests locales: `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/dal/repositories/analytics-colegio src/components/modules/admin/ColegioDetalleSecciones src/components/modules/admin/ColegioLineaTiempo`. Todos verdes. Pegar salida en pre-REALIZADO.
- [X] T015 Gate calidad (constitución §8.3 + candado 24 D-55): `npx tsc --noEmit` → 0 errores · `npm run lint -- src/lib/dal/repositories/analytics-colegio.ts src/lib/dal/repositories/analytics-colegio-types.ts src/components/modules/admin/ColegioDetalleSecciones.tsx src/components/modules/admin/ColegioLineaTiempo.tsx 2>&1 | grep -E "error|✖"` → 0 errores nuevos · `(set -a; source .env.test; set +a; npm run build)` → OK.
- [X] T016 SC-009 medición: contra fixture con volumen equivalente al colegio más grande de prod, medir `time curl -s -H "Cookie: token=<jwt_dev>" http://localhost:5005/api/admin/analytics/colegios/<id>` → < 800 ms. Documentar tiempo real. Si supera, revisar `Promise.all` y considerar agrupación trimestral para `serieMensual` (D6 research).
- [X] T017 SC-008 contraste: `node scripts/contrast_check.js` verde. Sin regresión Fase 1.
- [X] T018 Verificación en vivo local (constitución §8.3): `./scripts/dev-restart.sh` + abrir `/dashboard/admin/estadisticas/operacion/colegios/<id_local>` con colegio de actividad. Verificar visualmente 4 bloques A→D en orden + click en CTAs del Bloque A (según decisión T002/T005). Documentar hallazgos.
- [ ] T019 Commit único + gate pre-push + push + PR. Stage: archivos modificados/creados en T003-T013. Añadir `tasks.md` marcado. Mensaje commit menciona SPEC-311, 002-PI-210, cierra I-98 (via Fase 2), decisión T002 aplicada. Gate `git fetch origin && git rebase origin/main && git diff --name-status origin/main..HEAD` → esperado ~10-15 archivos según [quickstart §6](./quickstart.md). Push + `gh pr create --base main`.
- [ ] T020 Esperar `gh pr checks <N>` completo verde (regla dura §0.0 v6.0). Señal REALIZADO a Fábrica PI-1 (`idc-d9`) con: commit hash · PR link · tiempo SC-009 · notas SC-008 · decisión T002/T005 · findings T018.

---

## Dependencies

- **T001-T002** (Setup) preceden a todo. T002 CRÍTICO — decide alcance de T005.
- **T003** [US1] precede a **T004** (tipos primero, luego uso).
- **T004** [US1] precede a **T005-T013** (todos los componentes UI consumen el payload ampliado).
- **T005** [US1] depende de T002 decisión.
- **T006** [US1] paralelo con T005 (test junto al componente, ambos tocan `ColegioDetalleSecciones`).
- **T007** [US2] depende de T004 + tras T005 (extiende el mismo componente).
- **T008** [US2] extensión del test de T006.
- **T009** [US3] independiente (componente separado).
- **T010** [US3] depende de T009.
- **T011** [US3] paralelo con T009-T010.
- **T012** [US4] depende de T005, T007, T010 (todos modifican el mismo componente).
- **T013** [US4] extensión del test de T006/T008.
- **T014-T020** Polish: bloqueados por T003-T013.

## Parallel opportunities

- **T003 + T009** paralelos (archivos totalmente distintos).
- **T004 + T009** paralelos si T003 listo.
- **T006 + T008 + T013** son extensiones del mismo test — se pueden escribir en secuencia sin coordinación.
- **T017 + T016 + T014** paralelos post-implement.

## Independent test criteria (resumen)

| Story | Criterio de test independiente |
|---|---|
| US1 | Bloque A es primer GlassCard, tiene 3 KPIs + 2 CTAs con `href*=colegioId=` + operadores + motivo semáforo. |
| US2 | Bloque B segundo, 3 elementos gráficos, invariante `distribucionRol.suma === total`. |
| US3 | Componente `ColegioLineaTiempo` renderiza 4 hitos o 2 con edge case, altura < 100 px. |
| US4 | SC-006 exhaustivo: 100% campos originales presentes en el rediseño (asserts de texto/label). |

## MVP scope

**MVP = US1 + US2 + US4** (P1 · 3 bloques + regresión). US3 (P2 · línea de tiempo) es tarea chica que puede ir en el mismo PR o diferirse. Recomendación: incluir US3 en el PR (es 60 líneas SVG + 3 tests · costo marginal).

## Implementation strategy

1. T001-T002 Setup (crítico T002 · decide decisión T005).
2. T003-T004 backend payload (ampliación aditiva).
3. T005+T006 Bloque A + tests (US1 · MVP mínimo).
4. T007+T008 Bloque B + tests.
5. T009+T010+T011 Bloque C + tests (US3).
6. T012+T013 Bloque D + regresión SC-006.
7. T014-T018 Polish + verificación.
8. T019+T020 Commit + push + PR + REALIZADO.

---

## Decisión T002

**Evidencia de rutas admin existentes** (`find src/app/dashboard/admin -maxdepth 3 -name page.tsx`):
- Confirmado: `/dashboard/admin/reportes` y `/dashboard/admin/alertas` **NO existen**.
- Rutas relacionadas disponibles: `admin/spam` (solo POSIBLE_SPAM) · `admin/comite/apelaciones`/`gestion` · `admin/operadores/*` · `admin/estadisticas/operacion` (donde vive la propia ficha).

**Opción elegida: C simplificada** (anchors internos).

**Justificación**:
- Ninguna ruta admin muestra "reportes filtrados por colegio" — `admin/spam` solo cubre POSIBLE_SPAM.
- Opción A (reabrir §4 para pedir rutas nuevas) es sobredimensionada — bloquea el rediseño por infraestructura de navegación que puede tratarse en fase separada.
- Opción B (adaptar a rutas parciales) rompe la promesa del CTA — "Ver casos abiertos" apuntando a `admin/spam` engañaría al ADMIN porque no incluye REVISION_MANUAL.
- Opción C simplificada: los CTAs son enlaces `<a href="#anchor">` dentro de la misma ficha. `[Ver casos abiertos]` → `#actividad` (Bloque B ya muestra `porEstado` incluyendo REVISION_MANUAL + POSIBLE_SPAM). `[Ver alertas]` → `#alertas` (subsección de Bloque D con `alertas.ultimasAlertas` que ya viene en el payload Fase 1). Cumple FR-003 sin depender de rutas admin inexistentes ni engañar al usuario.

**Impacto en T005**: los CTAs se implementan como `<a href="#actividad">` y `<a href="#alertas">` (o `<Link href="#actividad">` si es compatible). El Bloque B lleva `id="actividad"` y la subsección de alertas dentro del Bloque D lleva `id="alertas"`. Anchors nativos del navegador; sin JS extra.

**Actualización del test SC-007/SC-013**: T006(c) verifica `href^="#actividad"` y `href^="#alertas"` en vez de `href*="colegioId="`. T018 verifica en vivo que click hace scroll al anchor correcto.

**Nota candado 17**: cambio menor sin reabrir §4 según autorización explícita de Fábrica en la nota crítica D4. Documentado aquí para trazabilidad. Si en el futuro se crean rutas admin dedicadas, los CTAs se pueden migrar a `href="/dashboard/admin/reportes?colegioId="` con cambio mínimo.
