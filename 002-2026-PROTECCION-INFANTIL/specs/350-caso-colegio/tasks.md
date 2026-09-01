# Tasks: SPEC-350 · Caso del colegio (A-69 · C3)

**Status**: Planeada
**Impacto en arquitectura:** aditivo · nueva columna nullable en `AnalisisExpediente`, migración aditiva, nueva ruta bajo `/api/colegio/casos/[id]/analisis`, nuevo componente `CasoVivo`. Sin cambios en `AlertaColegio`/`SeguimientoCaso`.

## Fase 1 · Setup
- [ ] T001 Migración Prisma aditiva: `AnalisisExpediente.expedienteId` a nullable + agregar `seguimientoCasoId String?` con FK a `SeguimientoCaso` (`onDelete: Cascade`) y su índice.
- [ ] T002 `npx prisma generate` tras T001.
- [ ] T003 Guard XOR en el DAL (helper compartido): al insertar `AnalisisExpediente` uno y solo uno de `expedienteId`/`seguimientoCasoId` debe estar presente; error controlado si ambos o ninguno.

## Fase 2 · Foundational
- [ ] T010 [P] `src/lib/caso/hechos-caso.ts`: dado un `SeguimientoCaso`, resuelve la lista de `HechoPadre[]` (fecha, ciudad, país, plataforma, categoría, edadReportada) a partir del reporte principal + `identificadorEstudianteId/ProfesorId/AcudienteId` de la alerta.
- [ ] T011 [P] Tests unit del mapeador (`hechos-caso.test.ts`): con 3 reportes, la lista viene ordenada por fecha, con campos completos, y CERO texto/nombres (mismo blindaje del padre).
- [ ] T012 Extender `ejecutar-analisis.ts` (SPEC-341) para aceptar `seguimientoCasoId` en el `payload` del job y en la persistencia. Cero ramas nuevas de negocio — solo el `where { expedienteId }` se vuelve `where { seguimientoCasoId }` cuando corresponde. Test de regresión: el padre sigue funcionando idéntico.

## Fase 3 · US1 · La pantalla del caso (P1 · MVP)
- [ ] T030 [US1] `src/lib/dal/services/analisis-caso.ts`: `leerVigenteDeCaso(casoId, usuarioId)` + `evaluarYEncolarSiCorresponde(casoId, usuarioId, disparador)`. Copiar la forma del DAL del padre pero cargando `SeguimientoCaso` + boundary `SCHOOL_ADMIN` o `COMITE_CONVIVENCIA` del `colegioId`. Reusar `calcularHashCadena`, `sendAnalisisExpediente`, guardas de huérfano/agotamiento.
- [ ] T031 [US1] `src/app/api/colegio/casos/[id]/analisis/route.ts`: GET + POST con misma forma de body que la del padre.
- [ ] T032 [US1] Test integración de la ruta: 403 no-colegio, 404 caso ajeno, encolar+placeholder al abrir sin análisis, idempotencia 2 aperturas → 1 GENERANDO, POST cooldown/ya_al_dia/sin_hechos.
- [ ] T033 [US1] `CasoVivo.tsx` server component: monta capa 1 (calculada) + mapa reusando `MapaUbicaciones` con los hechos.
- [ ] T034 [US1] `AnalisisCaso.tsx` client component: consumo GET/POST con polling 15s (calco de `AnalisisExpediente` pero textos en USTED). Reusa `ExpedienteGenerando` con el mismo prop `trabajosEnFila`.
- [ ] T035 [US1] Ruta de página `src/app/dashboard/colegio/casos/[id]/page.tsx`: monta `CasoVivo`; boundary de rol.

## Fase 4 · US2 · Blindaje PII del payload (P1)
- [ ] T040 [US2] Test dedicado: el orquestador con `alcance=COLEGIO_BLINDADO` sobre un caso demo (5 reportes + textos + identificadores) → payload al modelo no contiene ninguno de esos strings (grep exacto). Extiende `armar-payload.test.ts` del padre.

## Fase 5 · US3 · Escape del rector (P2)
- [ ] T050 [US3] Test: 3 FALLIDOs consecutivos del mismo hash → GET marca `agotadoPorFallos: true` + NO encola nuevo; POST manual SÍ encola (reusa el patrón de SPEC-348).

## Fase 6 · Polish
- [ ] T090 Regenerar `docs/architecture/02-roles-capacidades.md` (nueva ruta bajo `/api/colegio`).
- [ ] T091 `tokens:check` + `arch:check` + `locks:check` + `tsc --noEmit` verdes.
- [ ] T092 `cierre.md` con hash + recorrido esperado del CEO.
- [ ] T093 Actualizar `specs/README.md` a 🟢 Implementada al cerrar.

## Dependencias

- Setup → Foundational → US1 (bloqueante) → US2/US3 (paralelos).
- Cero conflicto conocido con SPEC-344 (PI-2) — este SPEC no toca `guardias.ts` ni `middleware.ts`. Si al implementar aparece un callsite compartido en `AlertasColegioPageClient.tsx`, se enumera con 22v5 y se avisa a PI-2.

## MVP

**US1** sola es el MVP funcional del brief D6 · el análisis IA se despliega desde
el día 1 gracias a que ya existe el motor de 341.
