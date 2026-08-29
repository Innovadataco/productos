# Feature Specification: SPEC-132 — Seguridad de la carga masiva del colegio (S-3 exceljs + S-4 roster server-side)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-055 (radica ZEUS). Dos puntos de seguridad en el flujo de
carga masiva del colegio (`src/lib/colegio/carga/`): **S-3** — el parser lee el Excel de
alumnos con la librería `xlsx` (CVEs conocidos); **S-4** — el roster de nombres de
alumnos viaja en un JWT SIN cifrar (PII de menores expuesta si el token se filtra). Ambos
bloquean la apertura a usuarios reales. El flujo es: `POST /api/colegio/carga/validar`
(parsea y firma un token con TODAS las filas) → `POST /api/colegio/carga/confirmar`
(lee el token e importa).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El Excel se lee con una librería mantenida y límites explícitos (Priority: P1)

Como responsable de seguridad, quiero que la lectura del Excel de alumnos use `exceljs`
(librería mantenida) en vez de `xlsx` (CVEs conocidos), con límites explícitos de tamaño
y filas, de modo que la superficie de parseo no sea un vector de ataque y la carga no
pueda tumbar el servicio.

**Why this priority**: Es la puerta de entrada de archivos arbitrarios subidos por
colegios; la librería actual tiene CVEs públicos y ningún límite defensivo.

**Independent Test**: los fixtures de `parser.test.ts` (fechas, encoding, columnas,
errores por fila) producen EXACTAMENTE el mismo resultado con exceljs; un archivo
sobre el límite (tamaño o filas) se rechaza con error claro.

**Acceptance Scenarios**:

1. **Given** los fixtures actuales del parser (CSV y XLSX con tildes, fechas, columnas
   variables, filas con error), **When** se parsean con la nueva librería, **Then** el
   resultado es idéntico fila a fila (fidelidad total).
2. **Given** un archivo XLSX mayor al límite de tamaño, **When** se intenta parsear,
   **Then** se rechaza con un mensaje claro (sin procesarlo).
3. **Given** un archivo con más filas que el límite, **When** se intenta parsear,
   **Then** se rechaza con un mensaje claro indicando el máximo.
4. **Given** la dependencia, **When** se audita `package.json`, **Then** `xlsx` ya no es
   una dependencia del runtime (eliminada del bundle).

---

### User Story 2 — El roster de alumnos nunca viaja en el token (Priority: P1)

Como responsable de protección de datos, quiero que el roster parseado (nombres de
alumnos) se guarde server-side con expiración y que el token de confirmación firme SOLO
un id de sesión de carga, de modo que ningún dato de menores viaje en el JWT.

**Why this priority**: Un JWT firmado pero NO cifrado expone todo su payload a quien lo
lea (logs del navegador, proxies, historial). Son nombres de menores: PII directa.

**Independent Test**: el JWT de confirmación contiene SOLO un id de sesión (sin filas);
la confirmación lee el roster server-side por ese id; un id vencido o inexistente se
rechaza y exige re-validar.

**Acceptance Scenarios**:

1. **Given** una validación exitosa, **When** se genera el token, **Then** el roster se
   persiste server-side con TTL y el token lleva SOLO el id de sesión de carga
   (decodificable sin filas ni nombres).
2. **Given** un token de sesión válido, **When** se confirma, **Then** el servidor lee el
   roster por el id y ejecuta la misma importación de hoy (mismo resultado).
3. **Given** un token vencido o inexistente, **When** se confirma, **Then** se rechaza
   con error claro exigiendo re-validar el archivo.
4. **Given** el almacenamiento server-side, **When** expira el TTL, **Then** los rosters
   expirados no se usan y se limpian (sin acumulación indefinida).
5. **Given** el token decodificado, **When** se inspecciona su payload, **Then** NO
   contiene nombres, identificadores ni datos de alumnos (guarda de privacidad).

---

### Edge Cases

- Confirmación con el mismo token dos veces (doble click): la sesión se consume o es
  idempotente (mismo resultado que hoy; se documenta).
- Rosters grandes: el límite de filas (S-3) acota también el tamaño del roster almacenado.
- Reinicio del servidor entre validar y confirmar: la sesión sobrevive (está en BD, no
  en memoria).
- Colegio A intentando confirmar con el id de sesión del colegio B: la sesión queda ligada
  a su `colegioId` y se rechaza (misma regla de aislamiento de hoy).
- CSV sigue siendo soportado con el parser manual actual (sin cambios).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La lectura XLSX DEBE usar `exceljs` (la dependencia `xlsx` se elimina del
  runtime), con el MISMO resultado de parseo que hoy (fixtures de `parser.test.ts`
  verdes sin cambiar su expectativa).
- **FR-002**: DEBE haber límites explícitos: tamaño máximo de archivo y máximo de filas
  (valores como parámetros de sistema o constantes documentadas), con error claro al
  excederlos.
- **FR-003**: El roster parseado DEBE persistirse server-side con `colegioId`, TTL y
  limpieza de expirados (migración ADITIVA; nada destructivo).
- **FR-004**: El token de confirmación DEBE firmar SOLO el id de la sesión de carga
  (+ `colegioId` para la guarda de aislamiento); NINGÚN dato de alumno en el JWT.
- **FR-005**: La confirmación DEBE leer el roster por el id, rechazar ids
  vencidos/inexistentes/ajenos con error claro, y producir la MISMA importación que hoy.
- **FR-006**: La limpieza de sesiones expiradas DEBE ejecutarse (job periódico del worker
  o borrado al leer, documentado).
- **FR-007**: Tests: fidelidad del parser (fixtures intactos), límites, token sin PII,
  confirmación por id, id vencido/ajeno rechazado. El motor, el schema de Reporte y la
  visibilidad NO se tocan.

### Key Entities *(include if feature involves data)*

- **`CargaRosterSesion`** (nueva, ADITIVA): `id` (cuid), `colegioId`, `filas` (Json del
  roster validado), `creadoEn`, `expiraEn`. El roster muere con su TTL.
- **Token de confirmación**: JWT corto (15 min) con SOLO `{ sesionId, colegioId }`.
- **`FilaCargaAlumno`**: forma del roster (sin cambios; la misma que valida hoy el parser).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `parser.test.ts` pasa con exceljs sin modificar las expectativas (fidelidad).
- **SC-002**: Archivo sobre el límite (tamaño o filas) rechazado con error claro (tests).
- **SC-003**: El payload del JWT decodificado NO contiene ningún nombre/identificador de
  alumno (test de guarda que falla si vuelve a entrar).
- **SC-004**: Confirmación end-to-end con roster server-side produce la misma importación
  (tests del flujo validar→confirmar) y un id vencido/ajeno se rechaza.
- **SC-005**: `xlsx` fuera de las dependencias del bundle de producción (verificable en
  `package.json`), suite completa + `tsc --noEmit` + build + `arch:check` verdes.

## Assumptions

- `exceljs` se añade como dependencia de runtime (justificado: reemplaza una librería con
  CVEs por una mantenida; no hay alternativa mantenida ya instalada).
- La app corre como un solo proceso web (standalone): la sesión en BD funciona igual en
  todos los entornos y sobrevive reinicios.
- El CSV manual actual se conserva (no es superficie de la CVE y funciona).
- El flujo validar→confirmar es interactivo (minutos): un TTL de 15 min como hoy.
- El aislamiento por colegio se mantiene ligando la sesión a `colegioId` (misma regla
  que el token actual).

## Impacto en arquitectura

Impacto en arquitectura: TOCA `src/lib/colegio/carga/` (parser → exceljs + límites,
token → id de sesión), las rutas `api/colegio/carga/validar|confirmar`, añade la tabla
ADITIVA `CargaRosterSesion` (+ `01-modelo-datos.md` regenerado), la dependencia `exceljs`
(y retira `xlsx`), y una limpieza de sesiones expiradas. NO toca el motor de IA, el
schema de Reporte, la visibilidad ni otros flujos del colegio.

## Implementación (cierre)

Implementada el 2026-08-01 en `feature/001-scaffolding` (compuerta §4 APROBADA por ZEUS
con las condiciones O-1..O-4, registradas aquí).

- **S-3 (parser seguro)**: `parser.ts` migrado de `xlsx` a `exceljs` con **fidelidad
  total** — los fixtures de `parser.test.ts` conservan sus expectativas intactas (O-1;
  ningún fixture se tocó en silencio). Límites explícitos: `carga.max_archivo_bytes`
  (5 MB) y `colegio.carga.max_filas` (misma clave que la ruta; backstop 2000). `xlsx`
  fuera del árbol por completo, runtime y tests (O-3: `npm ls xlsx` vacío; los fixtures
  XLSX ahora se construyen con exceljs). El CSV manual se conserva.
- **S-4 (roster server-side)**: tabla ADITIVA `CargaRosterSesion` (con FK a Colegio y
  TTL de 15 min); el token de confirmación firma SOLO `{ sesionId, colegioId }` — ningún
  dato de menores viaja en el JWT (guarda de test: el payload nunca lleva roster).
- **Confirmación single-use (O-2)**: lee el roster por id con guardas (vencida,
  inexistente, de otro colegio → rechazo claro) y BORRA la sesión en la MISMA
  transacción del import — la PII no espera al TTL; test: doble confirmación no duplica
  (el test viejo de "idempotencia por reuso del token" se actualizó al nuevo contrato).
  Backstop de limpieza: job del worker cada 15 min (`carga-roster-limpieza`).
- **Gates**: 46 tests del flujo de carga verdes, `tsc --noEmit` limpio, build OK,
  `01-modelo-datos.md` y `06-stack.md` regenerados, `arch:check` VERDE (O-4), suite
  completa verde. Reset de la suite incluye la tabla nueva.
