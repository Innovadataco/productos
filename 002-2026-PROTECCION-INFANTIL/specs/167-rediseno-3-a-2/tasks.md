# Tasks: SPEC-167 — Rediseño 3→2: Inicio + Estadísticas, eliminar Tablero

**Orden**: por dependencias. TDD donde aplica.

## T001 — Ampliar DTO de home con embudo
- [ ] Modificar `src/lib/dal/repositories/colegio-resumen.ts` para incluir `embudo` en `HomeRector` y en `homeRector()`.
- [ ] Reutilizar `AlertaColegioRepository.embudoPorReporte(colegioId)` dentro de `homeRector()`.
- [ ] Actualizar el tipo `HomeRector` y exportar `EmbudoTablero` si aún no está disponible.
- [ ] Test `src/lib/dal/repositories/colegio-resumen.test.ts`: embudo en home, A/B tenant, sin N+1.

## T002 — Mostrar embudo en Inicio
- [ ] Crear `src/components/modules/colegio/home/EmbudoEstado.tsx` (mover/ajustar desde `src/components/modules/colegio/tablero/EmbudoEstado.tsx`).
- [ ] Modificar `src/components/modules/colegio/home/HomeRectorPage.tsx` para renderizar `EmbudoEstado` debajo del héroe de semáforo.
- [ ] Asegurar que "Te esperan a ti" sea prominente y enlace a `/dashboard/colegio/alertas` cuando > 0.
- [ ] Test de componente: render con pendientes, sin pendientes, accesibilidad.

## T003 — Ampliar servicio de estadísticas
- [ ] Modificar `src/lib/colegio/estadisticas.ts` para devolver `EstadisticasInteligenciaColegio`.
- [ ] Incluir: totales ampliados con `profesores`, `porCurso`, `tendencia` (semanal/mensual/anual), `reloj24h`, `patrones` (trimestre actual) y `comparativa` (por grado default).
- [ ] Reutilizar `obtenerPatronesColegio` y `calcularComparativaCursos`.
- [ ] Test `src/lib/colegio/estadisticas.test.ts`: DTO completo, A/B, sin PII, profesores contados.

## T004 — Actualizar endpoint de estadísticas
- [ ] Modificar `src/app/api/colegio/estadisticas/route.ts` para devolver `EstadisticasInteligenciaColegio`.
- [ ] Mantener guardas de rol, módulo, vigencia, rate limit y `colegioId`.
- [ ] Actualizar `src/app/api/colegio/estadisticas/route.test.ts` con aserciones del DTO ampliado.

## T005 — Construir pantalla de inteligencia
- [ ] Reemplazar `src/app/dashboard/colegio/estadisticas/ColegioEstadisticasPageClient.tsx` con la nueva UI de inteligencia.
- [ ] Secciones obligatorias: tendencia, desglose por curso, patrones, comparativa, reloj 24 h, conteo de profesores.
- [ ] Rotular aparte el dashboard público global como "Mapa de reportes a nivel país" al final o como enlace separado.
- [ ] Modificar `src/app/dashboard/colegio/estadisticas/page.tsx` para hacer server fetch del DTO ampliado y pasarlo al cliente.
- [ ] Tests de componente y de página.

## T006 — Reubicar componentes de visualización
- [ ] Mover `RelojActividad.tsx`, `RitmoMensual.tsx` y `BarrasPorCurso.tsx` desde `src/components/modules/colegio/tablero/` a `src/components/modules/colegio/estadisticas/`.
- [ ] Actualizar imports en consumidores.
- [ ] Eliminar la carpeta `src/components/modules/colegio/tablero/`.

## T007 — Eliminar ruta del Tablero
- [ ] Reemplazar `src/app/dashboard/colegio/tablero/page.tsx` por redirect a `/dashboard/colegio`.
- [ ] Eliminar `src/app/dashboard/colegio/tablero/TableroClient.tsx`.
- [ ] Quitar "Tablero" de `src/lib/nav-items.ts`.
- [ ] Actualizar `src/lib/nav-items.test.ts` si falla.
- [ ] Test de redirect y de menú.

## T008 — Regenerar arquitectura y verificar gates
- [ ] Ejecutar `npm run arch:check` y regenerar artefactos necesarios.
- [ ] Verificar `npm run tokens:check`.
- [ ] Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`.
- [ ] Revisar que no se haya tocado `src/lib/ai/**`.

## T009 — Cierre
- [ ] Commit, push a `work/002-pi-167`, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.
