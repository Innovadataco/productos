# Tasks: SPEC-186 — Smoke inteligente del monitor Ollama

**Modo**: compuerta §4 (spec+plan LISTO → PARA; ZEUS aprueba antes de implementar).

---

## Pre-implementación (bloqueadas hasta aprobación)

- [ ] **T001** Decisión de compuerta §4: columna `metodo` en `HealthProbe` (Opción A) vs codificar en `detalle` (Opción B); default histórico; defaults operativos; resiembra en BD existente; UI del historial.

## Fase 1 — Modelo y seed

- [ ] **T002** (Opción A) Crear migración aditiva `spec_186_smoke_inteligente_ollama`: añadir `metodo String? @default("SMOKE")` a `HealthProbe`; regenerar Prisma Client.
- [ ] **T003** (Opción B alternativa, si ZEUS elige) Omitir migración; documentar en spec/plan que el método viaja en `detalle`.
- [ ] **T004** `prisma/seed.ts`: añadir `monitoreo.ollama.smoke.piggyback_min=15`; cambiar default de creación de `monitoreo.ollama.smoke.intervalo_min` a `30`; implementar resiembra aditiva (crear si no existe; no tocar valores existentes a menos que ZEUS apruebe forzar).

## Fase 2 — Repositorios

- [ ] **T005** `src/lib/dal/repositories/clasificacion-ia.ts`: añadir `existeClasificacionExitosaDesde(fecha: Date): Promise<boolean>` (o equivalente) con test.
- [ ] **T006** `src/lib/dal/repositories/monitoreo.ts`: 
  - Extender `crearProbe` para aceptar `metodo`.
  - Añadir `resumenOllamaUltimas24h(): Promise<{ pings: number; piggybacks: number; smokes: number; fallos: number }>`.
  - Añadir `historialProbes(senal: string, limite: number): Promise<HealthProbe[]>`.
  - Tests de integración/unit.

## Fase 3 — Lógica de probes

- [ ] **T007** `src/lib/monitoreo/probes.ts`:
  - Extender `ResultadoProbe` con `metodo?: MetodoProbe`.
  - Añadir `probeOllamaPiggyback({ ventanaMin, db? })`.
  - Refactorizar `probeOllamaSmoke` para: (1) intentar piggyback, (2) si no aplica, decidir smoke real según último smoke exitoso e intervalo, (3) ejecutar smoke real con modelo vigente.
  - Asignar `metodo="PING"` en `probeOllamaPing`.
  - Tests de integración con Ollama mockeado.

## Fase 4 — Monitor

- [ ] **T008** `scripts/monitor-probes.mjs`:
  - Leer `monitoreo.ollama.smoke.piggyback_min` en `leerConfig`.
  - Pasar parámetros a `probeOllamaSmoke`.
  - Asegurar que un solo probe se registre por ciclo de `ollama_smoke`.

## Fase 5 — API

- [ ] **T009** `src/app/api/admin/monitoreo/historial/route.ts`:
  - `verifyAuth("ADMIN")` + `assertModulo(_, "estadisticas")`.
  - Validar `senal` y `limite`.
  - Devolver `{ items, resumen24h }`.
- [ ] **T010** Tests de integración del endpoint historial.

## Fase 6 — UI

- [ ] **T011** `src/components/modules/monitoreo/OllamaSmokeHistorial.tsx`: componente modal/subsección con resumen de 24h y tabla de últimos 50 chequeos.
- [ ] **T012** `src/components/modules/monitoreo/SemaforoCard.tsx`: añadir `onClick?` sin romper usos actuales.
- [ ] **T013** `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx`: enganchar el historial a la tarjeta "Cerebro IA" (llamada a `/api/admin/monitoreo/historial`).
- [ ] **T014** Tests unitarios del componente historial.

## Fase 7 — Cierre

- [ ] **T015** Regenerar `docs/architecture/` y correr `arch:check`.
- [ ] **T016** Gate local completo: `tsc --noEmit`, `eslint --no-cache`, `test:unit`, `test:integration`, `build`.
- [ ] **T017** Commit(s) atómicos por spec, push a `work/002-pi-081`, PR a `feature/001-scaffolding`.
- [ ] **T018** `cierre.md` + fila en `specs/README.md` (ambas tablas).

---

## Plan (extracto verificado en fuente)

- `src/lib/monitoreo/probes.ts:95-132` — `probeOllamaSmoke` siempre genera; se divide en piggyback + smoke real condicional.
- `src/lib/dal/repositories/monitoreo.ts:20-22` — `crearProbe` recibe objeto plano; se extiende con `metodo`.
- `src/lib/dal/repositories/clasificacion-ia.ts` — no existe método de ventana temporal; se añade.
- `prisma/seed.ts:237` — `monitoreo.ollama.smoke.intervalo_min=5`; se cambia default de creación a 30 y se añade `piggyback_min=15`.
- `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx:117-130` — render de `SemaforoCard`; se engancha `onClick` en la tarjeta "Cerebro IA".
