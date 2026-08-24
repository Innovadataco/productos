# Research: SPEC-220 — Modelo Análisis + score de valor de cliente

## 1. Contexto del problema

El mega-lote Análisis dinero-vs-valor (SPEC-220..227) necesita una base de datos y un cálculo periódico del "score de valor" por cliente (suscripción). Sin esta SPEC:

- Las SPECs 221–227 no tienen tablas donde vivir (`ReglaRecomendacion`, `Recomendacion`, `DigestSemanal`, `Anomalia`).
- El CEO no tiene medida objetiva del uso de la plataforma por cliente (insumo de churn, upsell y digest).
- No hay histórico comparable mes a mes ni percentil por cohorte.

Esta investigación fija las decisiones contra el código real del repo (rama `work/002-PI-mega-cola-restante`).

## 2. Hallazgos contra el código real

### 2.1 `SesionLog` ya existe y NO tiene `suscripcionId` (divergencia con el brief)

- `prisma/schema.prisma:640` — modelo `SesionLog` de SPEC-206 (002-PI-120): campos `usuarioId`, `tenantId` (nullable), `rol`, `iniciadaEn`, `ultimaActividadEn`, `cerradaEn`, `duracionMin`, `ipHash`, índices `[usuarioId, iniciadaEn]` y `[tenantId, iniciadaEn]`.
- El brief §5.1 proponía `suscripcionId` y un middleware nuevo; eso ya se implementó distinto en SPEC-206.
- **Decisión**: el componente SESIONES se cuenta por `SesionLog.usuarioId` (titular PADRE) o `SesionLog.tenantId = Colegio.tenantId` (titular COLEGIO). No se añade columna ni se migra la tabla en prod.

### 2.2 Fuentes de conteo de componentes (schema real)

- `Reporte` (`prisma/schema.prisma:1427`): tiene `usuarioId` (nullable, línea 1442), `tenantId` (nullable, línea 1447), `eliminado` (línea 1453), `creadoEn`. Índices existentes por `creadoEn` y `[usuarioId, identificador]`; el filtro por `tenantId` usa la FK indexada por Prisma.
- `AlertaColegio` (`prisma/schema.prisma:1188`): `colegioId`, `creadoEn`, índice `[colegioId, estado]`.
- `SeguimientoCaso` (`prisma/schema.prisma:1304`): `colegioId`, `creadoEn`, índice `[colegioId, estado]`.
- `Expediente` (`prisma/schema.prisma:2100`): `padreUsuarioId`, `fechaApertura`, índice `[padreUsuarioId, estado]`.
- `AlertaSuscripcion` (`prisma/schema.prisma:1762`): es una **preferencia** de alerta configurada por el usuario (`@@unique([usuarioId, identificador, plataformaId])`), no un evento generado → no sirve como componente ALERTAS del padre.
- `EventoMatch` (`prisma/schema.prisma:1638`): eventos de coincidencia sobre `IdentificadorReportado`, sin vínculo a `usuarioId` → no atribuible a un cliente PADRE sin join semántico.
- **Decisión**: `componenteAlertas = 0` para PADRE en v1, con [NEEDS CLARIFICATION] en spec.md.

### 2.3 `Suscripcion` (SPEC-210) es el ancla del score

- `prisma/schema.prisma:723`: campos `tipoTitular` (`TipoTitular`: COLEGIO/PADRE), `colegioId`, `usuarioId`, `estado` (`EstadoSuscripcion`), `planActualId`. Índices `[estado, fechaFin]` y `[tipoTitular, estado]`.
- `Colegio.tenantId` es `@unique` (`prisma/schema.prisma:888`) → join directo para el componente de reportes del tenant.
- **Decisión**: `ScoreCliente.suscripcionId` FK a `Suscripcion`; cohorte de percentil = `Suscripcion.tipoTitular`.

### 2.4 Patrón de worker programado: `worker-tasas.mjs` (SPEC-214)

- `scripts/worker-tasas.mjs`: advisory lock `pg_try_advisory_lock(123456790)` con salida código 2 (líneas 14, 28–33), cron derivado de parámetro `pagos.tasas.refresco_horas` vía `getParametroSistemaValor` (líneas 64–71), `boss.schedule("tasas-refresh", cron, {}, { tz: "America/Bogota" })` (línea 79), importa servicio de `src/lib/pagos/tasas.ts` directamente (sin endpoint HTTP).
- `scripts/worker-reportes.mjs` usa lock `123456789` (AGENTS.md).
- **Decisión**: `worker-analisis-score.mjs` copia este patrón con lock `123456791`, cola `analisis-score-recalculo`, llamando a `src/lib/analisis/score.ts` directamente.

### 2.5 Lectura de parámetros

- `src/lib/parametros.ts:39` — `getParametroSistemaValor(clave)` con descifrado automático si es secreto. Los parámetros `analisis.*` no son secretos (`esSecreto: false`).
- Seed de parámetros con upsert por `clave` y `CategoriaParametro.SYSTEM`: patrón en `prisma/seed.ts:374-387` (parámetros `pagos.*`).

### 2.6 Ficha de cliente: Server Component con repositorio directo

- `src/app/dashboard/admin/pagos/cliente/[id]/page.tsx:13-18` — `verifyAuth("ADMIN")` + `assertModulo(admin, "pagos_admin")` + `new PagosRepository().obtenerFichaCliente(id)`; sin fetch a API.
- Existe además `GET /api/admin/pagos/cliente/[id]` (`src/app/api/admin/pagos/cliente/[id]/route.ts`) que retorna la misma ficha.
- **Decisión**: la card de score se renderiza server-side con `AnalisisRepository`; no se crea endpoint nuevo ni se modifica el existente (contrato de Pagos intacto). Sin `contracts/` en esta SPEC.

### 2.7 Permisos de módulo

- `src/lib/permisos-catalogo.ts:57` — `pagos_admin` es módulo crítico de admin; ADMIN recibe todos los módulos por seed (`prisma/seed-modulos-grants.ts:46`).
- **Decisión**: reutilizar `pagos_admin` para la card (vive dentro de la ficha de Pagos). El módulo/tab propio de análisis se crea en SPEC-222.

### 2.8 AuditLog desde workers

- Patrón establecido `ipAddress: "worker"` en `src/lib/dal/services/evento-match.ts:130`, `src/lib/expediente/compilacion/compilar-expediente.ts:242`, `src/lib/colegio/avisos.ts:257`.
- Enum `AccionAudit` (`prisma/schema.prisma:46`): valores aditivos por SPEC (patrón: comentario con SPEC + valores nuevos). Se añadirá `ANALISIS_SCORE_PURGA`.

### 2.9 Docker

- `docker-compose.prod.yml`: servicios `pi-notificaciones` (línea 117) y `pi-senal-comunitaria` (línea 138) con `command: node --import tsx scripts/worker-*.mjs`, `TZ: America/Bogota` y volumen `pi_worker_run`.
- **Decisión**: servicio `pi-analisis-score` idéntico en forma.

## 3. Opciones consideradas

### 3.1 Fórmula del score: hardcode vs parámetros

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| Pesos en `ParametroSistema` + snapshot por fila | Tuning sin deploy (brief §2, M6); histórico auditable | Lectura de 4 params por corrida | Sí |
| Pesos en constantes de código | Simple | Cada tuning = deploy; contradice el brief | No |

### 3.2 Purga de retención: DELETE vs overwrite `[retenido]`

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| DELETE de snapshots > ventana | Brief §14 ("purga detalle"); los snapshots son agregados sin PII ni texto | Pierde detalle (aceptado por negocio) | Sí |
| Overwrite estilo SPEC-236 | Conserva fila | Aplica a textos sensibles, no a conteos; no aporta nada aquí | No |

### 3.3 Percentil: SQL window vs segunda pasada en Node

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| Segunda pasada en Node tras upserts | Prisma puro, sin raw SQL, testeable | Carga la cohorte en memoria | Sí (cohortes pequeñas: clientes activos del mes) |
| `PERCENT_RANK()` raw SQL | Una sola query | Raw SQL fuera de migraciones (constitución §2.1 lo restringe), menos testeable | No |

### 3.4 Cálculo de períodos Bogotá

- `Intl.DateTimeFormat` con `timeZone: "America/Bogota"` (nativo Node 22) para derivar `YYYY-MM` y los límites del mes; sin dependencias nuevas. Verificado: el repo no fija una librería única de TZ para este caso de uso (SPEC-236 propuso `date-fns-tz`, pero eso es de otra rama de specs; aquí se prefiere cero dependencias nuevas).

## 4. Referencias

- Instructivo: `INSTRUCTIVO-002-PI-121-MODELO-ANALISIS-SCORE.MD` (alcance, candados, gate local).
- Brief maestro: `BRIEF-ANALISIS-DINERO-VS-VALOR.md` §3 (terminología), §5.1–5.7 (modelos/params), §6 (fórmula), §14 (retención), §15 (mapa de SPECs).
- Constitución: `.specify/memory/constitution.md` §1.2 (solo texto), §1.5 (no scoring de personas), §2.1 (raw SQL solo en migraciones), §4.5 (convenciones Prisma).
- SPEC-206 (002-PI-120): `SesionLog` en prod.
- SPEC-210 (002-PI-110): `Suscripcion`/`Plan`/`Pago` en prod.
- SPEC-214: patrón `worker-tasas.mjs`.
- SPEC-236: referencia de formato de artefactos (misma estructura que esta SPEC).

## 5. Preguntas abiertas

1. [NEEDS CLARIFICATION] Fuente del componente ALERTAS para titular PADRE (ver spec.md). Default: 0 en v1.
2. El "resumen histórico agregado" pre-purga del brief §14 se omite en v1 (Assumptions); confirmar con ZEUS que la purga simple basta.
