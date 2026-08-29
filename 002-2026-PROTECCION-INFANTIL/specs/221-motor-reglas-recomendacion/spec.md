# Feature Specification: SPEC-221 — Motor de reglas de recomendación

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: PLANEADO

**Dependencia bloqueante**: SPEC-220 (modelo de análisis dinero-vs-valor + score de valor, radicación 002-PI-121) debe estar implementado en la misma rama del mega-lote antes de esta spec: aporta los parámetros `analisis.*` base, el `ScoreCliente` que alimenta el contexto de las reglas y el seed de parámetros del namespace `analisis.*`. SPEC-INFRA-SESSION-LOG (002-PI-120) y Módulo Pagos (SPEC-210) ya están en la rama.

Impacto en arquitectura: añade los modelos `ReglaRecomendacion` y `Recomendacion` (aditivos), el motor de evaluación en `src/lib/analisis/reglas/`, un worker periódico `scripts/worker-analisis-reglas.mjs` con advisory lock propio, el endpoint admin `POST /api/admin/analisis/recomendaciones/[id]/resolver`, parámetros `analisis.recomendaciones.*` y el seed idempotente de 7 reglas semilla en modo `RECOMIENDA`.

**Input**: El brief `BRIEF-ANALISIS-DINERO-VS-VALOR.md` (§8 acciones automatizables, §9 anatomía de reglas) define un motor de reglas configurables que detecta candidatos vía SQL parametrizado, genera `Recomendacion` por cada candidato y las resuelve en dos modos: `RECOMIENDA` (humano decide, default no-negociable D-77) o `EJECUTA` (el sistema actúa solo, requiere consentimiento explícito del admin con motivo auditado). Esta spec construye el motor, el worker y las reglas semilla; la ejecución automática de acciones queda en SPEC-226 y el panel de edición en SPEC-224.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El motor evalúa reglas y genera recomendaciones (Priority: P1)

Como sistema quiero evaluar periódicamente cada `ReglaRecomendacion` activa ejecutando su query de detección, para generar una `Recomendacion` por cada candidato encontrado, sin duplicados por sujeto.

**Why this priority**: es el corazón del módulo dinero-vs-valor; sin detección y generación no hay "top 5 decisiones hoy" (Acción A del brief) ni insumos para el digest semanal ni el panel.

**Independent Test**: sembrar una suscripción `ACTIVA` con `fechaFin` a 5 días, ejecutar una evaluación de la regla `vencimiento.T_menos_7` y verificar que se crea una `Recomendacion` PENDIENTE con título renderizado desde la plantilla; re-ejecutar y verificar que no se crea duplicado.

**Acceptance Scenarios**:

1. **Given** una regla activa cuyo `sqlQuery` devuelve N filas candidatas, **When** el motor la evalúa, **Then** crea una `Recomendacion` por fila con `titulo` y `descripcion` renderizados desde `plantillaRecomendacion` con las variables de la fila, `prioridad` y `categoria` heredados de la regla y `expiraEn = ahora + analisis.recomendaciones.expiracion_dias`.
2. **Given** una fila candidata para `(reglaId, sujetoId)` que ya tiene una `Recomendacion` en estado `PENDIENTE`, **When** el motor evalúa de nuevo, **Then** NO crea duplicado; actualiza `datosContexto`, `prioridad` y `expiraEn` de la existente (deduplicación por `(reglaId, sujetoId)` en estado PENDIENTE).
3. **Given** una fila candidata cuya recomendación previa está `APLICADA` o `IGNORADA`, **When** el motor vuelve a detectar al sujeto, **Then** crea una nueva `Recomendacion` PENDIENTE (el sujeto vuelve a ser candidato y la resolución anterior queda como historial).
4. **Given** una regla con `activa = false`, **When** corre el ciclo de evaluación, **Then** la regla se omite sin error.
5. **Given** una regla con `umbralMinimo` configurado, **When** el resultado de la query no supera el umbral definido para disparar, **Then** no se generan recomendaciones.
6. **Given** una regla cuyo `sqlQuery` falla (sintaxis, timeout, tabla inexistente), **When** el motor la evalúa, **Then** registra el error en log (`[Analisis/Reglas]`), continúa con las demás reglas y NO desactiva la regla automáticamente.

---

### User Story 2 — Ejecutor SQL seguro de solo lectura (Priority: P1)

Como sistema quiero que las queries de detección de las reglas se ejecuten en una transacción de solo lectura con timeout, para que una regla mal escrita nunca pueda modificar datos ni bloquear la base.

**Why this priority**: las reglas son SQL configurable por un admin (SPEC-224 permitirá editarlas); sin sandbox de solo lectura, un error humano o una inyección accidental tendría blast radius total sobre datos sensibles.

**Independent Test**: configurar una regla de prueba con `sqlQuery = "DELETE FROM usuarios"`, evaluarla y verificar que el ejecutor la rechaza antes de tocar la base y registra el intento.

**Acceptance Scenarios**:

1. **Given** un `sqlQuery` que no inicia con `SELECT`/`WITH`, **When** el motor intenta evaluarlo, **Then** lo rechaza con error de validación antes de ejecutarlo y registra `AuditLog`.
2. **Given** un `sqlQuery` que contiene palabras de la deny-list (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `COPY`, `EXECUTE`, `CALL`), **When** se valida, **Then** se rechaza.
3. **Given** un `sqlQuery` válido, **When** se ejecuta, **Then** corre dentro de una transacción con `SET TRANSACTION READ ONLY` y `statement_timeout` acotado (parámetro `analisis.recomendaciones.statement_timeout_ms`, default 5000).
4. **Given** una query que excede el `statement_timeout`, **When** el motor la evalúa, **Then** aborta solo esa regla, loguea timeout y continúa con las demás.
5. **Given** cualquier query de regla, **Then** el motor solo lee tablas del dominio SaaS/análisis (`Suscripcion`, `Pago`, `Plan`, `Colegio`, `Usuario`, `CodigoReferidoUso`, `ScoreCliente`, `SesionLog`); las queries NUNCA seleccionan texto de reportes ni campos cifrados (`Reporte.textoCifrado` y derivados quedan fuera del alcance permitido por convención de seed y revisión).

---

### User Story 3 — Worker `worker-analisis-reglas` de instancia única (Priority: P1)

Como sistema quiero un proceso periódico que dispare la evaluación de reglas según su `frecuenciaMin` y expire recomendaciones vencidas, para que el motor corra desatendido con exactamente una instancia activa.

**Why this priority**: sin el worker el motor es código muerto; la unicidad por advisory lock evita evaluaciones duplicadas concurrentes (mismo patrón que `worker-reportes`, `monitor-probes` y `worker-notificaciones`).

**Independent Test**: levantar el worker con una regla `frecuenciaMin = 1` y datos candidatos, verificar que genera recomendaciones en el primer minuto; intentar levantar una segunda instancia y verificar que sale con código 2.

**Acceptance Scenarios**:

1. **Given** el worker corriendo, **When** ejecuta su tick, **Then** relee los parámetros `analisis.recomendaciones.*` y evalúa solo las reglas activas cuya `frecuenciaMin` ya venció desde su última evaluación.
2. **Given** una instancia del worker activa, **When** se intenta levantar otra, **Then** la segunda sale con código 2 por advisory lock de PostgreSQL (id propio, distinto al de `worker-reportes`, `monitor-probes`, `simulador-abuso` y `worker-notificaciones`).
3. **Given** una `Recomendacion` PENDIENTE con `expiraEn` vencido, **When** el worker ejecuta su tick, **Then** la marca `EXPIRADA` con `resueltaEn` y motivo `EXPIRACION_AUTOMATICA`, sin tocar las ya resueltas.
4. **Given** el worker en marcha, **When** recibe `SIGTERM`/`SIGINT`, **Then** termina el tick en curso, libera el advisory lock y sale limpio.
5. **Given** una regla en modo `EJECUTA` (promovida en SPEC-224), **When** el motor la evalúa en esta spec, **Then** genera la `Recomendacion` igual que en modo `RECOMIENDA` con `ejecutadaAutomatica = false` y loguea que la ejecución de la acción está diferida a SPEC-226 (comportamiento seguro por defecto; ninguna acción automática se ejecuta en SPEC-221).

---

### User Story 4 — Seed de 7 reglas semilla en modo RECOMIENDA (Priority: P1)

Como admin de plataforma quiero que el seed cree las 7 reglas semilla del brief §8.2, todas en modo `RECOMIENDA`, para que el panel tenga contenido útil desde el primer despliegue sin que el sistema actúe solo (D-77).

**Why this priority**: las reglas semilla son el valor inmediato del módulo (vencimientos, mora, freemium por vencer, referidos en riesgo); el modo `RECOMIENDA` por default es un candado no-negociable.

**Independent Test**: ejecutar `npx prisma db seed` dos veces y verificar que existen exactamente las 7 reglas con sus claves, todas `modo = RECOMIENDA`, sin duplicados.

**Acceptance Scenarios**:

1. **Given** el seed, **Then** existen las reglas con claves: `vencimiento.T_menos_7`, `mora.T_mas_30`, `padres_de_colegio_no_renovado`, `crecimiento_ciudad_anomalo`, `cliente_puntual_ahora_atrasado`, `alta_freemium_expira_manana`, `nuevo_referido_registrado_sin_pagar_7d`.
2. **Given** las 7 reglas semilla, **Then** todas tienen `modo = RECOMIENDA`, `activa = true`, `prioridad` y `frecuenciaMin` razonables, y `plantillaRecomendacion` en español con variables `{{...}}`.
3. **Given** el seed ejecutado dos veces, **Then** es idempotente (`upsert` por `clave`) y no duplica reglas ni pisa cambios manuales de `modo` hechos por un admin (el upsert NO sobrescribe `modo` ni `activa` si la regla ya existe).
4. **Given** el seed, **Then** también siembra idempotentemente los parámetros `analisis.recomendaciones.frecuencia_evaluacion_min` (INTEGER, default 60), `analisis.recomendaciones.expiracion_dias` (INTEGER, default 7) y `analisis.recomendaciones.statement_timeout_ms` (INTEGER, default 5000).

---

### User Story 5 — El admin resuelve recomendaciones con auditoría (Priority: P2)

Como admin quiero marcar una recomendación como APLICADA o IGNORADA con un motivo opcional, para cerrar el ciclo de vida humano de cada sugerencia y alimentar las métricas de tuning de SPEC-227.

**Why this priority**: la resolución humana es el modo de operación por defecto (D-77); el endpoint es la única vía de transición manual de estado y la UI de SPEC-222/SPEC-227 lo consume.

**Independent Test**: llamar `POST /api/admin/analisis/recomendaciones/[id]/resolver` como ADMIN con `{"estado":"APLICADA"}` y verificar estado, `resueltaEn`, `resueltaPorAdminId` y `AuditLog`; repetir y confirmar `409` (ya resuelta).

**Acceptance Scenarios**:

1. **Given** una `Recomendacion` PENDIENTE y un usuario ADMIN autenticado, **When** llama al endpoint con `estado = APLICADA` u `IGNORADA`, **Then** la recomendación queda resuelta con `resueltaEn`, `resueltaPorAdminId`, `motivoResolucion` opcional y un `AuditLog` con metadatos (sin datos sensibles del sujeto).
2. **Given** una `Recomendacion` ya `APLICADA`, `IGNORADA` o `EXPIRADA`, **When** se intenta resolver de nuevo, **Then** retorna `409` y el estado no cambia.
3. **Given** un usuario con rol distinto de `ADMIN` (o anónimo), **When** llama al endpoint, **Then** retorna `401`/`403` según el proxy.
4. **Given** un body con `estado` fuera de `{APLICADA, IGNORADA}` (ej. `EXPIRADA`, `PENDIENTE`), **When** se valida con Zod, **Then** retorna `400`.
5. **Given** un `id` inexistente, **When** se llama al endpoint, **Then** retorna `404`.

---

## Edge Cases

- **Regla que se auto-referencia o query pesada**: el `statement_timeout` y la transacción read-only acotan el daño; la regla se salta y se loguea, nunca tumba el worker.
- **Plantilla con variable ausente en la fila**: el renderer deja el placeholder visible (`{{variable}}`) y loguea warning; nunca rompe la generación del resto de candidatos.
- **Sujeto candidato eliminado entre detección y resolución**: la `Recomendacion` conserva `sujetoTipo`/`sujetoId` y `datosContexto` con el snapshot renderizado; la resolución sigue funcionando porque no hay FK dura al sujeto (integridad por aplicación, igual que el patrón `sujetoTipo/sujetoId` de `Notificacion`).
- **Dos workers por despliegue accidental**: el advisory lock garantiza instancia única; la segunda sale con código 2 (el supervisor/pm2 no debe reintentar en loop agresivo).
- **Reloj del servidor vs. zona Bogotá**: las ventanas de las reglas ("vence esta semana", "expira mañana") se calculan con `date-fns-tz` en `America/Bogota`, coherente con el resto del negocio.
- **Regla editada a `EJECUTA` antes de SPEC-226**: el motor genera la recomendación sin ejecutar la acción (US3 escenario 5); nunca hay ejecución parcial ni silenciosa.
- **Recomendación PENDIENTE cuyo sujeto deja de ser candidato**: no se borra; sigue su ciclo (resolución humana o expiración). La limpieza de "ya no aplica" es responsabilidad del humano o de la expiración.
- **Seed en ambiente con reglas ya tuneadas**: el upsert no pisa `modo`, `activa` ni `sqlQuery` modificados manualmente; solo crea las que faltan y actualiza campos descriptivos (`nombre`, `descripcion`, `plantillaRecomendacion`) si se decide así en implementación — lo que NO toca nunca es `modo` ni `activa`.
- **PII en agregados**: las reglas operan sobre datos comerciales (suscripciones, pagos, colegios); está prohibido que una regla seleccione texto de reportes, identificadores reportados ni datos de menores. Las 7 semilla solo tocan el dominio SaaS.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear el modelo `ReglaRecomendacion` (tabla `reglas_recomendacion`) con los campos del brief §5.3: `clave` única, `nombre`, `descripcion`, `categoria`, `sqlQuery`, `plantillaRecomendacion`, `modo` (`ModoRegla`: `RECOMIENDA` | `EJECUTA`), `accionEjecutable?`, `accionParametros?` (Json), `prioridad` (Int, default 50), `umbralMinimo?` (Float), `frecuenciaMin` (Int, default 60), `activa` (Boolean, default true), `creadaPorAdminId`, `ultimaEvaluacionEn?`, `createdAt`, `updatedAt`.
- **FR-002**: El sistema DEBE crear el modelo `Recomendacion` (tabla `recomendaciones`) con los campos del brief §5.4: `reglaId` (FK), `titulo`, `descripcion`, `categoria`, `prioridad`, `sujetoTipo?`, `sujetoId?`, `datosContexto` (Json), `accionSugerida?`, `accionParametros?` (Json), `estado` (`EstadoRecomendacion`: `PENDIENTE` | `APLICADA` | `IGNORADA` | `EXPIRADA`), `generadaEn`, `resueltaEn?`, `resueltaPorAdminId?`, `motivoResolucion?`, `expiraEn` (`Timestamptz(6)`), `ejecutadaAutomatica` (Boolean, default false).
- **FR-003**: El sistema DEBE implementar el ejecutor de queries en `src/lib/analisis/reglas/ejecutor-sql.ts` que valide que la query inicia con `SELECT`/`WITH`, aplique la deny-list de palabras peligrosas y la ejecute en transacción `READ ONLY` con `statement_timeout` (parámetro `analisis.recomendaciones.statement_timeout_ms`, default 5000 ms).
- **FR-004**: El sistema DEBE implementar el motor en `src/lib/analisis/reglas/motor.ts` con función `evaluarRegla(reglaId)` y `evaluarReglasPendientes()` que: filtre reglas activas cuya `frecuenciaMin` venció, ejecute la query, renderice la plantilla por fila, aplique deduplicación `(reglaId, sujetoId)` en estado PENDIENTE (actualiza en vez de duplicar), respete `umbralMinimo` y actualice `ultimaEvaluacionEn`.
- **FR-005**: El motor DEBE generar recomendaciones con `expiraEn = ahora + analisis.recomendaciones.expiracion_dias` (default 7) calculado en zona `America/Bogota`.
- **FR-006**: En esta spec, el motor DEBE tratar las reglas `EJECUTA` como generadoras solamente (`ejecutadaAutomatica = false`, log de ejecución diferida a SPEC-226); la ejecución de `accionEjecutable` queda fuera de alcance.
- **FR-007**: El sistema DEBE crear el worker `scripts/worker-analisis-reglas.mjs` con advisory lock propio de PostgreSQL (id nuevo, documentado), tick corto que evalúa reglas vencidas según `frecuenciaMin` y parámetro global `analisis.recomendaciones.frecuencia_evaluacion_min` (default 60), expiración de recomendaciones vencidas y manejo limpio de señales.
- **FR-008**: El worker DEBE marcar `EXPIRADA` toda `Recomendacion` PENDIENTE con `expiraEn` vencido, con `resueltaEn` y `motivoResolucion = 'EXPIRACION_AUTOMATICA'`, de forma idempotente.
- **FR-009**: El sistema DEBE sembrar de forma idempotente las 7 reglas semilla del brief §8.2 en modo `RECOMIENDA` (claves en US4 escenario 1), sin sobrescribir `modo` ni `activa` de reglas existentes.
- **FR-010**: El sistema DEBE sembrar idempotentemente los parámetros `analisis.recomendaciones.frecuencia_evaluacion_min` (60), `analisis.recomendaciones.expiracion_dias` (7) y `analisis.recomendaciones.statement_timeout_ms` (5000), categoría `SYSTEM`, siguiendo el patrón de `prisma/seed.ts`.
- **FR-011**: El sistema DEBE exponer `POST /api/admin/analisis/recomendaciones/[id]/resolver` restringido a `ADMIN`, con validación Zod (`estado ∈ {APLICADA, IGNORADA}`, `motivo?` máx 500 chars), que delega en el servicio de resolución y registra `AuditLog` (acción nueva aditiva `RECOMENDACION_RESUELTA`).
- **FR-012**: El servicio de resolución DEBE rechazar con `409` la resolución de recomendaciones no PENDIENTE y con `404` ids inexistentes, usando `AppError` y códigos canónicos de `src/lib/errors.ts`.
- **FR-013**: El sistema DEBE integrar el worker en `scripts/dev-restart.sh` (matar instancias previas y levantar una, mismo patrón que `worker-notificaciones.mjs`) y documentar su arranque manual.
- **FR-014**: El sistema DEBE implementar tests unitarios/integración: ejecutor SQL (rechazo de no-SELECT, deny-list, timeout), motor (generación, render, dedup, umbral, regla inactiva, EJECUTA diferida), worker (expiración idempotente, advisory lock), seed idempotente y endpoint (200/400/401/403/404/409).
- **FR-015**: Toda mutación (resolución admin, rechazo de query peligrosa) DEBE registrar `AuditLog` con metadatos, nunca con datos personales del sujeto ni texto de reportes.

### Key Entities

- **ReglaRecomendacion**: definición de una regla configurable. Atributos clave: `clave`, `sqlQuery`, `plantillaRecomendacion`, `modo` (`RECOMIENDA`/`EJECUTA`), `prioridad`, `frecuenciaMin`, `activa`, `ultimaEvaluacionEn`.
- **Recomendacion**: instancia generada por una regla para un sujeto. Atributos clave: `reglaId`, `titulo`, `sujetoTipo`/`sujetoId`, `datosContexto`, `estado` (`PENDIENTE`/`APLICADA`/`IGNORADA`/`EXPIRADA`), `expiraEn`, `ejecutadaAutomatica`.
- **Suscripcion / Pago / Plan / Colegio / CodigoReferidoUso** (SPEC-210, existentes): dominio de lectura de las reglas semilla.
- **ScoreCliente** (SPEC-220): contexto de valor para reglas futuras; las semilla v1 no lo requieren.
- **ParametroSistema**: namespace `analisis.recomendaciones.*`.
- **AuditLog**: resoluciones y rechazos de queries peligrosas (acción aditiva `RECOMENDACION_RESUELTA`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dado un dataset con 3 suscripciones candidatas, una evaluación de `vencimiento.T_menos_7` genera exactamente 3 recomendaciones PENDIENTE renderizadas, y una segunda evaluación genera 0 nuevas (dedup verificado en test).
- **SC-002**: El ejecutor rechaza el 100% de las queries de prueba no-read-only (batería de al menos 8 casos: DELETE, UPDATE, DROP, INSERT, ALTER, TRUNCATE, GRANT, query sin SELECT) antes de ejecutarlas.
- **SC-003**: El worker evalúa una regla con `frecuenciaMin = 1` dentro de los primeros 2 minutos de levantado y una segunda instancia sale con código 2.
- **SC-004**: La expiración marca `EXPIRADA` el 100% de las recomendaciones vencidas en un tick y es idempotente al re-ejecutarse.
- **SC-005**: El seed crea las 7 reglas en `RECOMIENDA` y los 3 parámetros; ejecutado dos veces produce exactamente los mismos conteos.
- **SC-006**: El endpoint de resolución responde `200`/`400`/`403`/`404`/`409` según matriz de casos y registra `AuditLog` en cada resolución exitosa.
- **SC-007**: Una regla promovida manualmente a `EJECUTA` genera recomendaciones sin ejecutar ninguna acción (verificado en test con `ejecutadaAutomatica = false`).
- **SC-008**: Gate local verde: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` + `./scripts/dev-restart.sh`.

---

## Assumptions

- SPEC-220 (002-PI-121) se implementa antes en la misma rama y aporta el namespace de parámetros `analisis.*` y el modelo `ScoreCliente`; esta spec solo añade los parámetros `analisis.recomendaciones.*`.
- El instructivo 002-PI-122 asigna a esta spec la creación de los modelos `ReglaRecomendacion` y `Recomendacion`, aunque el brief §15 los menciona también dentro de "modelos §5.1-5.7" de SPEC-220. Se asume que **SPEC-221 crea estas dos tablas** y SPEC-220 se limita a `SesionLog`(ya existe)/`ScoreCliente`/`DigestSemanal`/`Anomalia`/parámetros; si ZEUS decide lo contrario, esta spec se ajusta a consumirlas.
- La ejecución automática de acciones (`crear_bono_retencion`, `enviar_notificacion`, `asignar_a_operador`, `crear_alerta_admin`) es SPEC-226; aquí el modo `EJECUTA` solo existe a nivel de modelo y comportamiento seguro.
- La UI de consumo (widget "top 5", panel de reglas, historial) es SPEC-222/SPEC-224/SPEC-227; esta spec solo expone el endpoint de resolución que esas UIs necesitan.
- El patrón `sujetoTipo`/`sujetoId` sin FK dura sigue el precedente de `Notificacion` (`prisma/schema.prisma:2287-2288`).
- El Motor de Notificaciones (SPEC-201, `src/lib/notificaciones/motor.ts`) ya existe; las alertas al CEO del brief §8.3 se cablean en SPEC-223/SPEC-225, no aquí.
- Las queries de las reglas semilla son v1 tunables desde el panel (SPEC-224); su exactitud de negocio se valida en quickstart con datos semilla, no son contractuales a nivel de SQL.
- El worker corre con `node --import tsx` igual que `monitor-probes.mjs` y `worker-notificaciones.mjs`.

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

*(Se completará tras la implementación con la lista exacta de archivos, migraciones, endpoints y tests.)*

### Decisiones ejecutadas

*(Se completará tras compuertas de revisión.)*

### Gate local

*(Se completará tras validación.)*

### Deuda técnica / notas

*(Se completará al cerrar.)*
