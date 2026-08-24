# Feature Specification: SPEC-227 — Historial de recomendaciones y métricas de tuning

**Feature Branch**: `work/002-PI-mega-cola-restante`

**Created**: 2026-08-24

**Status**: IMPLEMENTADO

**Dependencia bloqueante**: SPEC-221 (002-PI-122 · Motor de reglas de recomendación) debe estar implementada en la misma rama antes de esta spec: entrega los modelos `ReglaRecomendacion` y `Recomendacion`, el enum `EstadoRecomendacion` (`PENDIENTE`/`APLICADA`/`IGNORADA`/`EXPIRADA`) y las 7 reglas semilla. SPEC-227 solo **lee** esos modelos; no los modifica.

Impacto en arquitectura: añade la vista admin `/dashboard/admin/analisis/recomendaciones`, tres endpoints de solo lectura bajo `/api/admin/analisis/recomendaciones*` (lista paginada con filtros, métricas de tuning y export CSV opcional), un servicio DAL de consulta y un módulo permisible nuevo `analisis_recomendaciones` (otorgado solo a `ADMIN`). Cero cambios de modelo de datos.

**Input**: El brief maestro `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §10.4 define el historial de recomendaciones: todas las recomendaciones generadas, filtrables por estado / regla / fecha, con métricas de tuning (tasa de aplicación, tasa de ignorada, tiempo promedio de resolución) que sirven para ajustar umbrales de las reglas (si una regla se ignora 80%, probablemente su umbral está mal). El instructivo 002-PI-128 añade: export CSV opcional sin PII, filtros por regla/estado/cliente/rango, terminología en criollo según brief §3 y sistema visual heredado (vidrio Apple + Instrument + radios 16/12/22).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El ADMIN consulta el historial completo de sugerencias con filtros (Priority: P1)

Como ADMIN quiero ver todas las sugerencias generadas por el motor de reglas en una tabla paginada, filtrable por regla, estado, cliente y rango de fechas, para auditar qué ha recomendado el sistema y qué pasó con cada sugerencia.

**Why this priority**: es la función central de la vista; sin el historial filtrable no hay forma de auditar el comportamiento del motor ni de responder "¿qué sugirió el sistema para el colegio X la semana pasada?".

**Independent Test**: sembrar recomendaciones en los 4 estados con distintas reglas y fechas, abrir `/dashboard/admin/analisis/recomendaciones`, aplicar cada filtro y verificar que la tabla y la paginación reflejan exactamente el subconjunto esperado.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol `ADMIN` y módulo `analisis_recomendaciones` otorgado, **When** abre `/dashboard/admin/analisis/recomendaciones`, **Then** ve una tabla con columnas: título de la sugerencia, regla (nombre en criollo), categoría, prioridad, estado (badge "Pendiente"/"Aplicada"/"Ignorada"/"Expirada"), fecha de generación y fecha de resolución, ordenada por `generadaEn` descendente.
2. **Given** el historial cargado, **When** el ADMIN selecciona una regla en el filtro "Regla", **Then** la tabla muestra solo sugerencias de esa regla y la paginación se recalcula.
3. **Given** el historial cargado, **When** el ADMIN filtra por estado "Ignorada", **Then** solo aparecen sugerencias con `estado = IGNORADA`.
4. **Given** el historial cargado, **When** el ADMIN define un rango de fechas (desde/hasta, día calendario Bogotá), **Then** solo aparecen sugerencias cuya `generadaEn` cae dentro del rango.
5. **Given** el historial cargado, **When** el ADMIN busca por cliente (identificador de suscripción/colegio), **Then** solo aparecen sugerencias cuyo `sujetoId` coincide.
6. **Given** más de 25 resultados, **When** el ADMIN navega a la página 2, **Then** la tabla muestra el siguiente bloque con la paginación estándar del proyecto (`page`/`pageSize`, default 25, máx 100).
7. **Given** un usuario con rol `OPERADOR` o `PARENT`, **When** intenta abrir la vista o llamar el endpoint, **Then** recibe `403` (la vista redirige fuera del panel según el control de módulos).

---

### User Story 2 — El ADMIN ve métricas de tuning por regla y globales (Priority: P1)

Como ADMIN quiero ver, para el rango filtrado, la tasa de aplicación, la tasa de ignorada y el tiempo promedio de resolución —global y por regla— para detectar reglas mal calibradas y ajustar sus umbrales.

**Why this priority**: el brief §10.4 define estas métricas como la razón de ser del historial ("si una regla se ignora 80% → probablemente el umbral está mal"); sin ellas la vista es solo una tabla.

**Independent Test**: sembrar una regla con 10 sugerencias (8 ignoradas, 2 aplicadas, tiempos de resolución conocidos) y verificar que las métricas por regla muestran tasa de aplicación 20%, tasa de ignorada 80% y el promedio de horas correcto.

**Acceptance Scenarios**:

1. **Given** sugerencias resueltas en el rango filtrado, **When** el ADMIN abre la vista, **Then** ve un bloque de KPIs con: total generadas, tasa de aplicación (%), tasa de ignorada (%) y tiempo promedio de resolución (horas) del conjunto filtrado.
2. **Given** varias reglas con actividad, **When** el ADMIN revisa el bloque "Por regla", **Then** ve una fila por regla con: nombre, total generadas, % aplicada, % ignorada, % expirada y tiempo promedio de resolución, ordenada por tasa de ignorada descendente (las peor calibradas primero).
3. **Given** una regla con tasa de ignorada superior al umbral parametrizable `analisis.recomendaciones.tasa_ignorada_alerta_pct` (default 70), **When** se renderiza el bloque por regla, **Then** la fila se destaca en color `rubi` con la señal "revisar umbral".
4. **Given** el rango filtrado sin ninguna sugerencia resuelta, **When** se calculan las métricas, **Then** las tasas muestran "—" (sin división por cero) y el tiempo promedio "—".
5. **Given** sugerencias aún `PENDIENTE`, **When** se calculan las tasas, **Then** las pendientes cuentan en "total generadas" pero NO en el denominador de tasas de aplicación/ignorada (estas se calculan solo sobre resueltas: `APLICADA + IGNORADA + EXPIRADA`).

---

### User Story 3 — El ADMIN exporta el historial a CSV sin PII (Priority: P2)

Como ADMIN quiero descargar el historial filtrado en CSV con identificadores de cliente opacos, para analizarlo fuera del sistema sin exponer datos personales (Ley 1581 de 2012).

**Why this priority**: el instructivo lo marca como "export CSV opcional"; es útil para análisis offline pero la vista ya cubre el tuning in-app.

**Independent Test**: filtrar un rango con sugerencias de varios clientes, descargar el CSV y verificar que (a) contiene una fila por sugerencia del subconjunto filtrado, (b) ninguna columna contiene nombres, emails, teléfonos ni nicks de clientes, (c) el cliente aparece solo como hash opaco estable.

**Acceptance Scenarios**:

1. **Given** un filtro activo, **When** el ADMIN pulsa "Exportar CSV", **Then** descarga un archivo `recomendaciones-YYYYMMDD-HHmm.csv` con las columnas: `recomendacion_id`, `regla_clave`, `regla_nombre`, `categoria`, `prioridad`, `estado`, `generada_en`, `resuelta_en`, `tiempo_resolucion_horas`, `ejecutada_automatica`, `sujeto_tipo`, `sujeto_hash`.
2. **Given** el CSV generado, **When** se inspecciona la columna `sujeto_hash`, **Then** es un hash irreversible (SHA-256 truncado con sal de servidor) del `sujetoId`, estable entre exports, nunca el id crudo ni datos del cliente.
3. **Given** el CSV generado, **Then** ninguna celda contiene nombre de colegio, email, teléfono, nick ni texto libre del cliente; el título/descripción de la sugerencia NO se exportan (pueden contener datos renderizados del cliente).
4. **Given** el conjunto filtrado excede el tope de exportación `analisis.recomendaciones.export_max_filas` (default 5000), **When** el ADMIN exporta, **Then** el sistema responde `413` indicando que refine el filtro.
5. **Given** una exportación exitosa, **Then** se registra `AuditLog` con acción de exportación, filtros aplicados y número de filas (sin contenido de filas).

---

## Edge Cases

- **Rango de fechas en frontera Bogotá**: una sugerencia generada a las 23:59 del día "hasta" debe incluirse; los cortes usan día calendario `America/Bogota`, no UTC.
- **Regla eliminada o renombrada**: la sugerencia conserva `categoria`/`prioridad` heredadas en la fila; el nombre de regla se resuelve por `reglaId` y si la regla ya no existe se muestra su `reglaId` crudo, sin romper la tabla.
- **Sugerencia ejecutada automáticamente** (regla en modo `EJECUTA`): se muestra con distintivo "ejecutada sola" y cuenta en las métricas igual que las manuales, pero el ADMIN puede filtrar por `ejecutadaAutomatica` para comparar desempeño humano vs. automático.
- **Cliente con suscripción eliminada**: el `sujetoId` puede quedar huérfano; la tabla muestra "sujeto no disponible" y el CSV sigue emitiendo el hash (estable por definición).
- **Sin resultados para el filtro**: la tabla muestra estado vacío con tono neutral ("No hay sugerencias para los filtros seleccionados") y las métricas en "—".
- **Export con 0 filas**: se permite y genera CSV solo con encabezado; no es error.
- **Rate limit**: los endpoints usan el scope `admin_read` existente; la exportación comparte el mismo scope (no se toca el rate limit del reporte público).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/admin/analisis/recomendaciones` protegido por `verifyAuth(RolUsuario.ADMIN)` + `assertModulo(user, "analisis_recomendaciones")` + rate limit `admin_read`, con paginación estándar (`page`/`pageSize`, default 25, máx 100) y respuesta `{ items, pagination }`.
- **FR-002**: El endpoint de lista DEBE aceptar los filtros: `estado` (`PENDIENTE|APLICADA|IGNORADA|EXPIRADA`), `reglaId`, `categoria`, `sujetoTipo`, `sujetoId`, `ejecutadaAutomatica` (bool), `desde` y `hasta` (fechas ISO, interpretadas como día calendario `America/Bogota`), validados con Zod; filtros inválidos responden `400`.
- **FR-003**: La respuesta de lista DEBE incluir por ítem: `id`, `titulo`, `regla` (`id`, `clave`, `nombre`), `categoria`, `prioridad`, `estado`, `generadaEn`, `resueltaEn`, `ejecutadaAutomatica`, `sujetoTipo` y un identificador de sujeto seguro (id opaco o nombre del colegio solo si el esquema de SPEC-221 ya lo expone a ADMIN; nunca email/teléfono/nick).
- **FR-004**: El sistema DEBE exponer `GET /api/admin/analisis/recomendaciones/metricas` con los mismos filtros de FR-002 (salvo paginación), que retorne: totales por estado, tasa de aplicación, tasa de ignorada, tasa de expirada (sobre resueltas), tiempo promedio de resolución en horas, y un arreglo `porRegla` con las mismas métricas desagregadas y ordenadas por tasa de ignorada descendente.
- **FR-005**: El sistema DEBE sembrar los parámetros `analisis.recomendaciones.tasa_ignorada_alerta_pct` (FLOAT, default `70`) y `analisis.recomendaciones.export_max_filas` (INTEGER, default `5000`) de forma idempotente en `prisma/seed.ts`.
- **FR-006**: El sistema DEBE exponer `GET /api/admin/analisis/recomendaciones/export` que devuelva `text/csv` con las columnas de US-3, respetando los mismos filtros, con tope `export_max_filas` (respuesta `413` si se excede) y `Content-Disposition: attachment`.
- **FR-007**: La exportación CSV DEBE pseudonimizar el sujeto con SHA-256(`sujetoId` + sal de variable de entorno) truncado a 16 hex; DEBE excluir título, descripción y cualquier dato de contacto del cliente.
- **FR-008**: Toda exportación DEBE registrar `AuditLog` (acción, usuario, filtros, conteo de filas) sin incluir contenido exportado.
- **FR-009**: El sistema DEBE crear la página `/dashboard/admin/analisis/recomendaciones/page.tsx` (Server Component) con componentes cliente solo para filtros, tabla, KPIs y botón de exportación; estilos 100% Tailwind con el sistema visual heredado (vidrio Apple en cards de KPIs, color `ambar` de Admin, radios 16/12/22, semáforo `pino`/`ambar`/`rubi` para tasas).
- **FR-010**: La vista DEBE usar la terminología del brief §3 en UI: "Sugerencia" (no "recomendación"), estados "Pendiente/Aplicada/Ignorada/Expirada", "Regla", tono neutral sin voseo.
- **FR-011**: El sistema DEBE registrar el módulo permisible `analisis_recomendaciones` en el catálogo de módulos (`prisma/seed-modulos-grants.ts`), otorgado por backfill únicamente a `ADMIN`, y añadir la entrada de navegación correspondiente bajo la sección de análisis del `AdminNav`.
- **FR-012**: La lógica de consulta DEBE vivir en un servicio DAL (`src/lib/dal/services/analisis-recomendaciones.ts`) con filtros tipados `Prisma.RecomendacionWhereInput` (nunca `any`); las rutas solo validan y serializan.
- **FR-013**: El sistema DEBE incluir tests: rutas (auth 401/403, filtros, paginación, códigos de error), servicio DAL (tasas con denominador de resueltas, frontera Bogotá, orden por tasa de ignorada), CSV (columnas exactas, hash estable, sin PII, tope 413, AuditLog) y componentes de la vista (render de estados y KPIs).
- **FR-014**: El sistema NO DEBE modificar `src/lib/ai/**`, el motor de reglas de SPEC-221, ni el rate limit del reporte público; SPEC-227 es estrictamente de lectura sobre `Recomendacion`/`ReglaRecomendacion`.

### Key Entities

- **Recomendacion** (entregada por SPEC-221, solo lectura aquí): `id`, `reglaId`, `titulo`, `descripcion`, `categoria`, `prioridad`, `sujetoTipo`, `sujetoId`, `estado` (`EstadoRecomendacion`), `generadaEn`, `resueltaEn`, `resueltaPorAdminId`, `motivoResolucion`, `expiraEn`, `ejecutadaAutomatica`.
- **ReglaRecomendacion** (entregada por SPEC-221, solo lectura aquí): `id`, `clave`, `nombre`, `categoria`, `modo`, `activa`.
- **EstadoRecomendacion** (enum de SPEC-221): `PENDIENTE`, `APLICADA`, `IGNORADA`, `EXPIRADA`.
- **ParametroSistema**: aloja los dos parámetros nuevos del prefijo `analisis.recomendaciones.*`.
- **AuditLog**: registro de exportaciones.
- **ModuloPermisible**: catálogo donde se registra `analisis_recomendaciones`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La lista responde en < 500 ms (p95 local) con 10 000 sugerencias en BD y filtros combinados (regla + estado + rango).
- **SC-002**: Las tasas de las métricas cuadran al punto porcentual con un dataset sembrado de composición conocida (ej. 8 ignoradas / 2 aplicadas → 20 % / 80 %), verificado por test de integración.
- **SC-003**: El tiempo promedio de resolución se calcula solo sobre sugerencias con `resueltaEn` no nula y respeta la frontera de día calendario `America/Bogota` en los filtros.
- **SC-004**: El CSV exportado pasa una verificación automática de ausencia de PII: ninguna celda coincide con nombre, email o teléfono de los clientes sembrados, y `sujeto_hash` es idéntico entre dos exports del mismo sujeto.
- **SC-005**: Un rol no-ADMIN recibe `403` en los tres endpoints y no ve la entrada de navegación.
- **SC-006**: La regla con tasa de ignorada > umbral parametrizado se destaca visualmente en la vista.
- **SC-007**: Gate local del mega-lote en verde: `npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- specs/227* (paths de la spec) && npm run build`, con diff limitado a archivos de esta spec y las anteriores del lote.

---

## Assumptions

- SPEC-221 (motor de reglas) estará implementada en la misma rama `work/002-PI-mega-cola-restante` antes de esta spec: modelos `ReglaRecomendacion`/`Recomendacion`, enum `EstadoRecomendacion` e índices `@@index([estado, prioridad, generadaEn])` / `@@index([sujetoId])` ya existen. Esta spec NO crea migraciones.
- SPEC-222 posee el tab "Dinero vs Valor" y la navegación principal de análisis; SPEC-227 cuelga su ruta de `/dashboard/admin/analisis/recomendaciones` según el instructivo 002-PI-128 y registra su propio módulo permisible para no depender del de SPEC-222.
- La resolución de sugerencias (marcar Aplicada/Ignorada) ocurre en el panel de SPEC-221/SPEC-226, NO en esta vista: el historial es de solo lectura.
- La sal de pseudonimización del CSV reutiliza una variable de entorno existente del servidor (o se añade una documentada en `.env.example` sin valor real); nunca se escribe el valor en el repo.
- El detalle por sugerencia (descripción renderizada, `datosContexto`) queda fuera de esta vista v1 por privacidad (Ley 1581); la fila muestra solo metadatos. El drill-down al cliente se resuelve vía enlace a la vista de cliente del módulo Pagos cuando exista.
- El worker del motor de reglas es el único escritor de `Recomendacion`; esta spec nunca escribe en esa tabla.

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

Implementada en `work/002-PI-mega-cola-restante` (002-PI-128). Tres endpoints de solo lectura, un servicio DAL + repositorio, tres módulos puros, vista admin, módulo permisible y dos parámetros.

- Endpoints: `GET /api/admin/analisis/recomendaciones` (lista paginada), `.../metricas` (tasas sobre resueltas + `porRegla` ordenado por tasa de ignorada desc), `.../export` (CSV sin PII, 413 sobre tope, AuditLog `RECOMENDACIONES_EXPORT_CSV`).
- DAL: `src/lib/dal/services/analisis-recomendaciones.ts` + `src/lib/dal/repositories/analisis-recomendaciones-repository.ts` (`Prisma.RecomendacionWhereInput` tipado; promedio de resolución con `$queryRaw` parametrizado `Prisma.sql`, columnas fijas).
- Dominio puro: `src/lib/analisis/filtros-historial.ts` (Zod compartido + día calendario Bogotá), `pseudonimizar.ts` (SHA-256 + sal, 16 hex, fail-closed), `historial-csv.ts` (columnas del contrato, escape, nombre de archivo).
- Vista: `src/app/dashboard/admin/analisis/recomendaciones/page.tsx` + `components/HistorialRecomendaciones.tsx` (tokens glass/tinta/ambar/pino/rubi, "Sugerencia", semáforo "revisar umbral").
- Seed/permisos: parámetros `analisis.recomendaciones.tasa_ignorada_alerta_pct` (70) y `export_max_filas` (5000) en `prisma/seed.ts`; módulo `analisis_recomendaciones` en `src/lib/permisos-catalogo.ts` (backfill solo ADMIN vía seed-modulos-grants); entrada nav en `src/lib/nav-items.ts` + icono en `AdminNav.tsx`; `ANALISIS_EXPORT_SALT` documentada en `.env.example` (sin valor real).
- Tests: 36 unitarios verdes (filtros, pseudonimizar, CSV, componente); 4 archivos de integración escritos (servicio DAL + 3 rutas), a correr por el coordinador (BD compartida).

### Decisiones ejecutadas

- **DESVIACIÓN documentada — migración aditiva de enum**: la spec declaraba "cero migraciones", pero FR-008 exige `AuditLog` por exportación y el enum `AccionAudit` no tenía ninguna acción de export reusable. Se añadió `RECOMENDACIONES_EXPORT_CSV` al final del enum (schema.prisma) + migración aditiva `prisma/migrations/20260824130000_spec_227_historial_recomendaciones/migration.sql` (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`, cero DROP; precedente SPEC-221/223/225). Cero cambios en `Recomendacion`/`ReglaRecomendacion`.
- **Código 413**: `ERROR_CODES` no contempla 413; se usa el literal `PAYLOAD_TOO_LARGE` (contracts §export) vía `AppError(msg, "PAYLOAD_TOO_LARGE", 413)`.
- **Módulo de primer nivel**: SPEC-222 no registró un módulo padre `analisis` en el catálogo al momento de implementar (research §5.1); `analisis_recomendaciones` queda de primer nivel (orden 94).
- **Select de categorías**: se deriva de las categorías de las reglas (sin input libre).
- Sin worker, sin advisory lock (no aplica).

### Gate local

- `npx tsc --noEmit`: limpio en los archivos de la spec.
- `npx prisma generate`: OK (tras añadir el valor de enum).
- Unitarios: 36/36 verdes (`filtros-historial`, `pseudonimizar`, `historial-csv`, `HistorialRecomendaciones`) + `nav-items.test.ts` 4/4.
- `npm run tokens:check`: VERDE global (1090 ≤ 1094); los archivos de la spec aportan 0 color crudo (verificado con el regex del script).
- ESLint sobre los archivos de la spec: 0 errores (warning preexistente de complejidad en `main()` de seed.ts).
- Integración: escrita, NO corrida (BD compartida; la corre el coordinador).

### Deuda técnica / notas

- La verificación manual del `quickstart.md` y el `./scripts/dev-restart.sh` quedan para la fase de cierre del coordinador (requieren BD y deploy limpio serializado).
- `cierre.md` se genera en la fase de cierre con la evidencia de git (commits serializados por el coordinador).
