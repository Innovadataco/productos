# Implementation Plan: SPEC-139 — Evento de match (F5)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/139-evento-match/spec.md` (002-PI-056, BANDA 3, F5)

## Summary

Instrumentar el "match": cuando un reporte queda APROBADO (predicado único D-08)
sobre un identificador que ya tiene ≥1 reporte aprobado de OTRO denunciante
(autenticados: `usuarioId`; anónimos: huella de fuente S-1), un post-hook ADITIVO
del worker registra un `EventoMatch` (entidad nueva, migración aditiva) con conteo
acumulado, ciudades y conductas coincidentes. Acciones: alerta al Círculo de
Confianza por el mecanismo existente (sin canal nuevo), marca de revisión
prioritaria del comité si ≥2 ciudades distintas, y contadores para el dashboard
público y admin. El worker NO cambia su lógica de clasificación; nada sale hacia IA
ni terceros.

## Technical Context

**Language/Version**: TypeScript 5 (strict maximal), Node.js >= 22
**Primary Dependencies**: Prisma 5.22 (migración aditiva `EventoMatch`),
`src/lib/reporte-aprobado.ts` (predicado único + variante Prisma),
`src/lib/anti-abuso/fuente-reporte.ts` (huellas S-1), DAL existente
(repos + servicios, `withUnitOfWork`, tx opcional D2). Nada nuevo de terceros.
**Storage**: PostgreSQL — tabla nueva `eventos_match` + índices; cero cambios en
tablas existentes
**Testing**: Vitest — tests del servicio de detección (fuentes distintas/iguales,
idempotencia, conservador sin huella) + tests de endpoints (bandeja, estadísticas)
**Project Type**: feature nueva de instrumentación (KPI de tesis) sobre el pipeline
existente
**Constraints**: FR-001/FR-010 — clasificación, visibilidad, scoring y dedup
INTACTOS (registro aditivo); FR-005 — post-hook fail-open; FR-009 — nunca
identidad de denunciantes ni textos en ninguna superficie
**Scale/Scope**: 1 migración + 1 repo + 1 servicio + post-hook (1 línea en el
worker) + 2 lecturas (pública, admin) + tests

## Constitution Check

- **Presunción de inocencia (§1.3)**: OK — el contador público es lenguaje
  estadístico ("N identificadores con reportes de múltiples fuentes
  independientes"), nunca veredictos; la detección es conservadora (sin huella de
  fuente → no cuenta como denunciante distinto).
- **Solo texto / sin multimedia**: OK — el evento guarda metadatos (ciudades,
  categorías de conducta, conteos), no contenido.
- **IA local**: OK — la detección NO usa IA (query + predicado); ningún texto sale
  del servidor.
- **No modificar texto original de reportes**: OK — el evento referencia reportes
  por FK; nunca toca `texto` ni `textoOriginal`.
- **Migraciones aditivas**: OK — tabla nueva, cero ALTER destructivo.
- **Metodología Spec-Kit**: OK — compuerta §4.

Sin violaciones que justificar.

## Diseño

### 1. Servicio de detección y registro (FR-001/FR-002/FR-003/FR-004)

Nuevo `EventoMatchService` en `src/lib/dal/services/evento-match.ts` +
`EventoMatchRepository` en `src/lib/dal/repositories/evento-match.ts` (patrón DAL:
repo solo acceso a datos, tx opcional D2; servicio con la lógica). Función
`detectarYRegistrarMatch(reporteId)`:

1. Carga el reporte con su clasificación y fuente; si NO cumple
   `esReporteAprobado` (estado final + categoría + no eliminado) → fin.
2. Resuelve el agregado `IdentificadorReportado` (`identificador` +
   `plataformaId`); si no existe o no tiene aprobados previos → fin.
3. Lista los reportes aprobados vigentes del identificador (`whereReporteAprobado`)
   con `usuarioId`, `ciudad`, categoría de su clasificación y huella de su
   `FuenteReporte` (excluye el reporte nuevo).
4. "Denunciante distinto": autenticado vs autenticado → `usuarioId` distinto;
   anónimo vs anónimo → huella distinta (`ipHash`/`fingerprintHash`; sin huella →
   no prueba fuente distinta, conservador); mixto → distinto por construcción.
5. Si hay ≥1 previo de fuente distinta → upsert del `EventoMatch` por
   `reporteNuevoId` (idempotencia): `conteoAcumulado` = fuentes independientes
   aprobadas vigentes (incluido el nuevo), `ciudades` = ciudades distintas de esos
   reportes, `conductasCoincidentes` = categorías presentes en ≥2 fuentes
   independientes, `interCiudad` = ciudades distintas ≥2.
6. Registra `AuditLog` con metadatos (sin texto del reporte, como manda la
   convención) y un paso de expediente `match_detectado` (referencias, no textos).

### 2. Post-hook del worker (FR-001/FR-005)

`scripts/worker-reportes.mjs`, junto a los hooks existentes
(`notificarCambioCirculoSiCorresponde`, `notificarColegioSiCorresponde`, líneas
214-220), misma forma fire-and-forget:

```js
detectarYRegistrarMatch(reporteId).catch((err) => {
    console.error(`[WORKER] Error registrando match reporte=${reporteId}:`, err.message);
});
```

Fail-open por construcción (`.catch` + log): un error no reprocesa el reporte ni
tumba el job. El endpoint `/api/reportes/procesar` y `finalizarReporte` NO se
tocan.

### 3. Acciones automáticas (FR-006/FR-007)

- **Círculo de Confianza**: sin canal nuevo. El hook existente
  (`notificarCambioCirculoSiCorresponde`, `circulo-confianza/notificaciones.ts:22`)
  ya corre por reporte visible en el worker; el match no cambia cooldown,
  preferencias ni contenido de la alerta ciega.
- **Comité**: los eventos con `interCiudad = true` se exponen en la bandeja del
  comité como sección/etiqueta prioritaria (reincidencia inter-ciudad). Lectura
  nueva en `ComiteBandejaService` (o endpoint propio `GET /api/admin/comite/eventos-match`,
  se decide en implementación; paginación estándar). El comité ve identificador,
  conteo, ciudades y conductas — nunca denunciantes ni textos.

### 4. Contadores (FR-008/FR-009)

- **Público**: `EstadisticasService.publicas()` gana
  `identificadoresConMatch` (count distinct `identificadorId` en `EventoMatch`) —
  texto estadístico, sin score ni identidades (I-29 se conserva: nada de scores en
  la API pública).
- **Admin**: listado de eventos (identificador, conteo, ciudades, conductas,
  fecha, `interCiudad`) paginado + tendencia temporal (matches por mes, misma idea
  del `timeline` de scoring). Nuevo endpoint `GET /api/admin/eventos-match` con el
  patrón de seguridad de admin (`verifyAuth` + `assertModulo` + rate limit
  `admin_read`).

## Data Model

Migración ADITIVA — tabla nueva, cero cambios en modelos existentes:

```prisma
model EventoMatch {
  id                    String   @id @default(cuid())
  identificadorId       String
  reporteNuevoId        String   @unique
  conteoAcumulado       Int
  ciudades              String[]
  conductasCoincidentes String[]
  interCiudad           Boolean  @default(false)
  creadoEn              DateTime @default(now())

  identificador IdentificadorReportado @relation(fields: [identificadorId], references: [id])
  reporteNuevo  Reporte                @relation(fields: [reporteNuevoId], references: [id])

  @@index([identificadorId])
  @@index([interCiudad])
  @@index([creadoEn])
  @@map("eventos_match")
}
```

- `reporteNuevoId @unique` ES el mecanismo de idempotencia (FR-004): un reporte
  dispara como mucho un evento, ante cualquier reintento del worker.
- Relaciones inversas aditivas en `IdentificadorReportado` y `Reporte`
  (`eventosMatch EventoMatch[]` / `eventoMatchDisparado EventoMatch?`) — solo
  campos de relación, sin columnas nuevas en esas tablas.
- Entidad global (sin `tenantId`): el match agrega todos los tenants como la
  consulta pública, sin identificar la fuente institucional.

## Contracts

- `GET /api/estadisticas-publicas` — extensión aditiva del payload: campo
  `identificadoresConMatch: number`. Sin cambios de firma ni de campos existentes.
- `GET /api/admin/eventos-match` (NUEVO) — query `page`/`pageSize` (default 25,
  máx 100), respuesta `{ items, pagination }`; cada item: `id`, `identificador`,
  `plataformaId`, `conteoAcumulado`, `ciudades`, `conductasCoincidentes`,
  `interCiudad`, `creadoEn`. Auth admin + módulo + rate limit, patrón existente.
- Bandeja del comité — distintivo de reincidencia inter-ciudad sobre
  `EventoMatch.interCiudad` (lectura; la forma exacta — sección propia o etiqueta —
  se fija en implementación).
- `GET /api/consulta` — SIN cambios: su conteo ya se rige por D-08 (SPEC-131); el
  desglose "reportes independientes" en la consulta queda fuera de esta spec
  (Assumptions).

## Fases de implementación (resumen para tasks)

1. **Entidad + DAL**: migración aditiva `EventoMatch`, repo, servicio de detección
   con regla de fuente distinta + tests unitarios/integración (SC-001/SC-002).
2. **Post-hook**: línea en `worker-reportes.mjs` + idempotencia ante reintentos +
   AuditLog/paso de expediente (SC-003, FR-004/FR-005).
3. **Comité**: marca `interCiudad` expuesta en bandeja prioritaria + test
   (SC-004, FR-006).
4. **Contadores**: estadísticas públicas + endpoint admin con tendencia + tests de
   no-exposición (SC-005, FR-008/FR-009).
5. **Gates + cierre**: suite completa, tsc, lint, build, `dev-restart.sh`,
   regenerar `docs/architecture` + `arch:check` verde (SC-006).
