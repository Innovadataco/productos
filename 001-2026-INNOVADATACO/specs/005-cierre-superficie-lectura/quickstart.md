# Quickstart — Verificación del cierre de la superficie de la API

Comandos de verificación de la spec 005. **El stack está arriba y en uso por Jelkin: no se
baja en ningún paso**; se recrea una sola vez, al final. Todo se ejecuta desde
`001-2026-INNOVADATACO/`.

> **D-039**: nada de lo que hay aquí escribe en la base del CEO. Las comprobaciones de
> escritura se hacen **con identificadores inexistentes** (el 401 debe llegar antes de que
> el identificador importe) y el resto vive en la suite, con la base simulada.

## 0. Baseline (medido el 2026-07-23, antes de implementar)

```bash
# Escritura anónima (I-010) — id inexistente a propósito
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  http://localhost:5001/api/licitaciones/no-existe-005          # -> 404  (llega a la BD)

# Sondeo de red anónimo
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:5001/api/config/models/discover?baseUrl=http://127.0.0.1:1"  # -> 200

# Lectura anónima (I-009)
for r in config/apis config/audit config/models config/module-settings documents \
         licitaciones licitaciones/entidades licitaciones/estados; do
  printf "%s " "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5001/api/$r)"
done; echo                                                       # -> 200 200 200 200 200 200 200 200

# Páginas sin sesión (I-008)
for p in / /configuracion /licitaciones /projects /research; do
  printf "%s " "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5001$p)"
done; echo                                                       # -> 200 200 200 200 200

# Suite
npx vitest run                                                   # -> 118 passed (23 files)
npx tsc --noEmit                                                 # -> limpio
```

## 1. Cimientos

```bash
npx vitest run src/lib                    # apiError, session, authCookie: verdes
grep -n "next/headers" src/lib/session.ts # objetivo: NINGUNA línea (debe servir al middleware)
```

## 2. Escritura (US-1) — el bloque que corta el daño irreversible

```bash
npx vitest run src/app/api/licitaciones src/app/api/config src/app/api/documents/search
```

Contra el stack ya recreado, siempre con id inexistente:

```bash
for m in DELETE PATCH; do
  printf "%s %s\n" "$m" "$(curl -s -o /dev/null -w '%{http_code}' -X $m \
    -H 'Content-Type: application/json' -d '{}' \
    http://localhost:5001/api/licitaciones/no-existe-005)"
done
# objetivo: 401 y 401   (baseline: 404 — o sea que consultaba la base)

curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:5001/api/config/models/discover?baseUrl=http://127.0.0.1:1"
# objetivo: 401 (baseline: 200, con el servidor haciendo el fetch)
```

## 3. Pantalla de configuración (US-2) — **antes** de cerrar los GET que consume

```bash
npx vitest run src/lib/respuestaApi.test.ts
```

**Verificación manual (SC-005), con las rutas todavía abiertas**: abrir `/configuracion`,
borrar la cookie `token` desde el inspector y recargar los datos. Objetivo: la pantalla se
muestra con listas vacías y un aviso legible. Baseline: se rompe al hacer `.map()` sobre
el objeto de error.

## 4. Lectura (US-3)

```bash
for r in config/apis config/audit config/models config/module-settings documents \
         licitaciones licitaciones/entidades licitaciones/estados; do
  printf "%s " "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5001/api/$r)"
done; echo
# objetivo: 401 en los ocho (baseline: 200)

curl -s http://localhost:5001/api/config/audit | head -c 120
# objetivo: {"error":"No autenticado"}  (baseline: registros de auditoría reales)
```

Con sesión, mismo cuerpo que antes:

```bash
curl -s -c /tmp/idc005.jar -X POST http://localhost:5001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"<la del CEO>"}' >/dev/null
curl -s -b /tmp/idc005.jar http://localhost:5001/api/documents | head -c 120   # objetivo: documentos
rm -f /tmp/idc005.jar
```

## 5. Páginas (US-4)

```bash
for p in / /configuracion /licitaciones /projects /research; do
  printf "%s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5001$p)"
done
# objetivo: 307/302 hacia /login?next=…  (baseline: 200 con la página completa)

curl -si http://localhost:5001/api/documents | head -3
# objetivo: 401 y content-type: application/json — NUNCA una redirección

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5001/login
# objetivo: 200 sin sesión (si esto redirige, hay bucle)
```

**Verificación manual (SC-012)**: abrir `/licitaciones` sin sesión → llegar al login →
entrar → **volver a `/licitaciones`**. Repetir con `/login?next=https://ejemplo.com`:
debe terminar en `/`.

## 6. Red de seguridad y gates globales

```bash
npx vitest run src/middleware.test.ts src/app/api/superficie.test.ts
```

Comprobación deliberada de que la prueba estructural sirve (SC-015): quitar la
verificación de una ruta cualquiera, ejecutarla —**debe ponerse roja**— y restaurar.

```bash
npx vitest run                       # >= 118 verdes, sin BD ni Ollama
npx tsc --noEmit                     # limpio (gate real; NO npm run build)
npx eslint src/lib src/app/api       # 0 no-explicit-any
git diff --cached --name-only        # solo rutas de 001-2026-INNOVADATACO/
docker ps --format '{{.Names}} {{.Ports}}' | grep -E '5005|5433|5010|5434'  # ajenos intactos
```

## 7. Recreación del stack (una sola vez, al final)

```bash
docker-compose build app             # construir ANTES para minimizar la interrupción
docker-compose up -d app             # recrear solo lo necesario. down -v PROHIBIDO
```

Verificar dentro del contenedor que el middleware tiene el secreto en ejecución (R-01):
si las páginas protegidas redirigen al login **estando la sesión iniciada**, el secreto no
llegó al borde → aplicar la contingencia de research D-04, en su orden.
