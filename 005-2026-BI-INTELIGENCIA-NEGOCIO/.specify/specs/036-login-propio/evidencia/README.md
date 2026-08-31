# Evidencia §6 · SPEC-036 · login propio de BI (una sola puerta)

Entorno: build de producción real servido con el entrypoint standalone
(`node .next/standalone/.../server.js`, **no** `next dev` ni `next start` — la app
usa `output: standalone`). `curl` contra `http://localhost:3011`. Env de prueba:
`BI_AUTH_USER=jelkin`, `JWT_SECRET=<test>`, `OPERACION_JSON_PATH=<fixture>`.
F3C 2026-08-30 19:2x COT.

> La clave real (`BI_AUTH_PASSWORD`) va en el `.env` del VPS (600, fuera de git),
> la siembra el CEO antes de desplegar. Acá se usa un valor de prueba solo para
> ejercer el flujo. Ningún secreto real aparece en esta evidencia.

## Las 6 salidas (pegadas verbatim)

### server v1 · `BI_AUTH_PASSWORD=clave-buena`

```
── (§6.1) anónimo /operacion y /dashboard → 307 a /login de BI (no PI)
GET /operacion:
   HTTP/1.1 307 Temporary Redirect
   location: /login?returnTo=%2Foperacion
GET /dashboard:
   HTTP/1.1 307 Temporary Redirect
   location: /login?returnTo=%2Fdashboard

── (§6.2) body anónimo de /operacion · grep PII → VACÍO
   bytes body: 7713
   grep -icE 'Fábrica|Calidad|Jelkin' → 0

── (§6.3) login correcto returnTo=/operacion → 302 a /operacion + cookie
   HTTP/1.1 302 Found
   location: http://localhost:3011/operacion
   set-cookie: session=<jwt-redactado>; Path=/; Expires=Tue, 01 Sep 2026 00:29:08 GMT; Max-Age=86400; Secure; HttpOnly; SameSite=lax
   → GET /operacion CON cookie: HTTP 200

── (§6.6) recarga autenticada NO re-pide clave (2x)
   recarga #1 /operacion → HTTP 200
   recarga #2 /operacion → HTTP 200

── (§6.5) logout → 302 /login + cookie borrada · /operacion deja de abrirse
   HTTP/1.1 302 Found
   location: http://localhost:3011/login
   set-cookie: session=; Path=/; Max-Age=0; HttpOnly
   → GET /operacion con cookie borrada: HTTP 307 · Location /login?returnTo=%2Foperacion
```

### El corazón (§6.4) · request-time EN VIVO · SIN deploy

Se mata v1, se reinicia con **otra** `BI_AUTH_PASSWORD` y **el mismo build**
(mismo `BUILD_ID`, no se corrió `next build`). La clave nueva sirve y la vieja
deja de servir de inmediato — prueba que el env se lee en request time y que
cambiar la clave es solo editar `.env` + reiniciar, sin rebuild ni PR ni deploy.

```
### BUILD_ID (no cambia entre v1 y v2 · sin rebuild): zfd7hxELFx92GPXrT1T_S

### server v2 · BI_AUTH_PASSWORD=clave-nueva · reinicio · MISMO server.js/BUILD_ID · SIN deploy
── (§6.4) clave VIEJA (clave-buena) → 302 /login?error=1 SIN cookie
   HTTP/1.1 302 Found
   location: http://localhost:3011/login?error=1&returnTo=%2Foperacion
── (§6.4) clave NUEVA (clave-nueva) → 302 /operacion + cookie session
   HTTP/1.1 302 Found
   location: http://localhost:3011/operacion
   set-cookie: session=<jwt-redactado>; Path=/; Expires=Tue, 01 Sep 2026 00:29:11 GMT; Max-Age=86400; Secure; HttpOnly; SameSite=lax
```

> **Nota de higiene (I-22):** el valor firmado del JWT `session` se redactó a
> propósito — no aporta a la evidencia (lo que importa son los atributos de la
> cookie: `Secure·HttpOnly·SameSite=lax·Max-Age=86400`). El `JWT_SECRET` usado en
> esta captura fue un valor **de prueba local**, nunca el de producción (que vive
> solo en `.env.bi.production` del VPS, 600, fuera de git). Tokens firmados con el
> secret de prueba no valen contra producción.

## Lectura de las 6

| # | Afirma | Resultado |
|---|---|---|
| 1 | anónimo a `/operacion` y `/dashboard` → 307 al **`/login` de BI** (no al puente de PI, no 200) | ✅ `location: /login?returnTo=…` en ambas |
| 2 | el body anónimo no filtra PII del tablero | ✅ 7713 B · `grep` 0 coincidencias de Fábrica/Calidad/Jelkin |
| 3 | login correcto con `returnTo=/operacion` aterriza en `/operacion` (no siempre `/dashboard`) | ✅ 302 → `/operacion` + cookie `session` (Secure·HttpOnly·SameSite=lax·Max-Age=86400) · GET autenticado 200 |
| 4 | cambiar la clave + reiniciar → nueva sirve, vieja no, **sin deploy** | ✅ mismo `BUILD_ID`; vieja → `/login?error=1` sin cookie; nueva → `/operacion` + cookie |
| 5 | logout vuelve a `/login` y `/operacion` deja de abrirse | ✅ 302 `/login` + `session=; Max-Age=0`; luego `/operacion` → 307 `/login` |
| 6 | recargar autenticado no re-pide clave | ✅ 200 / 200 |

## Notas

- **fail-closed** (verificado por Fábrica en fuente): si se despliega sin
  `BI_AUTH_USER`/`BI_AUTH_PASSWORD`, el login rechaza a todos con el mismo error
  sin cookie — nunca se abre solo. Por eso el CEO siembra las vars antes.
- La cookie `session` es un JWT `{sub, role:ADMIN}` HS256 TTL 24h, el mismo shape
  que `sesionDeRequest`/`verifyToken` ya leen (no se tocó `src/lib/auth/sesion|jwt`).
- Swap durante el `next build`: 45 páginas (~180 KB), Ollama de PI vivo, sin swap
  serio (turno RAM coordinado con Dev BI-1).

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 19:2x COT |
| **Autor** | Dev BI-2 |
