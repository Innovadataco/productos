# Feature Specification: SPEC-248 — Categorías Ley 2564 completas + Definiciones legales editables

**Feature Branch**: `work/002-PI-151`

**Created**: 2026-08-24

**Status**: `PLANEADO`

Impacto en arquitectura: agrega 3 valores al enum `CategoriaConducta` (`CIBERACOSO`, `HAPPY_SLAPPING`, `STALKING`) vía migración aditiva PostgreSQL (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`), extiende `RUBRICA_SEMILLA` en `src/lib/ai/rubrica-semilla.ts` con los 3 bloques de preguntas correspondientes y agrega el tipo `DefinicionCategoria` + la constante `DEFINICIONES_CATEGORIA` (14 entradas) en el mismo archivo. Introduce el parámetro `ia.rubrica.definiciones` (análogo a `ia.rubrica.preguntas`) y lo expone editable desde `/admin/ia?tab=rubrica` mediante el componente nuevo `<DefinicionLegalCard/>`. Extiende `GET /api/admin/ia/rubrica` con el campo `definiciones` y agrega `GET/PATCH /api/admin/ia/rubrica/definiciones[/:categoria]`. Actualiza `CATEGORIAS_LABELS`, `scoring.severity.*` (3 valores nuevos) y respeta el `ui.grupos_categoria` ya editado por el CEO. Cierre de brecha normativa: el motor pasa de cubrir 3/6 a 6/6 conductas de la Ley 2564 de 2026 art. 6.

**Input**: Cerrar la brecha del motor de clasificación IA respecto a la Ley 2564 de 2026 art. 6, agregando las 3 categorías de conducta que faltan y dando a `ADMIN`/`COMITÉ_VALIDACIÓN` un mecanismo para editar el fundamento legal de cada categoría sin depender de un deploy. El contenido legal (rúbricas y definiciones) ya está redactado en el brief; esta SPEC solo lo carga en el código y expone su edición.

**Dependencias**: ninguna dura. Precedente 1:1 (patrón a replicar, no bloqueante): SPEC-195 (motor SPAM) + SPEC-199 (parche motor SPAM, excepción de seed forzado).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Motor IA clasifica las 3 conductas nuevas de la Ley 2564 (Priority: P1)

Como sistema de clasificación quiero reconocer `CIBERACOSO`, `HAPPY_SLAPPING` y `STALKING` como categorías de primera clase (rúbrica, severidad, agrupación comercial), para que el motor cubra el 6/6 de las conductas tipificadas en la Ley 2564 art. 6 y no las siga cayendo en `OTRO`.

**Why this priority**: es la brecha de cumplimiento normativo que origina la SPEC; sin esto no hay cierre de brecha.

**Independent Test**: sembrar la BD con el seed actualizado y correr `SimulacionRun` sobre el dataset de prueba con reportes de bullying/stalking/happy-slapping (hoy clasificados en `OTRO`); verificar que ahora clasifican en la categoría correcta sin regresión en las categorías existentes.

**Acceptance Scenarios**:

1. **Given** el enum `CategoriaConducta` en producción, **When** se aplica la migración `agregar_categorias_ley_2564`, **Then** el enum expone `CIBERACOSO`, `HAPPY_SLAPPING` y `STALKING` sin bloquear escrituras concurrentes (Postgres 16, `ADD VALUE IF NOT EXISTS`).
2. **Given** `RUBRICA_SEMILLA` extendida, **When** se siembra `ia.rubrica.preguntas`, **Then** cada categoría nueva tiene exactamente 5 preguntas, con las 2 primeras marcadas `tipo: "decisiva"`.
3. **Given** un reporte de texto que describe hostigamiento repetido con intención de humillar (sin pedir contenido sexual ni dinero), **When** el motor lo clasifica, **Then** el resultado incluye `CIBERACOSO` entre las categorías presentes.
4. **Given** `scoring.severity.*` sembrado, **When** se consulta la severidad de las 3 categorías nuevas, **Then** `CIBERACOSO=60`, `HAPPY_SLAPPING=75`, `STALKING=70`.
5. **Given** el seed corre dos veces seguidas, **When** se compara el estado de `ia.rubrica.preguntas`, `scoring.severity.*` y `ui.grupos_categoria` tras cada corrida, **Then** el resultado es idempotente (sin duplicados, sin resetear ediciones admin de `ui.grupos_categoria`).

---

### User Story 2 — ADMIN edita el fundamento legal de una categoría sin deploy (Priority: P1)

Como `ADMIN` quiero ver y editar la definición legal (conducta, referencia normativa, texto literal, rol dentro de la conducta) de cada categoría desde `/admin/ia?tab=rubrica`, para corregir o actualizar el fundamento legal si cambia la interpretación o la norma, sin depender de un deploy de código.

**Why this priority**: es el segundo mecanismo nuevo de la SPEC (además de las 3 categorías) y el que da sostenibilidad de largo plazo al contenido legal.

**Independent Test**: como `ADMIN`, abrir `/admin/ia?tab=rubrica`, seleccionar una categoría, ver el card `<DefinicionLegalCard/>` con las 4 propiedades, editar `definicionLiteral` y guardar; recargar y confirmar que el cambio persiste y quedó en `AuditLog`.

**Acceptance Scenarios**:

1. **Given** una categoría con definición legal sembrada, **When** un `ADMIN` abre el tab Rúbrica y selecciona esa categoría, **Then** ve un card ámbar con `conductaLegal`, `referenciaNormativa`, `definicionLiteral` y (si aplica) `rolDentroDeConducta`, renderizado ANTES del listado de preguntas.
2. **Given** el card de definición legal, **When** el usuario autenticado NO es `ADMIN` (ej. `COMITE_VALIDACION`), **Then** el card se muestra en solo lectura, sin botón "Editar definición legal".
3. **Given** un `ADMIN` en el modal de edición, **When** envía `PATCH /api/admin/ia/rubrica/definiciones/CIBERACOSO` con los 4 campos, **Then** se actualiza `ia.rubrica.definiciones` para esa categoría únicamente (las otras 13 quedan intactas) y se registra `AuditLog` con `accion: RUBRICA_DEFINICION_UPDATE`, `valorAnterior`, `valorNuevo` y la categoría en `metadatos`.
4. **Given** un usuario no-`ADMIN` autenticado, **When** intenta `PATCH /api/admin/ia/rubrica/definiciones/[categoria]`, **Then** recibe `403`.
5. **Given** una categoría inexistente en el enum, **When** se hace `PATCH /api/admin/ia/rubrica/definiciones/NO_EXISTE`, **Then** se recibe `404` sin tocar el parámetro.
6. **Given** `GET /api/admin/ia/rubrica`, **When** se consulta, **Then** la respuesta conserva los campos existentes (`preguntas`, `modelos`, `temperatura`, `umbralPresencia`, `modeloEmbudo`) y agrega `definiciones` con las 14 entradas — cero breaking change.

---

### User Story 3 — Simulación obligatoria antes de activar en producción (Priority: P1)

Como responsable del motor (ZEUS/CEO) quiero que la rúbrica ampliada pase por `SimulacionRun` sobre el dataset actual antes de aceptarse, para verificar que no hay regresión en las categorías que ya clasificaban bien y que las 3 nuevas capturan lo que antes caía en `OTRO`.

**Why this priority**: es el candado de calidad del brief (§7); sin esto la SPEC no puede darse por completada aunque el código esté correcto.

**Independent Test**: ejecutar `SimulacionRun` con la rúbrica de 14 categorías sobre el dataset de evaluación existente; comparar contra el baseline de 11 categorías.

**Acceptance Scenarios**:

1. **Given** el dataset de evaluación existente, **When** se corre `SimulacionRun` con las 14 categorías activas, **Then** el reporte incluye precision/recall/confusion matrix para las 14 categorías.
2. **Given** los casos ya bien clasificados en `SPAM`/`SOLICITUD_MATERIAL`/`EXTORSION` (u otras existentes), **When** se comparan contra el baseline, **Then** no hay regresión (mismo resultado o mejor).
3. **Given** casos de prueba de bullying/stalking/happy-slapping previamente clasificados en `OTRO`, **When** se re-clasifican, **Then** caen en `CIBERACOSO`/`STALKING`/`HAPPY_SLAPPING` según corresponda.
4. **Given** el resultado de la simulación, **When** se documenta, **Then** queda un `AuditLog` con el resumen antes de aceptar la rúbrica para producción.

---

### Edge Cases

- ¿Qué pasa si `ia.rubrica.definiciones` no existe todavía (primera corrida del seed en un ambiente nuevo)? → se siembra desde `DEFINICIONES_CATEGORIA` (constante fallback en código).
- ¿Qué pasa si el CEO ya editó `ui.grupos_categoria` desde admin antes de correr este seed? → el seed usa `update: {}` (idempotente respetuoso); no pisa la edición existente, solo crea el parámetro si no existe.
- ¿Qué pasa si el motor de rúbrica (`src/lib/ai/rubrica.ts`) necesita `definiciones` para clasificar? → NO las necesita: `definiciones` es metadata informativa para el editor admin, no entra en el prompt de clasificación (embudo/voto no cambian).
- ¿Qué pasa si dos ediciones de `PATCH .../definiciones/[categoria]` llegan casi simultáneas? → último-escribe-gana sobre el JSON completo del parámetro (mismo comportamiento que `ia.rubrica.preguntas` hoy); fuera de alcance un lock optimista (no lo tiene el mecanismo existente que se reutiliza).
- ¿Qué pasa si se corre el seed dos veces? → idempotente: `ia.rubrica.preguntas` se fuerza (excepción SPEC-199, cambio estructural), `ia.rubrica.definiciones`/`ui.grupos_categoria`/`scoring.severity.*` respetan ediciones (`update: {}`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE agregar `CIBERACOSO`, `HAPPY_SLAPPING` y `STALKING` al enum `CategoriaConducta` mediante migración aditiva (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`), sin `DROP TYPE` ni `CREATE TYPE` nuevo.
- **FR-002**: El sistema DEBE extender `RUBRICA_SEMILLA` en `src/lib/ai/rubrica-semilla.ts` con los 3 bloques de preguntas del brief §5.2 (copiados literalmente, cero paráfrasis).
- **FR-003**: El sistema DEBE definir el tipo `DefinicionCategoria` (`conductaLegal`, `definicionLiteral`, `referenciaNormativa`, `rolDentroDeConducta?`) y la constante `DEFINICIONES_CATEGORIA` con las 14 entradas del brief §6, en el mismo archivo `rubrica-semilla.ts`.
- **FR-004**: El sistema DEBE sembrar `ia.rubrica.preguntas` con la `RUBRICA_SEMILLA` completa forzando el `update` (excepción documentada SPEC-199: cambio estructural del motor).
- **FR-005**: El sistema DEBE sembrar `ia.rubrica.definiciones` (JSON de `DEFINICIONES_CATEGORIA`) de forma idempotente-respetuosa (`upsert` con `update: {}`).
- **FR-006**: El sistema DEBE sembrar `scoring.severity.CIBERACOSO=60`, `scoring.severity.HAPPY_SLAPPING=75`, `scoring.severity.STALKING=70`, idempotente-respetuoso.
- **FR-007**: El sistema DEBE agregar `CIBERACOSO`, `HAPPY_SLAPPING`, `STALKING` a `ui.grupos_categoria` respetando la agrupación ya editada por el CEO (no resetear si el parámetro ya existe).
- **FR-008**: El sistema DEBE agregar las 3 categorías nuevas a `CATEGORIAS_LABELS` en `src/lib/labels.ts`.
- **FR-009**: `GET /api/admin/ia/rubrica` DEBE incluir el campo `definiciones` (14 entradas) sin remover ni renombrar los campos existentes.
- **FR-010**: El sistema DEBE exponer `GET /api/admin/ia/rubrica/definiciones` (roles `ADMIN` y `COMITE_VALIDACION`, solo lectura) devolviendo todas las definiciones.
- **FR-011**: El sistema DEBE exponer `PATCH /api/admin/ia/rubrica/definiciones/[categoria]` (rol `ADMIN` únicamente) que actualiza una definición individual y registra `AuditLog` (`accion: RUBRICA_DEFINICION_UPDATE`, `valorAnterior`, `valorNuevo`, `metadatos.categoria`).
- **FR-012**: El endpoint PATCH DEBE responder `404` si la categoría no existe en `DEFINICIONES_CATEGORIA`/el parámetro vivo, y `403` si el usuario no es `ADMIN`.
- **FR-013**: `RubricaTab.tsx` DEBE renderizar `<DefinicionLegalCard/>` (componente nuevo) ANTES del listado de preguntas de la categoría seleccionada, con color `ambar`, reutilizando `GlassCard`/`Badge` existentes.
- **FR-014**: El botón "Editar definición legal" DEBE ser visible solo para rol `ADMIN`.
- **FR-015**: El sistema NO DEBE modificar `src/lib/ai/clasificador.ts`, `embudo.ts`, `guardas.ts`, `votos.ts` ni `rubrica.ts` (candado del motor IA); la resolución de `definiciones` para el `GET` extendido se hace en el handler de la ruta, no en `cargarConfigRubrica()`.
- **FR-016**: Antes de aceptar la rúbrica ampliada para producción, el sistema DEBE correr `SimulacionRun` sobre el dataset de evaluación y documentar el resultado (precision/recall/confusion matrix) en `AuditLog`.

### Key Entities

- **`DefinicionCategoria`** (tipo, en `rubrica-semilla.ts`): fundamento legal de una categoría — `conductaLegal`, `definicionLiteral` (texto literal de la ley), `referenciaNormativa`, `rolDentroDeConducta?` (para categorías que comparten una misma conducta legal, ej. las 5 de grooming).
- **`DEFINICIONES_CATEGORIA`**: constante con las 14 `DefinicionCategoria` (fallback confiable en código; el valor vivo lo maneja el parámetro).
- **`ia.rubrica.definiciones`** (`ParametroSistema`, JSON): valor vivo editable desde admin; estructura `Record<CategoriaConducta, DefinicionCategoria>`.
- **`AuditLog` (`accion: RUBRICA_DEFINICION_UPDATE`)**: nuevo valor de `AccionAudit`, additivo, mismo patrón que `CONTACTO_EMERGENCIA_*` (SPEC-239).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El enum `CategoriaConducta` en BD tiene 15 valores (12 actuales + 3 nuevos) tras la migración, verificable con `\dT+ "CategoriaConducta"` sin downtime.
- **SC-002**: `RUBRICA_SEMILLA` tiene 5 preguntas por cada una de las 3 categorías nuevas, con las 2 primeras `tipo: "decisiva"` (verificable por test unitario).
- **SC-003**: `DEFINICIONES_CATEGORIA` tiene exactamente 14 entradas, una por cada valor no-`OTRO` del enum (`SPAM` incluida, sin fundamento legal aplicable).
- **SC-004**: `GET /api/admin/ia/rubrica` responde con los 5 campos previos intactos + `definiciones` con 14 entradas (test de integración, cero breaking change).
- **SC-005**: Un `ADMIN` puede editar y persistir una definición legal en menos de 3 interacciones (abrir tab → seleccionar categoría → editar → guardar), verificable en `quickstart.md`.
- **SC-006**: Correr el seed 2 veces seguidas produce el mismo estado en `ia.rubrica.definiciones`, `scoring.severity.*` y `ui.grupos_categoria` (test de idempotencia).
- **SC-007**: `SimulacionRun` sobre el dataset de evaluación no muestra regresión en las categorías previamente cubiertas y clasifica correctamente los casos de prueba de las 3 categorías nuevas.

## Assumptions

- El contenido legal (5 preguntas × 3 categorías + 14 definiciones) ya está redactado en el brief §5.2/§6; esta SPEC no redacta ni parafrasea texto legal, solo lo copia al código.
- PostgreSQL 16 (`pgvector/pgvector:pg16`, verificado en `docker-compose.yml`) soporta `ALTER TYPE ... ADD VALUE IF NOT EXISTS` sin lock destructivo (Postgres ≥ 12).
- `definiciones` es metadata informativa para el editor admin; no participa en el prompt de clasificación del motor (embudo/voto no cambian, `src/lib/ai/rubrica.ts` no se toca).
- Agregar `RUBRICA_DEFINICION_UPDATE` a `AccionAudit` es una migración aditiva adicional a las 3 de `CategoriaConducta`, en la misma ventana de migración; sigue el patrón ya usado por `CONTACTO_EMERGENCIA_*` (SPEC-239) — ver `plan.md` §Decisiones para el detalle que ZEUS debe auditar en la compuerta.
- Traducciones automáticas, firma digital de definiciones e historial de versiones quedan fuera de alcance v1 (brief §10).
