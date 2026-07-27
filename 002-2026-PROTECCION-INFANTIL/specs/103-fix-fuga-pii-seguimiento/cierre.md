# Cierre — Spec 103: Fix fuga de PII en seguimiento público (I-28, Crítica)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA Y COMMITEADA, **SIN DESPLEGAR** (deploy diferido al lote de release que autoriza ZEUS).

## Lo hecho

- **FR-1 (crítico)**: eliminado `piiDetectada` (PII cruda de menores) del objeto
  `clasificacion` de la respuesta de `GET /api/reportes/seguimiento/[numero]`. Se conserva
  `contienePii: boolean` y el resto del contrato.
- **FR-2**: `piiDetectada` fuera del tipo `ClasificacionData` de `SeguimientoClient.tsx`
  (el front nunca lo consumía) y del fixture de su test.
- **FR-3 (barrido)**: veredicto por ocurrencia en `src/app/api/**`:
  - Corregida: `reportes/seguimiento/[numero]/route.ts` (la fuga).
  - Permitidas (no tocadas): `procesar/route.ts` + helpers (ESCRITURA a BD, worker-secret),
    `admin/reportes/[id]/anonimizar` (lectura gateada admin).
  - Sin ninguna otra salida no-admin (el resto son fixtures de tests).
- **FR-4**: `rate-limit.ts` — `FAIL_CLOSED_SCOPES = { seguimiento, login }`: si el store
  falla, esos scopes devuelven `allowed:false` + `Retry-After`; el resto sigue fail-open
  byte a byte. Efecto colateral aceptado (y deseado por I-28): un fallo de BD bloquea
  temporalmente login y seguimiento en vez de dejarlos abiertos.

## Pruebas (Regla 3)

- Regresión `seguimiento/[numero]/route.test.ts`: la respuesta no contiene `piiDetectada`
  (ni anidada en el JSON) y sí `contienePii` (fixture con PII ficticia).
- `rate-limit.test.ts`: store caído → `seguimiento` y `login` fail-closed; `consulta` sigue
  fail-open.

## Gate

tsc ✅ · lint ✅ (0 errores; 1 warning preexistente) · **921/921 tests** ✅ (4 nuevos) ·
build ✅.

## Despliegue (Regla 4) — DIFERIDO

**NO desplegado** (guarda de la tarea). Validación interina = tests verdes + revisión del
diff por ZEUS. En el lote de release: verificar en vivo que el endpoint ya no trae el
arreglo y que Gesmovil sigue intacto.

## Deuda

- Ninguna nueva. (La PII histórica almacenada en `ClasificacionIA.piiDetectada` en prod
  sigue cifrada/gateada en BD; este fix cierra la salida pública, no altera datos.)
