# Implementation Plan: SPEC-110 — Apelación del identificador reportado

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

## Resumen

Flujo cerrado con el CEO: apelante autenticado → declara identificador + motivo + PDF de
evidencia sobre sí mismo → caso DIRECTO a bandeja propia del comité (sin triaje) →
resolución humana motivada (ACEPTADA: quitar visibilidad y/o baja de reportes falsos;
RECHAZADA: nada cambia) → solo entonces cambia la visibilidad. Evidencia cifrada, solo
comité, purga a los 30 días; aviso al comité a los 10 días hábiles; plazo legal 15.

## Respuestas de arquitectura (exigidas por el brief)

### 1. ¿Dónde se almacena el archivo?

En el sistema de archivos del servidor, **FUERA de la raíz web**:
`<raíz del repo>/storage/apelaciones/<documentoId>.enc` (override de entorno:
`APELACIONES_STORAGE_DIR`). `storage/` se agrega a `.gitignore`. El nombre es opaco (el
`cuid` del DocumentoApelacion, sin relación con el nombre original); el nombre original,
hash SHA-256, tamaño y MIME viven SOLO en la tabla `DocumentoApelacion`. Nada se escribe
bajo `public/` y Next.js no sirve ese directorio estáticamente.

### 2. ¿Cómo se cifra?

AES-256-GCM con la misma clave de parámetros (`PARAM_ENCRYPTION_KEY`, vía
`getEncryptionKey()` de `src/lib/param-encryption.ts`). `param-encryption.ts` cifra
cadenas; para archivos se añade `src/lib/apelacion-storage.ts` con formato binario:
`[IV 16B][TAG 16B][ciphertext]` escrito como buffer crudo en el `.enc`. El hash SHA-256
se calcula sobre el PDF en claro ANTES de cifrar (integridad verificable al descargar).
Si la clave no está configurada o es inválida, la creación falla cerrado (503): nunca se
persiste evidencia en claro.

### 3. ¿Cómo se sirve al comité sin exponerlo?

`GET /api/admin/comite/apelaciones/[id]/documento` — endpoint autenticado que exige rol
`COMITE_VALIDACION` (ADMIN/OPERADOR/PARENT → 403, por la enmienda constitucional: la
evidencia es solo del comité de validación). Lee el `.enc`, descifra en memoria, verifica
el hash y responde con `Content-Type: application/pdf` + `Content-Disposition: inline;
filename="evidencia-<numero>.pdf"`. Nunca URL pública ni archivo estático. Cada descarga
registra: fila `AccesoDocumentoApelacion` (usuario, fecha, IP, user-agent) y AuditLog
`APELACION_DOCUMENTO_ACCESO`. Documento purgado o ausente → 410.

### 4. ¿Cómo se borra a los 30 días?

Job diario en pg-boss: cola `apelacion-mantenimiento` programada con `boss.schedule`
(cron diario 06:00 `America/Bogota`, registrada en el arranque del worker existente
`scripts/worker-reportes.mjs`; el supervisor ya lo mantiene vivo). El handler llama a
`src/lib/apelacion-mantenimiento.ts`:
- `purgarDocumentosVencidos()`: documentos de apelaciones resueltas hace ≥
  `apelacion.retencion_documento_dias` (default 30) → borra el `.enc`, marca
  `eliminadoEn` y escribe AuditLog `APELACION_DOCUMENTO_PURGADO`. Los metadatos y los
  accesos se conservan (auditoría permanente sin conservar el dato sensible).
- `procesarAvisosPlazo()`: apelaciones sin resolver con ≥
  `apelacion.aviso_previo_dias` (default 10) días hábiles desde el radicado → email
  digest al/los miembro(s) activo(s) del comité (`enviarAvisoPlazoApelaciones` en
  `src/lib/email.ts`) + AuditLog `APELACION_AVISO_PLAZO`. Fallo de email = warn y reintento
  en la siguiente corrida (no bloquea la purga).

## Decisiones de diseño

- **Bandeja propia, no `SolicitudComite`**: `SolicitudComite` está atada 1:1 a un
  `reporteId` único (un caso = un reporte escalado por un operador). Una apelación es
  sobre un IDENTIFICADOR (N reportes), la crea el titular (no un operador) y tiene
  ciclo de vida, plazos, evidencia y efectos propios. Reusar la tabla exigiría nullable
  `reporteId` y ramificar todas las consultas existentes. Se crea bandeja propia
  (`/api/admin/comite/apelaciones/**`) reutilizando los PATRONES de la existente
  (assertModulo `comite_bandeja`, tomar/asignar, resolver con motivación, paginación).
  Justificación exigida por el brief: lo simple y cohesivo es tabla + bandeja propias.
- **Dueña única del flag**: `IdentificadorReportado` gana `ocultoPorComiteEn DateTime?`
  (migración aditiva). `actualizarVisibilidadPublica` pasa a
  `esVisible = !ocultoPorComiteEn && totalReportes >= umbral && ratio >= minRatio`.
  Resolver ACEPTADA con quitar-visibilidad fija la marca y llama a la dueña (efecto
  inmediato). El upsert de reporte nuevo en `POST /api/reportes` pone la marca en null:
  los reportes nuevos devuelven al identificador a las reglas normales (sin lista blanca).
  Ningún otro camino toca la marca: bajas/reactivaciones recalculan y la respetan.
- **Baja de reportes concretos**: el resolver acepta `reportesABajar: string[]`, valida
  pertenencia al identificador + plataforma declarados y delega en `darDeBajaReporte`
  (motivo `REPORTE_FALSO`, nota con el número de apelación), que ya registra expediente +
  auditoría + recálculo. Sin mecanismo nuevo.
- **N reportes al apelante**: `count` de reportes `eliminado=false` del identificador +
  plataforma. Es el ÚNICO dato de reportes que sale hacia el apelante.
- **Días hábiles**: `src/lib/apelaciones.ts` — `sumarDiasHabiles` y
  `diasHabilesTranscurridos` (lun-vie, sin festivos; ver Assumptions).
- **Auth de APIs del apelante**: `verifyAuth()` sin restricción de rol (cualquier cuenta
  activa puede apelar; el proxy ya aisla SCHOOL_ADMIN a sus rutas). El apelante solo ve
  lo suyo (`usuarioId = user.id`).
- **Parámetros** (ADR_004, seed + fallback en código):
  `apelacion.plazo_respuesta_dias_habiles=15`, `apelacion.aviso_previo_dias=10`,
  `apelacion.retencion_documento_dias=30`, `apelacion.max_tamano_documento_mb=5`
  (propuesta: 5 MB; rango razonable 2-5; 5 tolera certificados escaneados de varias
  páginas sin abrir la puerta a archivos abusivos).

## Archivos (alto nivel)

- BD: `prisma/schema.prisma` (enum `EstadoApelacion`; modelos `Apelacion`,
  `DocumentoApelacion`, `AccesoDocumentoApelacion`; `AccionAudit` +=
  `APELACION_DOCUMENTO_ACCESO`/`APELACION_DOCUMENTO_PURGADO`/`APELACION_AVISO_PLAZO`;
  `IdentificadorReportado.ocultoPorComiteEn`) + migración aditiva + seed de 4 parámetros.
- Libs: `apelaciones.ts`, `apelacion-storage.ts`, `apelacion-mantenimiento.ts`,
  `visibility.ts` (marca), `email.ts` (aviso), `reportes/route.ts` (levantar marca en
  reporte nuevo), `test-utils.ts` (reset de las 3 tablas).
- APIs: `POST /api/apelaciones`, `GET /api/apelaciones/mias`;
  `GET /api/admin/comite/apelaciones`, `GET /api/admin/comite/apelaciones/[id]`,
  `GET .../[id]/documento`, `POST .../[id]/tomar`, `POST .../[id]/resolver`.
- Worker: `scripts/worker-reportes.mjs` (cola + schedule + handler).
- UI: `/dashboard/apelaciones` (apelante) + `/dashboard/admin/comite/apelaciones`
  (comité) + entradas de navegación existentes.
- Docs: enmienda constitucional (commit propio), `specs/README.md`.

## Riesgos

- **pg-boss schedule** requiere pg-boss ≥ 8 (repo: ^12.26) — sin riesgo.
- **Reset de tests**: las 3 tablas nuevas entran en `resetDatabase()` antes que
  `usuario`/`plataforma` (FK).
- **Recálculo de score en bajas**: `darDeBajaReporte` llama a
  `actualizarVisibilidadPublica`, que ahora respeta la marca — comportamiento deseado
  (la decisión del comité se mantiene mientras no entren reportes nuevos).
