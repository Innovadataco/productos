# Feature Specification: Panel de spam — confianza real + motivo de ingreso

**Feature Branch**: `work/002-PI-ciclo-operador`
**SPEC**: 262
**Radicado**: 002-PI-165
**Created**: 2026-08-26
**Status**: DESARROLLO
**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0 §4.2 §5.2 · I-113

Impacto en arquitectura: modifica **`src/app/api/admin/spam/pendientes/route.ts`** y su componente cliente para que la columna "confianza" refleje el score REAL de SPAM y para añadir la etiqueta **"motivo de ingreso"** con los tres valores canónicos definidos por SPEC-207 (`spam_confianza_alta`, `spam_dominancia`, `spam_publicitario_deterministico`). Sin migraciones. Los datos ya viven en `ClasificacionIA.categoriasSecundarias` (score SPAM de la rúbrica) y se rederiva el motivo en runtime a partir del texto y de la rúbrica — sin acoplar el panel al `AuditLog`. Cero cambios en `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El ADMIN ve la confianza real, no 0.0 % falso (Priority: P1)

Con `RPT-2JFULR` en producción (ganó `OFRECIMIENTO_REGALOS` 0.667, SPAM 0.33 → entró por dominancia), el panel hoy pinta "0.0 %". Después del fix debe mostrar **~33 %** (el score de SPAM en la rúbrica) y la etiqueta "por dominancia SPAM".

**Why this priority**: la corrección de I-105 (motor) queda inutilizada si el operador ve 0 % y concluye "falso positivo".

**Independent Test**: `GET /api/admin/spam/pendientes` con un reporte `POSIBLE_SPAM` cuya `clasificacion.categoria !== "SPAM"` y cuyas `categoriasSecundarias` incluyen `{ categoria: "SPAM", score: 0.33 }` devuelve `{ confianzaSpam: 0.33, motivoIngreso: "spam_dominancia" }`.

**Acceptance Scenarios**:

1. **Given** un `POSIBLE_SPAM` que ganó SPAM (`clasificacion.categoria === "SPAM"`, confianza 0.72), **When** el ADMIN abre el panel, **Then** el reporte muestra "72 %" y motivo `spam_confianza_alta`.
2. **Given** un `POSIBLE_SPAM` que ganó otra categoría pero SPAM secundario ≥ `spam.dominancia_umbral`, **When** el ADMIN lo consulta, **Then** muestra el score SPAM de la rúbrica y motivo `spam_dominancia`.
3. **Given** un `POSIBLE_SPAM` que entró por la regla determinística (texto matchea acortadores/tags publicitarios) y no ganó SPAM ni tiene SPAM secundario relevante, **When** el ADMIN lo consulta, **Then** el reporte muestra la etiqueta "regla determinística" **sin porcentaje** (`confianzaSpam: null`, `motivoIngreso: "spam_publicitario_deterministico"`).
4. **Given** un `REVISION_MANUAL` con `clasificacion.categoria === "SPAM"` (el otro brazo del filtro SPEC-181), **When** el ADMIN lo ve, **Then** aparece con `confianzaSpam` = la del modelo y motivo `spam_confianza_alta`.

### User Story 2 — Filtro por motivo de ingreso (Priority: P3)

El ADMIN puede filtrar el listado por motivo (`spam_confianza_alta` | `spam_dominancia` | `spam_publicitario_deterministico`) para analizar por qué el motor está reteniendo casos.

**Independent Test**: `GET /api/admin/spam/pendientes?motivo=spam_dominancia` devuelve solo reportes cuyo motivo derivado es `spam_dominancia`.

### Edge Cases

- Reporte `POSIBLE_SPAM` sin `clasificacion` (ejemplo teórico): `confianzaSpam: null`, `motivoIngreso: "desconocido"`. No crashea, no miente.
- Reporte cuya `clasificacion.categoriasSecundarias` está vacía o mal tipada: se usa `null` y motivo `desconocido`.
- Reporte con `spam_dominancia` cuyo score SPAM secundario es 0.29 (bajo el umbral vigente): sigue mostrando `spam_dominancia` (fue lo que aplicó el motor cuando entró), no se recalcula el umbral hoy.
- El panel `/dashboard/admin/spam` **no cambia de naturaleza** ni de dueño: solo ADMIN (candado del INSTRUCTIVO).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `GET /api/admin/spam/pendientes` DEBE devolver, por cada reporte:
  - `confianzaSpam: number | null` — con la siguiente derivación:
    - Si `clasificacion.categoria === "SPAM"` → `clasificacion.confianza`.
    - Si no, y hay `categoriasSecundarias` con `categoria === "SPAM"` → `score` de SPAM ahí.
    - Si no, y el motivo derivado es `spam_publicitario_deterministico` → `null`.
    - Fallback → `null`.
  - `motivoIngreso: "spam_confianza_alta" | "spam_dominancia" | "spam_publicitario_deterministico" | "desconocido"` derivado en runtime.
- **FR-002**: La derivación del motivo DEBE reutilizar dos funciones puras ya existentes en `src/lib/ai/guardas-decision.ts` **sin modificar el motor**:
  - Rama SPAM ganó → `spam_confianza_alta` cuando `clasificacion.categoria === "SPAM"` y `confianza >= umbralSpam`.
  - Rama determinística → invocar `detectarSpamPublicitarioDeterministico(texto, dominiosAcortadores)` (pura, ya exportada) sobre el texto DESCIFRADO del reporte.
  - Rama dominancia → si no matcheó determinística y `categoriasSecundarias.SPAM.score >= spam.dominancia_umbral`.
- **FR-003**: El `umbralSpam` y `spam.dominancia_umbral` se leen de `ParametroSistema` (helper `getParametroSistema`) cuando arranca el endpoint; se cachean por request. Sin migraciones.
- **FR-004**: El campo `motivoIngreso` DEBE viajar en la respuesta JSON del endpoint; la UI del panel de spam DEBE renderizarlo como etiqueta descriptiva ("por confianza alta", "por dominancia SPAM", "regla determinística"). El porcentaje NO se muestra cuando `confianzaSpam === null`.
- **FR-005**: El endpoint DEBE aceptar el query param opcional `motivo` con los cuatro valores del enum FR-001; si se pasa, filtra la salida. El schema `spamPendientesQuerySchema` se extiende.
- **FR-006**: NINGUNA superficie fuera del panel de spam se ve afectada. La ficha del reporte (`api/admin/reportes-revision/[id]`) no cambia en esta SPEC.
- **FR-007**: El repositorio `ReporteRepository.findBandejaSpam` DEBE seleccionar además `categoriasSecundarias`, `texto`, y — para el brazo determinístico — el texto descifrado (ya se descifra en la ruta). Se preserva `SELECT_BANDEJA_SPAM` como fuente única del select.
- **FR-008**: Sin `AuditLog` como fuente de verdad para el motivo: la derivación se hace desde datos ya persistidos en `ClasificacionIA` + texto. Esto evita acoplar el panel al log.

### Key Entities

- `ClasificacionIA.categoriasSecundarias` (JSON): ya existente; contrato `{ categoria: CategoriaConducta, score: number }[]`.
- `ParametroSistema.spam.dominancia_umbral` (default 0.3, ya seedeado por SPEC-199).
- `ParametroSistema.spam.confianza_minima` (default 0.7, ya seedeado): usado como `umbralSpam` para `spam_confianza_alta`.

---

## Success Criteria *(mandatory, measurable)*

- **SC-006**: con `RPT-2JFULR` en la BD, `GET /api/admin/spam/pendientes` devuelve el reporte con `confianzaSpam ≈ 0.33` y `motivoIngreso: "spam_dominancia"`; el panel muestra "33 %" y la etiqueta "por dominancia SPAM" — **NO** "0.0 %". Verificado en vivo tras deploy.
- **SC-006b**: un reporte con `motivoIngreso: "spam_publicitario_deterministico"` NO muestra porcentaje.
- **SC-006c**: un reporte con SPAM ganador muestra `motivoIngreso: "spam_confianza_alta"` y la confianza del modelo.
- **SC-013**: verificación en vivo post-deploy: el CEO entra como ADMIN y ve las tres variantes correctamente.

---

## Assumptions

- El motor (`src/lib/ai/guardas-decision.ts`) exporta ya `detectarSpamPublicitarioDeterministico` (verificado, línea 14). Se REUTILIZA como función pura, no se modifica.
- El texto descifrado ya viaja en la respuesta actual (`descifrarTextoReporte(r.texto)`); se aprovecha esa lectura para el matcheo determinístico sin doble descifrado.
- Los umbrales pueden variar por parámetro; la derivación siempre usa los valores vigentes al consultar, no los históricos del momento en que se procesó el reporte. **Trade-off aceptado**: el panel muestra la interpretación actual del motor, no una foto histórica; esto encaja con el propósito analítico del panel (§1 BRIEF).

---

## Dependencies

- Independiente de SPEC-261, 263, 264 (mismo lote, sin acoplamiento). Merges secuenciales tras 002-PI-157.
