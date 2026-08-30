# TASKS-035 · Guards de seguridad (I-33) · v2 ampliado

## F1 · Helper compartido
- [x] `src/lib/auth/guard-bi-sesion.ts` · `exigirSesionBi(rutaBi)` (candado 22 · SOLO LECTURA de auth)

## F2 · Guards de UI
- [x] `operacion/layout.tsx` · guard · SIN BiAppShell (standalone)
- [x] `operacion/page.tsx` · guard al TOPE (antes de leerOperacion) · MISMO helper · cierra el leak de RSC
- [x] `chat/layout.tsx` (nuevo) · guard · client, sin guard en page (no server-renderiza PII)
- [x] `dashboard/layout.tsx` · refactor al helper (comportamiento idéntico)

## F3 · Guards de API (401 · DoS backstop)
- [x] `/api/bi/preguntar` · 401 PRIMERA línea del POST (antes de req.json y del motor)
- [x] `/api/bi/estado-sistema` · GET(req) + 401
- [x] `/api/health` NO tocado (público por diseño · healthcheck Docker)

## F4 · Tests
- [x] `bi-operacion-guard.test.tsx` · page sin sesión no lee datos · layouts · preguntar/estado-sistema 401 · motor no invocado · anti-drift genérico (dashboard/operacion/chat)
- [x] Ajuste tests existentes preguntar + estado-sistema (mock sesión válida)

## F5 · Gate local
- [x] `rm -rf .next && npm run build` verde
- [x] `npm run typecheck` verde
- [x] `npx vitest run` · 192 passed · 15 skipped · 0 failed
- [x] Ratchets 4/5 verdes

## F6 · Evidencia §6 (candado 25 · seguridad · en evidencia/README.md)
- [x] /operacion sin cookie → 307 · body grep PII = 0 · Location returnTo=%2Foperacion
- [x] /operacion con cookie → 200 + tablero (captura)
- [x] POST /api/bi/preguntar sin cookie → 401 en 29ms (sin latencia LLM · motor no invocado)
- [x] GET /api/bi/estado-sistema sin cookie → 401
- [x] GET /chat sin cookie → 307
- [x] /api/health sin cookie → 200 (control · intacto)
- [x] Enumeración de todas las rutas (encargo CEO)

## F7 · Push + PR
- [x] commit + push (PR #175 actualizado con el código)
- [ ] Señal REALIZADO

## Reglas duras
- [x] Diseño del tablero NO cambia (sin sidebar/shell)
- [x] returnTo=/operacion · /chat
- [x] No tocar lo congelado ni /api/health
- [x] Grep vacío del body de /operacion en la evidencia
