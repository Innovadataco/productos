# Feature Specification: SPEC-131 — Visibilidad pública solo por reportes aprobados (BL-5)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: PLANEADO

**Input**: Instructivo 002-PI-054 (radica ZEUS; dirección de producto decidida por el CEO).
`src/lib/visibility.ts:30` decide la visibilidad pública con `agregado.totalReportes`
(conteo crudo: incluye SPAM, OTRO y reportes sin clasificar). Un identificador puede
volverse público por reportes basura → choca con §1.3 (presunción de inocencia). La
dirección aprobada: contar SOLO reportes APROBADOS (predicado único `esReporteAprobado`,
D-08: estado ∈ {CLASIFICADO, CORREGIDO} ∧ categoría ∉ {SPAM, OTRO} ∧ no eliminado).
**Hallazgo de fuente (verificado):** `calcularScore` YA filtra aprobados y todo lo
visible al usuario (consulta, seguimiento, ranking, dashboard) fluye por él — el único
consumidor del conteo crudo es la decisión de visibilidad. Además, `totalReportes` tiene
semántica mixta: la creación lo incrementa en crudo y `recalcularYGuardarScore` lo
sobrescribe con el conteo aprobado (queda registrado en research.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — La visibilidad pública solo cuenta conductas reales aprobadas (Priority: P1)

Como responsable del producto, quiero que un identificador SOLO se vuelva visible
públicamente cuando tiene suficientes reportes APROBADOS (conducta real, no spam ni
"otro"), de modo que nadie quede expuesto por reportes basura (presunción de inocencia).

**Why this priority**: Es el consentimiento básico del producto (§1.3): la exposición
pública de un identificador debe basarse en hechos verificados, no en volumen crudo que
cualquiera puede inflar con spam.

**Independent Test**: un identificador con N reportes SPAM y 0 aprobados NO es visible
con ningún umbral; uno con el umbral de aprobados sí lo es.

**Acceptance Scenarios**:

1. **Given** un identificador con solo reportes SPAM/OTRO, **When** se evalúa la
   visibilidad, **Then** NO es visible públicamente (el conteo aprobado es 0).
2. **Given** un identificador con `umbral - 1` aprobados + varios spam, **When** se
   evalúa, **Then** NO es visible (el spam no empuja al umbral).
3. **Given** un identificador con `umbral` aprobados, **When** se evalúa, **Then** es
   visible (si cumple el ratio de autenticados y no hay ocultamiento por comité).
4. **Given** el ratio de autenticados, **When** se calcula, **Then** se calcula sobre la
   MISMA base aprobada (autenticados aprobados / aprobados), no sobre el crudo.

---

### User Story 2 — El agregado expone el conteo aprobado de forma explícita (Priority: P1)

Como mantenedor, quiero que `IdentificadorReportado` tenga contadores APROBADOS
explícitos y consistentes (una sola fuente: el recálculo), de modo que la decisión de
visibilidad no dependa de un campo con semántica mixta.

**Why this priority**: `totalReportes` hoy es crudo al crear y aprobado tras recalcular:
un campo con dos significados es un bug latente. Los contadores aprobados deben ser
explícitos, aditivos (sin romper nada) y con backfill para las filas existentes.

**Independent Test**: tras la migración, cada agregado tiene `reportesAprobados` y
`autenticadosAprobados` iguales al conteo del predicado aprobado; la creación y la
baja mantienen la consistencia en el siguiente recálculo.

**Acceptance Scenarios**:

1. **Given** el schema, **When** se agregan los contadores aprobados, **Then** la
   migración es ADITIVA (campos nuevos con default; nada destructivo).
2. **Given** agregados existentes (escritos por la lógica mixta), **When** corre el
   backfill, **Then** quedan con el conteo aprobado exacto del predicado `whereReporteAprobado`.
3. **Given** un reporte nuevo pendiente de procesar, **When** se crea, **Then** NO suma
   a los contadores aprobados hasta que el pipeline lo clasifica (los PENDIENTE no cuentan).
4. **Given** una baja de reporte aprobado, **When** se recalcula, **Then** los contadores
   aprobados bajan coherentemente y la visibilidad se re-evalúa sobre la misma base.

---

### Edge Cases

- Identificador con reportes PENDIENTE/PROCESANDO: no cuentan hasta que el pipeline
  termina (el recálculo post-clasificación escribe los aprobados).
- Reporte corregido por un humano de "categoría real" a OTRO (o a SPAM): el recálculo lo
  saca del conteo aprobado y puede ocultar al identificador (comportamiento deseado).
- Agregado con `ocultoPorComiteEn` (SPEC-110): sigue ganando (la decisión humana del
  comité prima; el nuevo conteo no la toca).
- Ratio con 0 aprobados: 0 (no división por cero), identificador no visible.
- El email a suscriptores y el score/riesgo: NUNCA se exponen al público (§1.3/§1.5);
  esta spec no cambia lo que el usuario ve, solo CUÁNDO se vuelve visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `actualizarVisibilidadPublica` DEBE decidir la visibilidad con el conteo
  APROBADO (`reportesAprobados >= umbral`), nunca con el total crudo.
- **FR-002**: El ratio de autenticados DEBE calcularse sobre la base aprobada
  (`autenticadosAprobados / reportesAprobados`, 0 si no hay aprobados).
- **FR-003**: `IdentificadorReportado` DEBE exponer contadores aprobados explícitos
  (`reportesAprobados`, `autenticadosAprobados`) vía migración ADITIVA (nada destructivo).
- **FR-004**: La única escritora de los contadores aprobados DEBE ser el recálculo
  (`recalcularYGuardarScore`, que ya computa sobre `whereReporteAprobado`); la creación
  NO los incrementa (un PENDIENTE no cuenta).
- **FR-005**: DEBE existir un script de backfill idempotente que recompute los contadores
  aprobados de TODOS los agregados existentes según el predicado aprobado, con conteo
  verificable.
- **FR-006**: NUNCA se expone score ni nivel de riesgo al público (§1.3/§1.5): la spec
  solo cambia CUÁNDO un identificador se vuelve visible y los conteos de hechos
  agregados (aprobados), no el contenido mostrado.
- **FR-007**: Tests: SPAM/OTRO NO suman a visibilidad; un identificador solo-spam NO es
  visible; el ratio se calcula sobre base aprobada. El motor de clasificación NO se toca.
- **FR-008**: La baja y las correcciones humanas DEBEN re-evaluar la visibilidad sobre la
  misma base aprobada (recálculo existente, ahora consistente).

### Key Entities *(include if feature involves data)*

- **`IdentificadorReportado`**: agregado por identificador+plataforma. Gana
  `reportesAprobados` y `autenticadosAprobados` (aditivos). `totalReportes` queda como
  contador de registros (su semántica mixta queda documentada; la visibilidad ya no lo lee).
- **Predicado aprobado (`esReporteAprobado` / `whereReporteAprobado`)**: fuente ÚNICA de
  conteo (spec 089, D-08). Esta spec NO la redefine: la consume.
- **Parámetros**: `visibility.report_threshold` y `visibility.min_authenticated_ratio`
  (mismos, ahora interpretados sobre base aprobada — el cambio de significado del umbral
  queda documentado para ajuste del CEO si el volumen baja).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un identificador con solo spam/otro NUNCA es visible (test dedicado).
- **SC-002**: SPAM/OTRO no empujan el umbral: `umbral-1` aprobados + N spam → no visible
  (test); `umbral` aprobados → visible (test).
- **SC-003**: El ratio se calcula sobre base aprobada (test con mezcla autenticados/
  anónimos aprobados vs. crudo).
- **SC-004**: Backfill ejecutado en dev con verificación: contadores aprobados = conteo
  del predicado en el 100% de los agregados; segunda corrida = 0 cambios.
- **SC-005**: Suite completa + `tsc --noEmit` + build + `arch:check` verdes; cero cambios
  en la superficie pública mostrada (solo cuándo aparece).

## Assumptions

- El predicado aprobado (spec 089, D-08) es vinculante y NO se redefine.
- `calcularScore` ya cuenta aprobados: el recálculo es la escritora natural de los
  contadores aprobados (una sola fuente).
- El umbral/ratio parametrizados se interpretan sobre base aprobada; si el CEO quiere
  reajustar el umbral por el menor volumen, es un cambio de parámetro aparte (fuera de
  alcance).
- `totalReportes` (crudo) se conserva para diagnóstico interno; su semántica mixta se
  documenta como deuda y la visibilidad deja de leerlo.
- La corrección DESBLOQUEA F5 (métrica del match) que ZEUS radica después; esta spec no
  la implementa.

## Impacto en arquitectura

Impacto en arquitectura: TOCA `src/lib/visibility.ts` (lectura aprobada),
`src/lib/scoring.ts` (el recálculo escribe los contadores aprobados), el schema con
migración ADITIVA (`reportesAprobados`, `autenticadosAprobados` en
`IdentificadorReportado`), un script de backfill idempotente en `scripts/`, y tests de
visibilidad. NO toca el motor de clasificación, ni la consulta pública mostrada, ni la
creación de reportes (salvo dejar de incrementar contadores aprobados, que nunca fueron
aprobados).

## Implementación (cierre)

*(Se completa al cerrar la spec.)*
