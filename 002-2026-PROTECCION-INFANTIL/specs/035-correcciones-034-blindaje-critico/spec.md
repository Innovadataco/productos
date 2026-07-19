# Feature Specification: Correcciones del 034 + blindaje crítico

**Feature Branch**: `[035-correcciones-034-blindaje-critico]`

**Created**: 2026-07-19

**Status**: EN PLANIFICACIÓN

**Input**: Ajustes derivados del cierre del spec 034 y blindaje de infraestructura crítica: (1) COMITE_VALIDACION aterriza en vistas públicas/PARENT al entrar a "Mi bandeja"; (2) el editor de grupos de categoría lee mal el valor del parámetro y no persiste; (3) la migración de reintentos eliminó los índices HNSW de embeddings y no los recreó; (4) la lógica de middleware en `src/proxy.ts` no está activa como middleware real; (5) el seed no es 100% idempotente y el password de admin tiene default en no-producción; (6) no hay garantía de un solo worker.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bandeja del comité (Priority: P1)

Un usuario con rol `COMITE_VALIDACION`, tras iniciar sesión o al hacer clic en "Mi bandeja", debe permanecer dentro del área de administración (`/dashboard/admin/comite`). Hoy termina en el home público porque el build `.next` desplegado no refleja el código fuente del layout admin, que ya incluye a `COMITE_VALIDACION` como rol interno.

**Why this priority**: El comité es un rol interno con responsabilidades de validación; si aterriza en vistas públicas o PARENT pierde el contexto de trabajo y puede exponer funciones incorrectas.

**Independent Test**: Un usuario `COMITE_VALIDACION` inicia sesión y navega a "Mi bandeja"; el navegador se mantiene en `/dashboard/admin/comite` sin redirigirse a `/` ni a `/mis-reportes`.

**Acceptance Scenarios**:

1. **Given** un usuario `COMITE_VALIDACION` que inicia sesión, **When** el login es exitoso, **Then** el sistema lo redirige a `/dashboard/admin/comite`.
2. **Given** un usuario `COMITE_VALIDACION` logueado, **When** hace clic en "Mi bandeja" del menú, **Then** navega a `/dashboard/admin/comite` y no es redirigido fuera del área admin.
3. **Given** un usuario `COMITE_VALIDACION`, **When** accede directamente a `/dashboard/admin/comite` tras un deploy limpio (`rm -rf .next && npm run build`), **Then** el layout admin le permite ver la bandeja.
4. **Given** un usuario `COMITE_VALIDACION`, **When** intenta acceder a `/mis-reportes` o `/dashboard/circulo-confianza`, **Then** es redirigido a `/dashboard/admin/comite`.
5. **Given** un usuario `COMITE_VALIDACION`, **When** el middleware perimetral está activo (US4) y `COMITE_VALIDACION` figura como rol interno, **Then** puede acceder a `/dashboard/admin/comite` y es rechazado en rutas de usuario final.

### User Story 2 - Persistencia del editor de grupos (Priority: P1)

El administrador edita los grupos de categoría en Configuración. Aunque el PATCH ahora hace upsert, el editor sigue leyendo `data.parametro?.valor` mientras el endpoint devuelve `data.valor`, por lo que siempre cae al fallback y los cambios no se reflejan tras recargar.

**Why this priority**: Sin la lectura correcta, el administrador no puede verificar lo que guardó, el parámetro no se usa en las vistas de usuario y el upsert pierde sentido.

**Independent Test**: Un admin guarda un cambio en los grupos de categoría, recarga la página y ve el valor guardado; las vistas de usuario (consulta, seguimiento) muestran los grupos actualizados.

**Acceptance Scenarios**:

1. **Given** que el parámetro `ui.grupos_categoria` existe con un valor guardado, **When** el admin abre el editor, **Then** se lee `data.valor` (no `data.parametro?.valor`) y se muestra el valor guardado.
2. **Given** un cambio guardado en el editor, **When** el admin recarga la página, **Then** el cambio persiste y no se muestra el fallback.
3. **Given** un cambio guardado, **When** un usuario final accede a una vista que usa grupos de categoría, **Then** ve los grupos actualizados (invalidar caché si existe).
4. **Given** otro componente de Configuración que lee parámetros, **When** se revisa el patrón de lectura, **Then** se corrige si también usa `data.parametro?.valor` en lugar de `data.valor`.
5. **Given** el editor con el fallback cargado, **When** el admin guarda por primera vez, **Then** se crea el parámetro y el siguiente reload muestra el valor guardado.

### User Story 3 - Índices vectoriales hnsw (Priority: P1)

La migración `20260718094450_add_reintento_reporte` eliminó los índices `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx` y no los recreó. Las búsquedas de similitud (RAG/dedup) ahora hacen sequential scan, lo que impacta la clasificación IA y el dataset de entrenamiento.

**Why this priority**: Los índices HNSW son esenciales para búsqueda por similitud en embeddings; sin ellos, el sistema no escala y el pipeline de IA se degrada.

**Independent Test**: Después de aplicar las migraciones, los índices HNSW existen y se verifican mediante un script; las consultas de similitud usan el índice.

**Acceptance Scenarios**:

1. **Given** una base de datos migrada desde cero, **When** se ejecuta `prisma migrate deploy`, **Then** existen los índices `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx` de tipo hnsw.
2. **Given** una base de datos que ya pasó por la migración que borró los índices, **When** se aplica la nueva migración aditiva, **Then** los índices se recrean sin pérdida de datos.
3. **Given** el script de verificación post-migración, **When** falta algún índice, **Then** el script falla con código distinto de cero.
4. **Given** el script de verificación, **When** todos los índices existen, **Then** el script termina con código 0.
5. **Given** la aplicación en ejecución, **When** se realiza una búsqueda por similitud, **Then** el plan de ejecución muestra uso del índice hnsw (no sequential scan).

### User Story 4 - Middleware perimetral (Priority: P1)

El archivo `src/proxy.ts` contiene la lógica de protección de rutas pero no existe `src/middleware.ts` ni Next.js lo ejecuta. Además, `esRolInterno` en `src/proxy.ts` no incluye `COMITE_VALIDACION`, lo que dejaría fuera al comité si se activa el middleware.

**Why this priority**: Sin middleware perimetral, las protecciones de rutas dependen únicamente de guards en páginas/endpoints. La defensa en profundidad requiere un middleware que intercepte antes de llegar al handler.

**Independent Test**: Con `src/middleware.ts` activo, una petición sin sesión a una ruta protegida es redirigida a login; un rol interno en una ruta de usuario final es redirigido a su área.

**Acceptance Scenarios**:

1. **Given** una petición sin sesión a `/dashboard/admin`, **When** el middleware la intercepta, **Then** redirige a `/login`.
2. **Given** una petición sin sesión a `/api/admin/reportes-revision`, **When** el middleware la intercepta, **Then** responde con 401.
3. **Given** un usuario `COMITE_VALIDACION` con sesión, **When** accede a `/dashboard/admin/comite`, **Then** el middleware lo deja pasar.
4. **Given** un usuario `OPERADOR` con sesión, **When** accede a `/mis-reportes`, **Then** el middleware lo redirige a `/dashboard/admin`.
5. **Given** un usuario `PARENT` con sesión, **When** accede a `/dashboard/admin`, **Then** el middleware lo redirige a `/mis-reportes` o `/`.
6. **Given** el middleware activo, **When** se accede a una ruta pública como `/consulta`, **Then** permite el tráfico anónimo.
7. **Given** los cinco roles (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`), **When** se prueba cada uno en sus rutas permitidas y prohibidas, **Then** el comportamiento es consistente y no hay lockout.

### User Story 5 - Datos idempotentes (Priority: P1)

El seed de Prisma no es 100% idempotente: `usuario.create` para admin usa un password por default en no-producción; `casoEval.createMany` y `datasetEntrenamiento.create` verifican por conteo pero no permiten re-ejecución limpia. El deploy debe documentar `prisma migrate deploy` como único método y ningún script debe invocar `migrate dev` o `migrate reset`.

**Why this priority**: Un seed idempotente permite recrear entornos de forma confiable y evita duplicados o datos inconsistentes. La seguridad exige que el password de admin nunca tenga default.

**Independent Test**: Ejecutar `npx prisma db seed` dos veces seguidas no genera duplicados ni errores; ejecutar sin `ADMIN_PASSWORD` falla si el admin no existe.

**Acceptance Scenarios**:

1. **Given** una base de datos vacía, **When** se ejecuta el seed sin `ADMIN_PASSWORD`, **Then** falla con mensaje claro.
2. **Given** una base de datos con el admin ya creado, **When** se ejecuta el seed, **Then** no se modifica el usuario admin (upsert por email).
3. **Given** una base de datos con casos de evaluación SEMILLA, **When** se ejecuta el seed, **Then** no se crean duplicados.
4. **Given** una base de datos con ejemplos de spam, **When** se ejecuta el seed, **Then** no se crean duplicados.
5. **Given** el script de deploy, **When** se revisa su contenido, **Then** no contiene `migrate dev`, `migrate reset` ni `db push`.
6. **Given** la documentación de despliegue, **When** se describe el proceso de migración, **Then** se indica `prisma migrate deploy` como único método permitido.

### User Story 6 - Worker de instancia única (Priority: P2)

El supervisor del worker puede lanzar un segundo worker si se invoca manualmente o por error. Esto genera duplicación de procesamiento de colas y posibles condiciones de carrera.

**Why this priority**: El principio de un solo worker ya está en AGENTS.md. Garantizarlo con un lock de Postgres previerte errores operativos sin depender de PM2.

**Independent Test**: Al intentar iniciar dos workers, el segundo detecta el lock y sale limpiamente con un mensaje informativo.

**Acceptance Scenarios**:

1. **Given** un worker en ejecución, **When** se intenta iniciar otro, **Then** el segundo obtiene el advisory lock, falla, y termina con código distinto de cero.
2. **Given** el primer worker terminado, **When** se inicia otro, **Then** obtiene el lock y arranca normalmente.
3. **Given** el graceful shutdown existente, **When** el worker recibe SIGTERM, **Then** libera el advisory lock antes de salir.
4. **Given** un lock de worker existente, **When** el proceso que lo posee muere inesperadamente, **Then** el lock se libera automáticamente (advisory lock de sesión).

---

## Edge Cases

- **US1**: ¿Qué pasa si el usuario COMITE_VALIDACION tiene un token inválido? El middleware y el layout admin lo redirigen a `/login`.
- **US2**: ¿Qué ocurre si el JSON guardado es inválido? El editor debe caer al fallback, mostrar advertencia, y permitir guardar un valor nuevo.
- **US3**: ¿Qué pasa si pgvector no soporta hnsw? La migración usa `CREATE INDEX IF NOT EXISTS ... USING hnsw` y el script de verificación falla si no existe.
- **US4**: ¿Qué pasa con las rutas API anónimas como `/api/reportes` POST? El middleware debe permitirlas si están en la lista de rutas públicas.
- **US5**: ¿Qué pasa si el admin cambia su password y luego se corre el seed? El upsert no debe sobreescribir la password ni el rol.
- **US6**: ¿Qué pasa si el worker se ejecuta en un entorno sin acceso a la BD? El intento de obtener el lock falla y el worker sale.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tras un deploy limpio (`rm -rf .next && npm run build`), el build debe reflejar el código fuente actual de `src/app/dashboard/admin/layout.tsx`, que ya reconoce `COMITE_VALIDACION` como rol interno.
- **FR-002**: `src/middleware.ts` (derivado de `src/proxy.ts`) debe incluir `COMITE_VALIDACION` en el conjunto de roles internos, para que no redirija al comité fuera del área admin.
- **FR-003**: `src/app/login/page.tsx` ya redirige a `COMITE_VALIDACION` a `/dashboard/admin/comite`; no requiere cambios, solo verificación tras deploy limpio.
- **FR-004**: `CategoriaGruposEditor.tsx` debe leer el valor del parámetro desde `data.valor` (nivel superior de la respuesta), no desde `data.parametro?.valor`.
- **FR-005**: Tras guardar `ui.grupos_categoria`, debe invalidarse cualquier caché que consuma ese parámetro (p. ej. `getParametroSistema` si cachea).
- **FR-006**: Otros consumidores de `GET /api/config/parametros/[clave]` deben usar `data.valor` si también usaban el patrón incorrecto.
- **FR-007**: Debe crearse una migración aditiva que recree los índices `EmbeddingReporte_vector_idx` y `EmbeddingDataset_vector_idx` usando `USING hnsw`.
- **FR-008**: Debe existir un script de verificación post-migración que falle si los índices hnsw no existen.
- **FR-009**: Debe existir `src/middleware.ts` que exporte la función `middleware` y use un matcher que cubra `/dashboard/admin/:path*`, `/api/admin/:path*`, `/mis-reportes` y `/dashboard/:path*`, excluyendo estáticos (`/_next/static`, `/_next/image`, `favicon.ico`, archivos estáticos).
- **FR-010**: `src/middleware.ts` debe reutilizar la lógica de `src/proxy.ts` y definir explícitamente: (a) rutas públicas; (b) roles internos `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`; (c) redirección de roles internos fuera de rutas PARENT; (d) redirección de PARENT y anónimos fuera de rutas admin.
- **FR-011**: `verifyAuth` debe seguirse usando en endpoints como defensa en profundidad.
- **FR-012**: `prisma/seed.ts` debe usar `upsert` para el usuario admin por email y fallar si `ADMIN_PASSWORD` no está definido cuando el admin no existe. No debe haber password default en ningún entorno.
- **FR-013**: `prisma/seed.ts` debe hacer idempotentes las inserciones de casos de evaluación SEMILLA y ejemplos de spam. Para `casoEval.createMany` (que no soporta `upsert`) se debe convertir a un loop de `findFirst` + `create`/`update` por clave natural (`texto + fuente + fixtureVersion`). Para los ejemplos de spam se debe usar el mismo patrón (`texto + fuente`).
- **FR-014**: Ningún script de deploy debe invocar `prisma migrate dev`, `prisma migrate reset` ni `prisma db push`.
- **FR-015**: El worker debe obtener un advisory lock de Postgres al inicio; si no lo obtiene, debe salir inmediatamente.
- **FR-016**: El worker debe liberar el advisory lock al recibir señal de terminación.

### Key Entities

- **Usuario**: roles relevantes `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`.
- **ParametroSistema**: clave `ui.grupos_categoria` y otros parámetros editables.
- **EmbeddingReporte / EmbeddingDataset**: tablas con columna `vector` e índices hnsw.
- **Middleware**: `src/middleware.ts` de Next.js.
- **Worker**: `scripts/worker-supervisor.mjs` y `scripts/worker-reportes.mjs`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario `COMITE_VALIDACION` accede a `/dashboard/admin/comite` tras login y permanece ahí al navegar por "Mi bandeja".
- **SC-002**: El editor de grupos de categoría muestra el valor guardado tras recargar la página en el 100% de los casos.
- **SC-003**: Los índices hnsw existen tras `prisma migrate deploy` y el script de verificación pasa.
- **SC-004**: El middleware intercepta peticiones sin sesión a rutas protegidas y redirige/retorna 401 en el 100% de los casos.
- **SC-005**: Ejecutar el seed dos veces no genera duplicados ni errores.
- **SC-006**: Iniciar un segundo worker mientras otro corre produce salida inmediata con código distinto de cero.
- **SC-007**: `npm run test` continúa pasando con 0 tests nuevos fallidos.

---

## Assumptions

- El rol `COMITE_VALIDACION` ya existe y tiene acceso al layout de administración.
- El endpoint `GET /api/config/parametros/[clave]` devuelve el valor en el nivel superior (`data.valor`).
- La base de datos usa PostgreSQL 16+ con extensión pgvector y soporte para índices hnsw.
- El middleware de Next.js puede validar el JWT de la cookie sin necesidad de Prisma.
- El worker se conecta a la misma base de datos que la aplicación.
- No se requieren cambios en el modelo de datos de Prisma para este spec (las migraciones SQL son aditivas).

---

## Implementación

### Resumen por User Story

- **US1 — Bandeja del comité**: No se modificaron `src/app/login/page.tsx`, `src/app/dashboard/admin/layout.tsx` ni `src/components/modules/NavHeader.tsx` porque el código fuente ya reconocía `COMITE_VALIDACION`. Se ejecutó `rm -rf .next && npm run build` para regenerar el build desplegado. El flujo se validó con un usuario `COMITE_VALIDACION`: login redirige a `/dashboard/admin/comite`, acceso a `/mis-reportes` y `/dashboard/circulo-confianza` redirige a `/dashboard/admin/comite`.
- **US2 — Persistencia del editor de grupos**: Se corrigió `src/components/modules/CategoriaGruposEditor.tsx` para leer `data.valor` en lugar de `data.parametro?.valor`. Se buscó el patrón `data.parametro?.valor` en consumidores de `GET /api/config/parametros/[clave]` y no se encontraron más casos. La invalidación de caché `public_params` ya estaba presente en el PATCH del endpoint.
- **US3 — Índices HNSW**: Se creó la migración aditiva `prisma/migrations/20260719095000_recrear_indices_hnsw_embeddings/migration.sql` que recrea ambos índices con `CREATE INDEX IF NOT EXISTS ... USING hnsw`. Se creó `scripts/verify-hnsw-indexes.ts` para fallar si los índices no existen o no son HNSW. `npx prisma migrate deploy` los aplicó correctamente.
- **US4 — Middleware perimetral**: Se extrajo la lógica de `src/proxy.ts` a `src/lib/proxy.ts` y se usó `src/proxy.ts` como entrypoint de middleware (convención requerida por Next.js 16.2.10, ya que `src/middleware.ts` estaba deprecado y no ejecutaba la lógica actualizada). Se incluyó `COMITE_VALIDACION` en los roles internos y se definieron redirecciones por rol. Se probaron los 5 roles (ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION) sin lockout.
- **US5 — Seed idempotente**: Se convirtió la creación del admin en `upsert` por email y se exige `ADMIN_PASSWORD` si el admin no existe; se eliminó cualquier password por default. Se reemplazaron `casoEval.createMany` y `datasetEntrenamiento.create` por loops de `findFirst` + `create`/`update` por clave natural. Se cambió `package.json` para que `db:migrate` use `prisma migrate deploy` y no `migrate dev`.
- **US6 — Worker de instancia única**: Se agregó advisory lock de Postgres (`pg_try_advisory_lock`) al inicio de `scripts/worker-reportes.mjs` usando una conexión dedicada de `pg`. El lock se libera en shutdown (SIGTERM/SIGINT) y se libera automáticamente si el proceso muere. Un segundo worker obtiene el lock, imprime el mensaje y sale con código 2.

### Validación final

- `npx tsc --noEmit` — sin errores.
- `npm run lint` — 0 errores (2 warnings preexistentes).
- `npm run test` — 409 tests pasaron, 0 fallidos.
- `npx prisma migrate deploy` — migración aditiva aplicada.
- `scripts/verify-hnsw-indexes.ts` — índices HNSW presentes.
- `npx prisma db seed` ejecutado 2 veces — idempotente, sin duplicados.
- Prueba manual de middleware con curl — comportamiento correcto para los 5 roles.
- Prueba manual de worker — segundo worker sale con código distinto de cero.
- `./scripts/dev-restart.sh` — deploy limpio exitoso, healthcheck OK, un solo worker.

### Decisiones y deuda técnica

- Se usó `src/proxy.ts` como entrypoint de middleware en lugar de `src/middleware.ts` porque Next.js 16.2.10 marca `middleware.ts` como deprecado y con `src/middleware.ts` el build no ejecutaba la lógica actualizada (redirigía a `/` para `COMITE_VALIDACION`). La lógica de protección y la matriz de roles se mantienen en `src/lib/proxy.ts` y son funcionales.
- No se añadieron tests automatizados del middleware; se cubrió con prueba manual de curl. Se recomienda agregarlos cuando la convención de Next.js se estabilice.

---

## Success Criteria *(post-implementación)*

- **SC-001**: `COMITE_VALIDACION` accede a `/dashboard/admin/comite` y permanece ahí al navegar por "Mi bandeja`. ✅
- **SC-002**: El editor de grupos de categoría lee `data.valor` y el valor guardado persiste tras recarga. ✅
- **SC-003**: Índices HNSW existen tras `prisma migrate deploy` y el script de verificación pasa. ✅
- **SC-004**: El middleware intercepta peticiones sin sesión y redirige/retorna 401. ✅
- **SC-005**: Ejecutar el seed dos veces no genera duplicados ni errores. ✅
- **SC-006**: Segundo worker obtiene lock, imprime mensaje y sale con código != 0. ✅
- **SC-007**: `npm run test` continúa pasando. ✅
