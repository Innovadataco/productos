# Research: SPEC-139 — reverificación en fuente (2026-08-02)

## Fuentes del instructivo

- PROPUESTA-FUNCIONALIDADES-ESTRATEGICAS.md §F5 (línea 357): flujo trigger →
  detección → registro → acciones → visibilidad; entidad `EventoMatch`;
  restricciones (solo aprobados D-08, post-clasificación, no revela denunciante ni
  contenido, alerta al círculo por mecanismo existente).
- PLAN-DE-TRABAJO-READINESS-2026-07-30.md línea 82 (Fase 6b): post-hook del worker;
  `EventoMatch`; ≥2 ciudades → bandeja prioritaria; **dependencias duras: BL-5 +
  S-1, "no arranca hasta cerrarlas"** (nota de auditoría ZEUS, línea 95).

## Dependencias de arranque — AMBAS CERRADAS (verificado)

- **BL-5 (SPEC-131)**: la visibilidad se decide SOLO con reportes aprobados —
  `src/lib/visibility.ts:23-33` (`reportesAprobados` + ratio sobre base aprobada).
  Contadores aprobados en el agregado: `prisma/schema.prisma:783-786`
  (`reportesAprobados`, `autenticadosAprobados`, escritor único
  `recalcularYGuardarScore`).
- **S-1**: huella anti-abuso con salt obligatorio y sin fallback —
  `src/lib/anti-abuso/fuente-reporte.ts:7-10` (`requireEnv("ANTI_ABUSO_SALT", 32)`);
  huellas `ipHash`/`fingerprintHash` (`:68-82`); modelo `FuenteReporte`
  (`prisma/schema.prisma:757-774`, índices por huella). El historial por fuente ya
  se consulta por `usuarioId`/`ipHash`/`fingerprintHash`
  (`contarHistorialFuente`, `:84-113`) — mismo patrón que necesita la regla de
  "denunciante distinto".

## Predicado único de aprobado (D-08)

- `src/lib/reporte-aprobado.ts:14-25` — `esReporteAprobado`: estado ∈
  {CLASIFICADO, CORREGIDO} ∧ categoría ∉ {SPAM, OTRO} ∧ no eliminado. Variante
  Prisma `whereReporteAprobado` (`:31-42`) para el filtro server-side. El match
  cuenta SOLO con este predicado (nunca `totalReportes` crudo — eso era BL-5).

## Punto de anclaje del post-hook

- `scripts/worker-reportes.mjs:214-220` — tras HTTP OK de `/api/reportes/procesar`
  el worker ya dispara fire-and-forget `notificarCambioCirculoSiCorresponde`
  (`:214-216`) y `notificarColegioSiCorresponde` (`:218-220`), ambos con `.catch` +
  log. El hook del match va en el mismo bloque, misma forma (fail-open).
- El pipeline NO se toca: idempotencia por estado final en
  `src/lib/dal/services/reporte-processing/index.ts:53-68`; cierre con
  visibilidad + scoring en `finalizacion.ts:94-120` (se conserva intacto).
- Nota: el endpoint de procesar es idempotente, pero el hook del worker corre tras
  CADA HTTP OK → la unicidad del evento la da `reporteNuevoId @unique`, no el
  flujo (FR-004).

## Materia prima ya existente

- Ciudades y categorías por identificador: el scoring ya calcula `ciudadesUnicas`,
  `paisesUnicos` y `categorias` (`src/lib/scoring.ts:23-26`, `ScoreResult`) — la
  misma base aprobada alimenta `ciudades[]` y `conductasCoincidentes[]`.
- Clave del agregado: `@@unique([identificador, plataformaId])`
  (`prisma/schema.prisma:800`); el match se evalúa por identificador+plataforma.
- Alerta círculo existente: `src/lib/dal/services/circulo-confianza/notificaciones.ts:22`
  (`notificarCambioCirculoSiCorresponde` — cooldown, preferencias, alerta ciega con
  conteo). F5 la REUTILIZA; no crea canal.
- Estadísticas públicas: `src/app/api/estadisticas-publicas/route.ts:6-13` delega
  en `EstadisticasService.publicas()` (`src/lib/dal/services/estadisticas.ts`) —
  punto de extensión del contador (I-29: nunca scores en la API pública).
- Bandeja del comité: `src/app/api/admin/comite/pendientes/route.ts` +
  `ComiteBandejaService` (`src/lib/dal/services/comite-bandeja.ts`) — patrón de
  auth/paginación a espejar para el distintivo inter-ciudad.
- Patrón DAL a copiar: repo con tx opcional y acceso a datos puro
  (`src/lib/dal/repositories/fuente-reporte.ts:1-15`), `withUnitOfWork`
  (`src/lib/dal/unit-of-work.ts`).

## Límites conocidos (documentados en Edge Cases)

- Reportes históricos sin `FuenteReporte` (previos a S-1): no prueban fuente
  distinta → no cuentan (conservador, §1.3).
- Corrección humana posterior (operador corrige a aprobado, SPEC-042): no
  atraviesa el post-hook del worker; propuesta: invocar el mismo servicio desde el
  flujo de corrección — decisión de ZEUS.
- Interacción con la dedup (paso 4 del embudo, anotada en el plan de trabajo): la
  dedup colapsa reportes casi idénticos de la misma fuente antes de clasificar, así
  que el match raramente ve "mismo denunciante" — aun así la regla re-verifica por
  fuente (SC-002).
