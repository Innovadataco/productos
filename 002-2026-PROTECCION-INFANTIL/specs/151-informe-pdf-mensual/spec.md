# Feature Specification: SPEC-151 — Informe PDF mensual determinístico

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-09

**Status**: DESARROLLO

**Input**: Instructivo 002-PI-058, brief §10 fila 11. El rector necesita un informe mensual descargable de actividad del colegio: reportes distintos, alertas, cursos afectados y desglose por curso y categoría de conducta. Debe ser determinístico (mismo mes = mismo contenido), generarse con `@react-pdf/renderer` en el servidor (sin headless/browser) y no exponer PII.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Descargar informe mensual (Priority: P1)

Como rector, quiero descargar un PDF con la actividad mensual del colegio para tener un artefacto tangible de gestión institucional.

**Why this priority**: Es la entrega central de la spec.

**Independent Test**: un SCHOOL_ADMIN pide `GET /api/colegio/reportes/pdf?mes=2026-07` y recibe un PDF no vacío con nombre `informe-mensual-{colegio}-2026-07.pdf`.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN con actividad en julio 2026, **When** solicita el informe, **Then** responde 200 con `Content-Type: application/pdf` y `Content-Disposition: attachment; filename=...`.
2. **Given** el PDF generado, **Then** incluye: nombre del colegio, mes del informe, total de reportes distintos, total de alertas, cursos afectados, desglose por curso y desglose por categoría de conducta.
3. **Given** un mes sin actividad, **When** se solicita el informe, **Then** se genera con totales en cero y sección de "sin actividad".
4. **Given** un mes con formato inválido o futuro, **When** se solicita, **Then** responde 400 sin generar PDF.

---

### User Story 2 — Determinismo y reproducibilidad (Priority: P1)

Como rector, quiero que el informe de un mes sea siempre el mismo, para poder archivarlo y compararlo con confianza.

**Why this priority**: "Determinístico" es un requisito explícito del brief.

**Independent Test**: dos requests del mismo mes generan PDFs con el mismo número de páginas y los mismos conteos; cambiar el día de generación no cambia los datos del mes.

**Acceptance Scenarios**:

1. **Given** dos requests con `mes=2026-07`, **Then** ambos incluyen exactamente los mismos reportes distintos, alertas y categorías.
2. **Given** un reporte creado en agosto, **When** se pide el informe de julio, **Then** ese reporte NO aparece.
3. **Given** un reporte dado de baja después de cerrado el mes, **When** se regenera el informe del mes, **Then** sigue apareciendo (el informe refleja el mes tal como fue, no el estado actual).

---

### User Story 3 — Privacidad y aislamiento (Priority: P1)

Como rector, quiero estar seguro de que el informe no filtra datos personales ni cruza a otros colegios.

**Why this priority**: Protección de menores y Ley 1581.

**Independent Test**: el PDF no contiene nombres de estudiantes, valores de identificadores, textos de reportes ni datos de otro colegio.

**Acceptance Scenarios**:

1. **Given** el contenido textual del PDF, **Then** no contiene nombres de estudiantes, teléfonos, correos, nicks ni textos de reportes.
2. **Given** un SCHOOL_ADMIN del colegio B, **When** solicita un informe, **Then** solo ve conteos de su colegio (404 si intenta forzar otro `colegioId`).

---

## Edge Cases

- **Mes futuro**: 400 con mensaje claro.
- **Mes mal formado**: 400 (Zod).
- **Colegio sin cursos**: informe válido con totales en cero.
- **Colegio vencido**: el proxy/vigencia ya bloquea; el endpoint no necesita lógica extra.
- **Muchos cursos/categorías**: el PDF pagina correctamente.
- **Determinismo vs bajas posteriores**: el informe usa `creadoEn` de la alerta y el estado del reporte al momento de la generación (aceptado: no es un snapshot histórico inmutable; es determinístico en los datos actuales del mes).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Endpoint `GET /api/colegio/reportes/pdf?mes=YYYY-MM` para SCHOOL_ADMIN.
- **FR-002**: Validación Zod del parámetro `mes` (formato `YYYY-MM`, no futuro, no más de 12 meses atrás).
- **FR-003**: Generación con `@react-pdf/renderer` en runtime Node (sin headless/browser).
- **FR-004**: Datos del informe (solo agregados): reportes distintos del mes, alertas del mes, cursos afectados, desglose por curso, desglose por categoría de conducta.
- **FR-005**: Determinístico: mismo mes → mismos conteos y mismas filas.
- **FR-006**: Tenant-first: todo filtrado por `colegioId` del usuario; B no ve datos de A.
- **FR-007**: Cero PII en el PDF: solo conteos y nombres de curso/categoría.
- **FR-008**: Descarga con nombre `informe-mensual-{slug-colegio}-{mes}.pdf`.
- **FR-009**: Auditoría `COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO` con metadatos (mes, tamaño bytes).
- **FR-010**: Tests de integración: 200 con PDF, 400 formato/mes futuro, aislamiento A/B, determinismo.
- **FR-011**: I-29 intacto; no se toca `src/lib/ai/**`; `arch:check` verde.

### Key Entities

- **InformeMensualColegio**: DTO de agregados mensuales (no persiste).
- **DocumentoInformeMensual**: componente `@react-pdf/renderer` que renderiza el PDF.

## Success Criteria *(mandatory)*

- **SC-001**: El endpoint devuelve PDF válido (>0 bytes) para meses con y sin actividad.
- **SC-002**: Dos requests del mismo mes generan PDFs con idénticos conteos (test de determinismo).
- **SC-003**: A/B: B recibe solo datos de B; no cruza PII.
- **SC-004**: `tsc`, `lint`, `tokens:check`, `arch:check` y tests del área verdes.

## Assumptions

- El informe refleja el estado actual de los datos del mes (no es un snapshot histórico inmutable); la determinación se mide por reproducibilidad con los datos actuales.
- Rango permitido: últimos 12 meses incluyendo el actual.
- `@react-pdf/renderer` se instala como dependencia de producción.
- La UI de descarga se agrega en `/dashboard/colegio/estadisticas` (botón adicional) o en `/dashboard/colegio/tablero`; se decide en implementación según diseño.

## Impacto en arquitectura

Añade endpoint (`/api/colegio/reportes/pdf`) y componente React-PDF en servidor. No modifica modelo de datos (salvo posible valor enum `AccionAudit`). No modifica proxy, navegación ni stack.
