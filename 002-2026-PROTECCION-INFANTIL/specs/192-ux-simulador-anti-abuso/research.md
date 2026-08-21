# Research: SPEC-192 — UX del simulador anti-abuso

## Hallazgos del CEO (8 corridas de referencia)

| ID run | Escenario | Problema observado |
|--------|-----------|-------------------|
| `cmt2cpou` | robot_inundando | Fingerprint /24 satura bucket tras 1ª corrida |
| `cmt2crj2` | ataque_coordinado | Detalle anterior visible al cambiar escenario |
| `cmt2cvfk` | bot_ips_rotativas | Plataforma texto libre, error de tipeo |
| `cmt2c6gb` | denunciante_spam | Form envió campo único en vez de array |
| `cmt2dng3` | personalizado | Botón Iniciar bloqueado tras finalizar |
| `cmt2dtjb` | robot_inundando | Historial muestra clave técnica, no label |

## Corrección honesta ZEUS en F2 (I-71 / I-78)

La primera propuesta de diseño usaba "sesión ADMIN" para validar el bypass de `report_fingerprint`, pero `POST /api/reportes` rechaza con 403 cualquier usuario con `rol !== "PARENT"` antes de llegar al rate-limit. Además, el worker envía requests anónimos (sin cookie) o con JWT `rol=PARENT` (escenario `denunciante_spam`), nunca ADMIN.

**Decisión corregida**: usar un **secret compartido server-only** (`SIMULADOR_ABUSO_SECRET`):
- Generado con `openssl rand -hex 32`.
- Propagado a `pi-app` y `pi-simulador-abuso` vía `.env.production`.
- Worker envía header `x-simulacion-secret`.
- Endpoint valida con `crypto.timingSafeEqual`.
- Fail-loud en el worker si falta el secret.

## Decisiones de diseño previas (SPEC-184/185)

- El worker envía requests reales a `POST /api/reportes` sin token ADMIN (solo token PARENT si el escenario lo requiere).
- El fingerprint se calcula server-side con `user-agent|accept-language|truncarIp(ip)`.
- Las IPs inyectables están restringidas a rangos RFC 5737.
- El historial ya está paginado y filtrable por estado/escenario.

## Opciones consideradas para I-71

| Opción | Pros | Contras |
|--------|------|---------|
| A. Header `x-simulacion-secret` + env compartido | Funciona con requests anónimos/PARENT; no requiere sesión ADMIN; auditable | Requiere gestionar un secret más |
| B. Endpoint dedicado `/api/admin/reportes/simulacion` | Más aislado | Mayor cambio arquitectónico; duplicaría lógica de creación de reporte |
| C. Excluir IPs RFC 5737 del rate-limit fingerprint | Automático, sin header | Expone bypass implícito, menos auditable |
| D. Sesión ADMIN en `POST /api/reportes` | Simple conceptualmente | Imposible: endpoint rechaza roles ≠ PARENT con 403 |

**Elegida: A** (versión corregida con secret compartido).

## Referencias

- `src/components/modules/AdminAntiAbusoSimulador.tsx`
- `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx`
- `src/app/api/reportes/route.ts`
- `scripts/simulador-abuso.mjs`
- `src/lib/rate-limit.ts`
- `src/lib/anti-abuso/fuente-reporte.ts`
- `BRIEF-SIMULADOR-ANTI-ABUSO-UX.md` v1.1 (corrección F2)
