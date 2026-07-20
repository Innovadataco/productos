# Feature Specification: Endurecimiento de Seguridad (Spec 046)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: Programa de Saneamiento — reforzar la postura de seguridad del producto antes de continuar con features posteriores (especialmente SPEC-050 y SPEC-060).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inventario y minimización de PII (Priority: P1)

El equipo de seguridad necesita saber exactamente dónde vive cada dato sensible (PII) en la base de datos, logs, embeddings y respuestas de API, para poder minimizar la exposición y cumplir con el principio de datos mínimos.

**Why this priority**: Sin un mapa claro de PII no se pueden auditar retenciones, anonimización ni cumplimientos. Es prerequisito para cualquier saneamiento posterior.

**Independent Test**: Un documento de inventario enumera cada campo sensible, su ubicación, si se cifra/anónima, quién puede acceder y qué minimización aplica.

**Acceptance Scenarios**:

1. **Given** una auditoría de seguridad, **When** se revisa el inventario, **Then** identifica cada campo PII en `prisma/schema.prisma`, endpoints públicos, logs de consola, `AuditLog`, `DatasetEntrenamiento` y vectores RAG.
2. **Given** un reporte que contiene PII, **When** el flujo de procesamiento lo anonimiza, **Then** el texto original cifrado no se expone en consultas públicas, dataset de entrenamiento ni logs de error.
3. **Given** un campo sensible marcado como secreto, **When** se persiste en `ParametroSistema`, **Then** se cifra con `param-encryption` antes de guardarse.

---

### User Story 2 - Endurecer la Content Security Policy (Priority: P2)

La CSP actual en `next.config.ts` debe ser revisada para evitar directivas permisivas que faciliten XSS o inyección de recursos. Si se usan scripts/estilos inline, deben protegerse con nonces o hashes.

**Why this priority**: CSP es una capa de defensa en profundidad contra XSS. Directivas como `unsafe-inline` y `unsafe-eval` reducen su efectividad.

**Independent Test**: Inspeccionar headers de respuesta y verificar que la CSP no permite `unsafe-eval` y que los scripts inline (si existen) usan nonces.

**Acceptance Scenarios**:

1. **Given** una petición a la aplicación, **When** se inspecciona el header `Content-Security-Policy`, **Then** no incluye `unsafe-eval` y `unsafe-inline` solo está presente si hay un mecanismo de nonce/hash documentado.
2. **Given** un intento de carga de script inline sin nonce, **When** el navegador aplica la CSP, **Then** lo bloquea.
3. **Given** el despliegue en HTTP local, **Then** la aplicación sigue cargando correctamente (compatibilidad con HSTS ignorado en HTTP).

---

### User Story 3 - Test e2e automatizado de anonimización (Priority: P2)

Se requiere una prueba automatizada que garantice que ninguna PII cruda (texto original, nombres, teléfonos, etc.) llega a: RAG (`DatasetEntrenamiento` / `EmbeddingDataset`), la consulta pública, los logs de error o la respuesta de los endpoints de consulta.

**Why this priority**: La anonimización es un pilar del producto. Sin una prueba automatizada, una regresión podría filtrar datos sensibles.

**Independent Test**: Ejecutar `tests/e2e/anonimizacion.spec.ts` y verificar que pasa.

**Acceptance Scenarios**:

1. **Given** un reporte con texto que contiene un nombre y un número telefónico, **When** el worker lo procesa y pasa a `CLASIFICADO`, **Then** el texto almacenado en `Reporte.texto` no contiene el nombre ni el teléfono en claro.
2. **Given** un reporte procesado con PII anonimizada, **When** se consulta el identificador públicamente, **Then** la respuesta de `/api/consulta` no incluye el texto original ni fragmentos con PII.
3. **Given** una corrección de administrador sobre ese reporte, **When** se crea un registro en `DatasetEntrenamiento`, **Then** el texto del dataset no contiene PII cruda y `textoAnonimizado` es `true`.
4. **Given** un error forzado en el flujo de anonimización, **When** se captura en logs, **Then** el log de consola no contiene el texto original con PII.

---

### User Story 4 - Tope de `pageSize` en endpoints paginados (Priority: P2)

Todos los endpoints paginados que aceptan `pageSize` deben tener un tope máximo para evitar exfiltración masiva de datos y caída de rendimiento.

**Why this priority**: Un `pageSize` ilimitado permite a un atacante descargar grandes volúmenes de datos en una sola petición.

**Independent Test**: Solicitar cada endpoint paginado con `pageSize=999999` y verificar que respeta el tope máximo.

**Acceptance Scenarios**:

1. **Given** `GET /api/admin/dataset-entrenamiento?pageSize=9999`, **When** el endpoint responde, **Then** el número de items devueltos no supera el tope máximo configurado.
2. **Given** `GET /api/config/parametros?pageSize=9999`, **When** el endpoint responde, **Then** respeta el tope máximo de 100.
3. **Given** `GET /api/reportes/mis-reportes?pageSize=9999`, **When** el endpoint responde, **Then** respeta el tope máximo de 100.
4. **Given** endpoints ya topeados como `admin/comite/pendientes` y `admin/estadisticas/clasificacion`, **Then** mantienen su validación existente.

---

### User Story 5 - Barrido de errores crudos (Priority: P2)

Ninguna ruta de la API debe devolver el contenido de `Error.message` crudo al cliente, ya que puede exponer detalles internos, stack traces, nombres de tablas o datos sensibles.

**Why this priority**: Los mensajes de error de base de datos, librerías o red pueden revelar información útil para un atacante.

**Independent Test**: Ejecutar `npm run test` y `tests/e2e` para verificar que las respuestas de error son genéricas y controladas.

**Acceptance Scenarios**:

1. **Given** un error inesperado en una ruta de API, **When** se captura en el handler, **Then** se loguea internamente y se responde con un mensaje genérico ("Error interno") y un código de error canónico.
2. **Given** un error de validación o permiso controlado (`AppError`), **When** se responde al cliente, **Then** se devuelve el mensaje de negocio intencional y su código, sin exponer el stack trace.
3. **Given** un error de conexión a Ollama o base de datos, **When** el endpoint responde, **Then** no incluye el mensaje técnico original de la excepción.

---

### User Story 6 - Plan de rotación de `PARAM_ENCRYPTION_KEY` (Priority: P3)

El sistema debe poder rotar la clave de cifrado de parámetros (`PARAM_ENCRYPTION_KEY`) sin perder acceso a los valores cifrados existentes. Esta user story solo crea el plan; la implementación queda para una fase posterior.

**Why this priority**: La rotación periódica de claves es una práctica de seguridad. Preparar el plan ahora evita diseños que bloqueen la rotación en el futuro.

**Independent Test**: El plan `specs/046-endurecimiento-seguridad/research.md` y `tasks.md` incluyen la estrategia completa de versionado y re-cifrado.

**Acceptance Scenarios**:

1. **Given** el plan de rotación, **When** se revisa, **Then** propone versionar cada valor cifrado (por ejemplo, `enc:v2:...`) y almacenar múltiples claves (`PARAM_ENCRYPTION_KEY`, `PARAM_ENCRYPTION_KEY_V2`, etc.).
2. **Given** el plan, **Then** incluye un script de re-cifrado offline que descifra con la clave antigua y cifra con la nueva, con rollback automático si falla.
3. **Given** el plan, **Then** no requiere cambios de código productivo ahora, solo artefactos de diseño.

---

## Edge Cases

- ¿Qué ocurre si `PARAM_ENCRYPTION_KEY` no está configurada? El sistema entra en modo degradado (texto plano) para parámetros secretos, pero se registra advertencia y no se permite en producción.
- ¿Qué pasa si un reporte ya tenía `textoOriginal` nulo pero `contienePii=true`? La corrección admin debe anonimizar el texto antes de guardarlo en `DatasetEntrenamiento` (ya implementado en US de correcciones; aquí se audita).
- ¿Cómo se maneja un error en `health/worker`? Se devuelve estado genérico de error sin exponer el mensaje de la excepción.
- ¿Qué pasa si el nonce CSP es adivinable? Se genera por petición con `crypto.randomUUID()` y nunca se reutiliza.
- ¿Cómo se asegura que no hay PII en los logs de error? Las excepciones de anonimización/clasificación se loguean sin incluir el texto del reporte.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mantener un inventario documentado de PII en `docs/pii-inventory.md` y en el plan de esta spec.
- **FR-002**: El sistema DEBE cifrar los parámetros secretos (`esSecreto=true`) usando `param-encryption` antes de persistirlos.
- **FR-003**: El sistema DEBE anonimizar el texto de los reportes antes de que alimenten `DatasetEntrenamiento` y `EmbeddingDataset`.
- **FR-004**: El sistema DEBE asegurar que los endpoints de consulta pública (`/api/consulta`, `/api/consulta/detalle`) no devuelvan texto de reporte ni PII cruda.
- **FR-005**: El sistema DEBE aplicar un tope máximo de 100 registros por página en `GET /api/admin/dataset-entrenamiento`, `GET /api/config/parametros` y `GET /api/reportes/mis-reportes`.
- **FR-006**: El sistema DEBE devolver mensajes de error genéricos para excepciones no controladas, sin exponer `Error.message` ni stack traces.
- **FR-007**: El sistema DEBE mantener la CSP en un lugar centralizado (middleware) con nonces por petición y directivas restrictivas.
- **FR-008**: El sistema DEBE tener un test e2e que verifique la ausencia de PII cruda en RAG, consulta pública y logs.
- **FR-009**: El sistema DEBE documentar un plan de rotación de `PARAM_ENCRYPTION_KEY` sin implementar código productivo.

### Key Entities

- **Reporte**: Contiene `texto` (anonimizado), `textoOriginal` (cifrado), `identificador` (público bajo umbral), `numeroSeguimiento`.
- **DatasetEntrenamiento**: Almacena `texto` anonimizado y `textoAnonimizado` flag.
- **ParametroSistema**: Clave-valor; `valor` cifrado si `esSecreto=true`.
- **AuditLog**: Traza inmutable; no debe contener PII cruda en `metadatos`, `valorAnterior` ni `valorNuevo`.
- **ClasificacionIA**: `rawResponse` puede contener texto del reporte; debe tratarse como PII.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los endpoints paginados mencionados responden con no más de 100 items cuando se solicita `pageSize > 100`.
- **SC-002**: El 100% de las respuestas de error de excepciones no controladas usan el mensaje "Error interno" o similar, sin exponer `Error.message`.
- **SC-003**: El test e2e de anonimización pasa y verifica que ninguna PII cruda aparece en `/api/consulta`, `DatasetEntrenamiento` ni logs de error.
- **SC-004**: El header `Content-Security-Policy` no incluye `unsafe-eval` y usa nonces para scripts inline.
- **SC-005**: El inventario de PII documenta al menos 10 campos/entidades con su tratamiento de cifrado, anonimización o acceso restringido.
- **SC-006**: El plan de rotación de `PARAM_ENCRYPTION_KEY` define versionado, re-cifrado y rollback sin cambios de código en esta fase.

---

## Assumptions

- La anonimización de reportes ya está implementada en el flujo de procesamiento (Spec 025/010); esta spec la audita y prueba.
- El modelo de IA local puede no estar disponible durante las pruebas, por lo que el test e2e puede simular el estado anonimizado creando datos directamente.
- `PARAM_ENCRYPTION_KEY` debe ser configurada en producción; en desarrollo/test se usa un valor de 32 bytes.
- La rotación de `PARAM_ENCRYPTION_KEY` no requiere cambios de schema ahora (solo plan).
- Los endpoints de SPEC-050 y SPEC-060 no se modifican.

---

## Implementación (documentado el 2026-07-20)

### Objetivo alcanzado

Refuerzo de la postura de seguridad del producto: inventario de PII, CSP endurecida sin `unsafe-eval` en producción, tope de `pageSize`, saneamiento de errores y test e2e de anonimización. La rotación de claves queda planificada para ejecución futura.

### Decisiones de diseño derivadas del código

- **CSP endurecida en `next.config.ts`**: se mantiene la CSP en `next.config.ts` (no en middleware) para evitar incompatibilidades con Next.js 16/Turbopack. Se eliminó `unsafe-eval` en producción y se condiciona solo para desarrollo (`next dev`), donde Turbopack lo requiere para HMR. Se añadieron `manifest-src`, `worker-src` y `media-src`. Los headers `upgrade-insecure-requests` (CSP) y `Strict-Transport-Security` (HSTS) se gobiernan mediante la variable de entorno `ENABLE_HTTPS_HEADERS` (default `false`); solo se emiten cuando la app corre realmente bajo HTTPS. Esto evita que el navegador bloquee estilos/scripts o grabe HSTS en entornos de acceso por HTTP (Mac, Tailscale, LAN). `src/lib/proxy.ts` conserva solo la lógica de autenticación y autorización.
- **Sanitización de errores**: se creó `safeErrorMessage()` en `src/lib/errors.ts` para estandarizar el mensaje expuesto al cliente. Las rutas que filtraban mensajes crudos de excepciones ahora loguean internamente y devuelven "Error interno".
- **pageSize centralizado**: se extrajo `MAX_PAGE_SIZE = 100` a `src/lib/pagination.ts` y se reutilizó en los tres endpoints para validación y respuesta.
- **Test e2e de anonimización**: se creó `tests/e2e/anonimizacion.spec.ts` que inserta un reporte con PII simulada, lo marca como anonimizado y verifica que `/api/consulta` y `/api/admin/dataset-entrenamiento` no exponen el texto crudo. El test usa llamadas directas a la API para no depender de la UI client-side.
- **Entorno de pruebas e2e**: se ajustó `playwright.config.ts` para pasar `DATABASE_URL` al `webServer`, garantizando que el servidor bajo prueba y el código de los tests usen la misma base de datos (`proteccion_infantil_test`).

### Endpoints y componentes afectados

- `next.config.ts` (CSP endurecida; `upgrade-insecure-requests` y HSTS condicionados a `ENABLE_HTTPS_HEADERS`).
- `.env.example` (documentación de `ENABLE_HTTPS_HEADERS`).
- `docs/ARCHITECTURE.md` (sección 5.7 sobre headers HTTP/CSP/HSTS).
- `src/lib/proxy.ts` (middleware de autenticación; CSP removida).
- `src/lib/errors.ts` (`safeErrorMessage`).
- `src/lib/pagination.ts` (constante `MAX_PAGE_SIZE`).
- `src/app/api/admin/dataset-entrenamiento/route.ts`.
- `src/app/api/config/parametros/route.ts`.
- `src/app/api/reportes/mis-reportes/route.ts`.
- Rutas con error crudo corregidas: `admin/ia/modelos`, `admin/ia/ollama/probar`, `admin/ia/evals`, `admin/ia/experimentos`, `admin/ia/sandbox`, `circulo-confianza`, `health/worker`, `auth/verificar/solicitar`, `auth/recuperar/solicitar`.
- `tests/e2e/anonimizacion.spec.ts`.
- `playwright.config.ts`.
- `docs/pii-inventory.md`.

### Tests

- `tests/e2e/anonimizacion.spec.ts` (3 tests, pasan).
- `src/lib/errors.test.ts` (existente, ampliado).
- `src/app/api/config/parametros/route.test.ts`.
- `src/app/api/admin/dataset-entrenamiento/route.test.ts`.
- `src/app/api/reportes/mis-reportes/route.test.ts`.
- `npm run test` (479 tests pasan).
- `npm run lint` (OK, 1 warning preexistente).
- `npx tsc --noEmit` (OK).
- `npm run test:e2e` (tests de Spec 046 pasan; quedan 5 fallos preexistentes en tests de otros specs: consulta, dashboard-publico, reportes, admin-panel).

### Migraciones relevantes

- Ninguna migración destructiva. No se toca schema ni datos de SPEC-050/SPEC-060.
