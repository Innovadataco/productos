# Feature Specification: SPEC-109 — Eliminar el módulo de apelación actual (D-34)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-28

**Status**: FINALIZADO (SIN desplegar, pendiente release + ACTA)

**Input**: "Eliminar por completo el módulo de apelación de la spec 015 (D-34: se rediseña
desde cero, nada se reutiliza). Crear una apelación ocultaba el identificador de inmediato
sin verificación ni decisión humana; el job que restauraría visibilidad no está programado
(ocultamiento permanente); el SMS es un mock; y actualizarVisibilidadPublica reescribe el
mismo flag ignorando la apelación. PASO 0 verificado en producción: 0 filas en
ApelacionIdentificador."

## Contexto (auditado por ZEUS — no se re-investiga)

El módulo de apelación vivo en producción encarna decisiones erróneas: ocultamiento
inmediato y permanente del identificador sin revisión, SMS simulado (mock) y un flag de
visibilidad que la propia plataforma reescribe. Se elimina COMPLETO; el rediseño (D-34) es
otra spec futura y no reutiliza nada de este módulo.

**PASO 0 (verificado 2026-07-28 en la BD de producción)**: `SELECT COUNT(*) FROM
"ApelacionIdentificador"` = **0**. No hay datos de personas reales que proteger; la tabla
puede eliminarse con migración.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El módulo deja de existir en superficie (Priority: P1)

Como responsable del producto, quiero que la página pública de apelación, sus APIs y su
entrada en el panel admin desaparezcan, para que ningún usuario pueda invocar un flujo que
ocultaba identificadores sin revisión humana.

**Why this priority**: el flujo actual es dañino (ocultamiento permanente sin decisión) y
sigue accesible hoy.

**Independent Test**: las rutas `/apelar`, `/api/apelaciones/**` y
`/api/admin/apelaciones/**` ya no existen (404); el menú admin no muestra "Apelaciones".

**Acceptance Scenarios**:

1. **Given** la app desplegada tras el cambio, **When** se pide `/apelar` o
   `/api/apelaciones/solicitar`, **Then** 404 (la ruta ya no existe).
2. **Given** el panel admin, **When** se renderiza la navegación, **Then** no hay entrada
   "Apelaciones" ni el componente `AdminApelaciones`.

---

### User Story 2 - Datos y permisos limpios (Priority: P1)

Como operador, quiero que el modelo de datos, los permisos de módulos, los parámetros y los
helpers del dominio de apelación se eliminen sin dejar referencias muertas, para que el
código no arrastre un módulo fantasma.

**Why this priority**: las referencias huérfanas (permisos, asignador, proxy, rate-limit,
tests) son la forma en que el módulo sigue "existiendo" después de borrar las rutas.

**Independent Test**: el build pasa sin ninguna referencia a `ApelacionIdentificador` fuera
de la migración; `puedeAccederAModulo("apelaciones")` ya no existe como módulo del
catálogo; la suite completa verde.

**Acceptance Scenarios**:

1. **Given** el schema migrado, **When** se inspecciona, **Then** no existen el modelo
   `ApelacionIdentificador` ni el enum `EstadoApelacion` ni sus relaciones (tabla vacía
   verificada en PASO 0).
2. **Given** el catálogo de permisos, **When** se lista, **Then** no hay módulo
   "apelaciones" ni entrada de menú asociada.
3. **Given** el asignador de operadores, **When** se compila, **Then** no hay rama de
   asignación de apelaciones (los reportes siguen asignándose igual).

---

### User Story 3 - Nada huérfano documentado (Priority: P2)

Como auditor, quiero el listado explícito de lo que quedaba huérfano al eliminar y su
destino, para verificar que nada del módulo sobrevive escondido.

**Why this priority**: una eliminación parcial deja trampas (imports muertos, permisos sin
destino, entradas de menú rotas).

**Independent Test**: el plan/cierre contiene el inventario de referencias eliminadas con
su ubicación, y `git grep apelac` en código productivo no devuelve nada fuera de
specs/docs/cierres históricos.

**Acceptance Scenarios**:

1. **Given** la eliminación aplicada, **When** se busca en el código, **Then** no quedan
   referencias operativas al módulo (solo registros históricos en specs/docs).

---

### Edge Cases

- La tabla de producción está vacía (verificado): la migración DROP es segura; si tuviera
  filas, esta spec no aplica (lo decide ZEUS).
- `src/lib/sms.ts`: se elimina SOLO si nada más lo usa (verificado: solo lo usa el test de
  verificación de apelaciones, que también se elimina).
- `actualizarVisibilidadPublica` NO se toca: queda como dueño único del flag de
  visibilidad.
- Los scopes de rate-limit `apelacion`/`apelacion_sms` se retiran junto con el módulo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Eliminar la página pública `src/app/apelar/` y las APIs públicas
  `src/app/api/apelaciones/**`.
- **FR-002**: Eliminar `src/lib/apelaciones.ts` y `scripts/job-apelaciones-vencimiento.ts`.
- **FR-003**: Eliminar el admin: `dashboard/admin/apelaciones/`, `api/admin/apelaciones/**`,
  `AdminApelaciones` y su entrada en `AdminNav`/`nav-items`.
- **FR-004**: Eliminar el modelo `ApelacionIdentificador`, el enum `EstadoApelacion` y sus
  relaciones, con migración (DROP seguro: tabla verificada vacía en producción).
- **FR-005**: Eliminar del seed los parámetros del módulo (`anti_abuso.apelacion_pausa_dias`
  y `ratelimit.apelacion.*`).
- **FR-006**: Eliminar las referencias en: permisos de módulos (`permisos-catalogo`,
  backfill del seed), asignador de operadores (`asignador.ts`, `permisos.ts`), proxy
  (`PUBLIC_ROUTES`), rate-limit (scopes `apelacion`, `apelacion_sms`), helpers de tests
  (`test-utils`, `reporte-test-utils`, `integracion.test`), `scripts/smoke-apelaciones.ts`
  y tests propios del módulo.
- **FR-007**: Eliminar `src/lib/sms.ts` SOLO si no lo usa nada más (verificado en la
  investigación del plan: solo lo usa el test de apelaciones).
- **FR-008**: NO tocar `actualizarVisibilidadPublica` (dueño único del flag de visibilidad).
- **FR-009**: Gate verde (tsc + lint + test + build) y CI de GitHub en verde. NO desplegar.

### Key Entities

- **Módulo eliminado**: `ApelacionIdentificador` (vacío en producción), `EstadoApelacion`,
  página `/apelar`, APIs públicas y admin, permisos y parámetros asociados.
- **No tocado**: `actualizarVisibilidadPublica` (visibilidad pública de identificadores).

## Success Criteria *(mandatory)*

- **SC-001**: `/apelar` y `/api/apelaciones/**` devuelven 404; el menú admin no muestra
  "Apelaciones".
- **SC-002**: `git grep apelac` en `src/` y `scripts/` no devuelve referencias operativas
  (solo specs/docs históricos).
- **SC-003**: El schema ya no contiene el modelo ni el enum; migración aplicada sin datos
  que perder (0 filas verificado).
- **SC-004**: Gate verde (tsc + lint + test + build) y CI GitHub success.
- **SC-005**: El inventario de huérfanos y su destino queda documentado en el cierre.

## Assumptions

- La tabla en producción está vacía (PASO 0 verificado 2026-07-28: 0 filas). Si al momento
  de migrar apareciera alguna fila, se PARA y se reporta (decisión de ZEUS).
- El rediseño de la apelación (D-34) es otra spec futura; esta spec NO introduce ningún
  reemplazo.
- La eliminación se despliega en el lote que autorice el CEO; esta spec entrega código,
  migración y pruebas.
