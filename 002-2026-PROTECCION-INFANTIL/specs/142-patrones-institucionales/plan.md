# Implementation Plan: SPEC-142 — Patrones institucionales para colegios (F6)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/142-patrones-institucionales/spec.md` (002-PI-056, F6)

## Summary

Post-hook de agregación en el worker (mismo punto que `notificarColegioSiCorresponde` /
futuro `EventoMatch` de F5): cuando un reporte APROBADO (predicado único
`esReporteAprobado`, D-08) menciona un identificador vinculado a un alumno, se hace
upsert en la entidad NUEVA `PatronInstitucional` (colegio, grado, conducta, plataforma,
período trimestral, conteo — sin PII). Vista `GET /api/colegio/patrones` + página para
SCHOOL_ADMIN con k-anonimato k=3 aplicado en lectura. Migración ADITIVA. Sin IA.

## Technical Context

**Language/Version**: TypeScript 5 (strict maximal), Node.js >= 22
**Primary Dependencies**: Prisma 5.22, Next.js 16 API Routes, Tailwind 3.4, pdfmake
(P3, patrón ya usado en `src/app/api/colegio/estadisticas/pdf/route.ts`). Nada nuevo.
**Storage**: PostgreSQL — tabla nueva `PatronInstitucional` + columna nullable en
`AlertaColegio` (migración aditiva); parámetro `colegio.patrones.k_anonimato` en
`ParametroSistema` (default 3)
**Testing**: Vitest — integración sobre PostgreSQL de test (patrón de la casa: handler
+ Request nativo, seed en beforeAll); tests unitarios de la regla de k y del mapeo de
dimensiones
**Project Type**: feature de agregación institucional (reactivo → preventivo)
**Constraints**: FR-002 (la entidad NO persiste PII por construcción), FR-005 (puerta =
`esReporteAprobado`, no `ESTADOS_VISIBLES`), FR-008 (migración aditiva), FR-010 (sin
IA, textos curados D-23)
**Scale/Scope**: 1 modelo Prisma + 1 repo DAL + 1 servicio de agregación + 1 endpoint +
1 página + (P3) PDF + tests

## Constitution Check

- **Solo texto**: OK — la entidad guarda conteos y categorías; nunca texto ni multimedia.
- **Presunción de inocencia**: OK — la vista es estadística ("N reportes registrados");
  sin veredictos; la supresión por k es la regla anti-identificación indirecta.
- **IA local**: N/A — la funcionalidad NO usa IA (agregación determinista); no se toca
  Ollama ni el motor.
- **Canales oficiales**: OK — la vista de patrones no es interfaz de reporte ni de
  consulta pública; el panel del colegio ya cumple la regla en sus interfaces de
  reporte. Sin cambios.
- **No modificar texto original**: OK — el hook no lee ni toca `texto`/`textoOriginal`.
- **Migraciones aditivas**: OK — FR-008.
- **Metodología Spec-Kit**: OK — compuerta §4 (spec+plan; tasks pendientes de ZEUS).

Sin violaciones que justificar.

## Diseño

### 1. Modelo de agregación (FR-001/FR-002/FR-008)

```prisma
model PatronInstitucional {
  id           String            @id @default(cuid())
  colegioId    String
  periodo      String            // trimestre calendario: "2026-Q3"
  grado        String            // snapshot del Curso.grado; sentinel SIN_GRADO_REGISTRADO
  conducta     CategoriaConducta // enum existente, sin cambios
  plataformaId String
  conteo       Int               @default(0)
  creadoEn     DateTime          @default(now())
  actualizadoEn DateTime         @updatedAt

  colegio    Colegio    @relation(fields: [colegioId], references: [id])
  plataforma Plataforma @relation(fields: [plataformaId], references: [id])
  alertas    AlertaColegio[]

  @@unique([colegioId, periodo, grado, conducta, plataformaId])
  @@index([colegioId, periodo])
}
```

- `AlertaColegio` gana `patronInstitucionalId String?` (FK nullable, ADITIVA): marca la
  fila agregada que ESTA alerta aportó. Es la llave de idempotencia (si ya tiene valor,
  no re-contar) y de la reversa exacta en baja (decrementar ESA fila, piso 0). No es
  PII: apunta a una fila agregada sin datos personales.
- `grado` NO nullable con sentinel: `Curso.grado` es nullable
  (`prisma/schema.prisma:462`) y Postgres trata los NULL como distintos en UNIQUE —
  el sentinel "Sin grado registrado" mantiene la unicidad real del agregado.
- `periodo` = trimestre de `Reporte.creadoEn` (decisión en Assumptions de la spec).
- Relaciones de vuelta en `Colegio` y `Plataforma` (aditivas).

### 2. Puntos de disparo y puerta de conteo (FR-001/FR-003/FR-004/FR-005)

Un solo servicio de agregación (`src/lib/colegio/patrones.ts`, lógica de negocio;
acceso a datos en `src/lib/dal/repositories/patron-institucional.ts` con tenant
obligatorio, SPEC-134) llamado desde TRES puntos:

1. **Worker post-hook** (`scripts/worker-reportes.mjs`, junto a
   `notificarColegioSiCorresponde`, :218): fire-and-forget con `.catch` (mismo patrón
   fail-open; un error de agregación NUNCA rompe el procesamiento).
2. **Transición a CORREGIDO**: corrección admin (`src/app/api/admin/correcciones/
   route.ts:171`) y resolución del comité (`src/lib/dal/services/comite-bandeja.ts:214`).
3. **Baja** (`eliminado = true`, `src/lib/dal/services/reporte-lifecycle.ts:101-114`):
   reversa — busca alertas del reporte con `patronInstitucionalId` y decrementa.

Flujo de agregación (por reporte):

- Puerta: `esReporteAprobado(reporte, categoria)` (FR-005) — NO `ESTADOS_VISIBLES`.
- Vínculos: mismos que las alertas (identificador normalizado →
  `IdentificadorAlumno` activos → `alumno.colegioId`), extendiendo el include para
  traer `alumno.curso.grado` (hoy `buscarActivosPorValor` solo trae `colegioId`,
  `identificador-alumno.ts:162-167`) — extensión aditiva del include o método nuevo.
- Dedupe por (colegio, reporte): de las alertas del colegio para ese reporte, solo la
  MÁS ANTIGUA (determinística) recibe el marcador y aporta al agregado (Edge Case:
  varios vínculos del mismo colegio cuentan una vez).
- Colegio no vigente → no agrega (misma regla que `colegioEstaVigente`, alertas.ts:80).
- Upsert por la clave única + `conteo: { increment: 1 }` + marcador en la alerta, en
  UNA transacción (`withUnitOfWork` / tx del repo, D2).

### 3. k-anonimato en lectura (FR-007)

La regla vive en UNA función pura del servicio de consulta (pantalla y PDF la usan):
dado el set de filas del (colegio, período) y k (de `ParametroSistema`,
`colegio.patrones.k_anonimato`, default 3):

- `porGrado` = solo filas de grado cuyo conteo TOTAL del período ≥ k (sumando sus
  celdas por conducta/plataforma); si algún grado queda fuera, la respuesta incluye
  `gradosSuprimidos: true` para que la UI lo declare en lenguaje neutral.
- `porConducta` y `porPlataforma` = agregados sobre TODAS las filas del colegio
  (la propuesta fija k solo en grado; extensión = decisión de ZEUS, Assumptions).
- El almacenamiento guarda los conteos crudos; la supresión es solo de lectura (si k
  cambia por parámetro, no hay que recomputar nada).

### 4. Endpoint y vista (FR-006/FR-009)

`GET /api/colegio/patrones?periodo=2026-Q3` (default: trimestre actual) — copia el
arreglo de guardas de `src/app/api/colegio/estadisticas/route.ts:12-40`:
`verifyAuth("SCHOOL_ADMIN")` → `assertModulo(user, "colegios_gestion")` → vigencia →
`user.colegioId` → rate limit `admin_read`. Respuesta:

```json
{
  "colegioId": "…", "periodo": "2026-Q3",
  "total": 12,
  "porGrado": [{ "grado": "7", "conteo": 5 }],
  "gradosSuprimidos": true,
  "porConducta": [{ "conducta": "SOLICITUD_ENCUENTRO", "conteo": 6 }],
  "porPlataforma": [{ "plataforma": "Roblox", "conteo": 7 }],
  "tendencia": { "periodoAnterior": "2026-Q2", "totalAnterior": 8, "variacion": 4 }
}
```

Página `/dashboard/colegio/patrones` (Server Component + cliente para filtros de
período), entrada en `ColegioSideNav` respetando la navegación por permisos (SPEC-086/
129). Estado vacío explícito cuando `total = 0`. Tono NEUTRAL, sin voseo, lenguaje
estadístico (FR-010).

### 5. PDF (P3, FR de US3)

Mismo mecanismo que `src/app/api/colegio/estadisticas/pdf/route.ts` (pdfmake, logo del
colegio, período en encabezado), consumiendo la MISMA función de la regla de k.

## Data Model

Ver §Diseño.1. Migración ADITIVA: `CREATE TABLE "PatronInstitucional"` + `ALTER TABLE
"AlertaColegio" ADD COLUMN "patronInstitucionalId" TEXT NULL` (+ FK e índices nuevos).
Sin backfill, sin cambios en filas existentes, sin enums nuevos (reusa
`CategoriaConducta`). Parámetro nuevo `colegio.patrones.k_anonimato = "3"` (seed de
parámetros, patrón `mensaje.padre.*` / `colegio.notificaciones.*`).

## Contracts

- **GET `/api/colegio/patrones`** — NUEVO. Auth: SCHOOL_ADMIN (rol + módulo
  `colegios_gestion` + vigencia + colegio propio + rate limit). Query: `periodo`
  opcional (`YYYY-Qn`). 200: payload del §Diseño.4 (solo agregados del colegio del
  usuario; k aplicado). Errores canónicos: 401/403/429/500 (`AppError`).
- **GET `/api/colegio/patrones/pdf`** — NUEVO (P3). Mismas guardas; 200 `application/pdf`.
- N/A para endpoints existentes: ninguno cambia contrato (los hooks de worker/corrección/
  baja son efectos internos sin cambio de respuesta).

## Fases de implementación (resumen para tasks)

1. **Modelo + DAL**: migración aditiva, repo `PatronInstitucionalRepository` (tenant
   obligatorio, tx opcional), extensión del include de vínculos con `curso.grado`,
   parámetro k. Tests de repo.
2. **Servicio de agregación**: puerta `esReporteAprobado`, dedupe por (colegio,
   reporte), upsert + marcador en tx, reversa en baja. Tests de integración (SC-001/002).
3. **Cableado de disparos**: worker post-hook (fail-open), corrección admin, comité,
   baja. Tests de cada disparo.
4. **Endpoint + regla de k + página**: guardas copiadas de estadísticas, función pura
   de k (tests unitarios: k=3, supresión, totales), vista con estado vacío y tendencia.
   Tests de API cross-tenant (SC-003).
5. **(P3) PDF** con la misma regla de k.
6. **Gates + cierre**: suite completa, tsc, lint, build, `docs/architecture/`
   regenerado + `arch:check` verde (SPEC-126), `./scripts/dev-restart.sh`, quickstart.
