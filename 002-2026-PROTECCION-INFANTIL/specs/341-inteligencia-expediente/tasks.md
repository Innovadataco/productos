# Tasks: SPEC-341 · La inteligencia del expediente (análisis IA en fila)

**Status**: Planeada
**Impacto en arquitectura:** aditivo — nuevo modelo `AnalisisExpediente`, nueva cola `padre.analisis.expediente`, nuevo worker, nueva ruta `/api/padre/expedientes/[id]/analisis`, nuevo componente `AnalisisExpediente` en el panel del padre. Sin cambios en modelos existentes; el motor de expediente actual (SPEC-323/236/340) no se toca.

**Referencias**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

---

## Fase 1 · Setup (bloque compartido, no toca ninguna historia por sí solo)

- [ ] T001 Crear la migración Prisma nueva agregando modelo `AnalisisExpediente` + enums `AlcanceAnalisis` y `EstadoAnalisis` en `prisma/schema.prisma` (según [data-model.md](./data-model.md)) y correr `npx prisma migrate dev --name analisis_expediente`.
- [ ] T002 Regenerar el cliente Prisma tras T001: `npx prisma generate`.
- [ ] T003 Sembrar los parámetros nuevos en `prisma/seed.ts` (bloque nuevo etiquetado `SPEC-341`):
    - `padre.analisis.max_concurrentes = 1`
    - `padre.analisis.cooldown_min = 5`
    - `padre.analisis.tiempo_estimado_seg = 90`
    - `padre.analisis.tope_fila = 50`
    - `padre.analisis.ttl_horas = 168`
    - `padre.analisis.prioridad = 5`  (< `queue.clasificacion.prioridad`, hoy 10)
    - `padre.analisis.modelo = <valor de ia.rubrica.modelo_embudo>` (leer del catálogo, no hardcodear)
    - `padre.analisis.prompt_sistema` — texto sembrado con la voz del brief; borrador para el seed (Jelkin/admin lo editan después): *"Sos el análisis asistido del expediente de un padre. Describís PATRONES observados en los datos calculados, nunca acusás a nadie. No inventás hechos: solo hablás de lo que aparece en el input. Voz cálida y clara, en tuteo, entre 120 y 220 palabras. Cerrás sin diagnóstico, sin score, sin veredicto: dejás la lectura para que el padre decida."*
    - `padre.analisis.frases_prohibidas_json` — lista inicial JSON: `["podría ser un depredador","es un caso claro de","estamos seguros de que","sugiere abuso","alto riesgo confirmado","conducta criminal","perpetrador identificado","sin duda"]`
    - Gemelos colegio: `colegio.analisis.max_concurrentes = 1`, `colegio.analisis.modelo = <mismo del embudo>`, `colegio.analisis.prompt_sistema` con voz institucional (borrador de 3-4 líneas: *"Análisis asistido de patrones institucionales anónimos: NUNCA nombrás personas ni identificadores; hablás por curso/franja horaria/plataforma. Voz técnica y descriptiva; sin recomendación clínica."*).
- [ ] T004 Ejecutar el seed local (`pnpm run seed`) y verificar por `psql` que los 12 parámetros nuevos existen.
- [ ] T005 Reservar advisory-lock `123456799` en `scripts/ADVISORY-LOCKS.md` (nueva fila para `scripts/worker-analisis-expediente.mjs` · servicio `pi-analisis-expediente` · SPEC-341).

---

## Fase 2 · Foundational (bloqueantes de TODAS las historias)

- [ ] T010 Crear `src/lib/expediente/analisis/hash-cadena.ts` con `calcularHashCadena(exp: { ultimoEventoEn, numEventos, categoriasDominantesJson })` → SHA-256 hex determinista (normalizando el JSON antes de hashear).
- [ ] T011 [P] Crear el test del hash en `src/lib/expediente/analisis/hash-cadena.test.ts`: mismo input → mismo hash; distinto input en cualquiera de las 3 columnas → hash distinto; JSON con distinto orden de claves → mismo hash (normalización).
- [ ] T012 Crear el tipo `PayloadAnalisis` y las dos funciones armadoras en `src/lib/expediente/analisis/armar-payload.ts`: `armarPayloadPadre(expediente, eventos, identificadoresPadre, hijoCruzado)` y `armarPayloadColegio(expediente, agregados)`. El primero incluye hechos con fecha/ciudad/país/plataforma/categoría/edadReportada; el segundo SOLO agregados (categoría dominante, franja horaria, curso, plataforma), CERO identificadores y CERO texto.
- [ ] T013 [P] Crear tests en `src/lib/expediente/analisis/armar-payload.test.ts` que aseguran (a) el payload de PADRE incluye la lista de hechos y (b) el payload de COLEGIO no contiene ningún valor de identificador ni texto de reporte (grep exacto de valores conocidos = 0 hits). Cubre SC-002 y SC-006.
- [ ] T014 [P] Crear `src/lib/expediente/analisis/prompt.ts` con `resolverPromptSistema(alcance): Promise<string>` que lee `padre.analisis.prompt_sistema` o `colegio.analisis.prompt_sistema` desde `ParametroSistema`, y devuelve además el hash SHA-256 del prompt (para auditar en `promptSistemaHash`).
- [ ] T015 [P] Crear `src/lib/expediente/analisis/validar-salida.ts` con `validarSalida(texto): {ok: true} | {ok: false, motivo: string}` que rechaza si el texto contiene alguna de las frases del parámetro `padre.analisis.frases_prohibidas_json` (case-insensitive, substring match). Cubre FR-014.
- [ ] T016 [P] Crear tests en `src/lib/expediente/analisis/validar-salida.test.ts` con casos positivos y negativos de frase prohibida.
- [ ] T017 Extender `src/lib/queue.ts` con `sendAnalisisExpediente(payload)` que (a) verifica en runtime que `padre.analisis.prioridad < queue.clasificacion.prioridad` y aborta si no; (b) usa `singletonKey = ${expedienteId}:${hashCadena}` para idempotencia FR-007; (c) respeta `padre.analisis.tope_fila` consultando `getQueueStats("padre.analisis.expediente")` antes de encolar. Cubre FR-004, FR-007, FR-008-bis, FR-008-ter, SC-008.
- [ ] T018 [P] Crear `src/lib/expediente/analisis/ejecutar-analisis.ts` con la función `ejecutarAnalisisJob(payload)` que orquesta el flujo del worker: carga el expediente + eventos + identificadores, arma el payload por `alcance`, llama a `llamarOllamaStructured<AnalisisSalida>`, valida la salida, persiste con `versionSecuencial = MAX + 1` y estado `PUBLICADO`. En cualquier fallo persiste `FALLIDO` con motivo y NO lanza excepción.
- [ ] T019 Crear el worker `scripts/worker-analisis-expediente.mjs` que consume la cola `padre.analisis.expediente`, toma `pg_try_advisory_lock(123456799)`, llama a `ejecutarAnalisisJob`, y usa `iniciarTickVida()` para healthcheck (SPEC-291). Incluye el comentario junto al literal explicando el ID (regla operativa 4 de ADVISORY-LOCKS.md).
- [ ] T020 Agregar servicio `pi-analisis-expediente` en `docker-compose.yml` y `docker-compose.prod.yml` (imagen del worker Node.js con `.env` montado, mismo patrón que `pi-expediente-motor`).

---

## Fase 3 · US1 · Lectura instantánea si el hash coincide, generación si no (P1 · MVP)

**Meta**: al abrir el expediente, el padre ve inmediatamente el análisis
vigente si el hash coincide; si no, el sistema encola UN job y muestra el
banner "generando" honesto con posición en fila.

**Test independiente**: recorrido navegador — abrir un expediente sin
análisis previo, verificar banner + capa 1 En vivo, esperar publicación,
recargar y verificar sello + guía de acción.

- [ ] T030 [US1] Crear `src/lib/dal/services/analisis-expediente.ts` con `leerVigente(expedienteId, usuarioId): Promise<AnalisisVigenteDto | null>` (Q-3: prisma solo en DAL) que devuelve la última fila `PUBLICADO` con su `guiaAccion` resuelta.
- [ ] T031 [US1] Extender el DAL de T030 con `evaluarYEncolarSiCorresponde(expedienteId, usuarioId, disparador): Promise<EvaluacionDto>` que calcula `hashActual`, compara con el vigente, decide si encola vía `sendAnalisisExpediente` según reglas FR-002/003/008-ter y `padre.analisis.ttl_horas`, y devuelve `{estado, cola, coincide, hechosNuevosDesde, colaLlena}` (el `colaLlena: boolean` viaja al UI para el mensaje *"La cola está llena — vuelve a intentar…"* — ver contracts/analisis-endpoint.md).
- [ ] T032 [US1] Crear la ruta `src/app/api/padre/expedientes/[id]/analisis/route.ts` con el `GET` según [contracts/analisis-endpoint.md](./contracts/analisis-endpoint.md): verifica sesión PARENT dueña, llama a los helpers del DAL de T030+T031, calcula `cooldown` desde el vigente, y devuelve el JSON completo.
- [ ] T033 [US1] Crear tests de integración en `src/app/api/padre/expedientes/[id]/analisis/route.test.ts` para el `GET`: (a) 403 para no dueña, (b) 404 sin expediente, (c) sin análisis previo → encola + devuelve `estado="GENERANDO"` + `cola.posicion=1`, (d) segunda apertura con job vivo NO encola otro (verifica en pg-boss que hay 1 solo).
- [ ] T034 [US1] Crear el componente `src/components/modules/padre/AnalisisExpediente.tsx` (client component) que consume `GET /api/padre/expedientes/[id]/analisis`, hace polling cada 15 s mientras `estado==="GENERANDO"`, y renderiza: sello del corte, texto del análisis, etiqueta "análisis asistido", sección "Qué puedes hacer ahora" con la guía, y aviso `Hay N hechos nuevos desde este análisis` cuando `!coincide` (FR-021/022, R-7).
- [ ] T035 [US1] Crear el componente `src/components/modules/padre/ExpedienteGenerando.tsx` que muestra el banner honesto con `cola.posicion` + `cola.estimadoSeg` traducido a minutos + mensaje base. Cubre FR-024. Independiente de `AnalisisExpediente` para poder reusar en la sección cuando NO hay vigente y hay solo generando.
- [ ] T036 [US1] Montar `AnalisisExpediente` bajo el mapa en `src/components/modules/padre/ExpedienteVivo.tsx` (o `ExpedienteDetalleClient.tsx` si SPEC-340 aún no está en la rama). Pasar `expedienteId` como prop.
- [ ] T037 [US1] Verificar que al arrancar el worker (T019) y disparar un GET desde el navegador, el análisis se publica en < 2× `tiempo_estimado_seg` y el UI refresca solo (SC-003).
- [ ] T038 [US1] Recorrido en navegador que valida SC-007 (sala de espera útil sola): (1) abrir un expediente SIN análisis previo → verificar los DOS bloques visibles: banner `ExpedienteGenerando` con posición + estimado + capa 1 "En vivo"; (2) esperar publicación y agregar un evento; (3) reabrir → verificar los TRES bloques: banner nuevo + capa 1 En vivo + análisis previo abajo con *"1 hecho nuevo después"*. Screenshot de los 3 estados adjunto en el `cierre.md` final.

---

## Fase 4 · US2 · "Actualizar análisis" a mano con cool-down (P2)

**Meta**: el padre puede pedir la regeneración a mano; el sistema respeta
cool-down y NO gasta modelo si la cadena no cambió.

**Test independiente**: con cool-down = 1 min, botón deshabilitado inicialmente,
habilitado tras 1 min, y respuesta correcta en los 3 casos (encolado / ya-al-día
/ cool-down).

- [ ] T040 [US2] Extender la ruta de T032 con el handler `POST` según [contracts/analisis-endpoint.md](./contracts/analisis-endpoint.md): honra `padre.analisis.cooldown_min`, responde los 4 casos (encolado, ya_al_dia, cooldown, cola_llena).
- [ ] T041 [US2] Crear tests de integración para `POST` en el mismo `route.test.ts` de T033: (a) cool-down activo → 200 con `motivo: "cooldown"`; (b) cool-down cumplido + hash coincide → 200 con `motivo: "ya_al_dia"` y NUEVO cool-down (FR-019); (c) cool-down cumplido + hash cambió + espacio en cola → 200 con `encolado: true`; (d) cola llena → 200 con `motivo: "cola_llena"`.
- [ ] T042 [US2] Agregar el botón "Actualizar análisis" en `AnalisisExpediente.tsx` (T034): deshabilitado durante GENERANDO (FR-027) y durante cool-down (FR-018) con texto `Podrás actualizar en <N> minutos`; on-click hace `POST` y muestra el toast según la respuesta.
- [ ] T043 [US2] Test manual del recorrido según [quickstart.md](./quickstart.md) pasos 6–7.

---

## Fase 5 · US3 · Fila de a uno con corte visible (P2)

**Meta**: el motor procesa los análisis serializados, con posición honesta
en el UI, y cada análisis publicado deja un corte auditable inmutable.

**Test independiente**: encolar 3 jobs, verificar orden serializado
respetando `max_concurrentes=1`, y que cada publicación persiste
`versionSecuencial`, `corteN`, `hashCadena`.

- [ ] T050 [US3] Ampliar `sendAnalisisExpediente` (T017) para leer `padre.analisis.max_concurrentes` y setear las opciones del `boss.work()` correspondiente en el worker (T019).
- [ ] T051 [US3] Test de integración en `scripts/integration/worker-analisis-expediente.test.ts` (o similar): inserta 3 jobs, arranca el worker en modo test, verifica que se procesan de a uno y `versionSecuencial` incrementa correctamente para cada expediente.
- [ ] T052 [US3] Test de integración de prioridad: inyectar 5 jobs de análisis + 3 de clasificación al mismo tiempo, verificar por logs que los 3 de clasificación se despachan antes que cualquier análisis (SC-008).
- [ ] T053 [US3] Test de invariancia post-publicación: intentar `prisma.analisisExpediente.update()` sobre un `PUBLICADO` debe ser bloqueado por el DAL (nueva capa de guard en `analisis-expediente.ts` del DAL) o fallar con un error controlado (FR-016).
- [ ] T054 [US3] Verificar en el `GET` (T032) que la propiedad `cola.posicion` refleja la posición REAL (contar jobs vivos en la cola con prioridad >= la del expediente actual) — sin este cálculo, FR-024 no pasa.

---

## Fase 6 · US4 · Tubería reutilizable con `alcance` (P3)

**Meta**: dejar la infraestructura preparada para que C3 (módulo colegio)
llame al orquestador con `alcance=COLEGIO_BLINDADO` sin código nuevo del motor.

**Test independiente**: llamar `ejecutarAnalisisJob({alcance: "COLEGIO_BLINDADO", ...})`
sobre un expediente demo → guarda una fila con `alcance=COLEGIO_BLINDADO` y su payload
al modelo no contiene identificadores. Verificado con test unitario del orquestador.

- [ ] T060 [US4] Test unitario dedicado en `src/lib/expediente/analisis/armar-payload.test.ts` (extensión de T013): asegurar que `armarPayloadColegio` NUNCA incluye ningún identificador (grep exacto sobre `JSON.stringify(payload)`) sobre un expediente demo con 5 identificadores. Cubre SC-002 y SC-006.
- [ ] T061 [US4] Documentar en `README.md` de `src/lib/expediente/analisis/` cómo consumir el orquestador desde otro módulo: 3 líneas de ejemplo mostrando la llamada con `alcance=COLEGIO_BLINDADO`. Sin código de producción del colegio (C3 tiene su propio brief).
- [ ] T062 [US4] Verificar que el worker (T019) despacha un job con `alcance=COLEGIO_BLINDADO` a través del mismo pipeline sin ramas condicionales (todo por el `alcance` del payload). Test.

---

## Fase 7 · Polish & cross-cutting

- [ ] T090 Regenerar `docs/architecture/02-roles-capacidades.md` con `npx tsx scripts/arch/generar-roles-capacidades.ts` para incluir la nueva ruta `/api/padre/expedientes/[id]/analisis`.
- [ ] T091 Correr `pnpm run tokens:check` y no bajar del piso vigente (1083); si sube, actualizar `TOKENS-PISO.md`.
- [ ] T092 Correr `pnpm run locks:check` y verificar que la fila `123456799` está registrada 1:1 con el worker.
- [ ] T093 Correr `pnpm run lint` y `pnpm run typecheck` sobre el diff; cero errores.
- [ ] T094 Correr `pnpm test` completo y confirmar suite verde.
- [ ] T095 Verificar en vivo (candado 25 del CLAUDE.md) el recorrido del [quickstart.md](./quickstart.md) contra la app desplegada localmente (o VPS staging) y reportar en `cierre.md` qué se vio.
- [ ] T096 Actualizar `specs/README.md` marcando SPEC-341 como `🟢 Implementada` al cerrar.
- [ ] T097 Escribir `specs/341-inteligencia-expediente/cierre.md` con: hash del PR, evidencia de las 8 SC, screenshots del banner + análisis publicado + botón actualizando, y la lista de parámetros creados.

---

## Dependencias y camino crítico

- **Setup (T001–T005) → Foundational (T010–T020)**: T010–T020 requieren la migración y los parámetros sembrados.
- **Foundational → US1**: T030–T037 requieren el hash (T010), el orquestador (T012), el prompt (T014), la validación (T015), la cola (T017), el ejecutor (T018) y el worker (T019).
- **US1 → US2**: T040–T043 reusan la ruta creada en T032 (extendiendo con POST). US2 puede empezar en paralelo con US3.
- **US1 → US3**: T050–T054 dependen del worker (T019). US3 puede empezar en paralelo con US2 (archivos distintos).
- **US4**: T060–T062 pueden correr desde que T012 (armar-payload) exista — es más test-driven que UI. Se puede empezar en paralelo con US1 después de T012.

## Ejecución paralela sugerida

- **Batch A (después de T012)**: T013 [P] + T014 [P] + T015 [P] + T016 [P] + T060 [P] (todos son archivos distintos, sin conflictos).
- **Batch B (después de T019)**: T033 [US1] + T041 [US2] pueden avanzar en paralelo si el mismo archivo `route.test.ts` se coordina con `git merge` (o mejor: separar en dos archivos si se sube el conflicto de ediciones).

## MVP scope sugerido

**US1 sola es MVP funcional**: entrega al padre la generación al abrir + lectura
instantánea si coincide + guía de acción. El botón "Actualizar" (US2) y la
visibilidad exacta de la fila (US3) son mejoras que se pueden diferir 1 sprint
sin bloquear la implantación. US4 es preparación para C3 y no entrega UI al
padre — se puede cerrar el mismo día que se implementa el orquestador (T012)
solo agregando los tests de blindaje.
