# Research: SPEC-130 — Cifrado en reposo del texto del reporte

**Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

## Estado real en fuente (verificado 2026-08-01)

| Punto | Hoy | Evidencia |
|---|---|---|
| `textoOriginal` al crear | **YA cifrado** (AES-256-GCM) | `ReporteCreationService.crear` → `encryptParameter(texto)`; comentario "el texto original se cifra inmediatamente" |
| `texto` (copia de trabajo) | **EN CLARO** en toda la BD | lo leen pipeline (`generarEmbedding`, guardas, clasificación, anonimización), corrección admin, expediente |
| Anonimización | **Solo si el detector marca PII** | `procesar`: `if (piiResult?.contienePii && estadoFinal !== "POSIBLE_SPAM")` → anonimiza; el resto conserva plano |
| DUPLICADO | Plano para siempre | `duplicados.ts` cierra sin tocar el texto |
| REVISION_MANUAL / POSIBLE_SPAM | Plano hasta que el humano resuelve; la resolución no anonimiza | `finalizacion.ts`, resolver admin |
| Logs/auditoría | Sin texto (regla vigente) | se mantiene |
| Clave | `PARAM_ENCRYPTION_KEY` única (también apelaciones/params) | `param-encryption.ts`; CEO la gestiona (BL-2) |

**Corrección al brief**: el instructivo dice que `textoOriginal` está en claro; en fuente
YA se cifra al crear (puede haber históricos pre-SPEC-110 con `textoOriginal` NULL o en
claro → los cubre la migración D5). El hueco principal es `texto`.

## Puntos de lectura/escritura del texto (a cubrir)

- Creación: `dal/services/reporte-creation.ts`.
- Pipeline: `dal/services/reporte-processing/` (`seguridad.obtenerReporte`, `index.ts`,
  `anonimizacion.ts`, `finalizacion.ts`, `duplicados.ts`).
- Resolución humana: `api/admin/reportes/[id]/anonimizar`, `api/admin/spam/[id]/resolver`,
  correcciones (`api/admin/correcciones`).
- Expediente/vistas autorizadas: vía DAL (`reporte-query`, expediente admin).
- Lifecycle: `dal/services/reporte-lifecycle.ts` (baja, reactivación).
- Jobs: `dataset-anonimizacion-backfill`, `dataset-embedding-backfill` (via pipeline).

## Alternativas consideradas

| Opción | Veredicto | Motivo |
|---|---|---|
| Cifrar `texto` con la misma utilidad GCM (D1-D3) | **Elegida** | Mínima, patrón probado (apelaciones), sin schema ni deps |
| Campo nuevo `textoCifrado` en vez de re-cifrar `texto` | Descartada | Doble fuente de verdad y migración de todos los lectores; rompe "no inventar" |
| Purga total del texto en TODO terminal | Descartada | El expediente y las correcciones futuras necesitan el texto en CLASIFICADO/CORREGIDO; la purga solo aplica donde ya no hay uso (DUPLICADO y resoluciones) |
| KMS externo / clave por tenant | Descartada | Sobre-ingeniería; BL-2 fija clave única gestionada por el CEO |
| Anonimizar REVISION_MANUAL a la TRANSICIÓN | Descartada | El operador necesita leer el texto para resolver; se anonimiza A LA RESOLUCIÓN (a confirmar por ZEUS) |

## Riesgos y mitigaciones

- **Doble cifrado**: `isEncryptedValue` en el helper (patrón ya usado en anonimización).
- **Pipeline a mitad durante la migración**: la migración solo envuelve en GCM; el
  pipeline descifra transparente (idempotente por lotes, re-corrible).
- **Tamaño**: GCM añade IV+TAG+base64 (~60% más); `@db.Text` sin límite práctico.
- **Clave comprometida**: fuera de alcance (rotación = BL-2 del CEO).
