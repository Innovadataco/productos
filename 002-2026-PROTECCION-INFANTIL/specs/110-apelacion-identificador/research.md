# Research: SPEC-110 — Apelación del identificador reportado

**Date**: 2026-07-29

## Hallazgos del código (verificados)

1. **Módulo viejo eliminado (SPEC-109)**: tabla `ApelacionIdentificador` y todo el
   código asociado ya no existen; prohibido reusarlo. Queda
   `PerfilOperador.esRevisorDeApelaciones` como campo inerte (su destino se decidió
   diferir a esta spec: NO se usa — la bandeja es del comité, no de operadores).
2. **Enum `AccionAudit` conserva** `APELACION_CREADA` y `APELACION_RESUELTA` (huérfanos
   del módulo viejo): se reutilizan y se añaden `APELACION_DOCUMENTO_ACCESO`,
   `APELACION_DOCUMENTO_PURGADO`, `APELACION_AVISO_PLAZO` (ALTER TYPE ADD VALUE es
   aditivo y soportado por PG ≥ 12 dentro de la transacción de Prisma).
3. **`actualizarVisibilidadPublica`** (`src/lib/visibility.ts`) es la dueña única de
   `esVisiblePublicamente`; la llaman: finalización del procesamiento, confirmar/baja/
   reactivar/anonimizar de reportes y el resolver del comité actual. Extensión mínima:
   leer la marca `ocultoPorComiteEn` del agregado.
4. **Punto de entrada de reportes nuevos**: el upsert de `IdentificadorReportado` en
   `POST /api/reportes` (`src/app/api/reportes/route.ts` ~L183). Ahí se levanta la marca
   (`ocultoPorComiteEn: null` en el `update`): reporte nuevo ⇒ reglas normales.
5. **Baja existente**: `darDeBajaReporte` (`src/lib/reporte-lifecycle.ts`) marca
   `eliminado`, purga embeddings/dataset si motivo ∈ {REPORTE_FALSO, ORDEN_LEGAL},
   recalcula score + visibilidad y audita — reusable tal cual desde el resolver.
6. **Comité existente**: bandeja `SolicitudComite` atada a `reporteId @unique` (caso =
   un reporte escalado). Patrones a reusar: `assertModulo(user, "comite_bandeja")`,
   tomar/asignar con 409, resolver con motivación + `logAudit`, paginación
   `{ items/solicitudes, paginacion }`, scopes de rate-limit `admin_read`/`admin_write`.
7. **Cifrado**: `param-encryption.ts` expone `getEncryptionKey()` (base64 32B o UTF-8 de
   32 chars, NO hex) sobre AES-256-GCM; para archivo se usa formato binario
   `[IV][TAG][ciphertext]` (misma clave, sin string/hex overhead).
8. **pg-boss v12**: soporta `boss.schedule(name, cron, data, { tz })` + `boss.work`;
   el worker único (`scripts/worker-reportes.mjs`, advisory lock) ya registra colas y es
   supervisado. Se registra ahí la cola `apelacion-mantenimiento` con cron diario.
9. **Emails**: `src/lib/email.ts` (Resend); patrón de aviso al comité existe
   (`enviarAlertaComitePendientes` + `notificarComiteSiCorresponde` con cooldown en
   `PerfilOperador`). En tests se mockea `resend` con `vi.mock` (ver `email.test.ts`).
10. **Tests de API**: handlers llamados con `Request` nativo; auth mockeada con
    `vi.spyOn(auth, "verifyAuth").mockResolvedValue(user)`; BD reset con
    `resetDatabase()` (`fileParallelism: false`, una sola PostgreSQL de test);
    `DISABLE_RATE_LIMIT=true` en `.env.test`. `request.formData()` con `File` funciona en
    Node ≥ 20 (undici) — usable para multipart en tests.
11. **Proxy** (`src/lib/proxy.ts`): `/api/apelaciones` no es pública ⇒ exige token;
    `/dashboard/apelaciones` cae en rutas de usuario final (PARENT ok, internos se
    redirigen a su home — correcto: el apelante es usuario final);
    `/dashboard/admin/comite/apelaciones` es ruta interna estándar (comité + admin).
12. **Días hábiles**: no existe utilidad previa en el repo; se crea en
    `src/lib/apelaciones.ts` (lun-vie; festivos fuera de alcance — Assumptions).

## Alternativas descartadas

- **Reusar `SolicitudComite`**: atada a `reporteId` único y a escalado por operador;
  rompería sus consultas. Bandeja propia con los mismos patrones.
- **Escribir el flag directamente** al aceptar: viola la dueña única (lección SPEC-109).
  La marca en el agregado + recálculo por la dueña es el mecanismo explícito documentado.
- **Borrado perezoso sin job**: la enmienda exige eliminación automática; el job diario
  pg-boss ya tiene infraestructura viva (worker + supervisor).
- **Servir el PDF con URL firmada/estática**: cualquier URL pública rompe "solo comité".
  Endpoint autenticado que streamea + auditoría por acceso.

## Referencias

- `.specify/memory/constitution.md` §1.2 (solo texto; enmienda de esta spec), §1.6
  (disputa Ley 1581).
- `specs/109-eliminar-modulo-apelacion/cierre.md` (guardas y huérfanos).
- ADR_004 (parametrización con test de efecto, lección I-14/I-20).
