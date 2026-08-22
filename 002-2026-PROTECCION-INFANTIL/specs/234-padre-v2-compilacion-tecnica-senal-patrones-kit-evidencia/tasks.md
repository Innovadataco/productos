# Tasks — SPEC-234 · Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia

**Input**: `spec.md`, `plan.md`, `data-model.md`, `research.md`, `quickstart.md`.

**Tests**: Vitest unitario/integración; tests junto al código.

**Organización**: Tasks agrupados por fase. Dependencias explícitas.

---

## Phase 1: Schema y migración aditiva

**Purpose**: Crear modelos y migración sin DROP/RENAME.

- [ ] T001 [P] Editar `prisma/schema.prisma`:
  - Añadir `enum TipoPatronExpediente` (`ACELERACION`, `PROGRESION`, `PERPETRADOR_SERIAL`, `MULTIPLATAFORMA`).
  - Añadir `model InformeConsolidado` con campos e índices exactos de `data-model.md`.
  - Añadir `model SenalComunitariaCache` con `identificadorReportado` como PK y campos exactos del brief §7.6.
  - Añadir `model PatronExpediente`.
  - Añadir relaciones inversas en `Expediente` si ZEUS ratifica.
- [ ] T002 [P] Generar migración aditiva (`npx prisma migrate dev --create-only --name padre_v2_compilacion_senal_patrones`) y verificar SQL.
- [ ] T003 [P] Aplicar migración localmente y regenerar cliente (`npx prisma migrate dev && npx prisma generate`).

**Checkpoint**: `npx prisma migrate status` verde; `npx prisma db pull` no detecta drift.

---

## Phase 2: Seed de parámetros

**Purpose**: Sembrar `padre.senal_comunitaria.refresh_min` de forma idempotente.

- [ ] T004 [P] Añadir `seedParametrosSenalComunitaria()` en `prisma/seed.ts` con upsert anti-I-100.
- [ ] T005 [P] Crear `src/lib/seed-senal-comunitaria.test.ts` que:
  - Ejecute el seed dos veces.
  - Verifique `count = 1` para la nueva clave.
  - Verifique que un cambio de default en código se propaga.

**Checkpoint**: `npm run test -- src/lib/seed-senal-comunitaria.test.ts` pasa.

---

## Phase 3: Repositorios DAL

**Purpose**: Respetar frontera Q-3.

- [ ] T006 [P] Crear `src/lib/dal/repositories/informe-consolidado-repository.ts` con:
  - `crearInforme(data)`
  - `listarPorExpediente(expedienteId, paginacion)`
  - `obtenerPorHash(pdfHash)`
- [ ] T007 [P] Crear `src/lib/dal/repositories/senal-comunitaria-repository.ts` con:
  - `obtenerORecalcular(identificadorReportado)`
  - `invalidar(identificadorReportado)`
  - `obtenerPendientesDeRefresco(limite)`
  - `guardarCache(data)`
- [ ] T008 [P] Crear `src/lib/dal/repositories/patron-expediente-repository.ts` con:
  - `guardarPatrones(expedienteId, patrones[])`
  - `listarPorExpediente(expedienteId)`

**Checkpoint**: Cada repositorio tiene su `.test.ts` y pasa.

---

## Phase 4: Servicio de compilación

**Purpose**: Implementar la lógica de compilación 100% SQL + funciones puras.

- [ ] T009 [P] Crear `src/lib/expediente/compilacion/queries/agregar-categorias.ts`:
  - Query SQL que, dado `expedienteId`, devuelve conteos y confianza por categoría.
- [ ] T010 [P] Crear `src/lib/expediente/compilacion/queries/senal-comunitaria.ts`:
  - Lee cache; si no existe/vencida, recalcula inline y guarda.
- [ ] T011 [P] Crear 4 reglas N1 puras en `src/lib/expediente/compilacion/reglas/`:
  - `aceleracion.ts`
  - `progresion.ts`
  - `perpetrador-serial.ts`
  - `multiplataforma.ts`
- [ ] T012 [P] Crear `src/lib/expediente/compilacion/score/calcular-score.ts` con fórmula parametrizada.
- [ ] T013 [P] Crear `src/lib/expediente/compilacion/template/renderizar-markdown.ts` que genere `resumenTextoGenerado` con secciones §9.
- [ ] T014 [P] Crear `src/lib/expediente/compilacion/compilar-expediente.ts` orquestador.

**Checkpoint**: `npm run test -- src/lib/expediente/compilacion` pasa.

---

## Phase 5: Kit evidencia PDF

**Purpose**: Generar PDF determinista y endpoint de verificación.

- [ ] T015 [P] Crear `src/lib/expediente/pdf/generar-pdf.ts`:
  - Usa `pdfmake`.
  - Fija metadatos para hash reproducible.
  - Devuelve `{ buffer, pdfHash }`.
- [ ] T016 [P] Persistir PDF en `/data/informes/[expedienteId]-v[n].pdf` y actualizar `InformeConsolidado`.
- [ ] T017 [P] Crear `src/app/api/publico/verificar-pdf/[hash]/route.ts`:
  - GET público.
  - Rate-limit scope `verificar_pdf`.
  - 200 con metadatos / 404.

**Checkpoint**: Tests de PDF y endpoint pasan.

---

## Phase 6: Worker de señal comunitaria

**Purpose**: Refrescar caché de forma asíncrona.

- [ ] T018 [P] Crear `scripts/worker-senal-comunitaria.mjs`:
  - Advisory lock propio.
  - Polling de cachés invalidadas/vencidas.
  - Recálculo y guardado.
- [ ] T019 [P] Añadir servicio `pi-senal-comunitaria` en `docker-compose.prod.yml` con `TZ=America/Bogota` y volumen `/data/informes` si comparte storage (solo lectura no necesaria; se añade por consistencia).

**Checkpoint**: Worker arranca localmente sin errores; test de invalidación pasa.

---

## Phase 7: Tests de esquema y privacidad

**Purpose**: Garantizar Ley 1581 y ausencia de PII en modelos agregados.

- [ ] T020 [P] Crear test de esquema que itere campos de `SenalComunitariaCache` y `PatronExpediente` y verifique ausencia de nombres prohibidos (`texto`, `identificador`, `reporteId`, `nombre`, `telefono`, etc.).
- [ ] T021 [P] Verificar que `resumenTextoGenerado` y PDF no contienen texto original de reportes.

**Checkpoint**: Tests de privacidad pasan.

---

## Phase 8: Integración, gate y cierre

**Purpose**: Verificar el sistema completo y documentar.

- [ ] T022 [P] Ejecutar gate local:
  - `npx tsc --noEmit`
  - `npm run lint --no-cache`
  - `npm run arch:check`
  - `npm run test`
  - `npm run build`
  - `./scripts/dev-restart.sh`
- [ ] T023 [P] Actualizar `spec.md` sección Implementación.
- [ ] T024 [P] Crear `cierre.md` con commits, gate y deuda técnica.

**Checkpoint**: Gate verde; rama `work/002-pi-134` lista para auditoría.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 bloquea Phase 2 y Phase 3.
- Phase 2 y Phase 3 pueden ejecutarse en paralelo.
- Phase 4 depende de Phase 1 y Phase 3.
- Phase 5 depende de Phase 4.
- Phase 6 depende de Phase 3.
- Phase 7 puede ejecutarse en paralelo con Phase 5/6.
- Phase 8 depende de todas las anteriores.

### Within Phase 4

1. Queries SQL primero.
2. Reglas N1 y score (funciones puras, testeables).
3. Template markdown.
4. Orquestador.

---

## Implementation Strategy

1. Schema + migración aditiva.
2. Seed idempotente.
3. Repositorios DAL + tests.
4. Compilación SQL + reglas N1 (severidad MEDIA/ALTA) + score + `resumenTextoGenerado`.
5. PDF + endpoint de verificación.
6. Worker de señal comunitaria.
7. Tests de privacidad y esquema.
8. Gate local y documentación de cierre.

---

## Notes

- No tocar `src/lib/ai/**`.
- No modificar `Expediente`, `EventoExpediente` ni `Reporte` salvo relaciones inversas ratificadas.
- Migraciones siempre aditivas.
- Todos los `DateTime` de momento usan `@db.Timestamptz(6)`.
