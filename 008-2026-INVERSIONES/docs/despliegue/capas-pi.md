# Inversiones · las 12 capas de seguridad de PI, con evidencia

**Marcadores** (repo público; los valores, en el ESTADO de la gestión): `<raíz>` es la carpeta base de Inversiones en el VPS, la que contiene al clon; `<respaldos>`, la de los respaldos cifrados; `<servicio-del-túnel>`, el servicio del túnel de PI. Ver [produccion.md](produccion.md).

Son los requisitos del CEO de PI para que Inversiones conviva en su VPS de producción (D-015). Cada capa lleva:
- su evidencia en el repo (`archivo:línea`);
- la prueba local: el comando y la salida del ensayo en el Mac, con el proyecto `inv-008-prueba`;
- el comando que se corre en el host al desplegar.

Las capas 1 a 6 son de este frente (red y contenedor). Las 7 a 12 son de la app: login ([#996](https://github.com/Innovadataco/productos/pull/996)), cifrado ([#995](https://github.com/Innovadataco/productos/pull/995)) y TOTP del dueño ([#1000](https://github.com/Innovadataco/productos/pull/1000)), ya en `main`. Su evidencia está en la sección «App (7 a 12)», verificada en el código de `main` (base a290b7de) el 2026-11-21.

**Riesgo cerrado:** el contenedor de la app de PI ya no monta el socket de Docker ([productos#993](https://github.com/Innovadataco/productos/pull/993)). Ninguna pieza de Inversiones usa el socket ni `/var/lib/docker`.

## Red (1 a 3)

| # | Requisito | Evidencia en el repo | Prueba local | En el host, al desplegar |
|---|---|---|---|---|
| 1 | La app solo en `127.0.0.1:5008` del host; nada en `0.0.0.0` | `docker-compose.prod.yml:82`; `scripts/desplegar-prod.sh:233` (la llamada a `puerto_publicado_ok`; la función, en `:47`) | `compose-prod.test.ts`, `desplegar-prod.test.ts` (rechaza `0.0.0.0` y `[::]`) y una mutación a `"5008:5008"` sin `127.0.0.1` que puso la prueba en rojo | `docker port $(sudo $COMPOSE ps -q inv-008-app) 5008` → `127.0.0.1:5008`; `ss -ltnp \| grep 5008` → solo `127.0.0.1:5008` |
| 2 | La entrada es solo por el túnel `<servicio-del-túnel>` → `inversiones.innovadataco.com` → `127.0.0.1:5008` | `produccion.md` §8: aplicado el 2026-11-21 por el coordinador con el CEO de PI (ingress y CNAME); ningún script lo configura. Ningún script nombra a cloudflared, `systemctl` ni `/etc/` (`candados-scripts.test.ts`) | `candados-scripts.test.ts`, regla «sistema», con su control positivo | `curl -I https://inversiones.innovadataco.com` → lleva a `/ingresar`; desde fuera, el 5008 cerrado (los puertos abiertos en el firewall: ver ESTADO en la gestión) |
| 3 | La base en un contenedor propio, sin puertos y en una red propia | `docker-compose.prod.yml:22` (el servicio), `:37` (solo `inv-008-red-interna`) y `:267` (`internal: true`). Sin `ports:`, sin redes `external` y sin `links` | `compose-prod.test.ts`; en local, `docker port` de la base salió vacío | `docker port $(sudo $COMPOSE ps -q inv-008-db)` → vacío; `docker network inspect inv-008-prod_inv-008-red-interna` → solo `inv-008-*` |

## Contenedor (4 a 6)

| # | Requisito | Evidencia en el repo | Prueba local | En el host, al desplegar |
|---|---|---|---|---|
| 4 | Usuario no root, como PI (`adduser` + `USER`); la única excepción es `inv-008-respaldo`, ver abajo | `Dockerfile:24` y `:83` (`addgroup -S -g 10008` + `adduser -S -u 10008`, como PI con `nextjs`); `USER 10008:10008` en `:53`, `:74` y `:92`; la base como `70:70`. `read_only`, `cap_drop: [ALL]` y `no-new-privileges` en los 5 servicios | `dockerfile.test.ts` y `compose-prod.test.ts`; en local, `id` dio `uid=10008` y escribir en `/app` dio `Read-only file system` | `docker exec $(sudo $COMPOSE ps -q inv-008-app) id` → `uid=10008`; `docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}}' …` → `true [ALL]` |
| 5 | Healthcheck en CADA servicio y `restart: always`, como PI | `docker-compose.prod.yml`: `restart: always` en `:25`, `:68`, `:170` y `:223` (base, app, respaldo y vigía); `healthcheck:` en `:52`, `:99`, `:146`, `:203` y `:252` (los cinco servicios) | `compose-prod.test.ts` (los 5 servicios); en local, base, app, respaldo y vigía en `healthy` | `sudo $COMPOSE ps` → los 4 permanentes en `healthy`; `docker inspect -f '{{.HostConfig.RestartPolicy.Name}}'` → `always` |
| 6 | Los secretos en el host, fuera del repo, y las imágenes sin secretos | Un solo archivo, `<raíz>/.env.inversiones.production` (600, root), usado solo como `--env-file` para interpolar (`scripts/produccion-comun.sh`, `armar_compose`); cada servicio con solo sus variables y ningún `env_file` ni `secrets`. `.dockerignore` excluye `.env*`; el Dockerfile falla si una imagen trae un `.env` | `dockerfile.test.ts` y `compose-prod.test.ts`; en local, `docker history --no-trunc` sin secretos y `find / -name '.env*'` vacío en las 3 imágenes | `sudo stat -c '%U %a' <raíz>/.env.inversiones.production` → `root 600`; `docker history --no-trunc inv-008-app:<sha> \| grep -Ei 'password\|secret\|clave\|token'` → vacío |

**Excepción a la capa 4, documentada (la única):** `inv-008-respaldo` corre como `user: "0:${INV_RESPALDO_GID}"`, es decir, root **del contenedor** con el grupo `respaldo` del host.
- **Por qué:** así deja los archivos `root:respaldo` en 0640 dentro de `<respaldos>/`, la carpeta `root:respaldo` en 750 que montó el CEO de PI, sin pedirle cambiarla.
- **La carpeta no está escrita en el repo:**
  - sale de la configuración no secreta `<raíz>/inv-008.conf`;
  - los scripts la validan antes de cada `up`: forma, enlaces, root y el grupo `respaldo` en 750, padres solo de root, solo respaldos de 008 adentro y fuera de `<raíz>`;
  - el contenedor no cambia la carpeta ni sus permisos: archivos 640 `root:respaldo`, carpeta 750 (la copia diaria de IDC depende de eso; `respaldo-contenedor.test.ts` y el ensayo lo comprueban);
  - `nosuid,noexec` va en el montaje del **host**, que hace el CEO de PI. Docker no lo aplica a un bind: el ensayo mostró `rw,relatime` dentro del contenedor. Los scripts lo revisan con `findmnt` y por ahora solo avisan;
  - el bind va en sintaxis larga con `create_host_path: false`: sin la carpeta configurada, el `up` del respaldo falla cerrado.
- **Lo que lo limita:**
  - `cap_drop: [ALL]` (`CapEff` en 0: no salta permisos ni cambia dueños) y `no-new-privileges`;
  - `read_only` con `tmpfs` en `/tmp` y `/run/respaldo`;
  - un único bind de escritura, que es esa carpeta;
  - red interna, sin salida.
- **La prueba:** `compose-prod.test.ts` exige que sea el único servicio con usuario 0.
- **En local**, con un volumen de prueba `0:4242` en 750:
  ```text
  -rw-r-----  1 0  4242  2475  inv-008-…-prueba-root.dump.age
  -rw-r-----  1 0  4242   111  inv-008-…-prueba-root.dump.age.sha256
  uid=0(root) gid=4242 · CapEff 0000000000000000 · touch /etc/x → Read-only file system
  ```
  Un usuario fuera del grupo (10008) no puede ni listar la carpeta: `Permission denied`.

**Excepción a la capa 5, documentada:** el migrador es de un solo uso (`run --rm`) y lleva `restart: "no"` (`docker-compose.prod.yml:119`). Con `always` podría volver a correr solo. Su healthcheck es nominal. Los cuatro permanentes sí llevan `restart: always`.

**Límite de la capa 6, dicho derecho:** con un solo archivo y `environment:`, los valores de cada contenedor se ven con `docker inspect <contenedor>`, para root y para el grupo `docker`. Cumple «fuera del repo y las imágenes sin secretos», pero no oculta los valores a quien administra el Docker del VPS.

## App (7 a 12): login, TOTP y cifrado

Evidencia verificada en el código de la base `main` a290b7de (productos#1000, con el TOTP ya mergeado) el 2026-11-21, línea por línea. Las pruebas locales de esta sección son de código (`npm test`, `npm run test:integracion`, `npm run test:e2e`); **no se ejecutó nada contra el VPS**.

| # | Requisito | Evidencia en el repo | Prueba local | En el host, al desplegar |
|---|---|---|---|---|
| 7 | Cabeceras de seguridad: CSP con nonce, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy | `next.config.ts:13-20` (X-Frame-Options `DENY`, `nosniff`, Referrer-Policy `no-referrer`, Permissions-Policy, HSTS `max-age=63072000; includeSubDomains; preload`, `X-Robots-Tag`), aplicadas a `/:path*` en `next.config.ts:28-29`. CSP por pedido con nonce: `src/auth/cabeceras.ts:34-36` (`politicaCsp`; `frame-ancestors 'none'` en `:19`; `upgrade-insecure-requests` fuera de desarrollo), puesta por `src/proxy.ts:30-39` (`pasar`) | `tests/unit/auth/cabeceras.test.ts:44` («lleva las de PI y las de la spec») y los de CSP de producción; `tests/e2e/sesion.spec.ts:210` (cabeceras y sin caché en las páginas) | `curl -sI https://inversiones.innovadataco.com/ingresar \| grep -iE 'content-security\|strict-transport\|x-frame\|x-content\|referrer\|permissions'`: deben salir las seis. Por verificar en el host: no se ejecutó contra el VPS |
| 8 | Cookie de sesión httpOnly, secure y sameSite strict | `src/auth/cookie.ts:11` (`__Host-sesion`), `:14` (`Path=/; HttpOnly; Secure; SameSite=Strict`), `:24` (`cookieDeSesion`, Max-Age de 8 h: `src/auth/limites.ts:7`), `:25` (`cookieDeBorrado`, mismos atributos). Se emite en `src/app/api/sesion/totp/route.ts:35`, tras el segundo paso, y se borra en `src/app/api/sesion/salir/route.ts:24`. La cookie previa al segundo paso, `__Host-presesion` (`src/auth/cookie.ts:12`, `:27-28`, 5 min), usa los mismos atributos | `tests/unit/auth/cookie.test.ts:17` (nombre), `:21` (atributos al crear), `:28` (al borrar), `:55` (presesión distinta de la sesión); `tests/e2e/sesion.spec.ts:31` (la cookie en el navegador) | Entrar con la cuenta del dueño en el navegador y revisar en DevTools, Application, Cookies, que `__Host-sesion` lleve HttpOnly, Secure, SameSite Strict y Path `/`, y que dure 8 h. Por verificar en el host: no hay comando sin credenciales que muestre el `Set-Cookie` |
| 9 | Login obligatorio en TODA ruta, con guardia en el servidor (página y API) | Proxy: `src/proxy.ts:73` (`esPublica`: solo pasan las rutas de `src/auth/rutas.ts:15-22`); `:82-84` (firma y vencimiento de la cookie; sin sesión, `sinSesion` en `:46-52`: página → 307 a `/ingresar`, API → 401 JSON). Matcher `src/proxy.ts:90`: solo se excluyen los estáticos de Next y el favicon. Revalidación en la base: `src/auth/sesion.ts:25` (`validarSesion`: activo, con clave, DUENO y `sesionVersion` vigente), `:49` (`exigirSesion`), `:56` (`validarSesionApi`), `:61` (`exigirSesionApi`). Pre-sesión: `src/auth/presesion-servidor.ts:28` (`exigirPresesion`) y `:35` (`exigirPresesionApi`). Inventario en el nuevo `main`, abajo | `tests/unit/auth/proxy.test.ts`, `tests/unit/auth/rutas.test.ts`, `tests/unit/auth/candados.test.ts` (cada página y API del segundo paso llama a su guardia), `tests/integracion/auth-sesion.test.ts`, `tests/integracion/auth-api.test.ts`; `tests/e2e/sesion.spec.ts:179` (sin sesión, el tablero lleva a `/ingresar`) y `:184-187` (API sin sesión: 401; la prueba pide `/api/plan`, que no existe en `main`) | `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://inversiones.innovadataco.com/` → `307 https://inversiones.innovadataco.com/ingresar`; `curl -s -w ' %{http_code}\n' https://inversiones.innovadataco.com/api/no-existe` → `{"error":"No autenticado"} 401`. Por verificar en el host |
| 10 | Límite de peticiones en el login y en las API | API: `src/proxy.ts:23` (limitador), `:54-59` (`topeDeApi`: 60 por minuto por IP, 429 con `Retry-After`); `src/auth/limites.ts:18-19`; contador `src/auth/limite-api.ts:25` (ventana fija, en memoria del proceso). IP solo desde `Cf-Connecting-IP`: `src/auth/ip.ts:10`, `:39`. Login: 5 fallos por cuenta bloquean 15 min (`src/auth/limites.ts:11,14`; `src/auth/ingreso.ts:106-107`); 20 fallos por IP en la base (`src/auth/limites.ts:15`; `src/auth/ingreso.ts:99`, `:122`); tope global de 60 ingresos por minuto (`src/auth/carga.ts:47`, `:61`, `:70`; usado en `src/app/api/sesion/ingresar/route.ts:33-34`). Segundo paso TOTP: 5 fallos (`src/auth/limites.ts:56`) con bloqueo progresivo (`src/auth/fallos-segundo-paso.ts:46-49`) | `tests/unit/auth/limite-api.test.ts:9` (deja pasar 60 y frena el 61); `tests/unit/auth/carga.test.ts`; `tests/unit/auth/tope-global.test.ts`; `tests/unit/auth/bloqueo-segundo-paso.test.ts`; `tests/integracion/auth-ingreso.test.ts`; `tests/e2e/sesion.spec.ts:52` (5 fallos bloquean la cuenta) | Desde fuera del VPS (por ejemplo, el Mac), porque sin `Cf-Connecting-IP` todo cuenta en el balde «sin IP»: `for i in $(seq 61); do curl -s -o /dev/null -w '%{http_code}\n' https://inversiones.innovadataco.com/api/salud; done \| sort \| uniq -c`. Esperado: 60 respuestas 200 (o 503 si la base está caída) y 1 con 429. Por verificar en el host |
| 11 | Cifrado de campos sensibles (AES-256-GCM, claves versionadas) | AES-256-GCM: `src/cifrado/sobre.ts:13` (`aes-256-gcm`), `:14-15` (IV de 12 bytes, etiqueta de 16), `:50` (`cifrar`), `:61` (`descifrar`, con la clave de la versión que dice el sobre). Claves versionadas: `src/cifrado/llavero.ts:3-4` (`CIFRADO_CLAVE_ACTIVA`, `CIFRADO_CLAVE_V<n>`), `:15`, `:54` (`obtenerLlavero`); en el compose, `docker-compose.prod.yml:76-77` (app) y `:127-128` (migrador). `fila_fuente.crudo`: se cifra al crear en `src/importacion/trii/guardar.ts:124` (`cifrarCrudo`) y `:125` (`filaFuente.create`); helper en `src/cifrado/campos.ts:35`. `certificacion_fondo.encargo`: helper en `src/cifrado/campos.ts:57`; cifrado de lo existente en `src/cifrado/migracion.ts:191-212` y `scripts/cifrar-existentes.ts`. Documentos: no se guardan (`prisma/schema.prisma:288`, comentario «El archivo original NO se guarda»; modelo `CargaArchivo` en `prisma/schema.prisma:277`). Montos: sin cifrar (`prisma/schema.prisma:402` y tipos `Decimal`; CHECK de montos en `prisma/migrations/20261120222014_inicial/migration.sql:633-638`) | `tests/unit/cifrado/sobre.test.ts`, `tests/unit/cifrado/llavero.test.ts`, `tests/unit/cifrado/campos.test.ts`, `tests/unit/cifrado/migracion.test.ts`, `tests/unit/cifrado/candado-reversion.test.ts`; `tests/integracion/cifrado.test.ts`; `tests/integracion/cifrado-importacion.test.ts`; `tests/unit/esquema.test.ts:67-71` (candado: ningún campo de `CargaArchivo` guarda el archivo original) | `sudo $COMPOSE run --rm inv-008-migrador npx tsx scripts/cifrar-existentes.ts` (ensayo: solo cuenta, no escribe). Esperado: `enClaro` en 0 para `fila_fuente` y `certificacion_fondo`. Por verificar en el host: el comando exacto dentro del migrador y el formato de la salida |
| 12 | `npm audit --omit=dev` con 0 críticas y 0 altas | `scripts/construir-imagen.sh:50` (`npm audit --omit=dev --audit-level=high` sobre el código del commit; con una alta no construye); `docs/despliegue/produccion.md:202` | Local, 2026-11-21, en `008-2026-INVERSIONES/` tras `npm ci`. Resultado en «Resultado del audit» abajo. Prueba automática: `tests/unit/produccion/construir-imagen.test.ts` (contiene 4 referencias a `audit`; por verificar qué cubre exactamente) | En el Mac, `scripts/construir-imagen.sh <sha>` corre el audit antes de construir; o `npm audit --omit=dev` en la copia del commit. Esperado: 0 críticas y 0 altas |

### Inventario de rutas protegidas en `main` (a290b7de)

Páginas (`src/app/**/page.tsx`):

| Ruta | Guardia | Dónde |
|---|---|---|
| `/` | sesión completa | `exigirSesion()` en `src/app/page.tsx:30` |
| `/totp/codigos` | sesión completa | `exigirSesion()` en `src/app/totp/codigos/page.tsx:15` |
| `/totp` | pre-sesión (segundo paso) | `exigirPresesion()` en `src/app/totp/page.tsx:19` |
| `/totp/enrolar` | pre-sesión (segundo paso) | `exigirPresesion()` en `src/app/totp/enrolar/page.tsx:51` |
| `/ingresar`, `/definir-clave` | públicas | `src/auth/rutas.ts:16-17`; `/ingresar` manda a `/` si hay sesión (`src/app/ingresar/page.tsx:27`) |

APIs (`src/app/api/**/route.ts`):

| Ruta | Guardia | Dónde |
|---|---|---|
| `/api/sesion/salir` | sesión (`validarSesionApi`) | `src/app/api/sesion/salir/route.ts:26` |
| `/api/sesion/totp/codigos` | sesión completa (`exigirSesionApi`) | `src/app/api/sesion/totp/codigos/route.ts:21` |
| `/api/sesion/totp` | pre-sesión (`exigirPresesionApi`) | `src/app/api/sesion/totp/route.ts:29` |
| `/api/sesion/totp/enrolar` | pre-sesión (`exigirPresesionApi`) | `src/app/api/sesion/totp/enrolar/route.ts:28` |
| `/api/salud`, `/api/sesion/ingresar`, `/api/sesion/definir-clave` | públicas | `src/auth/rutas.ts:18-20` |

Las pre-sesión «`/totp`», «`/totp/enrolar`» y sus dos APIs pasan el proxy sin sesión (`src/auth/rutas.ts:8-13` y `:21`) porque exigen la pre-sesión en el servidor, con su candado en `tests/unit/auth/candados.test.ts`.

**Rutas inexistentes:** una `/api/*` que no existe también responde 401 sin sesión. El proxy decide antes del enrutado: `src/proxy.ts:73` no la reconoce como pública, `:82-84` no encuentra sesión y `sinSesion` (`:46-52`) contesta 401 para `esApi`. Con una sesión válida, la petición sí llega al enrutado y Next responde 404. Por verificar en el host con el `curl` de la fila 9.


### Decisión del CEO sobre el #11 (texto de la decisión)

- Se cifran `fila_fuente.crudo` y `certificacion_fondo.encargo` con AES-256-GCM y claves versionadas.
- Los documentos de extractos no se guardan (`prisma/schema.prisma`, comentario «El archivo original NO se guarda», más el candado en `tests/unit/esquema.test.ts`).
- Los montos NO se cifran: conservan los CHECK y las sumas, y los protegen la base sin puertos, los roles y el respaldo cifrado.
- El cifrado de disco del host queda como opción futura.

**Hueco abierto del #11:** en `main` no hay ningún escritor de `certificacion_fondo` fuera de la migración (búsqueda en `src/` y `scripts/`). Hasta que entre el importador de fondo, un encargo nuevo no se cifra al escribirse. Por verificar cuando ese importador entre a `main`.

### Resultado del audit (#12)

Comando: `npm audit --omit=dev` en `008-2026-INVERSIONES/`, después de `npm ci`, el 2026-11-21. Salida real:

```text
found 0 vulnerabilities
```

### TOTP del dueño (segundo factor, productos#1000)

El TOTP del dueño ya está en `main` como `a290b7de` (productos#1000). Piezas clave:

- **Código RFC 6238** (SHA-1, pasos de 30 s, 6 dígitos, ±1 paso): `src/auth/limites.ts:39-44`; `src/auth/totp.ts:80` (`hotp`) y `:111` (`verificarTotp`). Anti-repetición de códigos con `totpUltimoPaso`: `src/auth/cuenta-totp.ts:63`.
- **Secreto cifrado** con AES-256-GCM, atado a la cuenta (AAD `usuario.totp` + id): `src/auth/secreto-totp.ts:15-24`. Columnas en `prisma/schema.prisma:177-184` (`totpSecreto`, `totpActivadoEn`, `totpUltimoPaso`, `presesionHash`).
- **Pre-sesión** de 5 min, distinta de la sesión (audiencia `inv008:presesion`): `src/auth/presesion.ts:21`, `:39` (firmar), `:54` (verificar); `src/auth/limites.ts:47`.
- **Segundo paso**: `src/auth/segundo-paso.ts:88` (`verificarSegundoPaso`), llamado desde `src/app/api/sesion/totp/route.ts:32`.
- **Bloqueo progresivo** tras 5 fallos: `src/auth/limites.ts:56`; `src/auth/fallos-segundo-paso.ts:46-49`.
- **Códigos de recuperación** (10, de un solo uso, guardados como hash SHA-256): `src/auth/limites.ts:61-62`; `src/auth/recuperacion.ts:25`, `:39`; `src/auth/codigos.ts:36` (`gastarCodigo`); tabla `prisma/schema.prisma:263` (`CodigoRecuperacion`).
- **Regenerar códigos** exige sesión completa y un código TOTP: `src/auth/regenerar.ts:57`; `src/app/api/sesion/totp/codigos/route.ts:21`, `:25`.
- **Reinicio por el operador** (perdió el teléfono y los códigos): `src/auth/reinicio-totp.ts:14`; `scripts/crear-acceso-inicial.ts` con `--reiniciar-totp`.
- **Privilegios de `inv_app`** del TOTP, activos desde la migración: `docker/migrador/privilegios.sql:52-54` (y `:57`, columnas del TOTP); prueba `tests/unit/produccion/privilegios.test.ts:63`.
- **Pruebas:** `tests/unit/auth/totp.test.ts`, `presesion.test.ts`, `recuperacion.test.ts`, `qr.test.ts`, `bloqueo-segundo-paso.test.ts`, `esquema-auth.test.ts`; `tests/integracion/auth-totp-api.test.ts`, `auth-totp-codigos.test.ts`, `auth-totp-enrolar.test.ts`, `auth-totp-esquema.test.ts`, `auth-totp-ingreso.test.ts`, `auth-totp-reinicio.test.ts`, `auth-totp-segundo-paso.test.ts`; `tests/e2e/totp.spec.ts`.

Lo que exige el TOTP antes de cargar datos es crear la cuenta del dueño y cargar sus datos. Por decisión D-017 la app se publica con 0 usuarios.


## Convivencia (condiciones del CEO de PI)
- **Pausa obligatoria en cada despliegue de PI.** El CEO de PI midió `MemAvailable` mínimo de 1.593 MB durante su build, y con los 1.152 MiB de Inversiones quedarían unos 0,4 GB.
  - La pausa la hace PI con `docker stop` y `start` de los contenedores con la etiqueta `com.docker.compose.project=inv-008-prod`.
  - **Respeta la marca de pausa `<raíz>/estado/pausado`.**
  - Procedimiento: [convivencia-pi.md](convivencia-pi.md#1--pausa-obligatoria-en-cada-despliegue-de-pi).
- **Candado común** `/var/lock/despliegue-vps.lock`: lo toman, sin esperar, `desplegar-prod.sh`, `reanudar-008.sh`, `crear-roles-prod.sh`, `crear-acceso-inicial.sh` y `cargar-prod.sh`. `pausar-008.sh` no lo toma, para servir aunque PI esté desplegando.
- **Escritura:** solo tres destinos, `<raíz>/`, ese candado y `<respaldos>/`. Hay una prueba en rojo por cada ruta vecina.
- **Memoria:** mem = memswap en cada contenedor, verificado al desplegar, más `cpu_shares` 256 y la medición antes de `up` y 10 minutos después.

## Ensayo local (salidas)
Mac Studio, 2026-11-21, Colima arm64 con Docker 29.5.2 y containerd. Proyecto `inv-008-prueba`, sin puertos publicados, secretos ficticios y GitHub simulado. Imágenes construidas con `scripts/construir-imagen.sh`, del mismo código de este PR. Salidas reales, recortadas:

```text
# imágenes (nativo arm64; amd64 construido y probado bajo emulación en la ronda anterior)
inv-008-app 368MB · inv-008-migrador 1.13GB · inv-008-vigia 54.8MB (alpine, sin node)
manifest.json del .tar → ["inv-008-app:<sha>","inv-008-migrador:<sha>","inv-008-vigia:<sha>"]

# despliegue (desplegar-prod.sh <id> --cargar <tar> <sha256>)
[desplegar-prod] sha256 y etiquetas del .tar verificados; docker load
[respaldo] respaldo listo: inv-008-20261121-002952-pre-migracion.dump.age     (0640; el dueño root:respaldo se probó aparte)
[desplegar-prod] mem = memswap en todos los contenedores de inv-008-prueba
[vigilar-convivencia] OK: MemAvailable 5025 MiB; sin OOM nuevos (oom_kill jerárquico 0)
DEPLOY VERIFICADO bce628493c5714243524b5d75d25c756e9416422
docker ps --filter label=com.docker.compose.project=inv-008-prueba → inv-008-app, -db, -respaldo, -vigia (healthy)

# TLS del vigía (sin token)
curl https://api.telegram.org → http=302 ssl_verify_result=0

# pausa
pausar-008.sh → marca estado/pausado · contenedores del proyecto: 0 · volumen inv-008-prueba_inv-008-db-datos intacto
desplegar-prod.sh con la marca → ❌ Inversiones está en pausa (…/estado/pausado): reanude antes
reanudar-008.sh → app, db, respaldo y vigía healthy; marca borrada; migraciones=6

# OOM real (un contenedor de prueba con 16m que se queda sin memoria)
oom_kill jerárquico (docker/): 0 → 1 · el contenedor salió con 137 y su cgroup se borró
[vigia] no se pudo enviar el aviso ALERTA (OOM nuevo; MemAvailable 4969 MiB) a Telegram   (Telegram inexistente a propósito)

# restauración, en orden: volumen nuevo → crear-roles → pg_restore --no-owner (clave age por stdin) → migrador → app
[migrador] 2/3 guardián del esquema → Script executed successfully.
{"estado":"ok","base":"ok","version":"bce628493c5714243524b5d75d25c756e9416422"}
conteos iguales en 29 tablas · inv_app ve el dato ficticio (citext) y DELETE FROM orden → permission denied · data_checksums=on

# con el login y el cifrado ya en main (después del rebase)
roles-base.test.ts contra PostgreSQL 16 real → 21 pasan (escrituras del login por columna, token de un solo uso,
  guardián que pasa y que se rompe con un CHECK cambiado y un disparador deshabilitado)
DEPLOY VERIFICADO bbb5054a3676574b85bf01e2c4c8ca5617fd3a6e · /api/salud → {"estado":"ok","version":"bbb5054…"}
GET / sin sesión → HTTP/1.1 307 · location: https://inversiones.innovadataco.com/ingresar
crear-acceso-inicial.sh --email ficticio@ejemplo.invalid → imprime una vez https://inversiones.innovadataco.com/definir-clave#t=<token>…
  (token_acceso=1; el token se tapó aquí)

# roles-base.test.ts en la ronda anterior: un mutante con DML completo para inv_app → 5 en rojo
```

**Ronda prod-endurecer** (2026-11-21, imágenes arm64 de `0eb4462b`, mismo proyecto `inv-008-prueba`, sin puertos, secretos ficticios, `down -v` al final). Salidas reales, recortadas:

```text
# primer despliegue → DEPLOY VERIFICADO 0eb4462b317871dd1005ea7bf89bd1bca55fb902 (sin aviso de connection_limit: la URL trae =5)
# re-despliegue del mismo sha: eventos de Docker del proyecto, en orden
kill/stop/die inv-008-app → kill/stop/die inv-008-respaldo → create/start/die/destroy inv-008-migrador → start inv-008-respaldo → start inv-008-app
  (la app es el mismo contenedor, otra vez healthy) → DEPLOY VERIFICADO
# re-despliegue del mismo sha con un índice vigilado borrado (el guardián falla)
[desplegar-prod] vuelta atrás hecha: corre 0eb4462b…  ·  /api/salud → {"estado":"ok","version":"0eb4462b…"}
# respaldo, flock de BusyBox en el contenedor
candado tomado y RESPALDO_ESPERA_S=0 → [respaldo] otro respaldo está en curso: este no se hace (salida 75)
con espera → esperó 18 s y terminó bien · .parcial de más de 60 min borrado, el reciente quedó
dos --ahora a la vez → los dos bien: inv-008-20261121-043628-par y inv-008-20261121-043629-par
# pg_dump real: cada .age se descifró fuera del contenedor y pg_restore --list leyó 32 TABLE DATA (0640, sha256 bien)
```

**Lo que NO se verificó en local:**
- el puerto en `127.0.0.1:5008`, porque el override lo quita;
- el túnel;
- el driver de cgroup del VPS (se espera systemd);
- `memswap` con swap real, porque Colima no tiene swap;
- la llegada del aviso al Telegram de Jelk (control positivo en el VPS);
- el TOTP del dueño: sus pruebas corren en CI (`tests/integracion/auth-totp-*.test.ts`, `tests/e2e/totp.spec.ts`); en este ensayo local no se probó contra el proyecto `inv-008-prueba`.

**Reinicio de Docker:** no se reinició el demonio de Docker del Mac, porque también corren ahí la base de desarrollo de Inversiones y la de PI. Que la pausa sobreviva un reinicio se demostró así: con la marca puesta, el proyecto queda con 0 contenedores, así que `restart: always` no tiene nada que levantar.

---
> v2.5 · 2026-11-21 · 07:34 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · respaldos: carpeta en 750, archivos 640, y `nosuid,noexec` en el montaje del host (revisado, por ahora aviso)
> v2.4 · 2026-11-21 · 04:55 (-05) · Inversiones · Fábrica ECC (frente prod-endurecer) · ensayo local de la pausa antes del migrador, la vuelta atrás y el candado del respaldo
> v2.5 · 2026-11-21 · 06:57 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · referencias archivo:línea corregidas contra el código de este clon (base fd7105ad); puertos del firewall fuera del repo; candado común con sus cinco tomadores
> v2.4 · 2026-11-21 · 06:50 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · marcadores en vez de rutas y servicios del VPS; la carpeta de respaldos sale de `inv-008.conf`; evidencias `archivo:línea` al día
> v2.3 · 2026-11-21 · 04:42 (-05) · Inversiones · Fábrica ECC (frente prod-endurecer) · capa 2: el túnel ya está aplicado (§8 de produccion.md)
> v2.2 · 2026-11-21 · 02:30 (-05) · Inversiones · Fábrica Inversiones · rebase sobre `main` a290b7de (TOTP, productos#1000): capas 7 a 12 re-verificadas, inventario de rutas, TOTP con piezas, base del audit
> v2.1 · 2026-11-21 · 02:08 (-05) · Inversiones · Fábrica Inversiones · capas 7 a 12 con evidencia (`archivo:línea` verificado), audit #12 y nota del TOTP
> v2.0 · 2026-11-21 · 00:50 (-05) · Inversiones · Fábrica ECC (frente producción) · correcciones de la GATE 2
> v1.0 · 2026-11-20 · 23:59 (-05) · Inversiones · Fábrica ECC (frente producción)
