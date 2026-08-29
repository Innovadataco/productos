# Research: SPEC-142 — reverificación en fuente (2026-08-02)

## El post-hook del worker ya existe (punto de enganche)

- `scripts/worker-reportes.mjs:209-220` — tras el 200 de `POST /api/reportes/procesar`,
  el worker dispara fire-and-forget: `notificarCambioCirculoSiCorresponde` (:214) y
  `notificarColegioSiCorresponde` (:218), ambos con `.catch` (fail-open). Es el mismo
  punto donde F5 enganchará `EventoMatch` (PLAN Fase 6b, fila F5) y donde F6 engancha
  la agregación de patrones.
- `src/app/api/reportes/procesar/route.ts:8-9` — la ruta solo delega en
  `procesarReporte` del DAL (`ReporteProcessingService`).
- `src/lib/dal/services/reporte-processing/finalizacion.ts:95-120` — al finalizar
  CLASIFICADO/CORREGIDO ya se actualizan visibilidad pública y score; los efectos
  institucionales viven en el worker, no aquí.

## La resolución identificador → alumno → colegio ya existe

- `src/lib/colegio/alertas.ts:50` (`notificarColegioSiCorresponde`): normaliza el
  identificador (:62), busca vínculos activos cross-tenant a propósito (:64-66),
  dedupe por (colegio, reporte, identificador) vía `buscarExistente` (:87), crea
  `AlertaColegio` (:93) y verifica vigencia del colegio (:80).
- `src/lib/dal/repositories/identificador-alumno.ts:162-167`
  (`buscarActivosPorValor`): devuelve vínculos activos con `alumno.colegioId`
  (excepción cross-tenant documentada en :9-11 y :158-161). **NO trae el grado**: hay
  que extender el include a `alumno.curso.grado` (aditivo) o añadir método al repo.
- **OJO — la puerta de las alertas NO es la de F6**: `alertas.ts:12-18` define
  `ESTADOS_VISIBLES` = CLASIFICADO, CORREGIDO, REVISION_MANUAL, POSIBLE_SPAM,
  REQUIERE_ANONIMIZACION — más amplio que "aprobado". F6 DEBE usar el predicado único
  (FR-005), no esta lista.

## Predicado único de aprobado (D-08)

- `src/lib/reporte-aprobado.ts:17-25` (`esReporteAprobado`): estado ∈ {CLASIFICADO,
  CORREGIDO} ∧ categoría ∉ {SPAM, OTRO} ∧ `eliminado = false`. Cabecera :4-8: "Es la
  ÚNICA fuente de conteo: consulta pública, scoring y dashboard usan esta misma
  definición (nunca duplicarla)". Variante Prisma `whereReporteAprobado` :31-41.
- BL-5 cerrado (SPEC-131, IMPLEMENTADO): el plan Fase 6b advierte que F5/F6 heredaban
  BL-5; ya resuelto — F6 solo consume el predicado.

## Segundo y tercer disparo (corrección y baja)

- `src/app/api/admin/correcciones/route.ts:165,171` — la corrección admin transita el
  reporte a `estado: "CORREGIDO"` con categoría corregida (audita `CASO_CORREGIDO`
  :190).
- `src/lib/dal/services/comite-bandeja.ts:214` — la resolución del comité también
  fija `estadoNuevo = "CORREGIDO"`.
- `src/lib/dal/services/reporte-lifecycle.ts:101-114` — la baja marca
  `eliminado: true` en tx (y purga texto a marcador, SPEC-130 D4). Punto de la reversa.

## Schema (prisma/schema.prisma)

- `Colegio` :422 (tenantId único :437); `Curso` :458 con **`grado String?` nullable
  :462** (motivo del sentinel); `Alumno` :475 (cursoId :477, colegioId :478);
  `IdentificadorAlumno` :492 (única por alumno+valor+tipo+plataforma :507).
- `Reporte` :614: `identificador` :616, `plataformaId` :617, `creadoEn` :647,
  `eliminado` :640.
- `ClasificacionIA` :931: `categoria CategoriaConducta` :934 (1:1 con Reporte).
- `Plataforma` :533 (`clave` :535, `nombre` :536).
- Enums existentes (reusar, sin cambios): `CategoriaConducta` :156-169,
  `EstadoReporte` :171-180.
- `AlertaColegio` :511+ (única compuesta colegio+reporte+identificador — base del
  marcador aditivo `patronInstitucionalId`).

## Patrón DAL (SPEC-134) y estadísticas existentes del colegio

- Repos con tenant obligatorio + tx opcional (D2): `src/lib/dal/repositories/
  alerta-colegio.ts:38-43` (constructor `tx?: Prisma.TransactionClient`);
  `src/lib/dal/unit-of-work.ts` (`withUnitOfWork`, `DbClient`).
- Guardas del endpoint hermano `GET /api/colegio/estadisticas`
  (`src/app/api/colegio/estadisticas/route.ts`): `verifyAuth("SCHOOL_ADMIN")` :14,
  `assertModulo(user, "colegios_gestion")` :15, vigencia :16-22, `user.colegioId` :24,
  rate limit `admin_read` :31.
- `src/lib/colegio/estadisticas.ts:46` (`calcularEstadisticasColegio`): conteos por
  curso sin PII (:40-41 "No expone PII: solo conteos por curso y totales") — precedente
  directo de la vista de patrones.
- PDF institucional ya existe: `src/app/api/colegio/estadisticas/pdf/route.ts`
  (pdfmake) — patrón para el informe descargable (US3, P3).

## Límites y decisiones tomadas de la fuente

- **Masa crítica** (PROPUESTA §F6, "Riesgo"): sin volumen, el informe no dice nada —
  PLAN Fase 6b ordena F6 tras F1/volumen. La spec lo trata como estado vacío honesto,
  no como blocker.
- **k=3 solo en grado** (PROPUESTA §F6, restricciones críticas): la extensión de k a
  conducta/plataforma queda para clarify de ZEUS (Assumptions).
- **Ataque por diferencia** (total − grados mostrados): riesgo residual aceptado — el
  colegio ya ve sus alertas individuales (`listarAlertasColegio`, alertas.ts:172-187
  expone identificador + categoría); el k protege la resolución por grado del agregado.
