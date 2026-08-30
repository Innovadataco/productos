# Evidencia §6 · SPEC-035 · guards de seguridad (I-33)

`next build && next start` (NO `next dev`) + `curl` + Playwright. F3C 2026-08-30 18:3x COT.

## Salidas de `curl` (pegadas verbatim)

```
── (§6.1) GET /operacion SIN cookie → 307
   http_code = 307

── (§6.2) GET /operacion SIN cookie · grep PII del body → VACÍO
   grep -E "Fábrica|Calidad|Jelkin|Reembolsos|congelada|Dev BI-2"  →  0 coincidencias
   (antes del fix el body del 307 tenía 52KB con TODA la PII del tablero;
    con el guard al tope de page.tsx antes de leerOperacion, el body cae a
    7.8KB de shell de redirect, sin un solo dato del tablero)

── (§6.4) GET /operacion SIN cookie · Location
   location: https://pi.innovadataco.com/api/auth/link-bi?returnTo=http%3A%2F%2Flocalhost%3A3011%2Foperacion

── (§6.3) GET /operacion CON cookie válida → 200 + tablero (sin regresión)
   http_code = 200   ·   captura: operacion-con-cookie-200.png (.op .wrap + .crew + reloj)

── (DoS) POST /api/bi/preguntar SIN cookie → 401 · SIN latencia LLM
   http_code = 401 · body = {"error":"no_autorizado"} · latencia = 29 ms
   (401 inmediato · NO se invocó el jurado de 3 modelos · sin ~76s de Ollama en el Mac Studio)

── POST /api/bi/preguntar CON cookie → 500 (pasa el guard · el motor falla sin Ollama · NO 401)
   http_code = 500

── GET /api/bi/estado-sistema SIN cookie → 401
   http_code = 401 · body = {"error":"no_autorizado"}

── GET /chat SIN cookie → 307
   http_code = 307
   location: .../api/auth/link-bi?returnTo=...%2Fchat

── (control · público por diseño · NO tocado) GET /api/health SIN cookie → 200
   http_code = 200 · body = {"status":"ok"}   (healthcheck Docker intacto)
```

## Enumeración de rutas (encargo del CEO · candado 15)

Revisé TODAS las rutas `src/app/**/{page.tsx,route.ts}`:

| Ruta | Estado |
|---|---|
| `/operacion` | **cerrada acá** (layout + page guard · era el leak) |
| `/chat` | **cerrada acá** (layout guard · client, sin leak de render) |
| `/api/bi/preguntar` | **cerrada acá** (401 · era el DoS) |
| `/api/bi/estado-sistema` | **cerrada acá** (401) |
| `/dashboard` | ya guardada (layout · SPEC-029) · refactorizada al helper |
| `/api/bi/aprobar` · `/rechazar` · `/kpis` | ya guardadas (401) |
| `/api/health` | pública POR DISEÑO (healthcheck Docker · {status:"ok"}) · NO tocar |
| `/api/auth/link` | pública por diseño (recibe el JWT ephemeral) · se retira en SPEC-036 |
| `/login` · `/login-error` | públicas por diseño |
| `/` (root) | `redirect('/dashboard')` · sin datos |

**No quedó ninguna ruta con datos sin guard.** Todo lo público es público por diseño.

## Nota de arquitectura

- El guard vive en UN helper compartido `src/lib/auth/guard-bi-sesion.ts` (`exigirSesionBi`), usado por dashboard/layout, operacion/layout, operacion/page y chat/layout. SPEC-036 (login propio) cambiará SOLO el interior del helper.
- `/operacion` necesita guard en el **page** (no solo layout) porque renderiza la PII server-side; `/chat` es client (datos por API) y le basta el layout. Distinción documentada en research D-035.
