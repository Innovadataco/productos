# Feature Specification: SPEC-220 — Modelo Análisis + score de valor de cliente

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: PLANEADO

**Radicación**: 002-PI-121 · Instructivo `INSTRUCTIVO-002-PI-121-MODELO-ANALISIS-SCORE.MD` · Mega-lote Análisis dinero-vs-valor (SPEC-220..227) · Brief maestro `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §5.1–5.7 (modelos), §6 (fórmula score), §14 (retención).

**Dependencias**: SPEC-206 SESSION-LOG (modelo `SesionLog` en prod, `prisma/schema.prisma:640`) · SPEC-210 Pagos (modelos `Suscripcion`/`Plan`/`Pago` en prod). Bloqueante para SPEC-221..227.

Impacto en arquitectura: añade 5 modelos aditivos (`ScoreCliente`, `ReglaRecomendacion`, `Recomendacion`, `DigestSemanal`, `Anomalia`), 2 enums (`ModoRegla`, `EstadoRecomendacion`), parámetros `analisis.*` en seed, servicio `src/lib/analisis/score.ts`, worker `scripts/worker-analisis-score.mjs` con advisory lock y cron pg-boss en `America/Bogota`, servicio `pi-analisis-score` en `docker-compose.prod.yml` y una card "Score de valor" (solo ADMIN) en la ficha de cliente existente.

**Input**: El CEO necesita el "cerebro comercial" de la plataforma: saber qué clientes aportan valor, cuáles están en riesgo y qué hacer hoy. Sin IA (reglas SQL + heurísticas configurables, decisión D-67 por analogía). Esta SPEC entrega la base de datos del dominio Análisis, el cálculo periódico del score de valor por cliente y su primera visualización, dejando el motor de reglas (SPEC-221), el panel (SPEC-222), el digest (SPEC-223) y las anomalías (SPEC-225) para SPECs posteriores que consumen estos mismos modelos.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El dominio Análisis existe en la base de datos de forma aditiva (Priority: P1)

Como plataforma quiero los 5 modelos del dominio Análisis (`ScoreCliente`, `ReglaRecomendacion`, `Recomendacion`, `DigestSemanal`, `Anomalia`) creados con migraciones aditivas y los parámetros `analisis.*` sembrados de forma idempotente, para que las SPECs 221–227 tengan su base de datos lista sin migraciones destructivas.

**Why this priority**: es el prerrequisito de todo el mega-lote; sin estos modelos ninguna otra SPEC de análisis puede implementarse.

**Independent Test**: correr `npx prisma migrate dev` y `npx prisma db seed`; verificar en Prisma Studio que las 5 tablas existen con sus índices/únicos y que los 12 parámetros `analisis.*` existen con sus defaults; repetir el seed y confirmar que no duplica filas.

**Acceptance Scenarios**:

1. **Given** el schema actualizado, **When** se aplica la migración, **Then** se crean las tablas `score_clientes`, `reglas_recomendacion`, `recomendaciones`, `digest_semanal`, `anomalias` y los enums `ModoRegla`/`EstadoRecomendacion`, sin `DROP` ni `ALTER` destructivo sobre tablas existentes.
2. **Given** el seed ejecutado, **Then** existen los parámetros `analisis.score.peso_reportes` (3), `analisis.score.peso_casos` (5), `analisis.score.peso_alertas` (2), `analisis.score.peso_sesiones` (1), `analisis.score.frecuencia_recalculo_horas` (24), `analisis.score.retencion_meses` (24), `analisis.recomendaciones.frecuencia_evaluacion_min` (60), `analisis.digest.dia_semana` (1), `analisis.digest.hora_bogota` (8), `analisis.anomalias.crecimiento_pct_umbral` (25), `analisis.anomalias.mora_dias_umbral_alta` (30), `analisis.anomalias.mora_dias_umbral_media` (15), todos con categoría `SYSTEM` y tipo correcto (`FLOAT`/`INTEGER`).
3. **Given** el seed ya ejecutado una vez, **When** se vuelve a ejecutar, **Then** los parámetros quedan con el mismo valor (upsert idempotente, cero duplicados).
4. **Given** los modelos `ReglaRecomendacion`, `Recomendacion`, `DigestSemanal` y `Anomalia`, **Then** quedan creados pero vacíos (su lógica de negocio corresponde a SPEC-221/223/225); esta SPEC solo garantiza su estructura.

---

### User Story 2 — Job diario recalcula el score de valor de cada suscripción activa (Priority: P1)

Como sistema quiero un worker programado que recalcule a diario el `ScoreCliente` del período en curso (mes calendario Bogotá) para todas las suscripciones con actividad comercial vigente, guardando snapshot con los pesos usados y el percentil en su cohorte, para que el score siempre refleje el mes actual y sea comparable entre clientes del mismo tipo.

**Why this priority**: el score es el insumo central de las recomendaciones, el panel dinero-vs-valor y el digest; sin recálculo periódico los datos envejecen y las decisiones del CEO se basan en cifras obsoletas.

**Independent Test**: sembrar una suscripción ACTIVA de tipo COLEGIO con reportes/alertas/seguimientos/sesiones conocidos en el mes actual, ejecutar el recálculo, y verificar que `scoreTotal = reportes×3 + casos×5 + alertas×2 + sesiones×1` con los pesos default, y que el snapshot guarda los pesos usados.

**Acceptance Scenarios**:

1. **Given** una suscripción en estado `ACTIVA` o `EN_GRACIA` con tipo titular COLEGIO, **When** el job ejecuta el recálculo del período `YYYY-MM` actual, **Then** cuenta: reportes del tenant (`Reporte.tenantId = Colegio.tenantId`, `eliminado = false`), casos (`SeguimientoCaso.colegioId`), alertas (`AlertaColegio.colegioId`) y sesiones (`SesionLog.tenantId = Colegio.tenantId`) creados dentro del mes calendario Bogotá, y persiste/actualiza la fila `ScoreCliente` con `@@unique([suscripcionId, periodo])`.
2. **Given** una suscripción `ACTIVA` con tipo titular PADRE, **When** el job recalcula, **Then** cuenta reportes (`Reporte.usuarioId = Suscripcion.usuarioId`, `eliminado = false`), casos (`Expediente.padreUsuarioId`, `fechaApertura` en el período), sesiones (`SesionLog.usuarioId`) y alertas = 0 (sin fuente de alertas para padre en v1; ver [NEEDS CLARIFICATION]).
3. **Given** los pesos del seed, **Then** `scoreTotal = componenteReportes × pesoReportes + componenteCasos × pesoCasos + componenteAlertas × pesoAlertas + componenteSesiones × pesoSesiones`, y los 4 pesos quedan congelados como snapshot en la fila (auditable: se sabe con qué pesos se calculó cada score histórico).
4. **Given** el job re-ejecutado el mismo día, **When** recalcula el mismo `(suscripcionId, periodo)`, **Then** hace upsert (actualiza la misma fila) sin duplicar snapshots — recálculo idempotente.
5. **Given** el recálculo completo del período, **When** termina el upsert de todos los scores, **Then** el job calcula `percentilEnCohorte` por cohorte (mismo `tipoTitular`, mismo `periodo`): posición relativa del `scoreTotal` entre las suscripciones de la cohorte (0–100); una cohorte de un solo miembro deja `percentilEnCohorte = null`.
6. **Given** el período en frontera de mes (23:59 del día último vs 00:01 del día primero), **Then** el corte usa día calendario `America/Bogota`, no UTC.
7. **Given** una segunda instancia del worker intentando arrancar, **Then** sale con código 2 por advisory lock de PostgreSQL (instancia única garantizada).
8. **Given** una suscripción `SUSPENDIDA` o `CANCELADA`, **Then** no se recalcula su score (sin actividad comercial vigente que medir), pero sus snapshots históricos se conservan.

---

### User Story 3 — El admin ve el score de valor en la ficha del cliente (Priority: P1)

Como ADMIN quiero ver en la ficha individual del cliente (`/dashboard/admin/pagos/cliente/[id]`) una card "Score de valor este mes" con el total y el desglose por componente (Reportes · Casos · Alertas · Sesiones) más el histórico de los últimos 12 meses, para entender de un vistazo cuánto valor está usando ese cliente.

**Why this priority**: es la primera superficie visible del dominio y la validación de extremo a extremo de que el cálculo funciona; el brief (§6.3) la marca como ubicación v1 del score.

**Independent Test**: con el score del mes calculado para una suscripción, abrir su ficha de cliente como ADMIN y verificar la card con total, desglose por componente y percentil; abrirla con otro rol y confirmar que no accede.

**Acceptance Scenarios**:

1. **Given** un ADMIN autenticado con acceso al módulo `pagos_admin`, **When** abre `/dashboard/admin/pagos/cliente/[id]` de una suscripción con score calculado, **Then** ve la card "Score de valor este mes" con `scoreTotal`, los 4 componentes con su peso aplicado y `percentilEnCohorte` (si existe).
2. **Given** una suscripción sin score calculado aún (job no corrido), **When** el admin abre la ficha, **Then** la card muestra un estado vacío neutral ("Score de valor aún no calculado para este período"), sin error.
3. **Given** el admin en la ficha, **When** existe histórico, **Then** la card lista los últimos 12 meses (`periodo` + `scoreTotal`) ordenados del más reciente al más antiguo.
4. **Given** un usuario con rol distinto de ADMIN o sin grant de `pagos_admin`, **When** intenta abrir la ficha, **Then** la puerta existente (`verifyAuth` + `assertModulo`) lo rechaza igual que hoy; el score NUNCA se expone al cliente titular ni a roles operativos en v1.
5. **Given** la card renderizada, **Then** usa el lenguaje descriptivo del dominio ("Score de valor", "Reportes", "Casos", "Alertas", "Sesiones") sin voseo y sin juicios sobre personas (el score mide uso de la plataforma por un cliente comercial, no conducta de personas).

---

### User Story 4 — Retención de snapshots: purga del detalle pasados 24 meses (Priority: P2)

Como sistema quiero que los snapshots de `ScoreCliente` más antiguos que `analisis.score.retencion_meses` (default 24) se eliminen con registro en `AuditLog`, para cumplir la política de retención (Ley 1581) sin acumulación indefinida.

**Why this priority**: cumplimiento de retención; no bloquea el valor funcional del score pero debe existir desde el inicio para no crear deuda de datos.

**Independent Test**: insertar un snapshot con `periodo` de hace 25 meses, correr el worker y verificar que la fila se elimina, queda `AuditLog` con metadatos (sin PII) y los snapshots de ≤ 24 meses no se tocan.

**Acceptance Scenarios**:

1. **Given** un snapshot cuyo `periodo` es más antiguo que `analisis.score.retencion_meses` respecto al mes actual Bogotá, **When** el worker ejecuta su tick de purga, **Then** elimina la fila y registra `AuditLog` con acción de retención y metadatos (`suscripcionId`, `periodo`, conteo), sin datos personales.
2. **Given** snapshots dentro de la ventana de retención, **Then** no se modifican ni eliminan.
3. **Given** la purga re-ejecutada, **Then** es idempotente: no hay filas que borrar, no genera `AuditLog` duplicado.
4. **Given** el valor del parámetro cambiado a 12 por el admin, **When** corre la purga, **Then** la nueva ventana se respeta sin deploy.

---

## Edge Cases

- **Suscripción sin actividad en el mes**: el job igualmente persiste snapshot con componentes en 0 y `scoreTotal = 0` — la ausencia de uso es una señal de negocio (cliente dormido) y debe quedar registrada.
- **Pesos cambiados a mitad de mes**: el snapshot de la fila guarda los pesos usados en cada recálculo; dos snapshots del mismo período pueden diferir si el admin tuneó los pesos entre corridas — comportamiento deseado y auditable.
- **Suscripción que cambia de estado durante el mes**: solo recalculan `ACTIVA`/`EN_GRACIA`; si una suscripción se suspende a mitad de mes, conserva el último snapshot calculado.
- **Cohorte de un solo cliente** (ej. primer cliente PADRE del mes): `percentilEnCohorte = null`; la UI no muestra percentil en ese caso.
- **Colegio sin `tenantId` enlazado o sesiones sin `tenantId`**: el conteo usa `tenantId` estricto; sesiones con `tenantId = null` no se atribuyen a ningún colegio (documentado; `SesionLog.tenantId` es nullable desde SPEC-206).
- **Mes con cero suscripciones activas**: el job termina en vacío sin error y loguea `[ANALISIS-SCORE] Recalculo: 0 suscripciones`.
- **Worker caído a mitad del recálculo**: cada upsert de `ScoreCliente` es una operación atómica por fila; la re-ejecución completa es idempotente por el único `(suscripcionId, periodo)`. El advisory lock se libera al morir el proceso.
- **Purge en el límite exacto (24 meses)**: la comparación se hace por `periodo` (`YYYY-MM`) contra el mes actual Bogotá, no por timestamp de creación, evitando falsos positivos por hora del día.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear el modelo `ScoreCliente` (tabla `score_clientes`) con: `id`, `suscripcionId` (FK a `Suscripcion`), `periodo` (`"YYYY-MM"`, mes calendario Bogotá), `componenteReportes`/`componenteCasos`/`componenteAlertas`/`componenteSesiones` (Int, default 0), `pesoReportes`/`pesoCasos`/`pesoAlertas`/`pesoSesiones` (Float, snapshot de pesos al calcular), `scoreTotal` (Float), `percentilEnCohorte` (Float?), `calculadoEn` (DateTime), `@@unique([suscripcionId, periodo])` e `@@index([periodo, scoreTotal(sort: Desc)])`.
- **FR-002**: El sistema DEBE crear el modelo `ReglaRecomendacion` (tabla `reglas_recomendacion`) con los campos del brief §5.3: `clave` única, `nombre`, `descripcion`, `categoria`, `sqlQuery`, `plantillaRecomendacion`, `modo` (`ModoRegla`: `RECOMIENDA` | `EJECUTA`, default `RECOMIENDA`), `accionEjecutable`, `accionParametros` (Json?), `prioridad` (default 50), `umbralMinimo`, `frecuenciaMin` (default 60), `activa` (default true), `creadaPorAdminId` (FK a `Usuario`), `@@index([activa, prioridad(sort: Desc)])`.
- **FR-003**: El sistema DEBE crear el modelo `Recomendacion` (tabla `recomendaciones`) con los campos del brief §5.4: `reglaId` (FK), `titulo`, `descripcion`, `categoria`, `prioridad`, `sujetoTipo`/`sujetoId` (polimórfico, sin FK), `datosContexto` (Json), `accionSugerida`, `accionParametros` (Json?), `estado` (`EstadoRecomendacion`: `PENDIENTE` | `APLICADA` | `IGNORADA` | `EXPIRADA`, default `PENDIENTE`), `generadaEn`, `resueltaEn`, `resueltaPorAdminId` (FK?), `motivoResolucion`, `expiraEn`, `ejecutadaAutomatica` (default false), índices `@@index([estado, prioridad(sort: Desc), generadaEn(sort: Desc)])` y `@@index([sujetoId])`.
- **FR-004**: El sistema DEBE crear el modelo `DigestSemanal` (tabla `digest_semanal`) con los campos del brief §5.5: `periodo` (`"YYYY-Www"`, ISO week Bogotá), `destinatarioId` (FK a `Usuario`), `generadoEn`, `enviadoEn`, `top5Decisiones` (Json), `kpisSemana` (Json), `kpisVsPrevia` (Json), `enlacePanel`, `estado` (String valores cerrados: `generado` | `enviado` | `fallido`), `@@unique([periodo, destinatarioId])`.
- **FR-005**: El sistema DEBE crear el modelo `Anomalia` (tabla `anomalias`) con los campos del brief §5.6: `tipo`, `sujetoTipo`/`sujetoId`, `severidad` (String valores cerrados: `BAJA` | `MEDIA` | `ALTA`), `descripcion`, `datosContexto` (Json), `detectadaEn`, `resueltaEn`, `resueltaPorAdminId` (FK?), índices por `(tipo, detectadaEn)` y `(severidad, detectadaEn)`.
- **FR-006**: El sistema DEBE sembrar idempotentemente en `prisma/seed.ts` los 12 parámetros `analisis.*` del brief §5.7 más `analisis.score.retencion_meses` (INTEGER, default 24), todos con `CategoriaParametro.SYSTEM`, `esPublico: false`, `esSecreto: false`.
- **FR-007**: El sistema DEBE implementar `src/lib/analisis/score.ts` con la función `recalcularScoresPeriodo(periodo?)` que: resuelve el período (default = mes actual Bogotá), lee los 4 pesos desde `ParametroSistema` (fallback a defaults del seed si faltan), itera las suscripciones `ACTIVA`/`EN_GRACIA`, cuenta los 4 componentes según `tipoTitular` (COLEGIO: `Reporte.tenantId`/`SeguimientoCaso`/`AlertaColegio`/`SesionLog.tenantId`; PADRE: `Reporte.usuarioId`/`Expediente`/`SesionLog.usuarioId`/alertas = 0), hace upsert por `(suscripcionId, periodo)` con snapshot de pesos y, al final, actualiza `percentilEnCohorte` por cohorte `(tipoTitular, periodo)`.
- **FR-008**: El cálculo DEBE usar únicamente conteos agregados (`count`) sobre entidades existentes; NUNCA lee, copia ni persiste texto de reportes, identificadores reportados ni PII de menores.
- **FR-009**: El sistema DEBE crear `scripts/worker-analisis-score.mjs` siguiendo el patrón de `scripts/worker-tasas.mjs`: advisory lock propio de PostgreSQL (id nuevo, distinto de los existentes), pg-boss `boss.schedule` con cron derivado de `analisis.score.frecuencia_recalculo_horas` y `tz: "America/Bogota"`, manejo de SIGTERM/SIGINT, y salida con código 2 si el lock está tomado.
- **FR-010**: El worker DEBE ejecutar en cada corrida: (a) recálculo del período actual y (b) purga de retención de snapshots más antiguos que `analisis.score.retencion_meses`, con `AuditLog` por purga (patrón `ipAddress: "worker"`) y sin borrar filas dentro de la ventana.
- **FR-011**: El sistema DEBE añadir el servicio `pi-analisis-score` en `docker-compose.prod.yml` con `TZ: America/Bogota` y `command: node --import tsx scripts/worker-analisis-score.mjs`, siguiendo el patrón de `pi-notificaciones`/`pi-senal-comunitaria`.
- **FR-012**: El sistema DEBE implementar `src/lib/dal/repositories/analisis-repository.ts` con `obtenerScoreCliente(suscripcionId)` que retorne el snapshot del período actual y el histórico de los últimos 12 períodos (orden descendente), tipado, sin `any`.
- **FR-013**: La página existente `src/app/dashboard/admin/pagos/cliente/[id]/page.tsx` DEBE renderizar la card "Score de valor este mes" (total, desglose por componente con peso aplicado, percentil si existe, histórico 12 meses) usando el repositorio anterior, solo visible bajo la puerta existente (`verifyAuth("ADMIN")` + `assertModulo(admin, "pagos_admin")`); NUNCA visible para el cliente titular ni otros roles en v1.
- **FR-014**: Todos los textos de UI nuevos DEBEN usar tono neutral sin voseo y la terminología cerrada del brief §3 ("Score de valor", "Reportes", "Casos", "Alertas", "Sesiones").
- **FR-015**: El sistema DEBE incluir tests: unidad del cálculo del score (fórmula, snapshot de pesos, componentes por tipo de titular), integración del repositorio, idempotencia del recálculo (upsert), cálculo de percentil (incluida cohorte unitaria → null), purga de retención (borra > ventana, conserva ≤ ventana, idempotente) y render de la card en la ficha (con y sin score).

### Key Entities

- **ScoreCliente** (nuevo): snapshot mensual del score de valor de una suscripción. Ver FR-001.
- **ReglaRecomendacion** (nuevo): definición de una regla de recomendación; lógica en SPEC-221/224. Ver FR-002.
- **Recomendacion** (nuevo): instancia generada de una regla; lógica en SPEC-221/227. Ver FR-003.
- **DigestSemanal** (nuevo): resumen semanal generado para un admin; lógica en SPEC-223. Ver FR-004.
- **Anomalia** (nuevo): anomalía detectada por reglas; lógica en SPEC-225. Ver FR-005.
- **Suscripcion** (existente, SPEC-210): titular del score (`tipoTitular`, `colegioId`, `usuarioId`, `estado`, `planActualId`). No se modifica; solo se añade la relación inversa `scoreClientes`.
- **SesionLog** (existente, SPEC-206): fuente del componente SESIONES por `usuarioId`/`tenantId`. No se modifica.
- **Reporte / SeguimientoCaso / AlertaColegio / Expediente** (existentes): fuentes de conteo de componentes. No se modifican.
- **ParametroSistema** (existente): parámetros `analisis.*` sembrados por seed.
- **AuditLog** (existente): registro de la purga de retención.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La migración aplica en una base existente sin errores y sin tocar tablas previas (solo `CREATE TABLE`/`CREATE TYPE`/`CREATE INDEX` aditivos); `npx prisma migrate dev` + `npx prisma db seed` dejan los 5 modelos y los 13 parámetros listos.
- **SC-002**: El recálculo del período actual sobre una base de prueba con 100 suscripciones activas termina en menos de 60 segundos en entorno local y produce exactamente un snapshot por suscripción (cero duplicados aunque se ejecute dos veces seguidas).
- **SC-003**: Para una suscripción con componentes conocidos (R reportes, C casos, A alertas, S sesiones) y pesos default, `scoreTotal = 3R + 5C + 2A + 1S` exactamente, y la fila guarda los pesos usados.
- **SC-004**: La card de la ficha de cliente muestra el score del mes con sus 4 componentes y el histórico de hasta 12 meses; una suscripción sin cálculo muestra el estado vacío neutral sin errores (HTTP 200).
- **SC-005**: La purga elimina el 100% de los snapshots con `periodo` más antiguo que la ventana configurada y 0 de los demás, con `AuditLog` por corrida de purga.
- **SC-006**: El worker corre como instancia única (segunda instancia sale con código 2) y programa su cron en `America/Bogota`.
- **SC-007**: Gate local completo en verde: `npx tsc --noEmit && npm run lint --no-cache && npm run test:unit && npm run build` + `./scripts/dev-restart.sh`.

---

## Assumptions

- `SesionLog` (SPEC-206) ya existe en producción con `usuarioId`, `tenantId` (nullable) y `rol`; el brief §5.1 proponía `suscripcionId`, pero el modelo real no lo tiene: el componente SESIONES se cuenta por `usuarioId` (titular PADRE) o `tenantId` del colegio (titular COLEGIO). No se añade ninguna columna a `SesionLog` en esta SPEC.
- La "sesión activa" de un colegio se atribuye por `tenantId`; las sesiones de usuarios del colegio con `tenantId = null` no cuentan (comportamiento heredado de SPEC-206).
- El score de valor mide **uso de la plataforma por un cliente comercial** (suscripción), no conducta de personas: no clasifica ni juzga identificadores reportados ni menores; es coherente con la constitución §1.5 porque no es un score de personas y solo lo ve el ADMIN interno.
- El "resumen histórico agregado" previo a la purga del brief §14 se simplifica en v1: los snapshots ya son agregados sin PII, por lo que la purga elimina el detalle > 24 meses con `AuditLog`; si el CEO pide un consolidado de más largo plazo se añadirá como SPEC posterior.
- `ReglaRecomendacion`, `Recomendacion`, `DigestSemanal` y `Anomalia` se crean en esta SPEC pero quedan sin lógica de negocio: motor de reglas (SPEC-221), digest (SPEC-223), anomalías (SPEC-225). No se siembran las 7 reglas semilla aquí (corresponde a SPEC-221 según el mapa §15 del brief).
- La card del score vive en la ficha de cliente existente del módulo Pagos y reutiliza su puerta de acceso (`pagos_admin`); el tab "Dinero vs Valor" con ranking y dispersión es SPEC-222.
- Los campos polimórficos `sujetoTipo`/`sujetoId` (`Recomendacion`, `Anomalia`) no llevan FK (patrón deliberado del brief); la integridad la garantiza la capa de servicio en las SPECs consumidoras.
- La zona horaria del negocio es `America/Bogota` (D-69): períodos mensuales, semanales y ventanas de retención se calculan en esa zona.
- No se crean endpoints API nuevos: la ficha es Server Component que consulta el repositorio directamente (patrón ya usado en `cliente/[id]/page.tsx`); por eso esta SPEC no tiene `contracts/`.

---

## [NEEDS CLARIFICATION]

1. **Componente ALERTAS para titular PADRE**: el brief define el componente `ALERTAS` del score pero no especifica su fuente para clientes PADRE (las `AlertaColegio` son exclusivas de colegios; `AlertaSuscripcion` es una preferencia configurada por el usuario, no un evento generado). Default asumido para no bloquear: `componenteAlertas = 0` para PADRE en v1. Si ZEUS define una fuente (p. ej. `EventoMatch` vinculado a alertas del padre), se ajusta el mapeo en `recalcularScoresPeriodo`.

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
