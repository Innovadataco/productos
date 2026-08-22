# Feature Specification: SPEC-234 — Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia

**Feature Branch**: `work/002-pi-134`

**Created**: 2026-08-22

**Status**: `PLANEADO`

**Impacto en arquitectura**: añade los modelos `InformeConsolidado`, `SenalComunitariaCache` y `PatronExpediente`; el servicio de compilación `src/lib/expediente/compilacion/`; el kit de evidencia PDF `src/lib/expediente/pdf/`; el endpoint público `GET /api/publico/verificar-pdf/[hash]`; el worker `pi-senal-comunitaria`; tres repositorios DAL; y tests unitarios/integración. No toca el motor IA ni implementa UI de padre/comité.

**Input**: SPEC-230 dejó los modelos base `Expediente` / `EventoExpediente` y los parámetros `padre.score.*` / `padre.patron.*`. Esta SPEC construye la **capa de compilación técnica** que transforma los eventos de un expediente en un informe consolidado con score, patrones N1, señal comunitaria y un PDF verificable N2, respetando la frontera DAL (Q-3) y la Ley 1581.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Generar informe consolidado de un expediente (Priority: P1)

Como OPERADOR o miembro del COMITÉ_DE_VALIDACION quiero compilar los eventos de un expediente en un informe técnico que muestre score, categorías dominantes, patrones detectados y señal comunitaria, para decidir si el caso amerita escalamiento o cierre sin revisar texto original.

**Why this priority**: es el núcleo de la fase "Padre v2"; sin compilación no hay informe ni evidencia N2.

**Independent Test**: invocar `compilarExpediente(expedienteId)` sobre un expediente con 5 eventos y verificar que devuelve un `InformeConsolidado` con score, categorías, patrones y `resumenTextoGenerado` estructurado.

**Acceptance Scenarios**:

1. **Given** un expediente con eventos clasificados, **When** se compila, **Then** el informe refleja el score de gravedad (VERDE/AMARILLO/ROJO) calculado con la fórmula parametrizada.
2. **Given** el informe, **Then** las categorías dominantes se calculan por frecuencia y peso de gravedad; nunca incluyen texto original.
3. **Given** el informe, **Then** se listan los patrones N1 detectados con su nivel de confianza y metadatos.
4. **Given** el informe, **Then** la señal comunitaria es un resumen agregado (nunca identificador ni textos).
5. **Given** un expediente sin eventos, **When** se compila, **Then** devuelve informe vacío, score VERDE y categorías vacías, sin lanzar error.

---

### User Story 2 — Detectar patrones N1 (Priority: P1)

Como sistema quiero aplicar cuatro reglas puras de detección de patrones —aceleración, progresión, perpetrador serial y multiplataforma— para enriquecer el informe con indicios estructurales que no dependan de la IA.

**Why this priority**: la detección de patrones es 100% SQL + lógica determinista (D-67); permite alertar ante dinámicas de riesgo sin reprocesar textos.

**Independent Test**: ejecutar cada regla contra datasets sintéticos y verificar que dispara solo cuando se cumplen los umbrales configurados en `ParametroSistema`.

**Acceptance Scenarios**:

1. **Given** una serie de eventos cuyo intervalo entre reportes se reduce al menos al `padre.patron.aceleracion_ratio_minimo`, **Then** la regla `aceleracion` devuelve `detectado=true` con el ratio calculado.
2. **Given** eventos cuyas categorías evolucionan de menor a mayor gravedad según el grupo de categorías, **Then** la regla `progresion` detecta la escalada.
3. **Given** un identificador reportado en al menos `padre.patron.senal_comunitaria_perpetrador_serial` reportes independientes, **Then** la regla `perpetrador_serial` dispara.
4. **Given** eventos en al menos `padre.patron.multiplataforma_min` plataformas distintas, **Then** la regla `multiplataforma` dispara.
5. **Given** un dataset que no cumple ningún umbral, **Then** ninguna regla dispara y no se generan `PatronExpediente` falsos.

---

### User Story 3 — Calcular score de gravedad parametrizado (Priority: P1)

Como sistema quiero calcular un score numérico y su semáforo (VERDE/AMARILLO/ROJO) a partir de los eventos del expediente, usando los pesos y umbrales sembrados por SPEC-230.

**Why this priority**: el score condiciona la visibilidad del informe y posibles escalamientos; debe ser reproducible y ajustable por parámetro.

**Independent Test**: construir expedientes sintéticos con distintos volúmenes, categorías graves y aceleración; verificar que el score cruza los umbrales configurados.

**Acceptance Scenarios**:

1. **Given** un expediente con pocas categorías leves y sin patrones, **Then** el score es menor que `padre.score.umbral_amarillo` y el semáforo es VERDE.
2. **Given** un expediente con varias categorías graves o patrones N1, **Then** el score está entre `padre.score.umbral_amarillo` y `padre.score.umbral_rojo` (AMARILLO) o supera el umbral rojo (ROJO).
3. **Given** un cambio en los parámetros `padre.score.*`, **When** se vuelve a compilar, **Then** el score refleja los nuevos pesos sin modificar eventos históricos.

---

### User Story 4 — Generar PDF verificable N2 (Priority: P1)

Como padre o comité quiero descargar un PDF de evidencia generado a partir del informe consolidado, con un hash SHA256 reproducible y un endpoint público donde terceros puedan verificar su integridad.

**Why this priority**: el kit evidencia es el entregable N2 para canales oficiales; debe ser reproducible y verificable sin exponer PII.

**Independent Test**: compilar un expediente, generar el PDF dos veces con los mismos datos y verificar que el hash SHA256 coincide; luego consultar `/api/publico/verificar-pdf/[hash]`.

**Acceptance Scenarios**:

1. **Given** un informe consolidado, **When** se genera el PDF, **Then** se persiste en `/data/informes/[expedienteId]-v[n].pdf` y se guardan `pdfUrl`, `pdfHash` y `pdfGeneradoEn`.
2. **Given** el mismo informe compilado dos veces, **Then** ambos PDFs tienen el mismo `pdfHash` (determinismo, incluyendo JSON con keys canónicas).
3. **Given** el PDF generado, **Then** su contenido `resumenTextoGenerado` no incluye texto original de reportes, nombres, teléfonos ni identificadores; solo datos agregados y señales.
4. **Given** el endpoint `/api/publico/verificar-pdf/[hash]`, **When** el hash existe, **Then** responde 200 con metadatos mínimos; si no existe, 404.
5. **Given** el endpoint público, **Then** aplica rate-limit `verificar_pdf` para mitigar enumeración de hashes.

---

### User Story 5 — Mantener caché de señal comunitaria (Priority: P2)

Como sistema quiero que un worker refresque periódicamente la caché de señal comunitaria, para que la compilación no recalcule agregados costosos en cada request.

**Why this priority**: la señal comunitaria puede requerer barrer muchos reportes; un worker con caché mejora latencia y reduce carga.

**Independent Test**: invalidar la caché, lanzar el worker y verificar que reconstruye la fila de `SenalComunitariaCache` y actualiza `actualizadoEn`.

**Acceptance Scenarios**:

1. **Given** un cambio que invalida la caché (nuevo evento relevante), **When** el worker `pi-senal-comunitaria` ejecuta, **Then** recalcula y actualiza los agregados para el `identificadorReportado` afectado.
2. **Given** la caché vigente, **When** la compilación la consume, **Then** usa `totalExpedientesActivos`, `totalExpedientesCerrados`, `totalExpedientesEscalados`, `categoriasFrecuenciaJson`, `paisesJson`, `ciudadesJson` y `plataformasJson` sin tocar `Reporte`.
3. **Given** la caché expirada (`actualizadoEn` antiguo respecto a `refresh_min`), **When** la compilación la consume, **Then** la marca como inválida y fuerza recálculo (o recalcula inline según decida la implementación).

---

### Edge Cases

- **Expediente CERRADO**: la compilación sigue permitida (lectura histórica); `agregarEvento` sigue rechazando en CERRADO (SPEC-230).
- **Evento sin categoría hidratada aún**: se ignora en agregados de categorías y se asume categoría desconocida con peso 0.
- **Texto original nunca sale**: ni `resumenTextoGenerado`, ni JSON, ni PDF contienen el texto del reporte; solo categorías y conteos.
- **Hash reproducible**: se fija el timestamp de generación a precisión de segundos (o se pasa explícitamente en tests) para que el mismo contenido produzca el mismo hash.
- **Storage no disponible**: la generación de PDF falla con error 500 controlado y se loguea; no se persiste informe incompleto.
- **Rate-limit store caído**: el endpoint `/api/publico/verificar-pdf/[hash]` falla abierto (permite la request) salvo que ZEUS decida fail-closed en la compuerta.
- **Worker de señal caído**: la compilación puede recalcular inline o usar caché con tolerancia de staleness; nunca bloquea la lectura del informe.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir los modelos `InformeConsolidado`, `SenalComunitariaCache` y `PatronExpediente` mediante migración aditiva, con `Timestamptz(6)` universal y sin DROP/RENAME.
- **FR-002**: El sistema DEBE implementar `compilarExpediente(expedienteId)` en `src/lib/expediente/compilacion/compilar-expediente.ts`, orquestador que devuelve un `InformeConsolidado` v1.
- **FR-003**: La compilación DEBE usar SQL puro (`$queryRaw`) para agregados de categorías y señal comunitaria; está prohibido usar `src/lib/ai/**`.
- **FR-004**: El sistema DEBE implementar cuatro funciones puras N1 —`detectarAceleracion`, `detectarProgresion`, `detectarPerpetradorSerial`, `detectarMultiplataforma`— con umbrales leídos de `ParametroSistema` (`padre.patron.*`).
- **FR-005**: El sistema DEBE calcular el score con la fórmula parametrizada definida en `src/lib/expediente/compilacion/score/calcular-score.ts`, usando `padre.score.*`.
- **FR-006**: El sistema DEBE generar un `resumenTextoGenerado` estructurado (`src/lib/expediente/compilacion/template/renderizar-markdown.ts`) con secciones: Alcance, Clasificaciones, Resumen, Patrones, Señal y Nivel de gravedad.
- **FR-007**: El sistema DEBE generar un PDF determinista con `pdfmake`, persistirlo en `/data/informes/[expedienteId]-v[n].pdf` y guardar `pdfUrl`, `pdfHash` y `pdfGeneradoEn` en `InformeConsolidado`.
- **FR-008**: El sistema DEBE exponer `GET /api/publico/verificar-pdf/[hash]` con rate-limit scope `verificar_pdf` y sin exponer PII.
- **FR-009**: El sistema DEBE implementar el worker `scripts/worker-senal-comunitaria.mjs` que refresca `SenalComunitariaCache` ante invalidaciones, con un advisory lock o polling simple.
- **FR-010**: El sistema DEBE sembrar el parámetro `padre.senal_comunitaria.refresh_min` INTEGER 60 en `prisma/seed.ts` (upsert anti-I-100) y reutilizar los parámetros `padre.score.*` / `padre.patron.*` ya sembrados.
- **FR-011**: El sistema DEBE respetar la frontera DAL Q-3: todo acceso a los nuevos modelos pasa por `src/lib/dal/repositories/informe-consolidado-repository.ts`, `senal-comunitaria-repository.ts` y `patron-expediente-repository.ts`.
- **FR-012**: `SenalComunitariaCache` y `PatronExpediente` NUNCA DEBEN almacenar textos originales, identidades ni datos re-identificables; solo agregados y metadatos estructurales.
- **FR-013**: El sistema DEBE auditar la generación de informes y PDFs mediante `AuditLog` (acciones nuevas o reutilizadas) sin incluir textos de reportes.
- **FR-014**: El sistema DEBE soportar la generación de múltiples versiones de informe por expediente (`versionSecuencial` autoincremental por expediente).

### Key Entities

- **InformeConsolidado**: resultado de la compilación de un expediente. Atributos: `expedienteId`, `versionSecuencial`, `scoreGravedad`, `scoreValor`, `categoriasDetectadasJson`, `patronesDetectadosJson`, `senalComunitariaJson`, `resumenTextoGenerado`, `pdfUrl`, `pdfHash`, `pdfGeneradoEn`, `generadoPorId`, `tipoRevision`, `guiaAccionCategoriaIdPrincipal`, `estadoAprobacion`, `aprobadoPorMiembrosJson`, `correccionesJson`.
- **SenalComunitariaCache**: agregados comunitarios por `identificadorReportado`. Atributos: `identificadorReportado` (PK), `totalExpedientesActivos`, `totalExpedientesCerrados`, `totalExpedientesEscalados`, `categoriasFrecuenciaJson`, `primeraAparicionEn`, `ultimaAparicionEn`, `paisesJson`, `ciudadesJson`, `plataformasJson`, `invalidado`, `actualizadoEn`.
- **PatronExpediente**: patrón N1 detectado en un expediente. Atributos: `expedienteId`, `tipoPatron`, `severidad` (`BAJA`/`MEDIA`/`ALTA`), `nivelConfianza`, `descripcionTexto`, `datosContextoJson`, `detectadoEn`.
- **Expediente / EventoExpediente**: modelos base de SPEC-230; solo lectura en esta SPEC.
- **ParametroSistema**: fuente de `padre.score.*`, `padre.patron.*` y `padre.senal_comunitaria.refresh_min`.
- **AuditLog**: registro de generación de informes y PDFs.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `compilarExpediente` sobre un expediente con 5 eventos devuelve un `InformeConsolidado` con score, categorías, patrones, señal y `resumenTextoGenerado` en menos de 1 segundo (sin contar IA).
- **SC-002**: Cada una de las 4 reglas N1 tiene al menos 2 tests sintéticos (dispara / no dispara) y todos pasan.
- **SC-003**: El cálculo de score produce VERDE/AMARILLO/ROJO según los umbrales configurados; los tests cubren los tres casos.
- **SC-004**: Dos generaciones consecutivas del mismo PDF producen el mismo `pdfHash`.
- **SC-005**: `GET /api/publico/verificar-pdf/[hash]` responde 200 para hash existente, 404 para hash inexistente y aplica rate-limit.
- **SC-006**: El seed de `padre.senal_comunitaria.refresh_min` es idempotente: ejecutarlo dos veces no duplica filas.
- **SC-007**: `SenalComunitariaCache` y `PatronExpediente` no contienen campos de PII; el test de esquema lo verifica.
- **SC-008**: El gate local completo (`tsc`, `lint`, `arch:check`, `test`, `build`) queda verde.

---

## Assumptions

- SPEC-230 está mergeado en `feature/001-scaffolding` antes de que esta SPEC rebases; de lo contrario los modelos `Expediente` / `EventoExpediente` no existirán y el rebase fallará.
- Los parámetros `padre.score.*` y `padre.patron.*` sembrados por SPEC-230 están disponibles; esta SPEC solo añade `padre.senal_comunitaria.refresh_min`.
- La compilación lee `EventoExpediente.texto` solo para conteos internos (longitud, tokens) y nunca lo incluye en salidas.
- El PDF usa `pdfmake` (ya dependencia del proyecto); no se introduce librería nueva sin ratificación de ZEUS.
- El almacenamiento de PDFs es filesystem local en `/data/informes/` dentro del contenedor `pi-app`, montado mediante volumen en `docker-compose.prod.yml`.
- El worker `pi-senal-comunitaria` se modela como servicio Docker separado con `TZ=America/Bogota`, siguiendo el patrón de `pi-worker`, `pi-monitor` y `pi-simulador-abuso`.

- La invalidación de caché es "event-based simple": en esta fase se implementa como polling periódico contra una tabla de invalidaciones (o marcas `invalidado`); notificaciones push quedan para SPEC-236.
- No se implementan en esta SPEC: bandeja del comité, aclaración padre-comité, notificaciones, auto-cierre, transiciones de estado, escalación ROJO ni UI `/dashboard/padre/*`.

---

## Implementación *(pendiente de ejecución)*

> Esta sección se completa al cerrar la SPEC. Ahora mismo describe el plan a ejecutar tras aprobación de ZEUS.

### Resumen de cambios previstos

- **Migración aditiva** `20260823010000_padre_v2_compilacion_senal_patrones`: añade `InformeConsolidado`, `SenalComunitariaCache`, `PatronExpediente` y el enum `TipoPatronExpediente`.
- **Seed**: parámetro `padre.senal_comunitaria.refresh_min` INTEGER 60 en `prisma/seed.ts` (upsert anti-I-100).
- **Servicio de compilación**: `src/lib/expediente/compilacion/compilar-expediente.ts`, queries SQL en `agregar-categorias.ts` y `senal-comunitaria.ts`, reglas N1 puras (con severidad MEDIA/ALTA que aportan al score vía `padre.score.peso_aceleracion`), score parametrizado y renderizado de `resumenTextoGenerado`.
- **Kit evidencia PDF**: `src/lib/expediente/pdf/generar-pdf.ts` con `pdfmake`, hash SHA256 reproducible y timestamp Bogotá.
- **Repositorios DAL**: `informe-consolidado-repository.ts`, `senal-comunitaria-repository.ts`, `patron-expediente-repository.ts`.
- **Endpoint**: `GET /api/publico/verificar-pdf/[hash]/route.ts` con rate-limit.
- **Worker**: `scripts/worker-senal-comunitaria.mjs` y servicio en `docker-compose.prod.yml`.
- **Tests**: reglas N1, score, seed idempotente, query señal, template markdown, PDF hash reproducible, esquema sin PII.

### Gate local a verificar

- `npx tsc --noEmit` ✅
- `npm run lint --no-cache` ✅
- `npm run arch:check` ✅
- `npm run test` ✅
- `npm run build` ✅
- `./scripts/dev-restart.sh` ✅

### Deuda técnica / notas

- La determinización del PDF requiere fijar el timestamp de generación a segundos y serializar JSON con keys ordenadas canónicamente; se documentará en `generar-pdf.ts`.
- El worker de señal comunitaria podría evolucionar a invalidación por cola pg-boss en SPEC-236; esta fase usa polling simple para no bloquear dependencias.
- La relación inversa `Expediente.informes` y `Expediente.patrones` se añade en Prisma si ZEUS la ratifica en la compuerta; de lo contrario se consulta por FK sin relación inversa.
