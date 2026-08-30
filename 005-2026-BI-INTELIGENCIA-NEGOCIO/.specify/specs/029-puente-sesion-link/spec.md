# SPEC-029 · Puente sesión PI ↔ BI · endpoint `/api/auth/link` + guard redirige a PI

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 029 |
| **Nombre** | puente-sesion-link |
| **Origen** | BI · INSTRUCTIVO-016 · F3C 2026-08-29 21:2x COT · Brief A-52 §3-BI |
| **Prioridad** | 🔴 CRÍTICA · cierra I-30 (bloqueador uso real BI) |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Cerrar I-30: hoy el guard de `/dashboard/**` (SPEC-024 CUMPLE) redirige a `/login` que a su vez redirige a `PI_BASE_URL/login` sin retorno funcional a BI; la cookie de PI (`__Host-token`) no cruza a `bi.innovadataco.com` por spec del prefijo `__Host-`. Este SPEC construye el lado BI del puente:

1. Endpoint `GET /api/auth/link` que consume un JWT ephemeral emitido por PI (SPEC-PI paralelo, ver Brief A-52 §3-PI) y setea cookie `session` local con TTL 24 h.
2. Modificar el guard existente para que, cuando falte sesión BI, redirija al endpoint PI (`${PI_BASE_URL}/api/auth/link-bi?returnTo=<url>`) en vez de a `/login` local.

Sin este SPEC, SPEC-024 CUMPLE no sirve al usuario final: nadie entra al dashboard.

---

## Alcance

### Rutas y archivos que este SPEC produce

| Ruta | Qué contiene |
|---|---|
| `src/app/api/auth/link/route.ts` (nuevo) | GET handler que verifica JWT ephemeral, setea cookie `session`, redirige a `returnTo` validado |
| `src/app/login-error/page.tsx` (nuevo) | Página mínima que muestra el motivo del fallo (`?reason=invalid_token|expired|bad_claim`) |
| `src/app/dashboard/layout.tsx` (**modificado** · SPEC-024) | Guard cambia el destino del redirect: `/login` → `${PI_BASE_URL}/api/auth/link-bi?returnTo=<absoluteUrl>` |
| `.env.bi.example` (**modificado**) | Documentar que `JWT_SECRET` es compartido con PI + añadir `BI_BASE_URL` (usado por PI para redirigir hacia acá) |

### Contrato del JWT ephemeral recibido (coordinado con SPEC-PI paralelo)

BI espera recibir por query string `token=<JWT>` con este shape del payload:

```json
{
  "sub": "<user-id>",        // string · id de usuario PI
  "email": "<email>",        // string · opcional pero típico
  "role": "<rol>",           // string · rol PI (ADMIN / SCHOOL_ADMIN / …)
                             //   MAPEADO al claim `role` que sesionDeRequest ya lee (línea 27 de sesion.ts).
  "linkTo": "bi",            // string · REQUERIDO · discrimina uso · rechazo si != "bi"
  "iat": <unix>,             // number · issued at
  "exp": <unix>              // number · issued + 60 s
}
```

**Algoritmo:** HS256, firmado con `JWT_SECRET` (mismo secreto que PI · `.env.bi.example` línea 7 ya lo anticipa).
**Librería:** `jose` (ya presente en el proyecto vía `verifyToken` de `src/lib/auth/jwt.ts`).
**TTL:** 60 s (validado por `jose.jwtVerify` que rechaza si `exp` está en el pasado, con `clockTolerance` por defecto).

### Validación de `returnTo` (candado 5 del Brief · defensa open redirect)

`returnTo` viene por query string. Reglas de validación (rechazo → default a `/dashboard`):

1. Debe parsear como URL relativa (comienza con `/`) O como URL absoluta contra `BI_BASE_URL`.
2. Whitelist explícita de prefijos permitidos: `/dashboard`, `/chat`, `/api/bi/kpis` (rutas propias de BI).
3. Nunca aceptar URLs con host distinto a `BI_BASE_URL`, ni URLs con protocolo distinto a `https:` en prod.
4. Si `returnTo` es inválido → se ignora silenciosamente y se usa `/dashboard`. No 4xx; se completa el login como si no hubiera venido `returnTo`.

### Atributos de la cookie `session` que se setea (candado 5 del Brief)

| Atributo | Valor | Razón |
|---|---|---|
| `Path` | `/` | La cookie aplica a todo el dominio BI. |
| `Secure` | `true` en prod (`NODE_ENV === "production"`), `false` en dev | HTTPS obligatorio en prod. |
| `HttpOnly` | `true` | JS del cliente no puede leerla · defensa XSS. |
| `SameSite` | `Lax` | Bloquea CSRF cross-site pero permite navegación normal. |
| `Max-Age` | `86400` (24 h) | Vida útil BI. |
| `Domain` | (no seteado) | Sin `Domain` la cookie queda pegada a `bi.innovadataco.com` (o `localhost` en dev). |
| Nombre | `session` | Matchea EXACTAMENTE lo que `sesionDeRequest` línea 15 busca (`k === "session"`). |
| Valor | JWT re-firmado con mismo `JWT_SECRET`, MISMO payload MENOS el claim `linkTo`, `exp` = ahora + 24 h | El JWT debe verificar con `verifyToken` existente y devolver `sub` + `role`; `linkTo` fuera para que un mid-flow no pueda re-usarse como link ephemeral. |

### Comportamiento del handler `GET /api/auth/link`

```
1. Leer query: token, returnTo (opcional).
2. Si !token → redirect 302 /login-error?reason=invalid_token
3. verifyToken(token) via lib existente (no duplicar).
4. Si payload===null → redirect 302 /login-error?reason=invalid_token
5. Si payload.exp está en el pasado → jose ya lo rechaza; safety net redundante → invalid_token/expired.
6. Si payload.linkTo !== "bi" → redirect 302 /login-error?reason=bad_claim
7. Construir payload nuevo: { sub, role, email? } sin linkTo. Firmar con SignJWT (jose) HS256 exp=24h.
8. Set-Cookie session=<newJwt> con atributos arriba.
9. Redirect 302 a returnToValidado ?? "/dashboard".
```

### Modificación del guard `src/app/dashboard/layout.tsx`

Reemplazar `redirect("/login")` por:

```ts
const pi = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
const bi = process.env.BI_BASE_URL ?? "https://bi.innovadataco.com";
// URL absoluta del request para que PI sepa a dónde redirigir después
const currentPath = h.get("x-forwarded-uri") ?? h.get("x-invoke-path") ?? "/dashboard";
const returnTo = `${bi}${currentPath}`;
redirect(`${pi}/api/auth/link-bi?returnTo=${encodeURIComponent(returnTo)}`);
```

*Nota Next.js:* en Server Component el path del request no está directo; se lee de headers estándar Next (`x-invoke-path`) con fallback a `/dashboard`. Investigación de patrón exacto queda documentada en research.md.

### Página `/login-error`

Simple Server Component:
```tsx
export default async function LoginErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const map: Record<string, string> = {
    invalid_token: "El enlace de acceso es inválido o está mal formado.",
    expired: "El enlace de acceso caducó. Inicia sesión de nuevo.",
    bad_claim: "El enlace no corresponde a este servicio.",
  };
  const msg = map[reason ?? ""] ?? "No se pudo completar el ingreso.";
  return <main className="p-8"><h1>No se pudo iniciar sesión</h1><p>{msg}</p><a href="/dashboard">Reintentar</a></main>;
}
```

Sin lógica compleja; sirve para que el usuario entienda por qué falló y pueda reintentar (el `/dashboard` disparará de nuevo el guard → PI).

---

## Fuera de alcance

- SPEC del lado PI (`/api/auth/link-bi` emisor) — Fábrica PI-1 → Dev PI-1 en paralelo (Brief §3-PI).
- Logout coordinado PI↔BI (Fase 2 · Brief §6).
- Refresh de sesión BI cuando expire cookie 24 h (Fase 2 · fuerza re-link).
- Multi-tenant.

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 22 | Rutas SOLO LECTURA respetadas | NO se toca `src/lib/auth/sesion.ts` ni `src/lib/auth/jwt.ts` (verifyToken). Se reutilizan. El único archivo tocado fuera de `src/app/api/auth/link` es `src/app/dashboard/layout.tsx` (guard SPEC-024) y `.env.bi.example` (documentación). |
| — | JWT_SECRET NUNCA en chat/commit | El valor real vive en `.env.bi.production` fuera de git; el generador y los tests usan `JWT_SECRET=test-secret-solo-para-vitest`. |
| — | Whitelist estricta `returnTo` | Documentada arriba. Nunca redirect abierto. |
| — | TTL 60 s del link ephemeral es de PI | BI solo verifica que no esté vencido, nunca lo extiende. |
| 14 | Verificación en vivo | Gate local con `curl` + JWT armado a mano usando `JWT_SECRET` local. |
| 17 | spec+plan commiteado antes de implementar | Aplicado (compuerta §4 real esta vez, esperando REVISO). |

---

## Riesgos

- **Coordinación con SPEC-PI:** el contrato JWT (arriba) debe ser exactamente lo que PI emite. Si PI incluye claims adicionales, el verifyToken de BI los ignora (jose no rechaza extras); si PI **omite** `sub`, `role` o `linkTo`, el handler lo rechaza como `bad_claim`. Documentado explícito arriba para que ambos lados lo confirmen.
- **`x-invoke-path` no es API pública Next.js:** puede cambiar entre versiones. Fallback a `/dashboard` y research.md documenta alternativas (extraer del `Referer`, usar `next/server`'s NextRequest en middleware) por si Fábrica prefiere un enfoque distinto.
- **Cookie `Secure=true` en dev:** si `NODE_ENV !== "production"` se setea `Secure=false` para funcionar en `http://localhost:3001`; en prod sí es obligatorio. Documentado.
- **Reuso del token ephemeral:** el JWT emitido por PI es one-shot conceptualmente pero técnicamente no hay revocación server-side. El TTL 60 s hace la ventana de reuso mínima. Aceptable para Fase 1.5.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 21:3x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
