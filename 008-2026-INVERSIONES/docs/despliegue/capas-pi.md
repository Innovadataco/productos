# Inversiones · las 12 capas de seguridad de PI, con evidencia

Son los requisitos del CEO de PI para que Inversiones conviva en su VPS de producción (D-015). Cada capa lleva:
- su evidencia en el repo (`archivo:línea`);
- la prueba local: el comando y la salida del ensayo en el Mac, con el proyecto `inv-008-prueba`;
- el comando que se corre en el host al desplegar.

Las capas 1 a 6 son de este frente (red y contenedor). Las 7 a 12 son de la app y **están por enlazar**: sus PR ya están en `main`, el login ([#996](https://github.com/Innovadataco/productos/pull/996)) y el cifrado ([#995](https://github.com/Innovadataco/productos/pull/995)), y la evidencia de cada capa la pone cada frente.

**Riesgo cerrado:** `pi-app` ya no monta `docker.sock` ([productos#993](https://github.com/Innovadataco/productos/pull/993)). Ninguna pieza de Inversiones usa el socket ni `/var/lib/docker`.

## Red (1 a 3)

| # | Requisito | Evidencia en el repo | Prueba local | En el host, al desplegar |
|---|---|---|---|---|
| 1 | La app solo en `127.0.0.1:5008` del host; nada en `0.0.0.0` | `docker-compose.prod.yml:73`; `scripts/desplegar-prod.sh:218` (`puerto_publicado_ok`) | `compose-prod.test.ts`, `desplegar-prod.test.ts` (rechaza `0.0.0.0` y `[::]`) y una mutación a `"5008:5008"` sin `127.0.0.1` que puso la prueba en rojo | `docker port $(sudo $COMPOSE ps -q inv-008-app) 5008` → `127.0.0.1:5008`; `ss -ltnp \| grep 5008` → solo `127.0.0.1:5008` |
| 2 | La entrada es solo por el túnel `cloudflared-hermes` → `inversiones.innovadataco.com` → `127.0.0.1:5008` | `produccion.md` §8: documentado, **no configurado**. Ningún script nombra a cloudflared, `systemctl` ni `/etc/` (`candados-scripts.test.ts`) | `candados-scripts.test.ts`, regla «sistema», con su control positivo | `curl -I https://inversiones.innovadataco.com` → lleva a `/ingresar`; desde fuera, el 5008 cerrado (ufw solo abre 22, 80 y 5432) |
| 3 | La base en un contenedor propio, sin puertos y en una red propia | `docker-compose.prod.yml:15`, `:30` (solo `inv-008-red-interna`) y `:238` (`internal: true`). Sin `ports:`, sin redes `external` y sin `links` | `compose-prod.test.ts`; en local, `docker port` de la base salió vacío | `docker port $(sudo $COMPOSE ps -q inv-008-db)` → vacío; `docker network inspect inv-008-prod_inv-008-red-interna` → solo `inv-008-*` |

## Contenedor (4 a 6)

| # | Requisito | Evidencia en el repo | Prueba local | En el host, al desplegar |
|---|---|---|---|---|
| 4 | Usuario no root, como PI (`adduser` + `USER`); la única excepción es `inv-008-respaldo`, ver abajo | `Dockerfile:23` y `:81` (`addgroup -S -g 10008` + `adduser -S -u 10008`, como PI con `nextjs`); `USER 10008:10008` en `:52`, `:72` y `:90`; la base como `70:70`. `read_only`, `cap_drop: [ALL]` y `no-new-privileges` en los 5 servicios | `dockerfile.test.ts` y `compose-prod.test.ts`; en local, `id` dio `uid=10008` y escribir en `/app` dio `Read-only file system` | `docker exec $(sudo $COMPOSE ps -q inv-008-app) id` → `uid=10008`; `docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}}' …` → `true [ALL]` |
| 5 | Healthcheck en CADA servicio y `restart: always`, como PI | `docker-compose.prod.yml`: `restart: always` en `:18`, `:59`, `:152` y `:199` (base, app, respaldo y vigía); `healthcheck:` en `:43`, `:88`, `:132`, `:179` y `:223` | `compose-prod.test.ts` (los 5 servicios); en local, base, app, respaldo y vigía en `healthy` | `sudo $COMPOSE ps` → los 4 permanentes en `healthy`; `docker inspect -f '{{.HostConfig.RestartPolicy.Name}}'` → `always` |
| 6 | Los secretos en el host, fuera del repo, y las imágenes sin secretos | Un solo archivo, `/opt/inversiones-008/.env.inversiones.production` (600, root), usado solo como `--env-file` para interpolar (`scripts/produccion-comun.sh`, `armar_compose`); cada servicio con solo sus variables y ningún `env_file` ni `secrets`. `.dockerignore` excluye `.env*`; el Dockerfile falla si una imagen trae un `.env` | `dockerfile.test.ts` y `compose-prod.test.ts`; en local, `docker history --no-trunc` sin secretos y `find / -name '.env*'` vacío en las 3 imágenes | `sudo stat -c '%U %a' /opt/inversiones-008/.env.inversiones.production` → `root 600`; `docker history --no-trunc inv-008-app:<sha> \| grep -Ei 'password\|secret\|clave\|token'` → vacío |

**Excepción a la capa 4, documentada (la única):** `inv-008-respaldo` corre como `user: "0:${INV_RESPALDO_GID}"`, es decir, root **del contenedor** con el grupo `respaldo` del host.
- **Por qué:** así deja los archivos `root:respaldo` en 0640 dentro de `/var/backups/idc/inversiones/`, la carpeta `root:respaldo` en 750 que montó el CEO de PI, sin pedirle cambiarla.
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

**Excepción a la capa 5, documentada:** el migrador es de un solo uso (`run --rm`) y lleva `restart: "no"` (`docker-compose.prod.yml:108`). Con `always` podría volver a correr solo. Su healthcheck es nominal. Los cuatro permanentes sí llevan `restart: always`.

**Límite de la capa 6, dicho derecho:** con un solo archivo y `environment:`, los valores de cada contenedor se ven con `docker inspect <contenedor>`, para root y para el grupo `docker`. Cumple «fuera del repo y las imágenes sin secretos», pero no oculta los valores a quien administra el Docker del VPS.

## App (7 a 12): frentes login y cifrado
**Por enlazar** a la evidencia de [#996](https://github.com/Innovadataco/productos/pull/996) (login) y [#995](https://github.com/Innovadataco/productos/pull/995) (cifrado). Este frente no conoce el texto exacto de esas capas y no lo inventa. Lo que sí deja listo, y probó en el ensayo con el código de los dos:
- **Login:**
  - `AUTH_SECRET` y `APP_ORIGEN` en la app (`docker-compose.prod.yml:66` y `:69`), obligatorios con `${…:?}`;
  - para `inv_app`, UPDATE **por columna** en `usuario` (`claveHash`, `sesionVersion`, `bloqueadoHasta`) y en `token_acceso` (`usadoEn`), e INSERT en `intento_ingreso` (`docker/migrador/privilegios.sql`);
  - si la app sale o se reinicia (`instrumentation.ts`), el despliegue falla.
- **Acceso inicial:** `scripts/crear-acceso-inicial.sh`, en el migrador con `inv_dueno` y `APP_ORIGEN`.
- **Cifrado (#11):** `CIFRADO_CLAVE_ACTIVA` y `CIFRADO_CLAVE_V1` en la app y en el migrador (`docker-compose.prod.yml:67-68` y `:116-117`).

| # | Requisito | Frente | Evidencia |
|---|---|---|---|
| 7 a 12 | Por enlazar | login / cifrado | #996 y #995 (en `main`) |

## Convivencia (condiciones del CEO de PI)
- **Pausa obligatoria en cada despliegue de PI.** El CEO de PI midió `MemAvailable` mínimo de 1.593 MB durante su build, y con los 1.152 MiB de Inversiones quedarían unos 0,4 GB.
  - La pausa la hace PI con `docker stop` y `start` de los contenedores con la etiqueta `com.docker.compose.project=inv-008-prod`.
  - **Respeta la marca de pausa `/opt/inversiones-008/estado/pausado`.**
  - Procedimiento: [convivencia-pi.md](convivencia-pi.md#1--pausa-obligatoria-en-cada-despliegue-de-pi).
- **Candado común** `/var/lock/despliegue-vps.lock`: lo toman `desplegar-prod.sh` y `reanudar-008.sh`, sin esperar.
- **Escritura:** solo tres destinos, `/opt/inversiones-008/`, ese candado y `/var/backups/idc/inversiones/`. Hay una prueba en rojo por cada ruta vecina.
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

**Lo que NO se verificó en local:**
- el puerto en `127.0.0.1:5008`, porque el override lo quita;
- el túnel;
- el driver de cgroup del VPS (se espera systemd);
- `memswap` con swap real, porque Colima no tiene swap;
- la llegada del aviso al Telegram de Jelk (control positivo en el VPS);
- el TOTP: su bloque de permisos queda preparado y comentado en `privilegios.sql`, y lo activa ese frente.

**Reinicio de Docker:** no se reinició el demonio de Docker del Mac, porque también corren ahí la base de desarrollo de Inversiones y la de PI. Que la pausa sobreviva un reinicio se demostró así: con la marca puesta, el proyecto queda con 0 contenedores, así que `restart: always` no tiene nada que levantar.

---
> v2.0 · 2026-11-21 · 00:50 (-05) · Inversiones · Fábrica ECC (frente producción) · correcciones de la GATE 2
> v1.0 · 2026-11-20 · 23:59 (-05) · Inversiones · Fábrica ECC (frente producción)
