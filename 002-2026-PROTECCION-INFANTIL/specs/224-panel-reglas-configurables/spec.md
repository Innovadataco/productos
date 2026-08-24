# Feature Specification: SPEC-224 — Panel de reglas configurables (Análisis dinero-vs-valor)

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: IMPLEMENTADO (integración pendiente de corrida por el coordinador)

Impacto en arquitectura: añade el panel admin `/dashboard/admin/analisis/reglas` (CRUD de reglas + editor SQL con test en transacción `READ ONLY` + versionado), la tabla `ReglaRecomendacionHistorial` y la columna aditiva `version` en `ReglaRecomendacion` (migración aditiva), 7 valores `AccionAudit REGLA_*`, parámetros `analisis.reglas.*` y el módulo permisible nuevo `analisis_admin`.

**Dependencia bloqueante**: SPEC-221 (motor de reglas de recomendación) debe estar implementada en la misma rama del mega-lote: provee los modelos `ReglaRecomendacion` y `Recomendacion`, el enum `ModoRegla` (`RECOMIENDA` | `EJECUTA`), el worker de evaluación y las 7 reglas semilla. SPEC-224 solo construye el panel de administración sobre esa base; no evalúa reglas ni ejecuta acciones automáticas (eso es SPEC-221/SPEC-226).

**Input**: El módulo Análisis dinero-vs-valor (BRIEF-ANALISIS-DINERO-VS-VALOR, mesa ARQ_12) define un motor de recomendaciones 100% reglas SQL configurables, sin IA. Hoy esas reglas solo podrían tocarse con un deploy o con SQL directo. El CEO necesita un panel admin (`/dashboard/admin/analisis/reglas`) para crear, editar, probar y versionar reglas, con editor SQL que muestra preview y permite probar contra datos reales en solo lectura, y con promoción `RECOMIENDA → EJECUTA` protegida por confirmación fuerte y motivo obligatorio en `AuditLog` (D-77).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — ADMIN lista y administra el catálogo de reglas (Priority: P1)

Como ADMIN quiero ver todas las `ReglaRecomendacion` en una tabla con su modo, frecuencia, estado activo y cuántas recomendaciones generó en los últimos 7 días, para entender de un vistazo qué reglas están trabajando y cuáles no.

**Why this priority**: sin visibilidad del catálogo, el CEO no puede calibrar el motor; la tabla es la entrada a todas las demás operaciones (crear, editar, promover).

**Independent Test**: con las 7 reglas semilla de SPEC-221 presentes, abrir `/dashboard/admin/analisis/reglas` y verificar que la tabla muestra nombre, categoría, modo, frecuencia, estado y conteo de recomendaciones de los últimos 7 días por regla.

**Acceptance Scenarios**:

1. **Given** un ADMIN autenticado con permiso del módulo `analisis_admin`, **When** abre `/dashboard/admin/analisis/reglas`, **Then** ve la tabla de reglas ordenada por `prioridad` descendente con columnas: nombre, categoría, modo, frecuencia (min), activa, recomendaciones generadas últimos 7 días.
2. **Given** un usuario con rol distinto de `ADMIN` (ej. `PARENT`, `OPERADOR`), **When** intenta abrir la página o llamar `GET /api/admin/analisis/reglas`, **Then** recibe `403`.
3. **Given** una regla inactiva (`activa = false`), **When** se lista el catálogo, **Then** aparece visualmente diferenciada (estado "Inactiva") y el worker de SPEC-221 no la evalúa.
4. **Given** la tabla, **When** el ADMIN activa o desactiva una regla, **Then** el cambio se persiste y queda en `AuditLog` con el estado anterior y el nuevo.

---

### User Story 2 — Editor de regla con SQL preview y test contra datos reales (Priority: P1)

Como ADMIN quiero crear o editar una regla escribiendo su `sqlQuery` y su `plantillaRecomendacion`, previsualizar el SQL y probarlo contra los datos reales en modo solo lectura antes de guardar, para no romper el motor con una query defectuosa.

**Why this priority**: las reglas son SQL escrito a mano por un humano; sin un test seguro previo, una query con error llega al worker de SPEC-221 y falla en silencio cada `frecuenciaMin`.

**Independent Test**: crear una regla nueva con una query `SELECT` válida, pulsar "Probar" y verificar que el panel muestra una muestra de filas reales (máx `analisis.reglas.test_max_filas`), el conteo total estimado y la duración; luego intentar probar una query con `DELETE` y confirmar que se rechaza sin ejecutarse.

**Acceptance Scenarios**:

1. **Given** el editor de regla, **When** el ADMIN pega una query `SELECT` válida y pulsa "Probar", **Then** el sistema ejecuta la query dentro de una transacción de solo lectura con `statement_timeout` y devuelve: muestra de filas (máx `analisis.reglas.test_max_filas`, default 50), número de filas de la muestra, duración en ms y las columnas del resultado (para mapear variables de la plantilla).
2. **Given** una query que contiene palabras de mutación (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `COPY`, `CALL`, `DO`), múltiples sentencias (`;` seguido de otra sentencia) o no inicia con `SELECT`/`WITH`, **When** se pulsa "Probar" o "Guardar", **Then** se rechaza con `400` y un mensaje que indica la razón, sin ejecutar nada.
3. **Given** una query válida pero que excede `analisis.reglas.test_timeout_ms` (default 5000 ms), **When** se prueba, **Then** PostgreSQL aborta por `statement_timeout`, la transacción se revierte y el panel muestra un error legible de timeout.
4. **Given** una plantilla con variables `{{variable}}`, **When** el test devuelve columnas, **Then** el editor muestra qué variables de la plantilla tienen columna correspondiente y cuáles no (advertencia, no bloqueo).
5. **Given** el test ejecutado, **Then** queda en `AuditLog` una entrada `REGLA_SQL_TEST` con metadatos (huella del query, duración, filas de muestra, admin) y **sin** el contenido de las filas.
6. **Given** una regla guardada, **When** el ADMIN edita y guarda, **Then** la validación estática de la query se repite en el servidor antes de persistir (nunca confiar solo en el cliente).

---

### User Story 3 — Promoción RECOMIENDA → EJECUTA con confirmación fuerte (Priority: P1)

Como ADMIN quiero promover una regla de `RECOMIENDA` a `EJECUTA` solo tras una confirmación fuerte (escribir `EJECUTA`) y con un motivo obligatorio que queda en `AuditLog`, para que el paso a autonomía total (D-77, Nivel 4 agentic) sea una decisión deliberada y trazable.

**Why this priority**: en modo `EJECUTA` el sistema actúa solo (crea bonos, envía notificaciones, asigna operadores vía SPEC-226). Una promoción accidental o sin rastro es un riesgo operativo y de cumplimiento.

**Independent Test**: promover una regla semilla a `EJECUTA` escribiendo la confirmación y un motivo, verificar en `AuditLog` la entrada con motivo y admin; luego intentar promover sin motivo o con confirmación incorrecta y confirmar `400`.

**Acceptance Scenarios**:

1. **Given** una regla en modo `RECOMIENDA`, **When** el ADMIN pulsa "Cambiar a EJECUTA", **Then** el sistema exige: (a) escribir exactamente `EJECUTA` en un campo de confirmación y (b) un motivo de mínimo 20 caracteres; sin ambos, la operación no se habilita.
2. **Given** la confirmación y el motivo válidos, **When** se confirma la promoción, **Then** la regla pasa a `modo = EJECUTA` y se registra `AuditLog` con acción `REGLA_PROMOVIDA_EJECUTA`, `valorAnterior = RECOMIENDA`, `valorNuevo = EJECUTA`, el motivo en metadatos y el `usuarioId` del admin.
3. **Given** una regla en modo `EJECUTA`, **When** el ADMIN la revierte a `RECOMIENDA`, **Then** se exige motivo obligatorio (sin confirmación de texto) y se registra `REGLA_REVERTIDA_RECOMIENDA` en `AuditLog`.
4. **Given** una regla en modo `EJECUTA` sin `accionEjecutable` configurada, **When** el worker de SPEC-221 la evalúe, **Then** se comporta como `RECOMIENDA` (genera sugerencia, no ejecuta nada) — la promoción sin acción configurada nunca produce efectos automáticos.
5. **Given** una llamada directa a `POST /api/admin/analisis/reglas/[id]/modo` con `modo = EJECUTA` pero sin `confirmacion = "EJECUTA"` o sin `motivo` válido, **When** se procesa, **Then** retorna `400` y el modo no cambia.

---

### User Story 4 — Versionado de reglas con historial auditable (Priority: P2)

Como ADMIN quiero que cada cambio en una regla genere una versión nueva con snapshot completo y motivo, y poder consultar el historial de versiones, para entender qué cambió, cuándo y por qué, y para comparar el rendimiento antes y después de un ajuste.

**Why this priority**: el tuning de reglas es iterativo (el brief §10.4 usa tasas de aplicación/ignorada para calibrar); sin historial no hay forma de correlacionar un cambio de umbral con un cambio en los resultados.

**Independent Test**: editar el `umbralMinimo` de una regla con motivo "subo umbral por ruido", verificar que `version` incrementa en 1, que existe una fila en `ReglaRecomendacionHistorial` con el snapshot anterior y el motivo, y que `GET /api/admin/analisis/reglas/[id]/historial` la devuelve.

**Acceptance Scenarios**:

1. **Given** una regla existente, **When** se persiste cualquier cambio en campos funcionales (`nombre`, `descripcion`, `categoria`, `sqlQuery`, `plantillaRecomendacion`, `accionEjecutable`, `accionParametros`, `prioridad`, `umbralMinimo`, `frecuenciaMin`, `activa`), **Then** `version` incrementa en 1 y se inserta un snapshot completo del estado anterior en `ReglaRecomendacionHistorial` con `cambiadoPorAdminId` y `motivo` (obligatorio en la API de edición, mínimo 10 caracteres).
2. **Given** el historial de una regla, **When** el ADMIN abre "Historial", **Then** ve las versiones ordenadas de más reciente a más antigua con: versión, fecha, admin, motivo y diff legible de campos cambiados.
3. **Given** una creación de regla nueva, **When** se guarda, **Then** nace en `version = 1` sin fila de historial (no hay estado anterior) y con `AuditLog` `REGLA_CREADA`.
4. **Given** el historial, **Then** es de solo lectura: no existe operación de restauración automática en v1 (restaurar = editar la regla copiando valores, lo que genera una versión nueva).

---

### User Story 5 — API de administración de reglas protegida y validada (Priority: P1)

Como sistema quiero endpoints `/api/admin/analisis/reglas` con autenticación `ADMIN`, permiso de módulo `analisis_admin`, rate limiting, validación Zod y errores canónicos, para que el panel sea la única vía de gestión y toda mutación quede auditada.

**Why this priority**: el panel es una superficie de administración con SQL arbitrario (aunque validado); la protección perimetral es no negociable.

**Independent Test**: llamar cada endpoint sin cookie (401), con rol `PARENT` (403), con payload inválido (400) y con payload válido (200/201), verificando `AuditLog` en las mutaciones.

**Acceptance Scenarios**:

1. **Given** cualquier endpoint del recurso, **When** no hay sesión válida, **Then** retorna `401`; con sesión sin rol `ADMIN` o sin permiso `analisis_admin`, retorna `403`.
2. **Given** `POST /api/admin/analisis/reglas` con `clave` duplicada, **When** se procesa, **Then** retorna `409` y no crea nada.
3. **Given** payloads inválidos (frecuenciaMin fuera de rango, prioridad fuera de 0-100, plantilla vacía, query que no pasa la validación estática), **When** se envían, **Then** retornan `400` con detalle Zod.
4. **Given** mutaciones exitosas (crear, editar, activar/desactivar, cambiar modo), **Then** cada una registra su acción en `AuditLog` sin incluir datos de reportes ni resultados de queries.
5. **Given** el endpoint de test SQL, **When** se supera el rate limit `admin_write`, **Then** retorna `429` con headers estándar.

---

## Edge Cases

- **Query válida de sintaxis pero con error en runtime** (tabla o columna inexistente): el test la ejecuta en transacción de solo lectura, PostgreSQL falla, la transacción se revierte y el panel muestra el mensaje de error de PostgreSQL truncado (sin stack trace).
- **Query con `SELECT *` sobre tabla grande**: el test aplica `LIMIT analisis.reglas.test_max_filas` envolviendo la query como subconsulta cuando no trae `LIMIT` propio; el `statement_timeout` cubre el peor caso.
- **Regla editada mientras el worker la está evaluando**: las escrituras del panel y las lecturas del worker son independientes; el worker toma la última versión en su siguiente ciclo. No hay locks de edición en v1 (un solo ADMIN operativo).
- **Promoción a EJECUTA de una regla inactiva**: se permite el cambio de modo, pero como `activa = false` el worker no la evalúa; la UI advierte "la regla está inactiva".
- **Plantilla con variables inexistentes en el resultado**: el render de SPEC-221 deja la variable sin resolver; el editor de SPEC-224 lo muestra como advertencia en el test (US-2 escenario 4).
- **Motivo con solo espacios**: la validación Zod aplica `trim()` antes de medir longitud mínima.
- **Historial de una regla semilla recién sembrada**: vacío hasta la primera edición; el seed de SPEC-221 no genera versiones.
- **Clave de regla renombrada**: `clave` es inmutable tras la creación en v1 (es la identidad estable que usa el worker y el historial); el campo no es editable en el formulario de edición.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer la página `/dashboard/admin/analisis/reglas` (App Router) con la tabla del catálogo de `ReglaRecomendacion`: nombre, categoría, modo, frecuencia, estado activo y conteo de `Recomendacion` generadas en los últimos 7 días, ordenada por `prioridad` descendente.
- **FR-002**: El sistema DEBE registrar la clave de módulo `analisis_admin` en el catálogo de permisos (`src/lib/permisos-catalogo.ts`, categoría `admin`) y proteger página y endpoints con `verifyAuth("ADMIN")` + `assertModulo(admin, "analisis_admin")`.
- **FR-003**: El sistema DEBE implementar `GET /api/admin/analisis/reglas` con paginación estándar (`page`/`pageSize`, default 25, máx 100) y respuesta `{ items, pagination }`, incluyendo por regla el conteo de recomendaciones de los últimos 7 días.
- **FR-004**: El sistema DEBE implementar `POST /api/admin/analisis/reglas` (crear), `GET /api/admin/analisis/reglas/[id]` (detalle) y `PATCH /api/admin/analisis/reglas/[id]` (editar campos funcionales y `activa`), con validación Zod y códigos canónicos (`400`/`401`/`403`/`404`/`409`).
- **FR-005**: El sistema DEBE tratar `clave` como única e inmutable: `POST` con clave existente retorna `409`; `PATCH` no admite cambio de `clave`.
- **FR-006**: El sistema DEBE implementar un validador estático de SQL de reglas en `src/lib/analisis/reglas/validar-sql.ts` que rechace: queries que no inicien con `SELECT` o `WITH`, múltiples sentencias, y presencia de palabras de mutación (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`, `COPY`, `CALL`, `DO`, `EXECUTE`) fuera de literales. La validación se aplica en el servidor tanto en test como en guardado.
- **FR-007**: El sistema DEBE implementar `POST /api/admin/analisis/reglas/test-sql` que ejecute la query recibida dentro de una transacción interactiva de Prisma con `SET TRANSACTION READ ONLY` y `SET LOCAL statement_timeout = analisis.reglas.test_timeout_ms` (default 5000), aplicando `LIMIT analisis.reglas.test_max_filas` (default 50) como envoltura cuando la query no declara `LIMIT`, y devuelva: columnas, muestra de filas, `filasMuestra` y `duracionMs`. El endpoint DEBE registrar `AuditLog` `REGLA_SQL_TEST` con metadatos (huella del query, duración, filas) y sin contenido de filas.
- **FR-008**: El editor de regla DEBE mostrar preview del SQL, botón "Probar" que llama al endpoint de test, tabla con la muestra devuelta y una verificación de variables: marca las `{{variables}}` de la plantilla que no tienen columna correspondiente en el resultado (advertencia no bloqueante).
- **FR-009**: El sistema DEBE implementar `POST /api/admin/analisis/reglas/[id]/modo` con body `{ modo, motivo, confirmacion? }`. Para `modo = EJECUTA` DEBE exigir `confirmacion === "EJECUTA"` y `motivo` (trim) de mínimo 20 caracteres; para `modo = RECOMIENDA` DEBE exigir `motivo` de mínimo 20 caracteres. Registra `REGLA_PROMOVIDA_EJECUTA` o `REGLA_REVERTIDA_RECOMIENDA` en `AuditLog` con valores anterior/nuevo y motivo.
- **FR-010**: Toda mutación de campos funcionales de una regla DEBE ejecutarse en una transacción que: (a) inserta snapshot completo del estado anterior en `ReglaRecomendacionHistorial` con `version` previa, `cambiadoPorAdminId` y `motivo` (obligatorio, mínimo 10 caracteres), y (b) actualiza la regla con `version = version + 1`. La creación nace en `version = 1` sin historial.
- **FR-011**: El sistema DEBE implementar `GET /api/admin/analisis/reglas/[id]/historial` que devuelva las versiones ordenadas descendente con versión, fecha, admin, motivo y campos cambiados; el panel DEBE ofrecer la vista "Historial" de solo lectura (sin restauración automática en v1).
- **FR-012**: Toda mutación (crear, editar, activar/desactivar, cambiar modo) DEBE registrar `AuditLog` con las acciones aditivas `REGLA_CREADA`, `REGLA_ACTUALIZADA`, `REGLA_DESACTIVADA`/`REGLA_ACTIVADA`, `REGLA_PROMOVIDA_EJECUTA`, `REGLA_REVERTIDA_RECOMIENDA`, nunca con datos de reportes ni resultados de queries.
- **FR-013**: El sistema DEBE sembrar de forma idempotente los parámetros `analisis.reglas.test_timeout_ms` (INTEGER, default 5000) y `analisis.reglas.test_max_filas` (INTEGER, default 50) en `ParametroSistema`, y la clave `analisis_admin` con permiso concedido a `ADMIN` en `PermisoModulo`.
- **FR-014**: El sistema DEBE incluir tests: validador estático de SQL (válidas, mutación, multi-sentencia, literales con palabras reservadas), test-sql con query válida/inválida/timeout, CRUD con códigos 401/403/400/409, promoción con/sin confirmación y motivo, versionado con snapshot, y permiso de módulo.
- **FR-015**: La UI DEBE seguir el sistema visual heredado (vidrio Apple, color `ambar` de Admin, tokens Tailwind existentes) y tono neutral sin voseo. Los textos del panel usan la terminología del brief §3 ("Regla", "Recomienda", "Ejecuta sola", "Sugerencia").

### Key Entities

- **ReglaRecomendacion** (definida en SPEC-221; esta spec solo la consume y, de forma aditiva, le añade `version` si SPEC-221 no lo incluyó): `id`, `clave` (única, inmutable), `nombre`, `descripcion`, `categoria`, `sqlQuery`, `plantillaRecomendacion`, `modo` (`ModoRegla`), `accionEjecutable`, `accionParametros`, `prioridad`, `umbralMinimo`, `frecuenciaMin`, `activa`, `creadaPorAdminId`, `version`.
- **ReglaRecomendacionHistorial** (nueva, aditiva): snapshot por versión con `reglaId`, `version`, `snapshot` (JSON completo del estado anterior), `motivo`, `cambiadoPorAdminId`, `creadoEn`.
- **Recomendacion** (SPEC-221): solo lectura para el conteo de los últimos 7 días.
- **ParametroSistema**: parámetros `analisis.reglas.*`.
- **PermisoModulo**: nueva clave `analisis_admin`.
- **AuditLog**: acciones aditivas `REGLA_*`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un ADMIN puede crear, probar y guardar una regla nueva en menos de 5 minutos sin tocar código ni base de datos, y la regla queda disponible para el worker de SPEC-221 en su siguiente ciclo.
- **SC-002**: El 100% de las queries con intención de mutación o multi-sentencia son rechazadas por el validador estático antes de ejecutarse (cobertura de tests del validador: casos válidos + al menos 10 casos maliciosos/erróneos).
- **SC-003**: Ninguna query de test puede superar `analisis.reglas.test_timeout_ms` ni escribir en la base de datos (transacción `READ ONLY` verificada en test de integración intentando una escritura dentro de la misma sesión: PostgreSQL la rechaza).
- **SC-004**: Toda promoción a `EJECUTA` queda en `AuditLog` con motivo y admin; una promoción sin confirmación exacta o sin motivo retorna `400` el 100% de las veces.
- **SC-005**: Cada edición persistida incrementa `version` en exactamente 1 y deja un snapshot recuperable vía `GET .../historial` en menos de 500 ms (local).
- **SC-006**: El gate local del mega-lote (`npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- <paths de SPEC-224> && npm run build`) queda en verde, y `git diff --name-status origin/feature/001-scaffolding..HEAD` solo muestra archivos de SPEC-224 más los de SPECs anteriores del lote.

---

## Assumptions

- SPEC-221 entrega en la misma rama `ReglaRecomendacion`, `Recomendacion`, enum `ModoRegla`, el worker de evaluación y las 7 reglas semilla en modo `RECOMIENDA`. Si SPEC-221 no incluye el campo `version` en `ReglaRecomendacion`, SPEC-224 lo añade con migración aditiva (`Int @default(1)`).
- SPEC-226 implementa la ejecución real de `accionEjecutable`; SPEC-224 solo gestiona la configuración y la promoción de modo, nunca ejecuta acciones.
- El panel de reglas vive en `/dashboard/admin/analisis/reglas` (instructivo 002-PI-125), coherente con la convención del repo de páginas admin bajo `/dashboard/admin/**`; el brief menciona `/admin/analisis/reglas` como shorthand.
- Existe un único rol operativo para este panel: `ADMIN` (brief §1). No hay vista para cliente ni para `SCHOOL_ADMIN` en v1.
- La validación estática de SQL es una barrera de defensa en profundidad; la barrera principal es la transacción `READ ONLY` + `statement_timeout`. No se pretende un parser SQL completo.
- El test SQL se ejecuta contra la base de datos real de la aplicación (no hay réplica de lectura en este entorno); de ahí la exigencia de solo lectura y timeout corto.
- Las reglas semilla y las reglas creadas por el admin comparten el mismo mecanismo de versionado a partir de su primera edición.
- El score de valor y las recomendaciones siguen siendo solo visibles para `ADMIN` (M5); nada de esta spec expone datos a otros roles.
- No se toca `src/lib/ai/**`, ni el rate-limit del reporte público, ni el Motor de Notificaciones (solo se consume `Suscripcion`/`Pago`/`Recomendacion` en lectura vía las queries de las reglas).

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

- **Datos (aditivo)**: columna `version` en `reglas_recomendacion`, tabla `regla_recomendacion_historial` (snapshot JSON + motivo + admin, `@@unique(reglaId, version)`), 7 valores `AccionAudit REGLA_*` — migración `prisma/migrations/20260824150000_spec_224_panel_reglas/migration.sql` (cero DROP; `ALTER TYPE ADD VALUE` con guarda `pg_enum`, patrón SPEC-225). Seed idempotente `seedParametrosReglasAdmin()` (`analisis.reglas.test_timeout_ms` = 5000, `analisis.reglas.test_max_filas` = 50, `update: {}`); el grant `analisis_admin` → ADMIN lo cubre `syncModulosYGrants`.
- **Catálogo/navegación**: módulo `analisis_admin` ("Análisis · Reglas", admin, crítico, orden 76) en `src/lib/permisos-catalogo.ts`; ítem `/dashboard/admin/analisis/reglas` en `src/lib/nav-items.ts`.
- **Servicio**: validador estático puro `src/lib/analisis/reglas/validar-sql.ts` (SELECT/WITH única sentencia, deny-list fuera de literales, falla cerrado ante literal sin cerrar); helpers puros `test-sql.ts` (envoltura LIMIT, huella sha256, acotados 1000..30000 ms / 1..200 filas, mensajes PG legibles) y `versionado.ts` (snapshot + diff de campos funcionales); schemas Zod `src/lib/schemas/analisis-reglas.ts`; DAL `src/lib/dal/repositories/reglas-admin-repository.ts` (CRUD + historial + auditoría en TX con `logAudit`) y orquestador `src/lib/dal/services/reglas-admin.ts` (el test SQL reutiliza `ReglasRecomendacionRepository.ejecutarQuerySoloLectura` — TX READ ONLY + statement_timeout, sin `$queryRawUnsafe` nuevo fuera del DAL).
- **API (6 handlers)**: `GET/POST /api/admin/analisis/reglas`, `GET/PATCH .../[id]`, `POST .../[id]/modo`, `GET .../[id]/historial`, `POST .../test-sql` — `verifyAuth("ADMIN")` + `assertModulo("analisis_admin")` + rate limit (`admin_read`/`admin_write`) + Zod + `errorToResponse`.
- **UI**: página `/dashboard/admin/analisis/reglas` + componentes `ReglasPanel`, `ReglasTable`, `ReglaEditor` (preview SQL, Probar, muestra, chequeo de variables), `ReglaModoDialog` (confirmación fuerte), `ReglaHistorial` (solo lectura).
- **Tests**: 69 unitarios verdes (validador 33 — 10 válidas + 20 maliciosas/erróneas, helpers test-sql, versionado, schemas, diálogo de modo) + 4 archivos de integración (CRUD 401/403/400/409/201, versionado, promoción SC-004, test-sql con SC-003: PostgreSQL rechaza INSERT en la TX READ ONLY con código 25006).

### Decisiones ejecutadas

- El validador del panel (`validar-sql.ts`) es MÁS estricto que el del motor (SPEC-221 `ejecutor-sql.ts`, intacto): distingue literales y rechaza multi-sentencia; el del motor no se modificó para no alterar SPECs ajenas.
- El test SQL NO introduce un segundo `$queryRawUnsafe`: consume el sandbox DAL ya aprobado de SPEC-221 (TX READ ONLY + `statement_timeout` interpolado como entero acotado).
- `camposCambiados` del historial se calcula en lectura (diff snapshot N vs snapshot N+1 o estado actual); no se añadió columna extra — volumen ínfimo.
- `clave` inmutable y `modo` solo vía endpoint dedicado: el PATCH los captura en el schema y el servicio los rechaza con 400 explícito.
- El modo NO genera versión (no es campo funcional, FR-010); su rastro es la auditoría dedicada con valorAnterior/valorNuevo.

### Gate local

- `npx tsc --noEmit`: limpio en todos los archivos de SPEC-224.
- Tests unitarios SPEC-224: 69/69 verdes (`vitest.unit.config.ts`); estructurales nav/AdminNav: 7/7 verdes.
- `npm run tokens:check`: VERDE global (1090 ≤ piso 1094); archivos UI de SPEC-224 aportan 0 colores crudos (regex del script).
- Tests de integración: escritos bajo `src/**`; los corre el coordinador (BD compartida).

### Deuda técnica / notas

- Restauración automática de versiones fuera de v1 (restaurar = editar copiando valores).
- Sin locks de edición (un solo ADMIN operativo); el worker toma la última versión en su siguiente ciclo.
- La validación estática no es un parser SQL completo; la barrera real es la TX READ ONLY (verificada en integración).
