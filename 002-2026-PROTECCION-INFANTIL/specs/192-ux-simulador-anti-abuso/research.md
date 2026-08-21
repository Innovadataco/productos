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

## Decisiones de diseño previas (SPEC-184/185)

- El worker envía requests reales a `POST /api/reportes` sin token ADMIN (solo token PARENT si el escenario lo requiere).
- El fingerprint se calcula server-side con `user-agent|accept-language|truncarIp(ip)`.
- Las IPs inyectables están restringidas a rangos RFC 5737.
- El historial ya está paginado y filtrable por estado/escenario.

## Opciones consideradas para I-71

| Opción | Pros | Contras |
|--------|------|---------|
| A. Header `x-simulacion: true` + validación ADMIN en `POST /api/reportes` | Simple, no toca rate-limit library | Requiere confiar en header interno |
| B. Endpoint dedicado `/api/admin/reportes/simulacion` para el worker | Más aislado | Mayor cambio arquitectónico, duplicaría lógica de creación de reporte |
| C. Excluir IPs RFC 5737 del rate-limit fingerprint | Automático, sin header | Expone bypass implícito, menos auditable |

**Elegida: A**. Es la más localizada y auditable; el header solo funciona con sesión ADMIN.

## Referencias

- `src/components/modules/AdminAntiAbusoSimulador.tsx`
- `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx`
- `src/app/api/reportes/route.ts`
- `scripts/simulador-abuso.mjs`
- `src/lib/rate-limit.ts`
- `src/lib/anti-abuso/fuente-reporte.ts`
