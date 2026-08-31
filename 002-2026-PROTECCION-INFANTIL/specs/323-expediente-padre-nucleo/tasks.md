# Tasks: El expediente del padre · NÚCLEO (SPEC-323)

**Radicado**: 002-PI-223 · SPEC-323
**Branch**: `work/pi-SPEC-323-expediente-padre-nucleo`
**Input**: `specs/323-expediente-padre-nucleo/`

**Estado AD-3 (texto evento #1)**: RESUELTO · CEO optó por **opción C** (2026-08-30 22:15 COT):
Descifrar `reporte.texto` con `descifrarTextoReporte()` **al leer** (server-side, en memoria) — sin persistir plaintext.
Límites duros: solo para el dueño (`padreUsuarioId === usuarioId`), solo en expediente y PDF, jamás para reportes ajenos.
`EventoExpediente.texto` se almacena vacío (`""`). El texto descifrado se inyecta al retornar el GET y al generar el PDF.

**Candados activos**:
- Solo-lectura ABSOLUTA: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`
- `crearReporteVinculado` MUERTO — no tocar
- SPEC-137 lock (`tomarLockDedup` + `findDuplicadoReciente`) se conserva — solo cambia la RESPUESTA
- Candado 25: evidencia = ejercicio real del flujo
- Candado 24 v2: correr tests de TODO lo que toca lo editado

---

## Phase 1: Setup — Verificación de entorno

**Purpose**: Confirmar que el worktree está listo antes de modificar código.

- [X] T001 Verificar que `npm ci` completa sin errores en el worktree (no instalar dependencias nuevas — pdfmake ya existe)
- [X] T002 Correr `npx tsc --noEmit` para confirmar que no hay errores TypeScript previos al inicio

---

## Phase 2: Foundational — Validators y types compartidos

**Purpose**: Las modificaciones de schema Zod y tipos de retorno son compartidas por US1 y US2. Deben completarse primero.

**⚠️ CRÍTICO**: US1 y US2 comparten `reporte-creation.ts` y `route.ts` — implementar en secuencia.

- [X] T003 [US1+US2] Agregar campo `reportePrevioId: z.string().uuid().optional()` al schema `crearReporteSchema` en `src/lib/validators.ts` (buscar la definición del schema de creación de reporte)
- [X] T004 [US1+US2] Agregar campo `reportePrevioId?: string` al tipo `CrearReporteInput` en `src/lib/dal/services/reporte-creation.ts` (línea ~10-30, donde está el tipo de input)

---

## Phase 3: User Story 1 — Oferta en lugar de bloqueo (P1) 🎯 MVP

**Goal**: El padre autenticado que intenta reportar el mismo identificador recibe una oferta de vinculación (HTTP 200) en lugar de un bloqueo (HTTP 429). Al aceptar, el formulario muestra el identificador fijo.

**Independent Test**: `POST /api/reportes` con duplicado → HTTP 200 + `{oferta: true, reporteExistenteId, identificador}`. Test en `tests/e2e/reportes.spec.ts` pasa con aserción fuerte.

### Implementation for User Story 1

- [X] T005 [US1] Modificar la lógica de dedup en `src/lib/dal/services/reporte-creation.ts` (líneas 77-88): cuando hay duplicado Y `input.reportePrevioId === existente.id` Y `existente.usuarioId === usuarioId` → retornar un nuevo tipo de resultado `{ok: "bypass_dedup", existente}` para que la ruta proceda; si hay duplicado Y sin reportePrevioId válido → retornar `{ok: false, tipo: "duplicado", reporteExistenteId: existente.id, identificador: input.identificador}`

- [X] T006 [US1] Modificar `src/app/api/reportes/route.ts` (líneas 143-149): cuando `resultado.ok === false && resultado.tipo === "duplicado"` Y el usuario es PARENT autenticado → responder HTTP 200 con `{oferta: true, reporteExistenteId: resultado.reporteExistenteId, identificador: resultado.identificador}` (NO 429). Anónimos y no-PARENT: sin cambio.

- [X] T007 [US1] Modificar `src/components/modules/ReporteWizard.tsx`: agregar estado `oferta: {reporteExistenteId: string, identificador: string} | null`. Cuando la respuesta del POST tiene `{oferta: true}`: mostrar card de oferta con texto "Ya reportaste este identificador. ¿Querés agregar otro evento?" y botón "Sí, agregar evento". Al aceptar: ir al formulario con `identificadorInicial` fijo e `identificadorBloqueado=true` y `reportePrevioId` en el estado para incluirlo en el siguiente POST.

- [X] T008 [US1] Actualizar `tests/e2e/reportes.spec.ts` líneas 81-107 (candado 24 v2): reemplazar aserción `expect(segundo.status()).toBe(429)` y `expect(json.error.code).toBe("DUPLICATE_REPORT")` por aserción fuerte del nuevo comportamiento: `expect(segundo.status()).toBe(200)`, `expect(json.oferta).toBe(true)`, `expect(json.reporteExistenteId).toBeTruthy()`. Agregar test de regresión para anónimos (deben seguir sin oferta).

**Checkpoint US1**: `POST /api/reportes` con duplicado de PARENT retorna 200+oferta. E2E pasa. Anónimo no cambia.

---

## Phase 4: User Story 2 — El expediente nace solo (P2)

**Goal**: Cuando el padre acepta la oferta y envía el 2.º reporte con `reportePrevioId`, el sistema crea automáticamente un Expediente y dos EventoExpediente (retroactivo #1 + nuevo #2).

**Independent Test**: Después del flow US1 con `reportePrevioId` → BD muestra 2 reportes + 1 expediente + 2 eventos. La respuesta incluye `{reporte: {...}, expediente: {...}}`.

### Implementation for User Story 2

- [X] T009 [US2] Agregar método `buscarExpedienteActivo(padreUsuarioId: string, identificadorReportado: string): Promise<Expediente | null>` en `src/lib/dal/repositories/expediente-repository.ts` (después de `crearExpediente` en línea ~68). Query: `prisma.expediente.findFirst({ where: { padreUsuarioId, identificadorReportado, estado: "ACTIVO" } })`.

- [X] T010 [US2] El texto del evento retroactivo #1 se almacena como `""` en `EventoExpediente.texto` (opción C: plaintext no se persiste). No se necesita helper — pasar `texto: ""` directamente en `agregarEvento`. El descifrado ocurre al leer (T014).

- [X] T011 [US2] Modificar `src/app/api/reportes/route.ts`: en el flujo cuando `resultado.ok === "bypass_dedup"` (vinculación aceptada) — después de que la ruta crea Reporte #2 normalmente via `withUnitOfWork` — ejecutar dentro de la misma transacción: (a) `buscarExpedienteActivo(usuarioId, input.identificador)`; (b) si null → `crearExpediente({padreUsuarioId: usuarioId, identificadorReportado: input.identificador, plataformaId: input.plataformaId})`; (c) `agregarEvento({expedienteId, texto: textoParaEventoRetroactivo(reporte1), reporteId: resultado.existente.id, fechaEvento: resultado.existente.creadoEn})`; (d) `agregarEvento({expedienteId, texto: input.texto, reporteId: reporte2.id})`. Responder HTTP 201 con `{reporte: reporte2, expediente: {...}}`.

- [X] T012 [US2] Ampliar tipo de retorno `ResultadoCreacion` en `src/lib/dal/services/reporte-creation.ts` para incluir variante de bypass que incluya `existente: ReporteExistente` (necesario para que la ruta tenga acceso a `reporte1` en T011).

- [X] T013 [US2] Correr tests unitarios de `reporte-creation.ts` y `expediente-repository.ts` (candado 24 v2): `npx vitest run src/lib/dal/services/reporte-creation.test.ts src/lib/dal/repositories/expediente-repository.test.ts`. Si existen tests que afirman la invariante de bypass, actualizarlos con aserciones fuertes.

**Checkpoint US2**: Flow completo: 1.er POST → oferta → 2.º POST con reportePrevioId → BD tiene 2 reportes, 1 expediente, 2 eventos.

---

## Phase 5: User Story 3 — Vista del expediente (P3)

**Goal**: El padre puede consultar el detalle de su expediente con sus propios eventos completos y el contexto anonimizado de otros.

**Independent Test**: `GET /api/padre/expedientes/[id]` → 200 con `eventosPropios` (con texto+ciudad+país+clasificación) y `contextoOtros` (solo fecha+ciudad+país+clasificación — SIN texto ni usuarioId en el payload).

### Implementation for User Story 3

- [X] T014 [P] [US3] Agregar método `obtenerDetalleExpediente(id: string, padreUsuarioId: string)` en `src/lib/dal/repositories/expediente-repository.ts`: (a) buscar expediente por id con guard `padreUsuarioId`; (b) SELECT `EventoExpediente` JOIN `Reporte` para eventos propios — incluir `evento.ordenSecuencial, evento.fechaEvento, reporte.ciudad, reporte.pais, reporte.fechaIncidente, reporte.estado, reporte.texto` (el `reporte.texto` cifrado se trae para descifrar en la capa de respuesta); (c) SELECT `Reporte` donde `identificadorReportado = expediente.identificadorReportado AND usuarioId != padreUsuarioId` — SELECT SOLO `fechaIncidente, ciudad, pais, estado` (candado Ley 1581 — sin texto ni usuarioId en el query de Prisma). En la construcción del DTO de eventos propios: llamar `descifrarTextoReporte(reporte.texto)` para cada evento y agregarle `textoDescifrado` al objeto. **Agregar comentario obligatorio (CEO)**: `// C/AD-3: el expediente es documento probatorio del dueño (spec 090/116 acotada, no derogada); descifrado server-side solo para el padreUsuarioId dueño, nunca para ajenos, sin persistir.`

- [X] T015 [US3] Crear `src/app/api/padre/expedientes/[id]/route.ts`: GET handler con `verifyAuth("PARENT")`; llamar `obtenerDetalleExpediente(id, user.id)`; retornar 200 con `{expediente, eventosPropios, contextoOtros}`. Manejar 403 (titularidad) y 404. No usar Prisma directamente en la ruta (SPEC-053).

- [X] T016 [US3] Verificar que el payload de `contextoOtros` no contiene `texto`, `textoOriginal`, `usuarioId` — inspeccionar el SELECT del método en T014 y confirmar que el tipo de retorno del DTO no incluye esos campos.

**Checkpoint US3**: GET retorna el expediente con eventos propios completos y contexto de otros anonimizado.

---

## Phase 6: User Story 4 — PDF del expediente (P4)

**Goal**: El padre puede descargar un PDF de su expediente generado en memoria.

**Independent Test**: `GET /api/padre/expedientes/[id]/pdf` → 200 con Content-Type `application/pdf` y archivo descargable con carátula, eventos propios y contexto de otros.

### Implementation for User Story 4

- [X] T017 [P] [US4] Crear `src/lib/expediente/pdf-expediente.ts`: módulo de generación de PDF del expediente usando pdfmake + `renderPdfBuffer` (mismo patrón que `pdf-denuncia.ts` — importar `renderPdfBuffer` de donde lo hace `pdf-denuncia.ts`). Firma: `generarPdfExpediente(datos: ExpedientePdfInput): Promise<Buffer>`. Contenido: (1) Carátula con datos del padre (nombre/email), identificador, fecha de generación en timestamp Colombia; (2) Sección "Mis eventos" — lista con ordenSecuencial, fechaEvento (Colombia), ciudad, país, **`textoDescifrado`** (ya viene descifrado del repositorio — T014), clasificación; (3) Sección "Contexto de otros reportes" — lista con fechaIncidente, ciudad, país, clasificación (sin texto ni autor — Ley 1581). No almacenar en disco. **Agregar comentario** en la sección de "Mis eventos": `// C/AD-3: textoDescifrado viene server-side del dueño — nunca texto de reportes ajenos aquí.`

- [X] T018 [US4] Crear `src/app/api/padre/expedientes/[id]/pdf/route.ts`: GET handler con `verifyAuth("PARENT")`; reutilizar `obtenerDetalleExpediente` (ya disponible de US3); llamar `generarPdfExpediente`; retornar `Buffer` con headers `Content-Type: application/pdf` y `Content-Disposition: attachment; filename="expediente-<identificador>-<fecha>.pdf"`.

**Checkpoint US4**: Descarga de PDF funciona. Abre correctamente con carátula + eventos + contexto.

---

## Phase 7: Polish — Tests y disciplina de specs

**Purpose**: Candado 24 v2 completo, disciplina de specs, regresión.

- [X] T019 [P] Correr todos los tests que tocan archivos editados: `npx vitest run src/app/api/reportes/ src/lib/dal/ src/lib/expediente/` — corregir cualquier test que falle por el cambio de comportamiento.

- [X] T020 [P] Actualizar `specs/README.md` — agregar fila para SPEC-323 con columnas: Número, Nombre, Status (EN PROGRESO), Radicado, Fecha.

- [X] T021 Verificar que `specs-discipline.test.ts` (si existe en el proyecto) incluye SPEC-323 en el catálogo; si el test falla porque la SPEC no aparece, agregar la entrada correspondiente.

- [X] T022 Actualizar `specs/323-expediente-padre-nucleo/spec.md` campo Status de `PLANEADO` a `EN PROGRESO`.

- [X] T023 Ejecutar regresión manual del quickstart (`specs/323-expediente-padre-nucleo/quickstart.md`): Paso 1 (1.er reporte) → Paso 2 (oferta) → Paso 3 (vinculación) → Paso 4 (GET expediente) → Paso 4b (Ley 1581) → Paso 5 (PDF). Documentar evidencia §6.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sin dependencias — empezar aquí
- **Phase 2 (Foundational)**: Depende de Phase 1 — bloquea US1 y US2 (ambas tocan `validators.ts` y `reporte-creation.ts`)
- **Phase 3 (US1)**: Depende de Phase 2
- **Phase 4 (US2)**: Depende de Phase 3 (el bypass de US1 es el entry point de US2)
- **Phase 5 (US3)**: Puede ejecutarse en paralelo con Phase 4 (archivos distintos: `expediente-repository.ts` y `route.ts` nueva)
- **Phase 6 (US4)**: Depende de Phase 5 (reutiliza `obtenerDetalleExpediente`)
- **Phase 7 (Polish)**: Depende de todas las fases de implementación

### User Story Dependencies

- **US1 (P1)**: Blocking para US2 — el bypass es el entry point del expediente
- **US2 (P2)**: Depende de US1 completado
- **US3 (P3)**: Puede arrancar en paralelo con US2 (diferente archivo de ruta)
- **US4 (P4)**: Depende de US3 (reutiliza el método de detalle)

### Archivos por fase (sin conflictos)

| Fase | Archivos |
|------|----------|
| US1 | `validators.ts`, `reporte-creation.ts`, `route.ts` (api/reportes), `ReporteWizard.tsx`, `reportes.spec.ts` |
| US2 | `expediente-repository.ts` (new methods), `route.ts` (api/reportes, ampliado) |
| US3 | `expediente-repository.ts` (new method), `src/app/api/padre/expedientes/[id]/route.ts` (NUEVO) |
| US4 | `src/lib/expediente/pdf-expediente.ts` (NUEVO), `src/app/api/padre/expedientes/[id]/pdf/route.ts` (NUEVO) |

### Parallel Opportunities

- T014 (US3 repo method) puede empezar mientras T011/T012 (US2) aún están en curso — archivos diferentes
- T017 (US4 pdf module) puede empezar mientras T015 (US3 route) aún está en curso
- T019, T020 pueden correr en paralelo en Phase 7

---

## Parallel Example: US3 + US4

```
US3 T014: agregar obtenerDetalleExpediente al repositorio
US4 T017: crear pdf-expediente.ts
# Ambos en archivos distintos — pueden ejecutarse en paralelo
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1: Setup
2. Phase 2: Foundational (validators + types)
3. Phase 3: US1 (oferta)
4. Phase 4: US2 (expediente)
5. STOP: verificar BD + E2E antes de continuar

### Entrega completa

1. MVP → US3 (vista) → US4 (PDF) → Phase 7 (polish)
2. Evidencia §6 del quickstart como cierre

---

## Notes

- AD-3 enchufable: `textoParaEventoRetroactivo` retorna `""` hasta decisión CEO
- `crearReporteVinculado` NO se toca en ningún task
- El anónimo NO cambia — el dedup está en `if (usuarioId)` ya existente
- SPEC-137 lock se conserva — solo cambia la respuesta, no la detección
- Cada checkpoint es un momento para correr `npx vitest` antes de avanzar
