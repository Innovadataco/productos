# Deuda: bcryptjs (JS puro) → hasher bcrypt nativo

**Origen**: cola nocturna 002-PI-041, bloque B6 (deuda b). Evaluada el 2026-07-29.
**Veredicto**: NO trivial en este contexto — queda anotada con el bloqueo exacto y la ruta viable.

## Motivo de la deuda

`bcryptjs` es JS puro: ~10-20× más lento que un binding nativo a coste 12. Pega en
cada login y en cada test que crea usuarios (el flaky de SPEC-114, 5142 ms, se atribuyó
en parte a bcrypt bajo contención de CPU — ver `specs/114-suite-e2e-por-rol/cierre.md:43`).

## Dónde se usa hoy (`bcryptjs@^3.0.2`, `package.json:28`)

- `src/lib/auth.ts:2` — `hashPassword` (`:49-51`) y `verifyPassword` (`:53-58`): **cada login**.
- `src/lib/token-recuperacion.ts:2` — hash/verify de tokens de recuperación (`:9-13`).
- `src/app/api/auth/verificar/solicitar/route.ts:3` — hash del código de verificación (`:73`).
- `src/app/api/auth/verificar/validar/route.ts:3` — verify del código (`:38`).

## Qué lo bloquea (archivo:línea)

1. **Docker prod es Alpine (musl) sin toolchain**: el stage `prod-deps` (`Dockerfile:33-40`)
   corre `npm ci --omit=dev` sobre `node:22-alpine` con solo `apk add openssl`
   (`Dockerfile:37`); el stage `deps` igual (`Dockerfile:5-11`). `bcrypt` (node-gyp) no
   publica prebuilds musl confiables: compilaría desde fuente y fallaría sin
   `python3`/`make`/`g++`. Agregar el toolchain a dos stages engorda y enlentece la imagen.
2. **Tracing del standalone sin verificar**: la imagen runner solo recibe lo que Next
   traza en `.next/standalone` (`Dockerfile:53-54`, `output: "standalone"` en
   `next.config.ts:5`). Los binarios `.node` nativos suelen requerir
   `serverExternalPackages` (hoy ausente en `next.config.ts`). Esto SOLO se verifica con
   `docker build` completo + arranque del contenedor (`docker-compose.prod.yml:26-48`),
   es decir, un despliegue — prohibido en la cola nocturna.
3. **Tres ABI distintos**: dev macOS arm64, CI ubuntu x64 (glibc), prod linux x64 (musl).
   El lockfile y las optionalDependencies deben resolver por plataforma; un error aquí
   solo explota en la imagen de producción.
4. **Camino crítico de seguridad**: una regresión de verify bloquea TODOS los logins.
   Los hashes existentes son `$2a$`/`$2b$` (invariante §9, `src/lib/e2e/helpers.ts:112-114`)
   y deben seguir verificando — `crypto.scrypt` nativo de Node queda descartado porque
   cambia el formato y forzaría reset de contraseñas de todos los usuarios.

## Ruta viable cuando se aborde (spec propia)

`@node-rs/bcrypt` (napi-rs): publica prebuilds para darwin-arm64, linux-x64-gnu **y
linux-x64-musl** — no necesita toolchain en el Dockerfile. API compatible
(`hash(pw, 12)` / `compare(pw, hash)` async), emite `$2b$` y verifica `$2a$`/`$2b$`
(hashes existentes intactos). Checklist mínimo:

1. `npm i @node-rs/bcrypt` + swap de los 4 imports (sin cambiar firmas de `auth.ts`).
2. Tests de compatibilidad: hash nuevo verifica; hash `$2a$` preexistente (seed) verifica.
3. `serverExternalPackages: ["@node-rs/bcrypt"]` en `next.config.ts` si el trace lo pierde.
4. **Obligatorio antes de merge**: `docker build` de la imagen prod + smoke de login
   dentro del contenedor (valida musl + tracing standalone).
5. Medir latencia de login antes/después (justifica el cambio).
