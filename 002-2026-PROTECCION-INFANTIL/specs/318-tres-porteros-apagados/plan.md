# Plan · SPEC-318 · Los tres porteros apagados

> Rama: work/pi-SPEC-318-tres-porteros-apagados · Base: origin/main @ 60da80036

## Stack y restricciones

- Next.js 14 App Router · TypeScript · Vitest · Prisma
- **Edge constraint:** `middleware.ts` no puede tocar Prisma. El estado viaja en cookie firmada HMAC-SHA256. El emisor corre en Node.
- El helper de emisión vive en `src/lib/routing/` (corre en Node, no en Edge).
- Los tests de middleware inyectan la cookie a mano (`firmarSesionEstado`) — seguirán haciéndolo; el nuevo test "cookie ausente" verifica la conducta real.
- Migración Prisma requerida para §3.5 (nuevo valor enum `AccionAudit`).

## Arquitectura del fix

### A · Helper compartido de emisión

**Nuevo:** `src/lib/routing/sesion-estado-emitter.ts`

```typescript
// Hace Promise.all [vigencia, consentimiento, debeCambiarPassword] para userId
// Devuelve el valor firmado de la cookie (string)
// Reutilizable por: login, activar, restablecer, vigencia/refresh
export async function buildSesionEstadoValue(userId: string): Promise<string>
```

Extrae la lógica de `vigencia/refresh/route.ts:46-58` sin tocar ese archivo.

### B · Cableado en rutas de auth (§3.1)

Tres rutas que ya devuelven una respuesta `NextResponse` o `Response`:

| Ruta | Cómo se agrega la cookie |
|---|---|
| `src/app/api/auth/login/route.ts` | `res.cookies.set(NOMBRE_COOKIE, cookieValue, opts)` antes de return |
| `src/app/api/auth/activar/route.ts` | Mismo patrón |
| `src/app/api/auth/recuperar/restablecer/route.ts` | Mismo patrón |

Cada ruta ya tiene `userId` disponible al momento de la respuesta exitosa.

### C · SessionPingProvider (§3.1 + §3.4)

`src/components/providers/SessionPingProvider.tsx` + `src/hooks/useSessionPing.ts`:
- Cambiar el endpoint de `/api/session/ping` a `/api/vigencia/refresh` (POST)
- El intervalo de refresco existente cubre §3.4 (colegio vencido ≤5 min)
- `SessionPingProvider` NO necesita cambiar su interfaz — solo el endpoint interno

### D · Cierre del ciclo (§3.2)

| Ruta | Patrón |
|---|---|
| `src/app/api/consentimiento/aceptar/route.ts` | Después de `servicio.aceptar()`, `buildSesionEstadoValue(user.id)` y set cookie |
| `src/app/api/auth/cambiar-password/route.ts` | Después del aviso SPEC-322, set cookie (debeCambiarPassword será false) |
| `src/app/api/auth/recuperar/restablecer/route.ts` | Mismo |

### E · Guard.ts — visibilidad persistente (§3.3)

`src/lib/consentimiento/guard.ts:17-22`: sumar `console.error` estructurado (objeto JSON) junto al existente. No borrar el `console.error` actual.

### F · Auditoría (§3.5)

1. `prisma/schema.prisma:53` — agregar `USUARIO_CAMBIO_PASSWORD` al enum `AccionAudit`
2. `prisma/migrations/` — nueva migración (`prisma migrate dev`)
3. Tres rutas propias: `cambiar-password`, `recuperar/restablecer`, `activar` — agregar `logAudit` con `accion: "USUARIO_CAMBIO_PASSWORD"`, `ipAddress: protegerIp(ip)` (HMAC, nunca en claro)

### G · Docstring de vigencia.ts (§3.4)

`src/lib/colegio/vigencia.ts:26-29` — actualizar para reflejar que el middleware cubre vigencia vía cookie; los layouts ya no lo aplican.

## Fases de implementación

### Fase 1 — Helper + migración (base)
- `src/lib/routing/sesion-estado-emitter.ts` (nuevo)
- `prisma/schema.prisma` + migración `AccionAudit`

### Fase 2 — Encender la señal (§3.1)
- Cablear A1, A2, A3 (login, activar, restablecer)
- Actualizar `SessionPingProvider` + `useSessionPing`

### Fase 3 — Cerrar el ciclo (§3.2)
- Callsites B1 (consentimiento/aceptar), B2 (cambiar-password), B3 (restablecer)

### Fase 4 — Guard, docstring, auditoría (§3.3 + §3.4 + §3.5)
- `guard.ts` log estructurado
- `vigencia.ts` docstring
- `logAudit` en los tres caminos propios de contraseña

### Fase 5 — Tests
- Test "cookie ausente" en `middleware.test.ts`
- Tests de rutas A1–A3 y B1–B3 verificando Set-Cookie en response
- `email.migracion.test.ts` o equiv para el nuevo enum (si aplica)
- `specs-discipline.test.ts` local antes de push

## Decisión de diseño clave (→ PARA)

**Pregunta a Fábrica:** ¿aprueba la emisión server-side en A1–A3 (auth routes) + `SessionPingProvider` apunta a `vigencia/refresh`?

**Alternativa descartada (por riesgo):** solo `SessionPingProvider` al montar (race condition: si el browser navega antes de que el primer fetch resuelva, el middleware ya corrió con cookie ausente y pasó fail-open — el guard no se aplica en ese request inicial). La solución server-side en A1–A3 garantiza que la cookie exista *antes* de la primera navegación al dashboard.

**Restricción Edge confirmada:** el helper vive en `src/lib/routing/` con `runtime: "nodejs"` implícito — no se importa desde `middleware.ts`.
