# Implementation Plan: SPEC-140 — Botón "Llevar a denuncia formal" + panel forense (F2 + N-4)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/140-denuncia-formal/spec.md` (002-PI-056, F2 + N-4)

## Summary

Desde el expediente del reporte (admin/comité): (1) botón "Llevar a denuncia formal" que
genera y descarga un PDF por PLANTILLA DETERMINISTA por conducta (D-23, nunca IA;
pdfmake en memoria, patrón `pdf-estadisticas.ts`) dirigido a un canal oficial elegido
(Línea 141 ICBF, CAI Virtual, Te Protejo — parámetro `mensaje.padre.canales`), SIN
retener el documento y registrando solo el evento en AuditLog; (2) panel forense (N-4):
vista y exportación controlada con los datos autorizados del expediente, sin identidad
del denunciante, también auditada; (3) conteo agregado de denuncias facilitadas como
métrica de impacto. Cambio de datos: SOLO dos valores aditivos en el enum `AccionAudit`.

## Technical Context

**Language/Version**: TypeScript 5 (strict maximal), Node.js >= 22
**Primary Dependencies**: pdfmake (ya en el stack, `src/lib/colegio/pdf-estadisticas.ts`),
`@/lib/parametros` (parámetros), `@/lib/audit` (`logAudit`), `@/lib/auth` (`verifyAuth`),
`@/lib/permisos-modulos` (`assertModulo`), DAL (`ReporteRepository`). Nada nuevo.
**Storage**: PostgreSQL — migración ADITIVA de enum `AccionAudit` (2 valores); sin tablas
nuevas; el evento vive en `AuditLog.metadatos` (Json)
**Testing**: Vitest — tests unitarios de plantillas/armado + tests de integración de los
endpoints (patrón `route.test.ts` del repo)
**Project Type**: feature de cierre de circuito señal → denuncia (F2) + insumo forense
para autoridades (N-4)
**Constraints**: FR-003 (el PDF NO se retiene), FR-004/FR-006 (auditoría sin contenido),
FR-007 (nunca texto original), constitución (solo texto, presunción de inocencia, canales
oficiales visibles, migraciones aditivas)
**Scale/Scope**: ~2 archivos de lib nuevos + 3 endpoints + botón en la vista del
expediente + migración de enum + tests

## Constitution Check

- **Solo texto**: OK — se generan PDFs de texto; no se sube ni procesa multimedia.
- **Presunción de inocencia (§1.3)**: FR-009 — el documento usa lenguaje
  descriptivo/estadístico ("se registraron reportes que describen…"), nunca veredictos;
  es una plantilla fija, no una inferencia.
- **IA local**: OK — esta feature NO usa IA (D-23 explícito: plantilla determinista,
  nunca generativa).
- **Canales oficiales visibles**: OK — son el contenido central del documento (FR-005).
- **No modificar el texto original**: OK — FR-007: el texto original no viaja a ningún
  artefacto; el flujo gated de revelación queda intacto y separado.
- **Disputas (Ley 1581)**: no aplica directamente (el identificador reportado conserva
  sus vías de apelación existentes; la denuncia formal es una salida, no una decisión de
  visibilidad).
- **Migraciones aditivas**: OK — solo `ALTER TYPE … ADD VALUE` vía migración Prisma.

Sin violaciones que justificar.

## Diseño

### 1. Generación de denuncia formal (FR-001…FR-005, US1)

- **Lib**: `src/lib/expediente/pdf-denuncia.ts` (mismo módulo que `mensaje-padre.ts`).
  `PLANTILLAS_DENUNCIA: Record<conducta, { hecho: string; recomendacion: string }>` con
  fallback genérico (patrón de `PLANTILLAS_CONDUCTA`, `mensaje-padre.ts:36-79`) pero con
  redacción formal para autoridad: encabezado con canal destino, identificador reportado,
  plataforma, fecha del incidente, ciudad/país, conductas descritas por plantilla, nota
  de presunción de inocencia y de canales oficiales. Texto base provisional — revisión
  legal del CEO ajusta el texto sin tocar la mecánica (no bloquea).
- **PDF**: `generarPdfDenuncia(datos): Promise<Buffer>` replicando la mecánica de
  `pdf-estadisticas.ts:94-186` (vfs registrado una vez, `createPdf(...).getBuffer()`).
- **Endpoint**: `POST /api/admin/reportes/[id]/denuncia-formal` con body Zod
  `{ canalDestino: string }` (debe ser uno de los canales del parámetro). Flujo:
  `verifyAuth` → `assertModulo(user, "denuncia_formal")` → rate limit `admin_read` →
  cargar reporte (repo; 404 si no existe o `eliminado`; 409 si el estado no tiene
  clasificación) → generar Buffer → `logAudit({ accion: "DENUNCIA_FORMAL_GENERADA",
  tipoRecurso: "Reporte", recursoId, usuarioId, metadatos: { reporteId, canalDestino,
  usuarioId, fecha } })` → responder attachment. El Buffer nunca toca disco ni BD.
- **Botón**: en `AdminReporteExpediente.tsx` (vista cliente del expediente): visible solo
  si el estado lo permite y el usuario tiene el módulo; abre modal con selector de canal
  (desde el endpoint de canales o embebido en la respuesta del expediente) + confirmación;
  deshabilitado durante la generación. Los canales oficiales se muestran también en la
  vista del comité si aplica (`ComiteSolicitudDetalle.tsx` — decidir en implementación si
  el botón vive en ambas vistas o solo en expediente; por defecto: expediente, que es la
  vista compartida).
- **Módulo de permisos**: `denuncia_formal` (hijo de `bandeja_reportes`, `esCritico`) en
  `CATALOGO_MODULOS` + seed. Otorgado por defecto a `ADMIN` y `COMITE_VALIDACION`.

### 2. Panel forense (FR-006, US2)

- **Campos autorizados (lista explícita, cerrada)**: identificador reportado, plataforma,
  fecha del incidente, ciudad, país, estado actual y traza de transiciones (estado,
  responsable, fecha), conductas confirmadas (categorías + descripción de plantilla),
  conteo de reportes del identificador (agregado), esAnonimo ("anónimo" como texto).
  **Excluidos siempre**: `usuarioId` y cualquier dato del denunciante (email, nombre),
  IP, huella anti-abuso (`fuenteConfianza`, fingerprint), texto y textoOriginal del
  reporte, datos de sesión, tenant del colegio.
- **Vista**: `GET /api/admin/reportes/[id]/forense` → JSON con la lista cerrada (mismo
  gate: `denuncia_formal`). La construcción usa una función pura
  `armarExpedienteForense(reporte)` que hace whitelist — nunca spread del modelo (para
  que un campo nuevo del modelo NO se filtre por defecto).
- **Exportación**: `GET /api/admin/reportes/[id]/forense/pdf` → mismo armado → PDF por
  la mecánica de §1 → `logAudit` con `EXPEDIENTE_FORENSE_EXPORTADO` → attachment. La
  vista JSON no audita (lectura ya cubierta por el gate del expediente); la EXPORTACIÓN
  sí, porque saca el documento del perímetro.

### 3. Métrica de impacto (FR-008, US3)

Agregación sobre `AuditLog`: conteo de `DENUNCIA_FORMAL_GENERADA` total y por mes
(`groupBy`/`count` en el repo `audit-log.ts` o el servicio de estadísticas admin).
Salida mínima: sección/endpoint agregado sin identificadores. Sin tabla nueva.

### 4. Migración de enum (aditiva)

`prisma/migrations/…`: `ALTER TYPE "AccionAudit" ADD VALUE 'DENUNCIA_FORMAL_GENERADA';`
y `ADD VALUE 'EXPEDIENTE_FORENSE_EXPORTADO';` (Prisma lo genera; verificar que la
migración resultante NO recrea el tipo — debe ser solo ADD VALUE). Las acciones nuevas
no entran a los grupos por prefijo de `audit-actions.ts:3-19` (OPERADOR_/COMITE_/
COLEGIO_): se muestran con el fallback legible (`labelAccionAudit`) y, si hace falta
frase natural, se añade al mapa correspondiente.

## Data Model

Cambio ADITIVO sobre el enum existente; sin tablas ni columnas nuevas:

- `AccionAudit` += `DENUNCIA_FORMAL_GENERADA` — metadatos del evento en
  `AuditLog.metadatos`: `{ reporteId, canalDestino, usuarioId, fecha }` (sin contenido).
- `AccionAudit` += `EXPEDIENTE_FORENSE_EXPORTADO` — metadatos: `{ reporteId, usuarioId,
  fecha }`.

Lecturas: `ReporteRepository.findParaExpediente` (ya trae clasificación, transiciones,
fuente — `expediente.ts:75-81`); el repo de `IdentificadorReportado` para el agregado de
conteo (schema.prisma:776-796).

## Contracts

- `POST /api/admin/reportes/[id]/denuncia-formal` — body `{ canalDestino: string }`
  (Zod; debe pertenecer a `mensaje.padre.canales`). 200 `application/pdf` attachment;
  400 validación; 403 sin módulo; 404 reporte inexistente/eliminado; 409 estado sin
  clasificación; 429 rate limit.
- `GET /api/admin/reportes/[id]/forense` — 200 JSON con la lista cerrada de campos
  autorizados; 403/404/429 como arriba.
- `GET /api/admin/reportes/[id]/forense/pdf` — 200 `application/pdf` attachment +
  auditoría; mismos errores.
- Contador agregado (US3): endpoint mínimo de estadísticas admin o sección del existente;
  respuesta solo `{ total, porPeriodo[] }`. Contrato exacto se fija en tasks.

## Fases de implementación (resumen para tasks)

1. **Migración + permiso**: enum aditivo, módulo `denuncia_formal` en catálogo + seed,
   frase legible si aplica.
2. **Plantillas + PDF de denuncia** (lib pura, tests unitarios de armado: por conducta,
   genérica, sin canales, lenguaje estadístico) + endpoint + auditoría + tests de
   integración (SC-001/SC-002).
3. **Botón en expediente** (modal de canal + confirmación; tests del componente).
4. **Panel forense**: whitelist de campos + vista JSON + exportación PDF + auditoría +
   test de ausencia de identidad (SC-003/SC-004).
5. **Métrica agregada** (SC-005) + gates: suite, tsc, lint, build, regenerar
   `docs/architecture/` + arch:check verde, `dev-restart.sh`.
