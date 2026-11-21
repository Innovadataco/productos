# Inversiones · despliegue en producción

Cómo se despliega, se revierte, se respalda y se restaura Inversiones en el **VPS de producción compartido con PI** (D-015).
- **El VPS:** Hostinger, Ubuntu 24.04.4, x86_64, Docker 29.6.2 con el almacén de containerd.
- **Lo verificó el coordinador** (reconocimiento de solo lectura): `/opt/inversiones-008` no existe todavía, y `/var/backups/idc/inversiones/` ya existe.

**Reglas que no se negocian** (Jelk: «no tocar gesmovil ni pi, solo inversiones, ojo no puede dañar nada»):
- **Escritura: solo tres destinos.** Los scripts lo hacen cumplir: toda ruta pasa por `ruta_escribible` y cada vecina tiene su prueba en rojo.
  - `/opt/inversiones-008/`, completo;
  - `/var/lock/despliegue-vps.lock`, ese archivo, que es el candado común con PI;
  - `/var/backups/idc/inversiones/`, esa carpeta, sin subcarpetas: los respaldos cifrados.
- **Lo que nunca se toca:** `/opt/proteccion-infantil/`, los contenedores `pi-*` o `bi-*`, Gesmovil y Hermes.
- **Docker:** solo con el proyecto `inv-008-prod`, siempre por la variable `COMPOSE`.
  - Nunca un comando global (`system prune`, `image prune -a`, `volume prune`, `stop $(docker ps -q)`).
  - Ningún comando de Docker nombra `pi-*`, `bi-*`, Gesmovil ni Hermes, ni siquiera para leer.
- **Sistema:** ningún script toca `ufw`, `systemctl`, `/etc/` ni el `crontab` de root.
  - El respaldo diario lo programa su propio contenedor.
  - El túnel solo está documentado aquí: **no lo configura ningún script**.
- **Red:**
  - desde internet solo se llega a los puertos 22, 80 y 5432 (ufw filtra el resto);
  - la app va en `127.0.0.1:5008`, nunca en `0.0.0.0`;
  - la base no publica ningún puerto.
- **Construcción:** se construye en el Mac, nunca en el VPS.

Documentos relacionados:
- [convivencia-pi.md](convivencia-pi.md): pausa (incluida la que hace PI en sus despliegues), memoria, criterio de corte y vigía.
- [capas-pi.md](capas-pi.md): las 12 capas de seguridad de PI, con su evidencia.

## 1 · Piezas

| Pieza | Qué es |
|---|---|
| `inv-008-app:<sha>` | La app (Next standalone). Usuario 10008, solo lectura, escucha en 5008 y se publica en `127.0.0.1:5008`. |
| `inv-008-migrador:<sha>` | `prisma migrate deploy`, el guardián del esquema y los privilegios de `inv_app`. Además corre las cargas y el acceso inicial (`tsx`, rol `inv_dueno`). Es de un solo uso. |
| `inv-008-vigia:<sha>` | Imagen mínima: alpine, sin node ni prisma. Lleva `age`, `curl`, certificados y `pg_dump` 16. La usan el vigía y el respaldo. |
| Servicios de `inv-008-prod` | Permanentes, con `restart: always`: `inv-008-db` (Postgres 16, 70:70, sin puertos, red interna), `inv-008-app`, `inv-008-vigia` (solo avisa) e `inv-008-respaldo` (respaldo diario). De un solo uso, con `restart: "no"` y `run --rm`: `inv-008-migrador`. |
| `/opt/inversiones-008/repo` | Clon por HTTPS del repo público. De root y sin escritura para el grupo ni para otros: el despliegue lo verifica. |
| `/opt/inversiones-008/.env.inversiones.production` | **El único archivo de producción**: root, 600, fuera de git. Plantilla sin valores: [`env-inversiones-production.example`](env-inversiones-production.example). |
| `/opt/inversiones-008/estado/` | El sha y la imagen actuales y anteriores, las mediciones, la línea base de OOM y la **marca de pausa `pausado`**. |
| `/opt/inversiones-008/imagenes/` | Los `.tar` que llegan del Mac. Se conservan los del sha actual y del anterior. |
| `/opt/inversiones-008/run/despliegue-inv-008.lock` | El candado de Inversiones. |
| `/var/lock/despliegue-vps.lock` | El candado común con PI. |
| `/var/backups/idc/inversiones/` | Los `.dump.age` con su `.sha256`, en 0640 con el grupo `respaldo`. |

**La variable de todo, incluida la reversa:**
```sh
COMPOSE="docker compose -p inv-008-prod -f /opt/inversiones-008/repo/008-2026-INVERSIONES/docker-compose.prod.yml --env-file /opt/inversiones-008/.env.inversiones.production"
```
- El archivo de producción se usa **solo para interpolar**: ningún servicio usa `env_file`.
- Cada servicio declara en `environment:` únicamente sus variables:

| Servicio | Variables |
|---|---|
| app | su URL con `inv_app`, `AUTH_SECRET`, `CIFRADO_CLAVE_ACTIVA`, `CIFRADO_CLAVE_V1` y `APP_ORIGEN` |
| migrador | su URL con `inv_dueno`, las de cifrado y `APP_ORIGEN` |
| base | `POSTGRES_PASSWORD` |
| respaldo | la URL con `inv_dueno`, la clave **pública** de `age` y el gid de `respaldo` |
| vigía | Telegram |

- **Límite conocido:** el valor de esas variables se ve con `docker inspect <contenedor>` (root y el grupo `docker`). Las **imágenes** no traen ninguno.

## 2 · Preparar el VPS (una sola vez)
Todo como root y todo dentro de los tres destinos permitidos.
```sh
sudo install -d -m 755 /opt/inversiones-008
sudo install -d -m 700 /opt/inversiones-008/estado /opt/inversiones-008/imagenes /opt/inversiones-008/run
sudo git clone https://github.com/Innovadataco/productos.git /opt/inversiones-008/repo
sudo chmod -R go-w /opt/inversiones-008/repo
```

**La carpeta de respaldos** `/var/backups/idc/inversiones/` ya existe: la montó el CEO de PI y `/var/backups/idc/` es `root:respaldo`, 750.
- El contenedor de respaldo corre como usuario 10008, no como root, así que necesita poder escribir ahí. Lo ajusta quien administra esa carpeta (el CEO de PI o Jelk), no un script de Inversiones:
  ```sh
  sudo chown 10008:respaldo /var/backups/idc/inversiones && sudo chmod u=rwx,g=rxs,o= /var/backups/idc/inversiones
  getent group respaldo | cut -d: -f3      # → INV_RESPALDO_GID del archivo de producción
  ```
- **Por confirmar con el CEO de PI:** su diseño dice archivos `root:respaldo`. Con un contenedor no root, los archivos quedan `10008:respaldo` en 0640. El grupo `respaldo` sigue leyéndolos para la copia; solo cambia el dueño.

**El archivo de producción.**
- Las claves se generan en el VPS y van directo al archivo, sin pasar por la pantalla ni por el historial.
- `openssl rand -hex` deja solo letras y números, que van en la URL sin codificar. `crear-roles-prod.sh` rechaza cualquier otra cosa.
```sh
sudo sh -c 'umask 077; f=/opt/inversiones-008/.env.inversiones.production; {
  echo "INV_POSTGRES_CLAVE=$(openssl rand -hex 32)"
  echo "INV_DUENO_DATABASE_URL=postgresql://inv_dueno:$(openssl rand -hex 32)@inv-008-db:5432/inversiones?schema=public&connection_limit=3"
  echo "INV_APP_DATABASE_URL=postgresql://inv_app:$(openssl rand -hex 32)@inv-008-db:5432/inversiones?schema=public&connection_limit=5"
  echo "INV_AUTH_SECRET=$(openssl rand -base64 48 | tr -d "\n")"
  echo "INV_CIFRADO_CLAVE_V1=$(openssl rand -base64 32)"
  echo "APP_ORIGEN=https://inversiones.innovadataco.com"
  echo "INV_RESPALDO_GID=$(getent group respaldo | cut -d: -f3)"
} > "$f"; chown root:root "$f"; chmod 600 "$f"'
```

Después se agregan a mano con `sudo nano`, sin pegarlas en la terminal:
- `INV_CIFRADO_CLAVE_ACTIVA`: su formato lo fija el frente de cifrado;
- `INV_AGE_PUBLICA`;
- `INV_TELEGRAM_BOT_TOKEN` e `INV_TELEGRAM_CHAT_ID`: son **el mismo bot y el mismo chat de las tareas programadas** (decisión de Jelk).
  - Los pone **Jelk**, o un script que él corre, sin que pasen por el chat ni por un log.
  - La Fábrica no los lee: ni en pruebas ni en scripts se toca `~/.config/odin/`.

**Clave de `age`.** Se genera en el Mac. La **privada** va directo al gestor de contraseñas de Jelk y **nunca** va al VPS. Al VPS solo va la **pública** (`age1…`).
```sh
docker run --rm --entrypoint age-keygen inv-008-vigia:<sha>
#   «# public key: age1…»  → INV_AGE_PUBLICA
#   «AGE-SECRET-KEY-1…»    → gestor de contraseñas de Jelk (no se guarda en disco)
```

**Rotación:**
- **Cuándo:** todas las claves una vez al año y ante cualquier sospecha.
- **Claves de los roles:** se cambian en el archivo y se corre `crear-roles-prod.sh`.
- **`INV_AUTH_SECRET`:** rotarlo cierra las sesiones.
- **Token de Telegram:** si se rota, se actualiza en el Mac (`~/.config/odin/`, lo hace Jelk) y en el VPS. Después se recrea solo el vigía:
  ```sh
  sudo env INV_TAG=$(sudo cat /opt/inversiones-008/estado/sha-actual) $COMPOSE up -d --no-deps inv-008-vigia
  ```

## 3 · Construir y enviar (en el Mac)
1. **Elegir el sha.** Se usa el sha de `main` del merge de Inversiones. Debe tener el CI `inv` en verde, con `inv-gate` y `app-008` en *success*.
2. **Construir y guardar el tar:**
   ```sh
   git fetch origin && scripts/construir-imagen.sh <sha> --guardar ~/inv-008-envio
   ```
   - Por stdout sale el ID de `inv-008-app`; por stderr, los tres IDs, la ruta del `.tar` y su sha256.
   - El script parte de `git archive <sha>`, nunca de la carpeta de trabajo.
     - `next build` copia el `.env` de la carpeta al standalone.
     - El Dockerfile, además, falla si una imagen trae un `.env`.
   - Corre `npm audit --omit=dev --audit-level=high`.
   - Construye con `buildx --platform linux/amd64 --provenance=false --sbom=false`.
   - Verifica `org.opencontainers.image.revision == <sha>` en las tres imágenes.
3. **Enviar directo a `/opt/inversiones-008/imagenes/`**, sin pasar por `/tmp`, con el usuario de SSH del VPS:
   ```sh
   rsync -a --rsync-path="sudo rsync" ~/inv-008-envio/inv-008-<sha>.tar* <usuario>@<vps>:/opt/inversiones-008/imagenes/
   ```

**Integridad.** Son dos almacenes de containerd, y la imagen se compara así, sin confiar en el `.Id` entre máquinas:
- **(a) El `.tar`:** su sha256 se calcula en el Mac y se verifica en el VPS antes de `docker load`. Lo hace `--cargar`. En el Mac, `docker save` dio el mismo sha256 dos veces.
- **(b) El `manifest.json` del `.tar`:** debe traer solo `inv-008-app`, `inv-008-migrador` e `inv-008-vigia` del mismo sha.
- **(c) El disco:** debe haber 15 GB más dos veces el tamaño del `.tar` libres.
- **(d) Las imágenes:** las tres deben tener `revision == <sha>`.
- **(e) El contenedor:** `docker inspect` de la app debe dar `.Image` igual a la imagen cargada.

## 4 · Primer despliegue (en el VPS, en este orden)
1. **Poner el clon en el sha:**
   ```sh
   sudo git -C /opt/inversiones-008/repo fetch && sudo git -C /opt/inversiones-008/repo checkout <sha>
   ```
2. **Crear los roles:** `sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh`
   - Levanta solo la base y le pasa las claves a `psql` por la entrada estándar.
   - `inv_dueno` queda dueño de todo. Las funciones que cree no son ejecutables por PUBLIC.
   - `inv_app` solo lee, más las escrituras del login, por columna:
     - `usuario`: UPDATE de `claveHash`, `sesionVersion` y `bloqueadoHasta`;
     - `token_acceso`: UPDATE de `usadoEn`;
     - `intento_ingreso`: INSERT.
   - Esos permisos los aplica el migrador.
3. **Desplegar:**
   ```sh
   sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/desplegar-prod.sh <id-imagen> \
     --cargar /opt/inversiones-008/imagenes/inv-008-<sha>.tar <sha256-del-Mac>
   ```
   - Solo cuenta como desplegado si la **última línea** es `DEPLOY VERIFICADO <sha>`. Tarda unos 10 minutos.
   - **El despliegue se niega si** existe la marca de pausa, si PI tiene el candado común o si se ve un despliegue de PI.
   - Si la app sale o se reinicia (`instrumentation.ts` sin `AUTH_SECRET` o sin `APP_ORIGEN`), falla.
   - Si falla después de recrear contenedores, **vuelve solo a la imagen que corría**.
4. **Acceso inicial, que es también la recuperación de acceso.** Lo corre **Jelk por SSH**, no la Fábrica, y **antes de cargar los datos reales**:
   ```sh
   sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/crear-acceso-inicial.sh <argumentos que defina el frente login>
   ```
   - Corre `crear-acceso-inicial.ts` en el migrador, con `inv_dueno` y `APP_ORIGEN`.
   - Imprime **una vez** `${APP_ORIGEN}/definir-clave#t=<token>`. No se guarda en ningún archivo; `run --rm` borra el log del contenedor al terminar.
5. **Verificar el login** en `127.0.0.1:5008`: sin sesión, la app redirige a `/ingresar` y las API responden 401.
   ```sh
   curl -sI http://127.0.0.1:5008/ | head -3
   ```
6. **Primer respaldo, antes de cargar los datos reales:**
   ```sh
   sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/respaldar-base.sh --motivo primero
   ```
7. **Cargar los datos reales:**
   - en el Mac: `pg_dump --data-only --exclude-table=_prisma_migrations … | age -r <pública>`;
   - se descifra en el Mac y va por la tubería de SSH a `$COMPOSE exec -T inv-008-db psql -1 -v ON_ERROR_STOP=1 -U inv_dueno -d inversiones`;
   - los conteos por tabla deben ser iguales a los del Mac.
8. **Abrir el túnel** (sección 8): lo aplica el coordinador con el CEO de PI. **Al final.**
9. **Anotar** el sha en `ESTADO.md` de la gestión.

## 5 · Despliegues siguientes y reversa
- **Siguiente versión:** pasos 3 y 4.1–4.3.
  - El script se niega a migrar hacia atrás: el sha nuevo debe descender del que corre.
  - Conserva la imagen y el `.tar` actuales y anteriores, y purga solo las `inv-008-*` viejas.
- **Reversa por etiqueta, sin migrar y sin consultar GitHub** (sirve con GitHub caído). Acepta la imagen actual o la anterior. Antes, se pone el clon en ese sha:
  ```sh
  sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/desplegar-prod.sh "inv-008-app:$(sudo cat /opt/inversiones-008/estado/sha-anterior)" --sin-migrar
  ```
- **Bajar Inversiones sin perder datos:** `sudo $COMPOSE down`, **nunca con `-v`**. Mejor `pausar-008.sh`, que deja la marca.

**Política de migraciones**, como PI:
- en producción, solo `prisma migrate deploy`;
- solo migraciones **aditivas**: columnas nuevas con nulos o con valor por defecto, y nunca un DROP ni un RENAME en el mismo despliegue que la quita del código;
- antes de cualquier DROP, revisar `pg_depend`;
- el guardián del esquema (`scripts/verificar-esquema.sql`) corre después de `migrate deploy`. Compara contra las definiciones canónicas:
  - los índices parciales, por su definición exacta y su unicidad;
  - los CHECK y EXCLUDE, por su definición exacta;
  - los disparadores: tabla, tipo, función y que estén habilitados;
  - el md5 de la función de solo inserción;
  - las extensiones.
  
  Si algo falta o cambió, aborta antes de levantar la app.

## 6 · Respaldos
- **El contenedor `inv-008-respaldo`** es permanente y programa el respaldo él mismo, sin systemd ni cron del host:
  - hace `pg_dump -Fc`, con el rol `inv_dueno` y la clave en las variables de libpq, nunca en los argumentos;
  - lo pasa por `age -r <pública>`, a las 02:30 COT;
  - deja `/var/backups/idc/inversiones/inv-008-AAAAMMDD-HHMMSS[-semanal|-<motivo>].dump.age` con su `.sha256`, los dos en 0640 con el grupo `respaldo`;
  - el texto plano nunca toca el disco: si algo falla, no queda ningún archivo.
- **Retención:** 14 diarios, 8 semanales (los del domingo) y 5 extras.
- **Respaldo ya:** `respaldar-base.sh [--motivo x]`. Se lo pide al contenedor y verifica el archivo y su sha256. El despliegue lo corre antes de migrar.
- **Copia fuera del VPS:** la hace la **infraestructura de IDC**, que copia `/var/backups/idc/` completo al Mac cada día. Inversiones no configura nada para eso.
- **Restauración, siempre con la clave privada fuera del VPS.** La clave sale del gestor de contraseñas de Jelk y entra a `age` por la entrada estándar (`age -d -i -`), nunca en un archivo. Hay dos casos.

**(A) Volumen nuevo, o el VPS perdido.** En el VPS:
```sh
$COMPOSE up -d --wait inv-008-db                           # la base nace vacía (POSTGRES_DB)
sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh
```
En el Mac, con el respaldo de la copia de IDC:
```sh
pbpaste | docker run --rm -i --network none -v ~/<copia>/inversiones:/r:ro --entrypoint age inv-008-vigia:<sha> \
    -d -i - /r/inv-008-<fecha>.dump.age \
  | ssh <usuario>@<vps> 'sudo docker exec -i $(sudo docker compose -p inv-008-prod ps -q inv-008-db) pg_restore -U inv_dueno -d inversiones --no-owner --exit-on-error'
```
En el VPS:
```sh
sudo env INV_TAG=<sha> $COMPOSE run --rm -T inv-008-migrador    # migraciones, guardián del esquema y privilegios
sudo env INV_TAG=<sha> $COMPOSE up -d --wait                    # app, vigía y respaldo
```

**(B) Reemplazar una base existente.**
1. `$COMPOSE stop inv-008-app inv-008-vigia inv-008-respaldo`
2. `$COMPOSE exec -T inv-008-db psql -U postgres -c 'DROP DATABASE inversiones WITH (FORCE)' -c 'CREATE DATABASE inversiones OWNER inv_dueno'`
3. Seguir como en (A) desde `crear-roles-prod.sh`.

**Prueba de restauración mensual** (y la primera, antes de retirar el chat de inversiones, D-013):
- se hace con el caso (A), en un proyecto de prueba en el Mac;
- los conteos por tabla deben ser iguales y la app debe responder `ok`;
- se anotan la fecha y el resultado en `ESTADO.md`.

## 7 · Las imágenes no traen secretos
```sh
docker history --no-trunc inv-008-app:<sha> | grep -Ei 'password|secret|clave|token|postgresql://' || echo "historial sin secretos"
docker image inspect -f '{{json .Config.Env}}' inv-008-app:<sha>
docker run --rm --entrypoint sh inv-008-app:<sha> -c 'find / -xdev \( -name ".env" -o -name ".env.*" \)'   # vacío
```
Las mismas tres revisiones valen para `inv-008-migrador` e `inv-008-vigia`.

## 8 · Túnel de Cloudflare (documentado, NO configurado)
Lo aplica el coordinador con el CEO de PI, en una ventana acordada y **solo con el login verificado**.

| Dato | Valor |
|---|---|
| Túnel | `970b8bb9-3931-42a3-a452-67329a56bae8` |
| Servicio | `cloudflared-hermes` (`ExecStart=/usr/local/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run`) |
| Configuración | `/etc/cloudflared/config.yml` |

1. **Antes:** guardar el código HTTP de PI, BI y piweb:
   ```sh
   for h in pi bi piweb; do printf '%s ' $h; curl -sI https://$h.innovadataco.com | head -1; done
   ```
2. **Respaldo:** `sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak-inv-$(date +%Y%m%d)`
3. **Las dos líneas.** Se agregan justo antes de `- service: http_status:404`, sin tocar ninguna otra:
   ```yaml
     - hostname: inversiones.innovadataco.com
       service: http://127.0.0.1:5008
   ```
   El `diff` contra el respaldo debe mostrar solo esas 2 líneas, y no debe haber una regla comodín antes.
4. **Validar:** `sudo cloudflared tunnel ingress validate --config /etc/cloudflared/config.yml`
5. **DNS:** con `/root/.cloudflared/cert.pem`, y después de verificar que no exista un registro `inversiones`:
   ```sh
   sudo cloudflared tunnel route dns 970b8bb9-3931-42a3-a452-67329a56bae8 inversiones.innovadataco.com
   ```
6. **Avisar al CEO de PI ANTES** de `sudo systemctl restart cloudflared-hermes`, que corta unos segundos a PI, BI, piweb y Hermes.
7. **Después:**
   - repetir el paso 1: si cambia cualquier código, se revierte de inmediato;
   - `curl -I https://inversiones.innovadataco.com` debe llevar a `/ingresar`.
8. **Reversa:**
   ```sh
   sudo cp /etc/cloudflared/config.yml.bak-inv-<fecha> /etc/cloudflared/config.yml && sudo systemctl restart cloudflared-hermes
   ```
   Repetir el paso 1.

## 9 · Ensayo local (cómo se probó sin el VPS)
- **Proyecto:** `inv-008-prueba`, que solo corre en el Mac o en el CI y nunca donde exista `/opt/inversiones-008`.
- **Override:** sin el puerto de la app, con el vigía apuntando a un Telegram inexistente y los respaldos en una carpeta de prueba.
- **Datos:** secretos ficticios, meminfo y cgroup de prueba para los scripts del host. GitHub se simuló con un `curl` falso.
- **Limpieza:** al final, `docker compose -p inv-008-prueba down -v`, que borra solo ese proyecto.
- **Resultados:** en [capas-pi.md](capas-pi.md#ensayo-local-salidas).

---
> v2.0 · 2026-11-21 · 00:40 (-05) · Inversiones · Fábrica ECC (frente producción) · correcciones de la GATE 2 (VPS compartido con PI)
> v1.0 · 2026-11-20 · 23:59 (-05) · Inversiones · Fábrica ECC (frente producción)
