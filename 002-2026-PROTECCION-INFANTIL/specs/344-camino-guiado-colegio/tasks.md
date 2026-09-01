# Tasks: Camino guiado del colegio (SPEC-344 · A-69 · C1)

**Input**: Design documents from `specs/344-camino-guiado-colegio/`
**Prerequisites**: plan.md, research.md (R1–R14), data-model.md,
contracts/ (4 docs), quickstart.md

**Tests**: la spec los exige (FR-026-bis, FR-026-ter, SC-008, SC-011) —
incluidos.

**Organization**: agrupadas por user story; cada historia es un incremento
verificable. Rutas relativas a `002-2026-PROTECCION-INFANTIL/`.

## Phase 1: Setup

- [x] T001 Migración aditiva Prisma `YYYYMMDDHHMMSS_camino_colegio_aditivo`: `TokenRegistro.rol RolUsuario @default(PARENT)` + `AcudienteEstudiante.documentoTipo String?` + `AcudienteEstudiante.documentoNumero String?`; ejecutar `npm run db:migrate` y verificar 0 filas afectadas destructivamente
- [x] T002 Extender `prisma/seed.ts` con 4 eventos + plantillas nuevos (`colegio.registro_enlace`, `colegio.registro_enlace.cuenta_existente`, `colegio.registro_enlace.nit_ya_registrado`, `colegio.bienvenida_rector`) y reglas activas para SCHOOL_ADMIN; ejecutar `npm run db:seed` idempotente

**Checkpoint**: `npm run build` sigue verde con la migración aplicada.

## Phase 2: Foundational (bloqueante — la cadena de guardias debe estar generalizada antes de las historias)

- [x] T003 Crear src/lib/camino/pasos-colegio.ts (Edge-safe, cero Prisma): `PASOS_COLEGIO` array de 5 valores, `PasoColegio` type, `RAIZ_CAMINO_COLEGIO`, `DEFINICION_PASOS_COLEGIO` con `{numero,destino,titulo}`, `DESTINO_CIERRE_COLEGIO`, `destinoDePasoColegio()`, `esPasoColegio()` type-guard — espejo de src/lib/camino/pasos.ts
- [x] T004 [P] Extender src/lib/camino/pasos.ts: agregar `destinoParaRol(rol, paso)` que despacha por rol usando `destinoDePaso` (PARENT) o `destinoDePasoColegio` (SCHOOL_ADMIN); NO tocar la superficie externa existente (test del padre debe seguir verde sin cambios)
- [x] T005 Extender src/lib/routing/vigencia-cookie.ts: importar `esPasoColegio` y actualizar la validación estricta del campo `pasoCamino` en `:124` a `esPasoCamino(v) || esPasoColegio(v)`; cookies vivas del padre siguen validando
- [x] T006 Crear src/lib/dal/services/camino/estado-colegio.ts: `derivarPasoPendienteColegio(usuarioId)` con las 5 condiciones de research R3 (consentimiento + 5 campos rector, ≥1 Suscripcion, ≥1 Profesor activo, ≥1 Curso activo, ≥1 Estudiante activo); resuelve `colegioId` desde `Usuario.colegioId`; NUNCA importarse desde middleware.ts (Edge)
- [x] T007 Extender src/lib/routing/sesion-estado-emitter.ts:46: cambiar la línea del `pasoCamino` para incluir `SCHOOL_ADMIN` → llama `derivarPasoPendienteColegio(userId)`; PARENT y demás roles sin cambios de comportamiento (test `sesion-estado-emitter.test.ts:176-183` se actualiza como cambio esperado, no regresión — SC-008)
- [x] T008 Extender middleware.ts:221 y :270: condiciones `sesion.rol === "PARENT" || sesion.rol === "SCHOOL_ADMIN"`; despachar con `destinoParaRol(sesion.rol, estado.pasoCamino)`; `caminoRebote` se conserva
- [x] T009 Extender src/lib/routing/guardias.ts: (a) generalizar la invariante cruzada `:245-246` a `exentasDe("vigencia", rol)` parametrizada por rol; (b) crear bloque `camino.exentasSchoolAdmin` con las rutas de research R2/data-model MÁS `/dashboard/colegio/cursos/unificado` (I2 del analyze — el wizard reusado en Paso 5 vive ahí); (c) extender `vigencia.SCHOOL_ADMIN.exentas` con TODOS los destinos del camino colegio + endpoints; verificar que la invariante cruzada corre en import-time y falla si algún destino queda sin exentar
- [x] T010 Corregir src/app/api/auth/logout/route.ts:11-12 (FR-044): expirar cookie `sesion_estado` (path `/`) junto a `token` y `__Host-token`; test que verifique las 3 cookies expiradas

**Checkpoint**: la cadena de guardias soporta SCHOOL_ADMIN sin cambio de comportamiento observable para PARENT ni otros roles. Correr `npm run test:unit` — guardias/vigencia-cookie/middleware/emitter verdes; correr suite del padre para candar SC-008.

## Phase 3: User Story 1 — Registro por enlace del colegio (P1) 🎯 MVP

**Goal**: el rector deja correo+nombre+NIT, abre el enlace, elige clave y entra al Paso 1 del camino.

**Independent Test**: `curl /api/auth/registro-colegio/solicitar` → 202 + evento correcto emitido; abrir enlace en desarrollo → completar → cookies sesión + estado + aterriza en `/camino/colegio/rector`.

- [x] T011 [US1] Extender src/lib/dal/services/registro-enlace.ts: agregar parámetro `rol?: RolUsuario` (default `"PARENT"`) a `solicitarEnlace` y `completar`; el completar fuerza el rol guardado en el `TokenRegistro`, no confía en el cliente; padre sigue funcionando sin tocar callers
- [x] T012 [P] [US1] Crear src/lib/email-colegio.ts: `enviarEnlaceRegistroColegio(email, url, nombreColegio, expiraEn)`, `enviarCuentaExistenteColegio(email, nombreColegio)`, `enviarNitYaRegistrado(email, nit)`, `enviarBienvenidaRector(email, nombreRector)` — todos vía `programar()` del motor de notificaciones
- [x] T013 [US1] Crear src/app/api/auth/registro-colegio/solicitar/route.ts (contract auth-registro-colegio-solicitar.md): valida `{email, nombreColegio, nit}` con Zod; anti-enumeración por AMBAS dimensiones (matiz CEO 03:18) — 4 combinaciones responden idéntico 202; rate limits IP+email; test integración con las 4 combinaciones + verificación de qué correo se envió
- [x] T014 [US1] Crear src/app/api/auth/registro-colegio/completar/route.ts (contract auth-registro-colegio-completar.md): valida token+password+nombreColegio+nit; re-verifica anti-colisión NIT (409 si otro lo reclamó); ejecuta `crearColegioMinimo` + siembra cursos por defecto (T017) en la misma `withUnitOfWork`; sella cookie `sesion_estado` con `sellarCookieSesionEstado`; emite bienvenida; test integración cubre 201, 409 email_existente, 409 nit_ya_registrado, 410 enlace_invalido
- [x] T015 [US1] Modificar src/app/registro-colegio/page.tsx: pasa de 2 pasos (`email`→`verificar`) a 2 pasos (`solicitar`→`aviso`) espejo del padre; llama `/api/auth/registro-colegio/solicitar`; pantalla de aviso con el correo escrito, botón "reenviar", enlace "este no es mi correo"
- [x] T016 [P] [US1] Crear src/app/registro-colegio/crear-clave/[token]/page.tsx: espejo de `src/app/registro/crear-clave/[token]/page.tsx` del padre; misma UI de contraseña, mismos errores 409/410 con pantalla serena
- [x] T017 [US1] Crear src/lib/colegio/cursos-seed.ts: `crearCursosPorDefecto(colegioId, anioLectivo, tx?)` idempotente sobre `@@unique([colegioId, nombre, grado, anioLectivo])`; siembra "Grado 1º" … "Grado 11º" con `anioLectivo = new Date().getFullYear().toString()`; test unit con re-ejecución que verifica idempotencia
- [x] T018 [US1] Modificar src/lib/dal/services/registro-colegio.ts:326: llamar `crearCursosPorDefecto(colegio.id, anioLectivo, tx)` justo después de `seedMateriasPorDefecto`; verificar en un test que un colegio recién creado tiene 11 cursos activos

**Checkpoint**: el rector puede registrarse por enlace de punta a punta y aterriza en el Paso 1 del camino con la cookie `sesion_estado` sellada.

## Phase 4: User Story 2 — Guardián del camino colegio (P1)

**Goal**: el guardián devuelve al rector al paso pendiente por URL escrita a mano; API responde JSON 403 con `redirectTo`; retomar en el paso guardado; padre y otros roles intactos.

**Independent Test**: recorrido curl con URL manual a `/dashboard/colegio` → 302 al paso pendiente; `curl /api/colegio/algo` → 403 JSON con `redirectTo`.

- [x] T019 [US2] Crear src/app/camino/colegio/layout.tsx (armazón + indicador "Paso N de 5"): reusa el patrón de src/app/camino/layout.tsx del padre; dos salidas visibles ("Salir y seguir después" → logout, "Este no es mi correo" → registro); `pasoActual(pathname)` mapea URL → step con `DEFINICION_PASOS_COLEGIO`
- [x] T020 [P] [US2] Crear src/app/camino/colegio/listo/page.tsx: pantalla de cierre; server-side re-deriva `derivarPasoPendienteColegio` y redirige al paso pendiente si `!== null`; botón al dashboard
- [x] T021 [US2] Test integración `estado-colegio.test.ts`: cubre las 5 combinaciones (falta rector, falta plan, falta profesor, falta curso, falta estudiante) y el estado completo (`null`); verifica que activar/inactivar el único estudiante devuelve al Paso 5 (el camino se sostiene, no se gana)
- [x] T022 [US2] Test integración `middleware-guardia-colegio.test.ts`: SCHOOL_ADMIN sin paso Rector cumplido → URL a `/dashboard/colegio/tablero` responde 302 a `/camino/colegio/rector`; llamada `/api/colegio/cursos` responde 403 JSON `{code:"CAMINO_INCOMPLETO", redirectTo:"/camino/colegio/rector"}`
- [x] T023 [US2] Test unit `sesion-estado-emitter.test.ts` extendido: SCHOOL_ADMIN con camino incompleto → `pasoCamino: "rector"`; con camino completo → `null`; COMITE_CONVIVENCIA sigue con `pasoCamino: null` en TODAS las condiciones; ADMIN/OPERADOR/COMITE_VALIDACION siguen igual (SC-008)
- [x] T024 [P] [US2] Test unit `guardias.test.ts` extendido: la invariante cruzada dispara excepción al import si un destino del camino colegio no está en `vigencia.SCHOOL_ADMIN.exentas`; test verde con la exención completa; regresión — quitar una ruta del bloque de exentas rompe el test

**Checkpoint**: el guardián del camino colegio funciona como el del padre; regresión cero para PARENT y otros roles.

## Phase 5: User Story 3 — Paso 1 · Quien responde (P1)

**Goal**: rector completa 5 campos + acepta convenio en el mismo paso.

**Independent Test**: `curl PATCH /api/colegio/rector` con los 5 campos + firma consentimiento vía `/api/consentimiento/aceptar` → paso "rector" cumple.

- [x] T025 [US3] Crear endpoint `PATCH /api/colegio/rector/route.ts` (o extender `/api/colegio/perfil` existente si existe): valida `{documentoTipo, documentoNumero, nombre, apellidos, telefono}` con Zod; escribe en `Usuario` + refleja en `Colegio.representanteLegal*` (concat nombre+apellidos, tipo+número); si `Colegio.representanteLegalIdentificacion === "PENDIENTE"`, reemplaza; test cubre retro-llenado + validación campo por campo con mensaje humano
- [x] T026 [US3] Crear src/components/modules/colegio/camino/RectorForm.tsx: form con 5 campos + selectores catálogo (tipos doc activos vía `/api/colegio/tipos-documento`); botón "Continuar" deshabilitado hasta que todos los campos estén válidos; mensajes de error nombran el campo faltante explícitamente
- [x] T027 [US3] Crear src/app/camino/colegio/rector/page.tsx: monta `RectorForm` + sección del convenio (reusa componente del modal de consentimiento SPEC-343 en modo "inline", o embebe link "Leer el convenio" + casilla "Acepto y continúo"); server action llama al PATCH + al `/api/consentimiento/aceptar` en secuencia; llama `sellarCookieSesionEstadoEnAccion(userId)` antes del `redirect`; si el sellado falla, muestra aviso al rector (patrón A-67)

**Checkpoint**: el Paso 1 cumple y avanza al Paso 2 sin recarga; una fila con "PENDIENTE" se reemplaza correctamente.

## Phase 6: User Story 4 — Paso 2 · Plan con puente D2 (P1)

**Goal**: al elegir plan (freemium o pagado), el Paso 2 cumple Y `Colegio.finServicio` queda escrito con la ventana correspondiente (puente D2 · R6).

**Independent Test**: `curl POST /api/colegio/suscripcion/activar-freemium` → 201 + `Colegio.finServicio` es hoy+30 días; `POST /api/colegio/suscripcion/solicitar-plan` con plan MENSUAL → 201 + `finServicio` = hoy+1 mes (via `calcularFinServicio`).

- [x] T028 [US4] Crear src/app/api/colegio/suscripcion/activar-freemium/route.ts (contract colegio-suscripcion-activar-freemium.md): auth SCHOOL_ADMIN, exento del camino; en una `withUnitOfWork` crea Suscripcion freemium + escribe `Colegio.finServicio = hoy + pagos.freemium.duracion_dias` usando `calcularFinServicio` o cálculo directo; sella cookie; test integración cubre 201, 200 idempotente, 409 plan_pagado_activo
- [x] T029 [P] [US4] Modificar src/app/api/colegio/suscripcion/solicitar-plan/route.ts: además de crear Suscripcion `PENDIENTE_AUTORIZACION`, actualizar `Colegio.finServicio` con `calcularFinServicio(hoy, plan.duracion)` (SPEC A-64 `src/lib/colegio/periodo.ts`); sellar cookie con `sellarCookieSesionEstadoEnAccion`; test integración verifica que finServicio se escribe correctamente por cada duración (MENSUAL/SEMESTRAL/ANUAL)
- [x] T030 [US4] Crear src/app/camino/colegio/plan/page.tsx: reusa `PlanesSelector` con `titularidad="colegio"`; server actions `actionActivarFreemium` y `actionSolicitarPlan` llaman a los endpoints anteriores y `sellarCookieSesionEstadoEnAccion` (candado 26/I-227); redirige a `/camino/colegio/profesores`

**Checkpoint**: un colegio nuevo que elige plan deja de quedar "gratis para siempre" — `finServicio` refleja la ventana.

## Phase 7: User Story 5 — Paso 3 · Profesores individual + Excel fresco (P1)

**Goal**: rector agrega ≥1 profesor (individual o Excel); el paso cumple.

**Independent Test**: alta individual → paso cumple; descarga plantilla → llena con la fila ejemplo → valida (1 lista, 0 errores) → confirma → paso cumple.

- [x] T031 [US5] Crear src/lib/colegio/carga-profesores/parser.ts: `COLUMNAS_PROFESOR = ["nombre","apellidos","tipo_documento","numero_documento","anio_nacimiento","sexo","email","telefono"]`; `parseArchivoCargaProfesores(buffer)` acepta CSV y XLSX (exceljs), normaliza mayúsculas/trim, maneja BOM/comillas; límites por parámetro sistema (5MB/2000 filas); test unit cubre CSV con comillas, XLSX, BOM, filas vacías, límites (FRESCO contra main — bc49277fc solo como referencia, matiz CEO)
- [x] T032 [P] [US5] Crear src/lib/colegio/carga-profesores/validator.ts: `validarFilasProfesores(filas, tiposActivos, documentosEnBd)` clasifica `crear|omitido|error`; valida obligatorios, `sexo` ∈ {M,F,OTRO}, año 1900..año actual, tipo_documento activo, email/telefono; test unit con 10+ casos edge
- [x] T033 [US5] Crear src/lib/colegio/carga-profesores/importer.ts: consume el token firmado (JWT TTL 15 min) del validar; crea profesores en `withUnitOfWork`; idempotente por documento; sellar cookie al terminar; test unit
- [x] T034 [US5] Crear src/app/api/colegio/carga-profesores/plantilla/route.ts (contract): emite CSV con TODAS las columnas obligatorias + fila ejemplo válida; el CSV se genera desde la MISMA constante `COLUMNAS_PROFESOR` del parser (fuente única, evita I-245)
- [x] T035 [US5] Crear src/app/api/colegio/carga-profesores/validar/route.ts: multipart/form-data, `parseArchivoCargaProfesores` + `validarFilasProfesores`, responde resumen + token firmado; test integración con 400 por columnas faltantes, archivo grande, ejemplos válidos
- [x] T036 [US5] Crear src/app/api/colegio/carga-profesores/confirmar/route.ts: consume token, llama `importer`, sella cookie, 201; test integración cubre 201, 200 idempotente, 410 token_invalido, 409 duplicados_race
- [x] T037 [US5] TEST-CANDADO FR-026-bis: crear src/app/api/colegio/carga-profesores/plantilla/plantilla-autoconsistente.test.ts que descarga la plantilla del endpoint, la alimenta al validator y afirma `{crear: 1, omitido: 0, error: 0}` (cierra I-245 para profesores)
- [x] T038 [P] [US5] Crear src/components/modules/colegio/profesores/ImportProfesores.tsx: dropzone → POST validar → preview "N listos / M con problemas" → confirmar; patrón `src/components/modules/colegio/unificado/ImportExcel.tsx`
- [x] T039 [US5] Crear src/app/camino/colegio/profesores/page.tsx: reusa `ProfesoresPageClient` en `variante="camino"` + monta `ImportProfesores`; "Continuar" deshabilitado hasta que haya ≥1 profesor activo; server action que redirige a Paso 4

**Checkpoint**: el rector puede cargar profesores individual o por Excel; la plantilla emitida pasa su propio validador (test-candado I-245).

## Phase 8: User Story 6 — Paso 4 · Cursos + materias con profesor obligatorio (P1)

**Goal**: 11 grados aparecen listos; D3 candado servidor rechaza materia sin profesor.

**Independent Test**: colegio nuevo → GET cursos activos → 11; `POST /api/colegio/cursos/[id]/materias` sin profesorId → 400.

- [x] T040 [US6] Modificar src/lib/schemas/index.ts:239 `cursoMateriaBodySchema`: `profesorId: cuidIdSchema` (dropear `.optional().nullable()`); mensaje humano "Toda materia debe llevar un profesor a cargo"; extender también el schema del PATCH nuevo
- [x] T041 [US6] Endurecer src/lib/dal/repositories/curso-materia.ts:55 `crear`: rechazar profesorId null/vacío/inexistente antes de las guardas existentes; NO tocar el schema Prisma (D3 candado servidor, no schema); test unit cubre las 3 rechazos + un happy
- [x] T042 [US6] Crear src/app/api/colegio/cursos/[id]/materias/[materiaId]/route.ts con handler `PATCH` (FR-031): reasignar profesor de una materia existente; valida `{profesorId}` obligatorio; usa el mismo repo `curso-materia.ts`; test integración cubre 200 (reasignación), 400 (sin profesor), 404 (materia no del curso)
- [x] T043 [US6] Modificar src/components/modules/colegio/curso/SeccionMateriasCurso.tsx: label "Profesor a cargo" (era "opcional"); botón guardar deshabilitado hasta que haya profesor seleccionado; consumir el nuevo PATCH para reasignaciones sin necesidad de DELETE+POST
- [x] T044 [US6] Crear src/app/camino/colegio/cursos/page.tsx: lista los 11 grados sembrados con acción inactivar/dividir A/B; para cada curso, muestra selección de materias con profesor obligatorio; "Continuar" deshabilitado hasta que haya ≥1 curso activo (los 11 sembrados cumplen desde el arranque)

**Checkpoint**: D3 candado activo; los 11 grados aparecen sin digitar.

## Phase 9: User Story 7 — Paso 5 · Estudiantes con acudiente doc opcional (P1)

**Goal**: rector agrega ≥1 estudiante con acudiente (documento opcional); paso cumple.

- [x] T045 [US7] Modificar src/lib/schemas/index.ts:255 `acudienteEstudianteBodySchema` y `:172` `acudienteUpdateBodySchema`: agregar `documentoTipo?` y `documentoNumero?` opcionales; valida tipoDocumento contra catálogo activo si viene
- [x] T046 [P] [US7] Modificar src/app/api/colegio/alumnos/[id]/acudientes/route.ts y acudientes/[acudienteId]/route.ts: aceptar los 2 campos nuevos; persistir en `AcudienteEstudiante`; test integración cubre acudiente sin doc (opcional) y con doc
- [x] T047 [US7] Modificar src/components/modules/colegio/alumnos/[id]/SeccionAcudientes.tsx: 2 campos nuevos etiquetados "(opcional)"; visible en el listado
- [x] T048 [P] [US7] Modificar src/components/modules/colegio/unificado/tipos.ts `AcudienteForm`: agregar `documentoTipo?`, `documentoNumero?`; `construirPayload` los omite si vacío
- [x] T049 [US7] Crear src/app/camino/colegio/estudiantes/page.tsx: reusa alta individual + link al wizard unificado; "Continuar" deshabilitado hasta ≥1 estudiante activo; server action sella cookie y redirige a `/camino/colegio/listo`

**Checkpoint**: el Paso 5 cumple y el camino cierra; dashboards del colegio abren al primer intento.

## Phase 9-bis: Sellado transversal en endpoints mutadores del colegio (P1 · cierra I1 del analyze)

**Goal**: cada mutación que puede cerrar un paso del camino re-sella la cookie `sesion_estado` — sin esto SC-004 (avance al instante) se rompe cuando el rector usa endpoints existentes.

- [x] T049-b Extender src/app/api/colegio/profesores/route.ts (POST alta individual): llamar `sellarCookieSesionEstado(res, userId)` tras crear el profesor; si el sellado falla, incluir campo `aviso` en la respuesta pidiendo recargar (patrón `src/app/api/padre/hijos/route.ts:79-87`); test integración cubre el sellado
- [x] T049-c [P] Extender src/app/api/colegio/cursos/[id]/alumnos/route.ts (POST alta estudiante): mismo sellado; test integración
- [x] T049-d [P] Extender src/app/api/colegio/cursos/unificado/route.ts (POST wizard): mismo sellado tras persistir; test integración
- [x] T049-e [P] Extender src/app/api/colegio/cursos/route.ts (POST curso) y `.../cursos/[id]/estado/route.ts` (PATCH inactivar): sellado — el paso 4 se rompe si el rector inactiva el último curso activo

## Phase 10: User Story 8 — Nada del padre ni de otros roles se rompe (P1)

**Goal**: SC-008 — regresión cero.

- [x] T050 [US8] Actualizar src/lib/routing/sesion-estado-emitter.test.ts:176-183: reflejar que SCHOOL_ADMIN ahora sí lleva `pasoCamino` cuando el camino está incompleto (cambio esperado, documentar en el commit como "no es regresión, es la nueva verdad"); mantener el test que afirma que ADMIN/OPERADOR/COMITE_VALIDACION/COMITE_CONVIVENCIA siguen con `null`
- [x] T051 [US8] Correr todo `npm run test:unit` + `npm run test` (integración) + `npm run test:journeys` + `npm run test:e2e camino-padre.spec.ts`; documentar los archivos que se tocaron y por qué

## Phase 11: I-245 · plantilla de alumnos existente (candado transversal)

**Goal**: FR-026-ter — arreglar la plantilla oficial de alumnos hoy en producción + test-candado.

- [x] T052 Modificar src/app/api/colegio/carga/plantilla/route.ts:11-15: agregar `documento_tipo_alumno` y `documento_numero_alumno` al array de columnas; ajustar la fila de ejemplo del CSV para incluir valores válidos
- [x] T053 Crear src/app/api/colegio/carga/plantilla/plantilla-alumnos-autoconsistente.test.ts (test-candado): descarga la plantilla, la pasa por `parseArchivoCarga` + `validarFilasCarga` y afirma `{crear: 1, omitido: 0, error: 0}` — cierra I-245 para alumnos

## Phase 12: OnboardingColegio apagado

- [x] T054 Deshabilitar el modal OnboardingColegio: en los layouts/páginas del dashboard del colegio que hoy montan `OnboardingModal.tsx`, quitar su render (o poner `if (false)`) con comentario "APAGADO SPEC-344 · reemplazado por el camino guiado. Reversible: revertir este commit."; verificar que ninguna prueba dependía del modal, actualizar las que sí (mantener el test del modal en verde por seguridad; solo se quita del montaje)

## Phase 13: Polish & Cierre

- [ ] T055 Test E2E `tests/e2e/camino-colegio.spec.ts` (390 px): recorre los 5 pasos con Playwright; incluye alta individual profesor + alta Excel; verifica que el rector no puede saltar pasos por URL manual
- [x] T056 [P] Extender `vitest.unit.includes.ts` con los tests unit nuevos (estado-colegio, pasos-colegio, carga-profesores/parser, validator, test-candado plantilla)
- [x] T057 Regenerar artefactos de arquitectura: `npm run arch:generate` + `npm run arch:check` VERDE; los tres artefactos afectados (`03-navegacion.md`, `02-roles-capacidades.md`, `04-modelo.md`) entran en el mismo PR
- [x] T058 Gate de calidad completo: `npx tsc --noEmit` + `npm run lint` + `npm run test:unit` + `npm run test` + `npm run build` + `./scripts/dev-restart.sh` + `npm run arch:check`
- [x] T059 Deploy limpio local + recorrido real del quickstart.md §3: registro por enlace + 5 pasos + móvil 390 px + regresión padre; capturar evidencia (screenshots o descripción textual)
- [x] T060 [P] Disciplina de specs: fila de SPEC-344 en specs/README.md (formato existente), sección "Impacto en arquitectura:" ya en spec.md, Status del encabezado a IMPLEMENTADO
- [x] T061 Documentar cierre en specs/344-camino-guiado-colegio/cierre.md: evidencia del gate + recorrido + deuda técnica (OnboardingColegio inactivo + eventual unificación vigencia colegio ← Suscripcion queda para otra spec del brief); un commit por fase + uno de docs

## Dependencies & Execution Order

- Setup (T001–T002) → todo lo demás.
- Foundational (T003–T010) → BLOQUEANTE. Debe estar completo antes de US1–US7 porque toda historia depende del guardián generalizado y de la cookie extendida.
- US1 (T011–T018): depende de Foundational; T017 se puede hacer en paralelo con T011–T016.
- US2 (T019–T024): depende de US1 (necesita rector creado); T024 se puede hacer en paralelo (`[P]`).
- US3 (T025–T027): depende de US2 (necesita guardián funcionando).
- US4 (T028–T030): depende de US3 (paso 1 debe cumplir primero para llegar al 2); T029 [P] con T028.
- US5 (T031–T039): depende de US4; T031/T032 pueden ir en paralelo con T038.
- US6 (T040–T044): depende de US5.
- US7 (T045–T049): depende de US6; T045/T046/T047/T048 pueden pipelinearse.
- Sellado transversal (T049-b…e): en paralelo con US7; T049-b/c/d/e independientes entre sí.
- US8 (T050–T051): al final; T050 en paralelo con T024.
- I-245 (T052–T053): independiente, se puede hacer temprano.
- OnboardingColegio (T054): después de que el camino funcione entero.
- Polish (T055–T061): al final; T056/T060 en paralelo.

**Parallel example**: tras T010 (Foundational done), un dev alterna: T011+T017+T052 en paralelo (independientes); luego T013+T014 secuencial; luego T019+T024 en paralelo; y así.

## Implementation Strategy

MVP = US1 (registro por enlace) + US2 (guardián) — sin ellos el resto no puede probarse. Cada US se cierra con su suite verde antes de arrancar la siguiente (candado de calidad); un commit por US + uno por Foundational + uno de docs. El cierre incluye recorrido real en navegador a 390 px (regla de oro: verde CI ≠ funciona).
