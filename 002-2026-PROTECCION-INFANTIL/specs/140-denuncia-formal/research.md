# Research: SPEC-140 — reverificación en fuente (2026-08-02)

## Patrón PDF existente (a replicar)

- `src/lib/colegio/pdf-estadisticas.ts:94` — `generarPdfEstadisticas(): Promise<Buffer>`
  con pdfmake en Node; vfs registrado una vez (`:31`) y augmentation tipada del build CJS
  (`:20-28`, de SPEC-136 — reutilizable tal cual para el nuevo generador).
- `src/app/api/colegio/estadisticas/pdf/route.ts:53-77` — el patrón de respuesta:
  calcular → generar Buffer → `logAudit` (sin contenido) → `Content-Disposition:
  attachment`. NADA se persiste; el Buffer vive solo en la respuesta. Es exactamente el
  "se genera y descarga, no se guarda" que pide F2.

## Plantillas deterministas y canales oficiales (ya existen)

- `src/lib/expediente/mensaje-padre.ts:4-5` — regla dura ya escrita: plantillas
  deterministas, "PROHIBIDO generarlo con un LLM" (D-23).
- `src/lib/expediente/mensaje-padre.ts:36-79` — `PLANTILLAS_CONDUCTA` por categoría con
  fallback `PLANTILLA_GENERICA` (`:31-34`): la forma exacta para
  `PLANTILLAS_DENUNCIA` (redacción formal distinta, misma mecánica).
- `src/lib/expediente/mensaje-padre.ts:158-173` — `cargarCanalesPadre()` lee
  `mensaje.padre.canales` y degrada a `[]` si falta/es inválido.
- `prisma/seed.ts:1010-1019` — el parámetro ya tiene los 3 canales: Línea 141 ICBF
  (141), Te Protejo (teprotejo.org), CAI Virtual — Policía Nacional (123).

## AuditLog y enum (necesita migración aditiva)

- `prisma/schema.prisma:45-119` — enum `AccionAudit`: NO existe acción de denuncia
  formal ni de exportación forense (últimos valores: `CONSULTA_SIN_RESULTADOS`,
  `CONSULTA_VACIA_CTA_REPORTAR`). Dos valores nuevos, ADITIVOS.
- `prisma/schema.prisma:357-381` — modelo `AuditLog` (`accion`, `tipoRecurso`,
  `recursoId`, `usuarioId`, `metadatos` Json): el evento cabe sin tabla nueva (D-22).
- `src/lib/audit.ts:18-49` — `logAudit` (IP hasheada desde E-6, `:12-16`); acepta
  `metadatos` Json y `tx`.
- `src/lib/audit-actions.ts:3-19` — los grupos filtran por prefijo
  (OPERADOR_/COMITE_/COLEGIO_); las acciones nuevas usan el fallback
  `labelAccionAudit` (`:21-26`) — no rompe la vista de auditoría.

## Expediente (donde vive el botón) y gates

- `src/app/api/admin/reportes/[id]/expediente/route.ts:27-30` — gate actual:
  `verifyAuth` + `assertModulo(user, "bandeja_reportes")` + rate limit `admin_read`.
- `…/expediente/route.ts:61-76` — patrón de campo gated: `revelar=true` solo con el
  módulo `expediente_revelar_original` y registra `TEXTO_ORIGINAL_REVELADO` "Nunca se
  registra el texto: solo metadatos" (`:66`). Mismo principio para los eventos de F2.
- `src/components/modules/AdminReporteExpediente.tsx:1-17` — vista cliente del
  expediente (Modal + GlassCard + Button ya importados): ubicación natural del botón.
- `src/lib/permisos-catalogo.ts:23-24` — `bandeja_reportes` y su hijo
  `expediente_revelar_original` (`esCritico`): patrón para el módulo nuevo
  `denuncia_formal`.

## Datos del reporte disponibles y lo que hay que EXCLUIR (N-4)

- `prisma/schema.prisma:614-644` — `Reporte`: `identificador`, `plataformaId`,
  `fechaIncidente`, `ciudad`, `pais`, `estado`, `esAnonimo`, `eliminado`… y
  `usuarioId` (`:629`) = identidad del denunciante a excluir de la vista forense.
- `prisma/schema.prisma:171-180` — `EstadoReporte`: botón solo con clasificación
  (CLASIFICADO, CORREGIDO, REVISION_MANUAL).
- `prisma/schema.prisma:931-956` — `ClasificacionIA` (`categoria`,
  `categoriasSecundarias`): las conductas confirmadas para las plantillas.
- `prisma/schema.prisma:776-796` — `IdentificadorReportado` (`totalReportes`,
  `reportesAprobados` SPEC-131): conteo agregado disponible para la vista forense.
- `src/lib/expediente/expediente.ts:75-81` — `cargarDatosExpediente` usa
  `ReporteRepository.findParaExpediente` (DAL): las lecturas nuevas van por repos,
  no por Prisma directo.

## Decisiones tomadas al escribir (a validar por ZEUS)

1. **Roles**: botón/panel para ADMIN y COMITE_VALIDACION vía módulo `denuncia_formal`
   (el instructivo dice "admin/comité"). Incluir OPERADOR = solo otorgar el módulo.
2. **Texto original EXCLUIDO** de denuncia y forense (FR-007): la evidencia la aporta
   quien denuncia; la revelación gated queda como flujo humano separado.
3. **Reintentos sin dedup**: como el documento no se retiene, cada generación es un
   evento; el conteo de AuditLog es el dato fiel de uso (y la métrica de impacto).
4. La exportación forense audita; la VISTA forense JSON no (lectura ya cubierta por el
   gate) — auditar exportaciones, no lecturas, es coherente con
   `COLEGIO_ESTADISTICAS_PDF_DESCARGADO`.

## Riesgos / límites conocidos

- La redacción legal de las plantillas es provisional hasta la revisión del CEO
  (PLAN línea 81: no bloquea el código). Riesgo declarado en PROPUESTA §F2: sin revisión
  legal el documento podría perjudicar la denuncia — se mitiga con la nota de "borrador
  para presentar ante la autoridad" en la plantilla base.
- El enum `AccionAudit` es compartido por todas las vistas de auditoría; valores nuevos
  son seguros (aditivos) pero hay que verificar que la migración generada sea solo
  `ADD VALUE` (no recrear el tipo, que requeriría rewrite de tabla).
