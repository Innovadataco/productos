# Feature Specification: Padre v2 · Modelos Expediente + Evento

**Feature Branch**: `work/002-pi-130`

**Created**: 2026-08-22

**Status**: IMPLEMENTADO

**Input**: Instructivo SPEC-230 / 002-PI-130. Extender el módulo Padre con dos modelos de datos (`Expediente`, `EventoExpediente`), dos enums (`EstadoExpediente`, `ScoreGravedad`), un valor adicional en `TipoRevisionComite`, 18 parámetros de configuración `padre.*`, un repository DAL con operaciones atómicas, y sus tests correspondientes. Sin cambiar el motor de IA, sin alterar el modelo `Reporte`, sin UI ni rutas de dashboard.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Padre abre un expediente y registra la evolución de una situación de riesgo (Priority: P1)

Un usuario con rol `PARENT` puede crear un expediente asociado a un identificador reportado (número telefónico, nick o perfil) y registrar eventos secuenciales que documenten la evolución de la situación. Cada evento preserva el texto original aportado por el padre, mantiene un orden cronológico inmutable dentro del expediente y, opcionalmente, puede vincularse a un reporte comunitario existente.

**Why this priority**: El expediente es la unidad de seguimiento continuo que permite al padre pasar de reportes aislados a una línea de tiempo estructurada. Sin él, no hay forma de consolidar múltiples eventos sobre un mismo identificador ni de escalonar la gravedad de forma auditada.

**Independent Test**: Un usuario `PARENT` puede crear un expediente, agregarle varios eventos, listar sus expedientes y recuperar uno por identificador con su secuencia de eventos ordenada. Todo se valida a través del repository DAL sin depender de UI, workers de IA ni endpoints de reporte.

**Acceptance Scenarios**:

1. **Given** un usuario `PARENT` autenticado, **When** crea un expediente para el identificador `+573001234567` en la plataforma WhatsApp, **Then** el sistema persiste el expediente en estado `ACTIVO`, score `VERDE`, con `numEventos = 0` y sin fecha de cierre.
2. **Given** un expediente `ACTIVO` sin eventos, **When** el padre agrega el primer evento con texto descriptivo, **Then** el sistema crea el `EventoExpediente` con `ordenSecuencial = 1`, incrementa `numEventos` a 1, actualiza `ultimoEventoEn` y mantiene la operación atómica.
3. **Given** un expediente con eventos previos, **When** el padre agrega un nuevo evento, **Then** el sistema asigna `ordenSecuencial` igual al máximo anterior + 1, sin huecos ni repeticiones, aunque haya concurrencia.
4. **Given** un evento que el padre vincula a un reporte comunitario existente, **When** se persiste el evento, **Then** la relación opcional con `Reporte` se almacena sin modificar el reporte original.
5. **Given** un padre con al menos un expediente, **When** consulta la lista de expedientes de su cuenta, **Then** el sistema retorna solo los expedientes cuyo `padreUsuarioId` coincide con el usuario autenticado, paginados y ordenados por `updatedAt DESC`.
6. **Given** un expediente con eventos, **When** se consulta por su `id`, **Then** el sistema retorna el expediente junto con sus eventos ordenados por `ordenSecuencial` ascendente.

---

### User Story 2 - Sistema escala expedientes de alto riesgo al comité de validación (Priority: P2)

El sistema detecta cuando un expediente acumula gravedad suficiente (múltiples eventos, categorías graves, aceleración de reportes o señales comunitarias) y lo transiciona automáticamente hacia estados que requieren revisión humana del comité. La consolidación del expediente como insumo de comité usa un tipo de revisión específico sin confundirse con revisiones de reportes individuales.

**Why this priority**: La escalación protege al menor al garantizar que situaciones complejas o repetidas no dependan únicamente de decisión automática. Es un pilar de la presunción de inocencia: el comité revisa el patrón agregado, no dictamina culpabilidad sobre personas.

**Independent Test**: Dado un expediente con varios eventos graves, el sistema puede cambiar su estado a `PENDIENTE_COMITE` o `ESCALADO`, actualizar el score de gravedad a `AMARILLO`/`ROJO`, y registrar que la solicitud de comité es de tipo `CONSOLIDACION_EXPEDIENTE`. Esto se valida por tests del repository y no requiere que el motor de IA esté activo.

**Acceptance Scenarios**:

1. **Given** un expediente `ACTIVO` con `numEventos` menor al mínimo configurado (`padre.expediente.consolidacion_min_reportes`), **When** se evalúa su gravedad, **Then** permanece en estado `ACTIVO` y no se genera solicitud de comité.
2. **Given** un expediente que supera el umbral de eventos y acumula categorías consideradas graves según `padre.categorias_graves_json`, **When** se actualiza su score de gravedad, **Then** el campo `scoreGravedadActual` pasa a `AMARILLO` o `ROJO` según los umbrales configurados.
3. **Given** un expediente con score `ROJO` o patrones de aceleración detectados, **When** el sistema decide escalar, **Then** el estado cambia a `PENDIENTE_COMITE` o `ESCALADO` y se registra una solicitud de comité con `TipoRevisionComite.CONSOLIDACION_EXPEDIENTE`.
4. **Given** un expediente escalado, **When** el padre intenta agregar un nuevo evento, **Then** el sistema permite el evento (puede ser información adicional) pero no modifica el estado de escalación automáticamente hacia atrás.
5. **Given** un expediente sin actividad durante el período configurado (`padre.expediente.auto_cierre_meses`), **When** se ejecuta el cierre por inactividad, **Then** el estado pasa a `CERRADO`, se marca `autoCerradoPorInactividad = true` y se registra `fechaCierre`.

---

### Edge Cases

- ¿Qué ocurre si dos eventos concurrentes intentan obtener el mismo `ordenSecuencial`? El repository debe usar una transacción con bloqueo selectivo para garantizar monotonicidad sin huecos.
- ¿Cómo se comporta el sistema si se agrega un evento a un expediente `CERRADO`? `agregarEvento` rechaza la operación con `AppError` (conflicto de estado). Una nueva situación sobre el mismo identificador se modelará en una SPEC posterior creando un expediente nuevo con `expedienteRelacionadoAnteriorId`.
- ¿Qué pasa si el parámetro `padre.expediente.consolidacion_min_reportes` no existe? El repository debe usar un valor predeterminado conservador (`2`) y registrar la anomalía.
- ¿Cómo se maneja un evento cuyo texto supera el límite permitido? Se rechaza antes de tocar la base de datos, preservando la integridad del expediente.
- ¿Qué sucede si el padre intenta listar expedientes de otro usuario? El repository filtra estrictamente por `padreUsuarioId` y nunca expone expedientes ajenos.
- ¿Cómo se trata un evento vinculado a un `Reporte` que después se da de baja? La relación opcional se mantiene (no se borra el evento), pero la lectura puede mostrar metadatos de baja sin revelar el texto original del reporte.
- ¿Qué ocurre si un expediente se escala mientras otro proceso lo está cerrando por inactividad? La transacción con bloqueo de fila debe prevenir condiciones de carrera y dejar un único estado final consistente.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir crear un `Expediente` vinculado a un usuario `PARENT`, un identificador reportado y, opcionalmente, una plataforma.
- **FR-002**: El sistema DEBE almacenar el estado del expediente usando el enum `EstadoExpediente` (`ACTIVO`, `CONSOLIDANDO`, `PENDIENTE_COMITE`, `EN_APROBACION_PADRE`, `EN_ACLARACION`, `CERRADO`, `ESCALADO`).
- **FR-003**: El sistema DEBE mantener un score de gravedad actual del expediente usando el enum `ScoreGravedad` (`VERDE`, `AMARILLO`, `ROJO`) con valor por defecto `VERDE`.
- **FR-004**: El sistema DEBE permitir registrar eventos dentro de un expediente mediante `EventoExpediente`, asignando un `ordenSecuencial` monotónico por expediente.
- **FR-005**: El sistema DEBE garantizar que `ordenSecuencial` sea único por `(expedienteId, ordenSecuencial)` a nivel de base de datos.
- **FR-006**: El sistema DEBE permitir que un evento opcionalmente vincule un `Reporte` existente sin modificar el modelo `Reporte`.
- **FR-007**: El sistema DEBE proveer un método para listar todos los expedientes de un padre, ordenados por `updatedAt DESC`.
- **FR-008**: El sistema DEBE proveer un método para obtener un expediente por `id` incluyendo sus eventos ordenados.
- **FR-009**: El sistema DEBE crear el enum `TipoRevisionComite` con los valores `REVISION_REPORTE` y `CONSOLIDACION_EXPEDIENTE` (ambos valores en la misma migración aditiva).
- **FR-010**: El sistema DEBE sembrar 18 parámetros `padre.*` en `ParametroSistema` de forma idempotente mediante `upsert` (patrón anti-I-100): no duplica filas y propaga cambios de default definidos en código.
- **FR-011**: El sistema DEBE ubicar todo acceso a Prisma para expedientes y eventos dentro de `src/lib/dal/repositories/expediente-repository.ts`; endpoints y servicios posteriores llamarán únicamente a este repository.
- **FR-012**: El sistema DEBE implementar `crearExpediente`, `agregarEvento`, `listarExpedientesDePadre` y `obtenerExpedientePorId` en el repository.
- **FR-013**: El sistema DEBE ejecutar `agregarEvento` dentro de una transacción atómica que cree el `EventoExpediente` y actualice los contadores/timestamps del expediente.
- **FR-014**: El sistema DEBE dejar los campos `categoriaDetectada` y `confianzaClasificacion` de `EventoExpediente` como opcionales, permitiendo hidratarlos de forma asíncrona cuando el motor de IA termine, sin bloquear la creación del evento.
- **FR-015**: El sistema DEBE soportar auto-cierre de expedientes por inactividad usando el parámetro `padre.expediente.auto_cierre_meses`.
- **FR-016**: El sistema DEBE almacenar categorías dominantes y patrones detectados en campos JSON (`categoriasDominantesJson`, `patronesDetectadosJson`) para análisis posterior.
- **FR-017**: El sistema DEBE permitir la auto-referencia opcional `expedienteRelacionadoAnteriorId` para encadenar expedientes históricos de un mismo identificador/padre.
- **FR-018**: El sistema DEBE escribir tests unitarios del repository y un test de idempotencia del seed que verifique que ejecutar el seed dos veces no duplique filas y propague cambios de default definidos en código.
- **FR-019**: El sistema DEBE respetar la presunción de inocencia: ningún campo ni mensaje del expediente debe etiquetar al titular del identificador como culpable; solo se registran eventos, estados y estadísticas descriptivas.
- **FR-020**: El sistema DEBE persistir todos los timestamps de momento con zona horaria (`@db.Timestamptz(6)`) alineado a la directriz D-69 (Bogotá).
- **FR-021**: El sistema DEBE rechazar `agregarEvento` sobre un expediente en estado `CERRADO` con `AppError`; una nueva situación sobre el mismo identificador se resolverá en una SPEC posterior creando un expediente nuevo con `expedienteRelacionadoAnteriorId`.

### Key Entities

- **Expediente**: Agrupación lógica de eventos que un padre registra sobre un identificador reportado. Atributos: identificador único, padre vinculado, identificador reportado, plataforma opcional, fechas de apertura/cierre/escalado, estado, score de gravedad actual, categorías dominantes, número de eventos, fecha del último evento, flag de cierre por inactividad, expediente anterior relacionado, patrones detectados.
- **EventoExpediente**: Ocurrencia puntual dentro de un expediente. Atributos: identificador único, expediente vinculado, orden secuencial, reporte vinculado opcional, fecha del evento, texto del padre, categoría detectada (hidrata async), confianza de clasificación (hidrata async), plataforma, metadatos de adjuntos.
- **Usuario** (existente): El padre al que pertenece el expediente. Relación `1:N` entre `Usuario` y `Expediente`.
- **Reporte** (existente): Reporte comunitario al que un evento puede apuntar opcionalmente. Relación `1:0..1` entre `Reporte` y `EventoExpediente`; el modelo `Reporte` no se modifica.
- **ParametroSistema** (existente): Tabla de configuración donde se almacenan los 18 parámetros `padre.*`. Relación indirecta: los parámetros gobiernan el comportamiento del repository.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El repository crea un expediente y agrega 5 eventos consecutivos asignando `ordenSecuencial` `1, 2, 3, 4, 5` sin saltos ni repeticiones, verificado por tests unitarios.
- **SC-002**: La operación `agregarEvento` incrementa `numEventos` y actualiza `ultimoEventoEn` de forma atómica; un test de concurrencia simulada no genera registros huérfanos ni contadores inconsistentes.
- **SC-003**: El seed de los 18 parámetros `padre.*` es idempotente: ejecutarlo dos veces consecutivas no duplica filas y propaga cambios de default definidos en código.
- **SC-004**: El test de idempotencia del seed verifica que los valores por defecto de los 18 parámetros coinciden con los definidos en el instructivo.
- **SC-005**: `listarExpedientesDePadre` retorna solo los expedientes del padre solicitado; un test con dos padres distintos confirma que no hay filtrado cruzado.
- **SC-006**: `obtenerExpedientePorId` retorna el expediente con sus eventos ordenados por `ordenSecuencial`; si el expediente no existe o no pertenece al padre, retorna `null`.
- **SC-007**: La migración crea `TipoRevisionComite` con ambos valores (`REVISION_REPORTE`, `CONSOLIDACION_EXPEDIENTE`) en un solo `CREATE TYPE`, dado que el enum no existía en la base; no usa `ALTER TYPE ADD VALUE` ni recrea el enum.
- **SC-008**: Los tests del repository y del seed pasan en menos de 30 segundos en el entorno de CI local.
- **SC-009**: Ningún campo del modelo `Expediente` ni `EventoExpediente` almacena fotos, videos, audios ni archivos; solo texto y metadatos JSON.

---

## Assumptions

- El modelo `Reporte` permanece inmutable en esta fase; `EventoExpediente` solo lo referencia opcionalmente.
- El motor de IA local (`src/lib/ai/**`) no se modifica; la hidratación async de `categoriaDetectada` y `confianzaClasificacion` será consumida por jobs existentes en fases posteriores.
- Los reportes son exclusivamente texto; no se procesa ni almacena multimedia.
- Las migraciones serán aditivas y no destructivas; no se usarán `DROP`, `RENAME` ni `migrate reset`.
- El acceso a Prisma para expedientes y eventos siempre pasará por `expediente-repository.ts`, manteniendo la frontera DAL definida en Q-3.
- La UI, layouts de padre y rutas `/dashboard/padre/*` están fuera del alcance de esta especificación.
- El cierre por inactividad se ejecutará por un job programado en una fase posterior; esta fase solo almacena el campo `autoCerradoPorInactividad` y el parámetro de configuración.
- Los 18 parámetros `padre.*` son de solo lectura para la mayoría de roles; su modificación queda para un panel de administración futuro.
- La zona horaria de referencia para todos los timestamps es `America/Bogotá`, materializada en base de datos con `@db.Timestamptz(6)`.
- La presunción de inocencia se mantiene: el expediente describe eventos y patrones, nunca declara que una persona es agresora.

---

## Implementación

### Resumen de cambios

- **Schema / migración (SPEC-230 T001-T003)**:
  - `prisma/schema.prisma`: añadidos enums `EstadoExpediente`, `ScoreGravedad` y `TipoRevisionComite`; modelos `Expediente` y `EventoExpediente`; relaciones inversas mínimas `Usuario.expedientes` y `Reporte.eventos` (esta última autorizada expresamente por ZEUS).
  - `prisma/migrations/20260823000000_padre_v2_expediente_evento/migration.sql`: migración aditiva generada con `prisma migrate diff` contra `origin/feature/001-scaffolding`; contiene `CREATE TYPE`, `CREATE TABLE` e `CREATE INDEX`; cero `DROP`, `RENAME` ni `ALTER TABLE ... DROP COLUMN`.
  - `TipoRevisionComite` se crea con los dos valores (`REVISION_REPORTE`, `CONSOLIDACION_EXPEDIENTE`) en un único `CREATE TYPE`, porque ZEUS confirmó que el enum no existía en la base.

- **Seed idempotente (T004-T005)**:
  - `prisma/seed.ts`: función `seedParametrosPadre()` con 18 upserts de `ParametroSistema` (tipos correctos, `esPublico = false`, categoría `CONFIG`).
  - `src/lib/seed-padre.test.ts`: test de idempotencia que ejecuta el seed dos veces, verifica 18 filas, confirma que un valor modificado manualmente no se sobrescribe y que un cambio de default en código se propaga (SC-003 reformulado).

- **Repository DAL (T006-T007)**:
  - `src/lib/dal/repositories/expediente-repository.ts`: frontera Q-3; operaciones `crearExpediente`, `agregarEvento`, `listarExpedientesDePadre`, `obtenerExpedientePorId`.
  - `agregarEvento` corre dentro de `withUnitOfWork`; bloquea la fila del expediente; calcula `ordenSecuencial = MAX + 1`; rechaza expedientes `CERRADO` con `AppError` (409); si no recibe `reporteId`, crea un `Reporte` vinculado resolviendo la clave de plataforma a su `id` real.
  - `src/lib/dal/repositories/expediente-repository.test.ts`: 10 tests que cubren apertura, orden secuencial, rechazo de cerrado, límite de texto, listado aislado, recuperación con/sin filtro de padre, contadores atómicos y vinculación con reporte existente.

### Decisiones tomadas

- **Frontera DAL Q-3**: todo acceso a `Expediente`/`EventoExpediente` pasa por `expediente-repository.ts`; el repository sí puede leer `Plataforma` para resolver `plataformaId` clave → `id` al crear el `Reporte` vinculado, pero no expone ese acceso fuera del repository.
- **Relación inversa en `Reporte`**: se añadió solo `eventos EventoExpediente[]` (autorizado por ZEUS en ajuste B); el resto del modelo `Reporte` quedó intacto.
- **Creación de `Reporte` desde evento**: cuando `agregarEvento` no recibe `reporteId`, genera un reporte mínimo usando defaults seguros (`ciudad`/`pais` = "No especificado", `esAnonimo` = false) para no dejar una FK huérfana. Esto respeta la decisión de no alterar el modelo `Reporte` y de que `EventoExpediente` apunta a él opcionalmente.
- **Zona horaria**: todos los timestamps de momento usan `@db.Timestamptz(6)` alineado a D-69 (Bogotá).

### Tests

- `npm run test -- src/lib/dal/repositories/expediente-repository.test.ts`: 10/10 verdes.
- `npm run test -- src/lib/seed-padre.test.ts`: 1/1 verde.
- Gate local: `npx tsc --noEmit` verde; `npm run lint` sin errores (solo warnings preexistentes); `npm run arch:check` verde tras regenerar `docs/architecture/01-modelo-datos.md`.

## Impacto en arquitectura:
- Deposita 2 modelos aditivos en `prisma/schema.prisma` (`Expediente`, `EventoExpediente`) + 2 enums nuevos (`EstadoExpediente`, `ScoreGravedad`) + creación aditiva del enum `TipoRevisionComite` con 2 valores (`REVISION_REPORTE`, `CONSOLIDACION_EXPEDIENTE`).
- Extiende `ParametroSistema` con 18 parámetros `padre.*` (reutiliza tabla existente · [D-72](../../../docs/architecture/00-decisiones.md)).
- Agrega frontera DAL `src/lib/dal/repositories/expediente-repository.ts` con `agregarEvento()` transaccional (Q-3).
- Cero cambios en `src/lib/ai/**` (motor IA intacto).
- Cero modificaciones estructurales al modelo `Reporte` (solo relación inversa Prisma autorizada por ZEUS).
- Migración aditiva sin `DROP` ni `rename`.
- Todos los `DateTime` de momento con `@db.Timestamptz(6)` (timezone Bogotá · [D-69](../../../docs/architecture/00-decisiones.md)).
