# Plan de implementación: SPEC-224 — Panel de reglas configurables

## 1. Resumen ejecutivo

Esta spec construye el panel admin de gestión de `ReglaRecomendacion` del módulo Análisis dinero-vs-valor: tabla del catálogo, editor con SQL preview y test en solo lectura contra datos reales, promoción `RECOMIENDA → EJECUTA` con confirmación fuerte (D-77) y versionado con historial auditable. Cuatro pilares:

1. **Superficie de administración** (`/dashboard/admin/analisis/reglas` + `src/components/modules/analisis/`): tabla, editor, historial.
2. **API** (`src/app/api/admin/analisis/reglas/**`): CRUD, test SQL, cambio de modo, historial — con `verifyAuth("ADMIN")` + `assertModulo("analisis_admin")` + rate limit + Zod.
3. **Servicio de reglas** (`src/lib/analisis/reglas/`): validador estático de SQL, ejecutor de test en transacción `READ ONLY`, versionado transaccional.
4. **Datos aditivos**: tabla `ReglaRecomendacionHistorial`, columna aditiva `version` (si SPEC-221 no la trae), valores `AccionAudit` `REGLA_*`, clave de módulo `analisis_admin`, parámetros `analisis.reglas.*`.

No evalúa reglas (SPEC-221) ni ejecuta acciones automáticas (SPEC-226).

## 2. Decisiones de arquitectura

### 2.1 Ejecución segura del SQL de prueba

Decisión central de la spec. El admin escribe SQL arbitrario; el test debe ser imposible de convertir en escritura y acotado en tiempo.

- **Barrera principal — transacción de solo lectura**: `prisma.$transaction` interactiva con `SET TRANSACTION READ ONLY` y `SET LOCAL statement_timeout = <param>` ejecutados dentro de la TX vía `$executeRaw`. PostgreSQL garantiza que ninguna escritura puede ocurrir en esa TX aunque el validador falle. La query se ejecuta con `$queryRawUnsafe` (es SQL de admin, no input de usuario final; la parametrización no aplica a SQL libre) dentro de esa misma TX.
- **Barrera secundaria — validador estático** (`validar-sql.ts`): función pura que normaliza (quita comentarios `--` y `/* */`, colapsa espacios, preserva literales) y rechaza: no iniciar con `SELECT`/`WITH`, más de una sentencia (`;` fuera de literales seguido de contenido), y palabras de mutación como token fuera de literales (`INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE`). Falla cerrado: ante la duda, rechaza.
- **Acotado de filas**: si la query no declara `LIMIT` al nivel exterior, se envuelve como subconsulta `SELECT * FROM (<query>) AS test_limit LIMIT <max>`; si declara `LIMIT` mayor que el máximo, igualmente se envuelve.
- **Alternativas consideradas**:

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| TX `READ ONLY` + `statement_timeout` + validador estático | Garantía a nivel motor DB; sin deps nuevas; defensa en profundidad | `$queryRawUnsafe` requiere disciplina (solo en este servicio) | **Sí** |
| Usuario de BD read-only dedicado | Garantía total incluso sin validador | Segundo connection string / `DATABASE_URL` nuevo; Prisma singleton por rol; complejidad de infra | No (v1) |
| Parser SQL real (pgsql-ast-parser) | Análisis exacto | Dependencia nueva; falsos negativos con sintaxis pg específica; el repo evita deps no justificadas | No |
| Solo validador regex, sin TX readonly | Simple | Una bypass del regex = escritura en prod | No |

### 2.2 Versionado: tabla de historial con snapshot

- Nueva tabla `ReglaRecomendacionHistorial` (aditiva) con snapshot JSON completo del estado anterior + `motivo` + `cambiadoPorAdminId` + `version`. La actualización de la regla y la inserción del snapshot ocurren en la misma `prisma.$transaction`.
- **Alternativas consideradas**: (a) solo campo `version` sin historial — no cumple "versionado" del instructivo ni el tuning del brief §10.4; (b) historial como eventos en `AuditLog` — mezcla auditoría con capacidad de consulta funcional y obliga a reconstruir snapshots; (c) tabla de historial — **elegida**: consulta directa, diff legible, cero impacto en tablas existentes.
- Restauración automática (rollback a versión N) queda **fuera de v1**: restaurar = editar copiando valores, lo que genera versión nueva. Documentado en spec (US-4 escenario 4).

### 2.3 Confirmación fuerte de promoción (D-77)

- Endpoint dedicado `POST /api/admin/analisis/reglas/[id]/modo`, separado del `PATCH` general, para que ningún cambio de modo ocurra "de paso" en una edición.
- `EJECUTA` exige `confirmacion === "EJECUTA"` (string exacto, case-sensitive, validado en servidor con Zod `z.literal("EJECUTA")`) + `motivo` trim ≥ 20 chars. La UI reproduce el patrón "escribe EJECUTA para confirmar" con el botón deshabilitado hasta cumplir ambas condiciones.
- Reversión a `RECOMIENDA` exige motivo (≥ 20) pero no confirmación de texto: salir de autonomía es la operación segura.
- Ambas registran `AuditLog` (`REGLA_PROMOVIDA_EJECUTA` / `REGLA_REVERTIDA_RECOMIENDA`) con `valorAnterior`/`valorNuevo` y motivo en `metadatos`.
- **Alternativas consideradas**: doble clic / modal simple — insuficiente para D-77 ("confirmación fuerte"); código por email — fricción alta para un solo admin y ya existe confirmación tipada como patrón reconocido (GitHub-style).

### 2.4 Permiso de módulo `analisis_admin`

- Se añade al catálogo `src/lib/permisos-catalogo.ts` (categoría `admin`, `esCritico: true`, orden 76, junto a `pagos_admin` en 75) y se siembra `PermisoModulo` concedido a `ADMIN` de forma idempotente. Página y endpoints usan `assertModulo(admin, "analisis_admin")`, siguiendo el patrón exacto de `src/app/api/admin/pagos/planes/route.ts`.
- Se añade item de navegación en `src/lib/nav-items.ts` (`{ href: "/dashboard/admin/analisis/reglas", label: "Análisis · Reglas", modulo: "analisis_admin" }`) junto al de Pagos.
- **Alternativa considerada**: reutilizar el módulo `estadisticas` (el panel principal Análisis de SPEC-222 vive como tab de estadísticas). Rechazada: editar SQL y promover a EJECUTA es una capacidad crítica que merece permiso propio y revocable, igual que `pagos_admin`.

### 2.5 Ubicación y estructura de UI

- Página App Router `src/app/dashboard/admin/analisis/reglas/page.tsx` (Server Component que verifica sesión y delega a un componente cliente) + subruta de detalle/edición en el mismo `page.tsx` con estado cliente (v1: editor en panel lateral/modal sobre la tabla, sin ruta `[id]` separada — el detalle completo lo da el endpoint).
- Componentes cliente en `src/components/modules/analisis/`: `ReglasTable.tsx`, `ReglaEditor.tsx` (con `SqlPreview` + botón Probar + muestra de resultados + chequeo de variables), `ReglaModoDialog.tsx` (confirmación fuerte), `ReglaHistorial.tsx`.
- Sistema visual heredado: vidrio Apple en cards, color `ambar` de Admin (token `ambar` ya existe en `tailwind.config.ts`), radios 16/12/22 según instructivo. Cero CSS fuera de Tailwind.

## 3. Flujos detallados

### 3.1 Test SQL (endpoint `test-sql`)

```text
1. verifyAuth("ADMIN") + assertModulo("analisis_admin") + checkRateLimit("admin_write").
2. Zod: { sqlQuery: string (1..10000), reglaId?: string }.
3. validarSqlRegla(sqlQuery) → si falla, 400 con razón.
4. Envolver con LIMIT si aplica.
5. prisma.$transaction(async (tx) => {
     await tx.$executeRaw`SET TRANSACTION READ ONLY`;
     await tx.$executeRaw`SET LOCAL statement_timeout = ${timeoutMs}`;  // vía $executeRawUnsafe con valor saneado (int)
     const t0 = Date.now();
     const filas = await tx.$queryRawUnsafe(sqlEnvuelta);
     return { filas, duracionMs: Date.now() - t0 };
   }, { timeout: timeoutMs + 2000 })
6. logAudit(REGLA_SQL_TEST, metadatos: { huellaQuery: sha256(sql)[:16], duracionMs, filasMuestra }) — sin filas.
7. Responder { columnas, filas (muestra), filasMuestra, duracionMs }.
8. Error de PG (sintaxis, tabla inexistente, timeout, read-only violation) → 400 con mensaje truncado legible; sin stack trace.
```

### 3.2 Edición con versionado (PATCH)

```text
1. Auth + módulo + rate limit. Zod: campos opcionales + motivo (trim 10..500) obligatorio.
2. Rechazar cambio de `clave` (400) si viene y difiere.
3. Si viene sqlQuery, validarSqlRegla en servidor.
4. prisma.$transaction:
   a. Leer regla actual (404 si no existe).
   b. Insert ReglaRecomendacionHistorial { reglaId, version: regla.version, snapshot: regla completa, motivo, cambiadoPorAdminId }.
   c. Update regla con campos nuevos + version: regla.version + 1.
   d. logAudit(REGLA_ACTUALIZADA o REGLA_ACTIVADA/REGLA_DESACTIVADA según cambio de `activa`).
5. Responder regla actualizada.
```

### 3.3 Cambio de modo

```text
1. Auth + módulo + rate limit.
2. Zod discriminado por `modo`:
   - EJECUTA: { modo: "EJECUTA", confirmacion: z.literal("EJECUTA"), motivo: trim 20..500 }
   - RECOMIENDA: { modo: "RECOMIENDA", motivo: trim 20..500 }
3. Leer regla; si ya está en ese modo → 409 (nada que hacer).
4. Update modo + logAudit correspondiente (valorAnterior/valorNuevo, motivo en metadatos).
5. Si modo resulta EJECUTA y !accionEjecutable → advertencia en la respuesta (la regla se comporta como RECOMIENDA hasta que SPEC-226 tenga acción).
```

## 4. Estructura de archivos propuesta

```text
src/lib/analisis/reglas/
  validar-sql.ts                # validador estático puro
  validar-sql.test.ts
  test-sql.ts                   # ejecución READ ONLY + timeout + LIMIT
  test-sql.test.ts
  versionado.ts                 # snapshot + bump en TX
  versionado.test.ts
  types.ts                      # DTOs del panel

src/lib/schemas/analisis-reglas.ts   # Zod: crear, editar, modo, test

src/app/api/admin/analisis/reglas/
  route.ts                      # GET lista, POST crear
  route.test.ts
  [id]/route.ts                 # GET detalle, PATCH editar
  [id]/route.test.ts
  [id]/modo/route.ts            # POST cambio de modo
  [id]/modo/route.test.ts
  [id]/historial/route.ts       # GET historial
  test-sql/route.ts             # POST test SQL
  test-sql/route.test.ts

src/app/dashboard/admin/analisis/reglas/
  page.tsx                      # tabla + editor + historial (delega a clientes)

src/components/modules/analisis/
  ReglasTable.tsx
  ReglaEditor.tsx
  ReglaModoDialog.tsx
  ReglaHistorial.tsx
  ReglasPanel.test.tsx

src/lib/permisos-catalogo.ts    # + analisis_admin (aditivo)
src/lib/nav-items.ts            # + item Análisis · Reglas
prisma/schema.prisma            # + ReglaRecomendacionHistorial, + version (si falta), + AccionAudit REGLA_*
prisma/seed.ts                  # + parámetros analisis.reglas.*, + PermisoModulo analisis_admin

specs/224-panel-reglas-configurables/
  spec.md, plan.md, research.md, data-model.md, quickstart.md
  checklists/requirements.md, contracts/224-panel-reglas.md
```

## 5. Interfaz pública

Ver `contracts/224-panel-reglas.md` (request/response de los 6 endpoints).

## 6. Fases de implementación

1. **Fase 1 — Datos**: migración aditiva (`ReglaRecomendacionHistorial`, `version` si aplica, `AccionAudit REGLA_*`), seed idempotente (parámetros + permiso), catálogo de módulos + nav.
2. **Fase 2 — Servicio**: `validar-sql.ts`, `test-sql.ts`, `versionado.ts` con tests unitarios.
3. **Fase 3 — API**: 6 route handlers + tests de integración (401/403/400/409/200).
4. **Fase 4 — UI**: página + 4 componentes + test de componente del flujo de promoción.
5. **Fase 5 — Gate**: `npx tsc --noEmit && npm run lint --no-cache && npm run test:unit -- src/lib/analisis src/app/api/admin/analisis && npm run build`, verificación de diff acumulado del lote y `./scripts/dev-restart.sh`.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Bypass del validador estático de SQL | La TX `READ ONLY` es la garantía real; test de integración que intenta `INSERT` dentro de la TX y verifica rechazo de PostgreSQL. |
| `SET LOCAL statement_timeout` con valor interpolado | El valor viene de `ParametroSistema` parseado a entero acotado (1000..30000) antes de interpolarse; nunca string libre. |
| SPEC-221 entrega `ReglaRecomendacion` sin `version` | Migración aditiva propia de SPEC-224 (`ADD COLUMN version INTEGER NOT NULL DEFAULT 1`); documentado en data-model.md. |
| Test-sql sobre tabla grande degrada la app | `statement_timeout` (default 5 s) + `LIMIT` envolvente + rate limit `admin_write`. |
| Diff del mega-lote se contamina | Gate I-101 por SPEC: `git diff --name-status origin/feature/001-scaffolding..HEAD` solo con archivos del lote. |
| UI de promoción ambigua | Diálogo dedicado con campo de confirmación tipada y botón deshabilitado hasta cumplir condiciones; texto neutral sin voseo. |
