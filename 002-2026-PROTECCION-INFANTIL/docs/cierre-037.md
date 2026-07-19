# Cierre 037 — Fixes de seguridad y limpieza

**Spec**: `specs/037-seguridad-limpieza/spec.md`  
**Branch**: `feature/001-scaffolding`  
**Fecha de cierre**: 2026-07-19  
**Responsable**: ODIN (agente automático)

---

## Resumen

Se aplicó rate limiting a los endpoints administrativos que aún no lo invocaban y se sanitizó el mensaje de error guardado en las transiciones de fallback del worker de procesamiento de reportes.

---

## Commits

1. **`037-us1-rate-limiting-admin`** — Aplica `checkRateLimit` a los endpoints admin identificados sin rate limit.
2. **`037-us2-errmsg-generico-transicion`** — Reemplaza el mensaje de error crudo en `src/app/api/reportes/procesar/route.ts` por mensaje genérico + código de error.
3. **`037-docs`** — Completa Spec-Kit (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`, `tasks.md`) y este cierre.

---

## Archivos tocados

### Código (US1)

- `src/app/api/admin/operadores/route.ts`
- `src/app/api/admin/operadores/[id]/route.ts`
- `src/app/api/admin/operadores/[id]/regenerar-password/route.ts`
- `src/app/api/admin/operadores/[id]/reenviar-email/route.ts`
- `src/app/api/admin/operadores/[id]/reactivar/route.ts`
- `src/app/api/admin/comite/integrantes/route.ts`
- `src/app/api/admin/comite/integrantes/[id]/route.ts`
- `src/app/api/admin/reportes-revision/[id]/reasignar/route.ts`

### Código (US2)

- `src/app/api/reportes/procesar/route.ts`

### Documentación

- `specs/037-seguridad-limpieza/spec.md`
- `specs/037-seguridad-limpieza/plan.md`
- `specs/037-seguridad-limpieza/research.md`
- `specs/037-seguridad-limpieza/data-model.md`
- `specs/037-seguridad-limpieza/quickstart.md`
- `specs/037-seguridad-limpieza/checklists/requirements.md`
- `specs/037-seguridad-limpieza/tasks.md`
- `docs/cierre-037.md`

---

## Validación técnica

### Tipos

```bash
npx tsc --noEmit
```

Resultado: **OK** (sin errores).

### Lint

```bash
npm run lint
```

Resultado: **OK** (0 errores, 1 warning preexistente en `src/app/dashboard/admin/comite/gestion/page.tsx`).

### Tests

```bash
npm run test
```

Resultado: **78 test files, 412 tests passed**.

### Healthcheck / Deploy

```bash
./scripts/dev-restart.sh
```

Resultado: **OK**

```json
{"status":"ok","workerAlive":true,"dbOk":true,"timestamp":"2026-07-19T10:22:02.536Z"}
```

### Verificación con quickstart.md

- Login como admin (`/api/auth/login`): **200** con cookie `token`.
- GET `/api/admin/operadores`: **200**, endpoint protegido funciona correctamente.
- **Nota**: el entorno de desarrollo tiene `DISABLE_RATE_LIMIT=true` en `.env`, por lo que no se pudo alcanzar el estado `429` manualmente. El helper `checkRateLimit` y la respuesta `429` están cubiertos por `src/lib/rate-limit.test.ts` y por endpoints admin existentes.

---

## Endpoints afectados por rate limiting

| Archivo | Métodos | Scope |
|---------|---------|-------|
| `admin/operadores/route.ts` | GET, POST | `admin_read`, `admin_write` |
| `admin/operadores/[id]/route.ts` | PATCH, DELETE | `admin_write` |
| `admin/operadores/[id]/regenerar-password/route.ts` | POST | `admin_write` |
| `admin/operadores/[id]/reenviar-email/route.ts` | POST | `admin_write` |
| `admin/operadores/[id]/reactivar/route.ts` | POST | `admin_write` |
| `admin/comite/integrantes/route.ts` | GET, POST | `admin_read`, `admin_write` |
| `admin/comite/integrantes/[id]/route.ts` | PATCH, DELETE | `admin_write` |
| `admin/reportes-revision/[id]/reasignar/route.ts` | POST | `admin_write` |

---

## Cambio en `procesar/route.ts`

- Se definió `errorCode` a partir del error si tiene propiedad `code`; de lo contrario `INTERNAL_ERROR`.
- Se reemplazó:
  - `motivo: `Error de procesamiento: ${errMsg}`` → `motivo: "Error durante el procesamiento del reporte"`
  - `metadatos: { error: errMsg }` → `metadatos: { errorCode }`
- El log de `console.error` y el campo `Reporte.processingError` conservan `errMsg` para diagnóstico operativo; este spec solo sanitiza la traza de auditoría de la transición.

---

## Deuda técnica

- `Reporte.processingError` todavía almacena el mensaje de error crudo. El alcance del spec fue exclusivamente los metadatos de la transición; si se requiere sanitizar también ese campo, se debe crear un spec aparte que evalúe impacto en UI y alertas.
- No se agregaron tests nuevos que verifiquen `429` en cada endpoint afectado; el patrón está cubierto por `src/lib/rate-limit.test.ts` y endpoints admin previos.

---

## Notas

- No se modificaron migraciones, seed, middleware, worker ni lógica central de specs 035/036.
- Todos los cambios son aditivos y no destructivos.
- Rama actualizada en `feature/001-scaffolding`.
