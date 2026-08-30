# RESEARCH-029 · Puente sesión PI ↔ BI

## Estado actual del auth BI (verificado 2026-08-29 21:2x COT)

### `src/lib/auth/sesion.ts` (SOLO LECTURA)
```
extraerToken(req):
  1. Authorization: Bearer <token>   → devuelve token
  2. Cookie header · busca `session=<valor>` → devuelve valor
  3. Sin ninguno → null

sesionDeRequest(req):
  1. token = extraerToken(req); si null → null
  2. payload = await verifyToken(token); si null → null
  3. Si payload.role y payload.sub son strings → {id: sub, rol: role}
  4. Sino → null
```

**Contrato implícito** para la cookie `session`: debe contener un JWT válido cuyo payload tenga `sub` (string) y `role` (string). Cualquier otro claim es ignorado silenciosamente.

### `src/lib/auth/jwt.ts` (SOLO LECTURA)
```
verifyToken(token):
  1. Lee JWT_SECRET del env; si vacío → null
  2. jose.jwtVerify(token, textEncoded(secret))
  3. Try → devuelve payload; catch → null
```

**Algoritmo:** `jose.jwtVerify` acepta HS256 por default. El emisor (PI) debe firmar con el mismo `JWT_SECRET` en HS256 para verificar.

### `src/app/dashboard/layout.tsx` (SPEC-024 · CUMPLE)
Actualmente:
```ts
const sesion = await sesionDeRequest(req);
if (!sesion) redirect("/login");
```
`/login` a su vez redirige a `PI_BASE_URL/login` sin retorno funcional — el bug de I-30. Este SPEC modifica la línea `redirect(...)` para apuntar a `${PI_BASE_URL}/api/auth/link-bi?returnTo=<absolute>`.

### `.env.bi.example`
- `JWT_SECRET=REEMPLAZAR_CON_MISMO_JWT_SECRET_DE_PI` (línea 7) — ya anticipado como compartido.
- `PI_BASE_URL=https://pi.innovadataco.com` (línea 10).
- `BI_BASE_URL` NO existe hoy; este SPEC lo añade.

### Dependencia `jose` (verificado en `package.json`)
- `"jose": "^6.0.10"` presente.
- API usada: `jwtVerify` (ya reutilizado) + `SignJWT` (nueva importación en este SPEC).

---

## Contrato JWT ephemeral (coordinado con SPEC-PI paralelo · Brief §3-PI)

El emisor PI (`GET /api/auth/link-bi`) debe producir un JWT con este shape mínimo:

```json
{
  "sub": "<user-id>",
  "email": "<opcional>",
  "role": "ADMIN | SCHOOL_ADMIN | ...",
  "linkTo": "bi",
  "iat": 1756500000,
  "exp": 1756500060
}
```

- Algoritmo: HS256.
- Secreto: `JWT_SECRET` compartido (mismo en `.env.bi.production` y `.env.production` de PI).
- TTL 60 s (Brief §3-PI · §5 candados).
- `linkTo` es el discriminador de propósito: BI rechaza cualquier valor distinto de `"bi"` con `?reason=bad_claim`.

**Confirmación bilateral en implementación:** Fábrica PI-1 confirmará que el emisor produce exactamente estos claims; si difiere (por ejemplo `roles: string[]` en vez de `role: string`), se coordina un ajuste antes del deploy.

---

## Defensa contra open redirect (Brief §5)

`returnTo` viene por query string. La whitelist es intencionalmente estrecha para Fase 1.5:

- **Absoluta:** aceptamos solo host `BI_BASE_URL`. Se extrae `pathname + search` y se descarta el host.
- **Relativa:** debe comenzar con `/`.
- **Prefijos permitidos:** `/dashboard`, `/chat`, `/api/bi/`. Cualquier otro → default `/dashboard`.
- **Rechazo silencioso:** si `returnTo` falla la validación, se ignora y se completa el login redirigiendo a `/dashboard`. No 4xx. Razón: el flujo se dispara por el guard de BI que ya venía a `/dashboard` de todos modos; forzar un error visible confundiría al usuario.

Alternativas consideradas y descartadas:
- Aceptar cualquier path `/*`: demasiado permisivo (habría manera de inyectar `/../..` u otros paths que el usuario nunca visita).
- Regex por dominio: innecesario; validación por prefijo es más simple y auditable.

---

## Cookie `session` — atributos exactos

Los atributos vienen del Brief §3-BI y se validan aquí contra el estado actual:

| Atributo | Valor | Confirmación en fuente |
|---|---|---|
| Nombre | `session` | `sesion.ts` línea 15: `k === "session"`. Match exacto obligatorio. |
| `Path` | `/` | Todo el dominio BI. |
| `Secure` | `NODE_ENV === "production" ? true : false` | HTTPS en prod, HTTP en dev local. |
| `HttpOnly` | `true` | Defensa XSS estándar. |
| `SameSite` | `Lax` | Bloquea CSRF cross-site pero permite navegación desde otro origen (que es exactamente el flujo del handoff desde PI). |
| `Max-Age` | `60 * 60 * 24` (86 400 s) | 24 h; Brief §3-BI. |
| Sin `Domain` | correcto | Sin `Domain`, la cookie queda pegada a `bi.innovadataco.com` (o `localhost` en dev). Mismo patrón que `__Host-` de PI, sin el prefijo formal. |

**Valor de la cookie:** JWT re-firmado por BI con `JWT_SECRET` y payload `{sub, role, email?}` (SIN `linkTo`), `exp = ahora + 24 h`. Motivo de re-firmar: evitar que un adversario que capture la cookie 24 h después pueda reciclarla como link ephemeral (aunque `linkTo` ya expiró, la ausencia del claim en la cookie garantiza que no accidentalmente vuelva a pasar por el flujo de handoff).

---

## Extraer path del request en Server Component (Next.js App Router)

Investigación previa al PASO 4:

- **Server Component** (que es donde vive `dashboard/layout.tsx`) NO recibe el objeto request directamente. Se usan las utilities `headers()` y `cookies()` de `next/headers`.
- `headers()` expone los headers HTTP del request actual. Next.js internamente añade `x-invoke-path` con la ruta que se está renderizando; también `x-forwarded-uri` en algunas configuraciones tras proxy.
- Alternativa robusta: leer `Referer` (no siempre está en un navegador limpio) o construir el URL desde `x-forwarded-host` + `x-invoke-path`.
- **Fallback seguro:** si ninguna cabecera está presente, redirigir con `returnTo=/dashboard`. El usuario aterriza en el dashboard aunque intentara acceder a una sub-ruta; menos preciso pero funciona.

Documentado como TODO explícito en `plan.md` F3; Fábrica define durante implementación si `x-invoke-path` es suficiente o si prefiere un enfoque distinto (middleware con NextRequest, por ejemplo).

---

## Decisiones de diseño

### D-029.1 · Re-firmar el JWT para la cookie session, no reusar el ephemeral
Aunque el JWT ephemeral tiene 60 s de TTL y sería seguro por ese tiempo, la cookie necesita 24 h. Se re-firma con el mismo `JWT_SECRET` para producir un token válido para la vida útil de la sesión. Beneficio adicional: el claim `linkTo` se remueve, así el token de sesión NO puede ser confundido con un link ephemeral en un flujo hipotético futuro.

### D-029.2 · `sanitizeReturnTo` con rechazo silencioso (default `/dashboard`)
Rechazar `returnTo` con 4xx obligaría al usuario a re-loguearse; degradar silenciosamente a `/dashboard` completa el login y el usuario puede navegar. Aceptable trade-off para Fase 1.5.

### D-029.3 · `login-error` como página HTML plana, no JSON
El endpoint es llegado vía redirect desde el guard, siempre bajo un navegador. Una página HTML explicativa con `<a href="/dashboard">Reintentar</a>` cierra el ciclo (re-dispara el guard → PI). Un JSON obligaría al usuario a entender la URL.

### D-029.4 · TTL 24 h de la cookie session, sin refresh automático
Fase 1.5. Cuando expira, el guard vuelve a disparar el flow completo PI→BI. Simple y suficiente para uso admin/analista (Jelkin). Fase 2 puede añadir refresh silencioso.

### D-029.5 · Emisor firma con `role: string`, no `roles: string[]`
Coincide con `sesionDeRequest` línea 27: `typeof payload.role === "string"`. Si PI emite `roles: [...]`, sesionDeRequest devuelve `null` y el guard redirige otra vez → loop infinito. Documentado explícito en Brief §3-BI para que PI use `role` singular.

---

## Fuentes consultadas

- `src/lib/auth/sesion.ts` (extraerToken + sesionDeRequest · líneas 1-30)
- `src/lib/auth/jwt.ts` (verifyToken · líneas 1-15)
- `.env.bi.example` (líneas 7 · JWT_SECRET · 10 · PI_BASE_URL)
- `package.json` (jose ^6.0.10)
- BRIEF-A-52 completo (§3-BI · §5 candados · §4 coordinación deploy)
- `../work/bi-SPEC-024-layout-sidebar/src/app/dashboard/layout.tsx` (guard actual · SPEC-024 CUMPLE)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 21:3x COT |
| **Autor** | Dev BI-2 |
