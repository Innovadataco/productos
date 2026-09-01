# Tasks: Puesto de mando del rector (SPEC-353 · A-69 · C6)

**Input**: specs/353-puesto-mando-colegio/ (spec + plan con research inline)
**Tests**: exigidos por la spec (SC-001/002/004) — incluidos.

## Phase 1: US1 · Frase accionable (P1)

- [X] T001 [US1] Agregado `identificadorCruzado7d(colegioId)` en src/lib/dal/repositories/alerta-colegio.ts: identificadores de estudiante presentes en alertas VISIBLES de los últimos 7 días que tocan >1 alumnoId distinto; devuelve `{identificadores: number, estudiantesMax: number}`; NUNCA valores de identificadores; test integración con fixture de 1 identificador → 2 estudiantes y contrafixture (2 alertas mismo estudiante → no cuenta)
- [X] T002 [US1] Extender `homeRector` en src/lib/dal/repositories/colegio-resumen.ts: `+casosComite {abiertos, masViejoDias}` (reusa ComiteConvivenciaSolicitudesRepository), `+ultimaAlertaSinAbrirEn`, `+identificadorCruzado` (T001); dentro del Promise.all existente; test integración del DTO
- [X] T003 [US1] Crear src/lib/colegio/que-hacer-hoy.ts: `calcularQueHacerHoy(datos)` puro → `{titulo, detalle, accionHref, accionTexto, tono}` con prioridad cruzado > sin-abrir > comité > calma; conteo total si hay varios pendientes ("Dos cosas necesitan su atención hoy"); usted formal; + que-hacer-hoy.test.ts unit con un caso por regla + empates + colegio virgen
- [X] T004 [US1] Crear src/components/modules/colegio/home/QueHacerHoyCard.tsx (mockup 2.1: caja ámbar con h-título, detalle, botón "Ver ahora"; tono calma sin color de alerta) + test de render por tono; insertarla en HomeRectorPage.tsx entre HeroEstado y EmbudoEstado

## Phase 2: US2 · Preferencias con experiencia A-62 (P1)

- [X] T005 [US2] Rediseñar src/app/dashboard/colegio/configuracion/ConfiguracionPageClient.tsx in-place con el patrón de PreferenciasNotificaciones.tsx del padre: catálogo de 4 frases (R5), Switch por fila con spinner y PATCH inmediato + reversión si falla, umbrales como frase con inputs embebidos (persistencia en blur), cabecera "Le escribimos a **{correo}**" con edición en línea del override; contrato GET/PATCH intacto (FR-008)
- [X] T006 [US2] Actualizar/crear ConfiguracionPageClient.test.tsx: render de frases, toggle → PATCH inmediato optimista + reversión en fallo, blur del umbral → PATCH, cabecera con correo efectivo
- [X] T007 [US2] Verificar que los tests de integración existentes de /api/colegio/preferencias-avisos pasan SIN modificar (SC-004)

## Phase 3: Polish & Cierre

- [X] T008 vitest.unit.includes.ts + gate completo (tsc, lint, unit, integración focalizada, build, arch:check, dev-restart)
- [X] T009 Recorrido real: home con los 4 estados de frase (sembrar por SQL) + toggle de preferencias persistiendo + 390 px
- [X] T010 Disciplina specs (fila README, Impacto en arquitectura ya en spec, Status IMPLEMENTADO) + cierre.md + PR

## Dependencies

T001 → T002 → (T003 ∥) → T004 · T005 → T006 → T007 · Phase 3 al final.
