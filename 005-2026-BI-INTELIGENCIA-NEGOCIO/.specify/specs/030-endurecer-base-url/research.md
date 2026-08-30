# RESEARCH-030 · Endurecer resolución de BI_BASE_URL

## Incidente que origina el SPEC (verificado por Fábrica)

En el deploy real, `https://bi.innovadataco.com/dashboard` sin sesión devolvió redirect con `returnTo=http://localhost:3001/dashboard` → rompió el puente de sesión de Jelkin.

Causa raíz (SSH al VPS · Fábrica · count=0): `BI_BASE_URL` no existía en `.env.bi.production`. El patrón `process.env.BI_BASE_URL ?? "http://localhost:3001"` degradó a localhost silenciosamente en producción.

SPEC-029 documentó `BI_BASE_URL` en `.env.bi.example`, pero el `.env.bi.production` del VPS nunca se sincronizó. Jelkin ya parcheó la env (E2E desbloqueado). Este SPEC endurece el código para que el mismo fallo de config nunca vuelva a degradar en silencio.

## Evidencia empírica reutilizada (D-029.6)

En SPEC-029 comprobé con `next build && next start` + curl qué headers llegan al Server Component de Next.js 15:
```
host · user-agent · accept · x-forwarded-host · x-forwarded-port · x-forwarded-proto · x-forwarded-for
```

**Clave para este SPEC:** `x-forwarded-host` y `x-forwarded-proto` SÍ están disponibles. Son la fuente Nivel 1 del helper — el proxy real (Cloudflare Tunnel) los inyecta con el host público. `x-invoke-path` NO llega (por eso returnTo sigue fijo a `/dashboard`, fuera de alcance de este SPEC).

## Patrón de referencia · SPEC-313 lado PI (hotfix mismo problema, lado emisor)

`ce03c2bdf` (SPEC-313 · 002-PI-213) resolvió el mismo problema en el emisor PI `/api/auth/link-bi`:
> prioridad `x-forwarded-host + x-forwarded-proto` (proxy real en prod) → `PI_BASE_URL` env (fallback) → hardcode `https://pi.innovadataco.com` (última garantía, nunca 0.0.0.0)

Este SPEC mirrorea la prioridad en el lado BI, con **una diferencia intencional**: el Nivel 3 de BI es **THROW en producción**, no hardcode. Razón: PI tiene un host "última garantía" fijo (`pi.innovadataco.com` es siempre el destino), pero para BI el host base se usa para construir `returnTo` y validar `sanitizeReturnTo`; un hardcode equivocado sería tan invisible como el bug original. Preferimos fallar visible (500 en logs) a degradar en silencio. En la práctica el Nivel 1 (proxy) cubre el 100 % del tráfico prod normal, así que el throw solo dispara ante mala config real.

## Dos sitios con el patrón frágil (verificado en fuente)

1. `src/app/dashboard/layout.tsx` línea ~41:
   ```ts
   const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";
   ```
   Contexto: Server Component · tiene `const h = await headers()` → puede leer forwarded headers.

2. `src/app/api/auth/link/route.ts`:
   ```ts
   const biBase = (): string => process.env.BI_BASE_URL ?? "http://localhost:3001";
   ```
   Contexto: Route Handler · tiene `req` → `req.headers` es una `Headers` con `.get()`.

Ambos contextos exponen un objeto con `.get(name): string | null`, así que un helper único `resolveBiBaseUrl(h)` sirve para los dos.

## Decisiones de diseño

### D-030.1 · Helper acepta cualquier `{ get(name): string | null }`
Tanto `headers()` (ReadonlyHeaders) como `req.headers` (Headers) cumplen la firma. Evita duplicar lógica y hace el helper testeable con un mock trivial `{ get: (n) => map[n] ?? null }`.

### D-030.2 · THROW en prod, no hardcode (diferencia con SPEC-313)
Ver "Patrón de referencia" arriba. El throw es intencional: mala config de infra debe ser visible, no silenciosa. La lección de esta noche es exactamente que un fallback silencioso es peor que un error visible.

### D-030.3 · Nivel 1 exige AMBOS headers
Si solo viene `x-forwarded-host` sin `x-forwarded-proto` (o viceversa), no se reconstruye desde Nivel 1 · se cae a Nivel 2 (env). Evita construir una URL con un proto adivinado. En la práctica Cloudflare Tunnel envía ambos.

### D-030.4 · Normalización de trailing slash
`https://bi.x/` y `https://bi.x` deben producir el mismo base. Se recorta el slash final para que la concatenación `${bi}/dashboard` no genere `//dashboard`.

### D-030.5 · `PI_BASE_URL` fuera de alcance
Este SPEC endurece solo `BI_BASE_URL`. `PI_BASE_URL` (host de PI, usado en el redirect al emisor) ya fue endurecido del lado emisor por SPEC-313 y su fallback hardcode `https://pi.innovadataco.com` es un destino fijo conocido — no tiene el mismo riesgo de localhost. Tocarlo sería scope creep.

## Fuentes consultadas

- `src/app/dashboard/layout.tsx` (SPEC-029 · línea del fallback frágil)
- `src/app/api/auth/link/route.ts` (SPEC-029 · `biBase()` con mismo patrón)
- `.specify/specs/029-puente-sesion-link/research.md` D-029.6 (evidencia empírica de headers)
- commit `ce03c2bdf` SPEC-313 (patrón de referencia lado PI)
- INSTRUCTIVO-017

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 23:5x COT |
| **Autor** | Dev BI-2 |
