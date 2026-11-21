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
  - El túnel **no lo configura ningún script**: se aplicó a mano (§8).
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
| Servicios de `inv-008-prod` | Permanentes, con `restart: always`: `inv-008-db` (Postgres 16, 70:70, sin puertos, red interna), `inv-008-app`, `inv-008-vigia` (solo avisa) e `inv-008-respaldo` (respaldo diario, `0:<gid respaldo>` sin capacidades: la excepción documentada). De un solo uso, con `restart: "no"` y `run --rm`: `inv-008-migrador`. |
| `/opt/inversiones-008/repo` | Clon por HTTPS del repo público. De root y sin escritura para el grupo ni para otros: todo script con sudo lo revisa al empezar (§2, «Árbol de root»). |
| `/opt/inversiones-008/.env.inversiones.production` | **El único archivo de producción**: root, 600, fuera de git. Plantilla sin valores: [`env-inversiones-production.example`](env-inversiones-production.example). |
| `/opt/inversiones-008/estado/` | El sha y la imagen actuales y anteriores, las mediciones, la línea base de OOM y la **marca de pausa `pausado`**. |
| `/opt/inversiones-008/imagenes/` | Los `.tar` que llegan del Mac. Se conservan los del sha actual y del anterior. |
| `/opt/inversiones-008/run/despliegue-inv-008.lock` | El candado de Inversiones. |
| `/var/lock/despliegue-vps.lock` | El candado común con PI. |
| `/var/backups/idc/inversiones/` | Los `.dump.age` con su `.sha256`, `root:respaldo` en 0640, en la carpeta del CEO de PI (`root:respaldo`, 750). |

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

**Árbol de root.** Todo script con sudo, justo después de fijar el proyecto, revisa que lo que corre como root (o decide qué corre) sea solo de root (`revisar_arbol` en `produccion-comun.sh`):
- los padres de `008-2026-INVERSIONES/` hasta `/`, sin recursión: quien escribe en un padre puede cambiar la carpeta entera;
- `scripts/` completo y `docker-compose.prod.yml`: sin otro dueño, sin escritura del grupo ni de otros y sin enlaces simbólicos;
- `.git`, `.git/config` y `.git/hooks`: el despliegue corre `git status` como root, y git puede ejecutar `core.fsmonitor` o el hook `post-index-change`;
- el archivo de producción: de root y en 600.

Si algo no cumple, el script se niega y nombra las rutas. **`pausar-008.sh` solo avisa**, para no frenar un corte de emergencia.

**Límite:** un script no responde por sí mismo. Cuando la revisión corre, bash ya leyó ese script y `produccion-comun.sh`; si alguien pudo cambiarlos, también pudo quitar la revisión. Lo que sí cuida es lo que se lee después (los otros scripts, el compose y el SQL de roles), la cadena de padres y la configuración de git, ante un permiso mal puesto. La garantía de fondo es la misma de siempre: el clon lo escribe solo root.

Revisión previa, de solo lectura (no debe imprimir nada):
```sh
sudo find / /opt /opt/inversiones-008 /opt/inversiones-008/repo /opt/inversiones-008/repo/008-2026-INVERSIONES /opt/inversiones-008/repo/.git -maxdepth 0 \( ! -user root -o -perm -0020 -o -perm -0002 -o -type l \) -print
sudo find /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts /opt/inversiones-008/repo/008-2026-INVERSIONES/docker-compose.prod.yml /opt/inversiones-008/repo/.git/config /opt/inversiones-008/repo/.git/hooks \( ! -user root -o -perm -0020 -o -perm -0002 -o -type l \) -print
sudo find /opt/inversiones-008/.env.inversiones.production -maxdepth 0 \( ! -user root -o -perm -0040 -o -perm -0004 -o -perm -0020 -o -perm -0002 -o -type l \) -print
```

**La carpeta de respaldos** `/var/backups/idc/inversiones/` ya existe y **no se toca**: la montó el CEO de PI, como `root:respaldo` en 750.
- Los archivos de Inversiones quedan ahí `root:respaldo` en 0640, como pidió.
- Para eso, el contenedor `inv-008-respaldo` corre como `0:<gid de respaldo>`: root **del contenedor**, sin ninguna capacidad. Es la única excepción a «no root» (capas-pi.md #4).
- Lo único que hace falta es el gid numérico del grupo `respaldo`:
  ```sh
  getent group respaldo | cut -d: -f3      # → INV_RESPALDO_GID del archivo de producción
  ```

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

**Tamaño del pool de la app.** La URL de la app lleva `connection_limit=5` y la del dueño `=3`.
- Sin él, Prisma 5 abre núcleos × 2 + 1 conexiones: con 2 núcleos son 5; con 5 o más pasarían de las 10 que admite `inv_app`. Se midió en el Mac: 29 conexiones sin el parámetro (14 núcleos) y 5 con él.
- `desplegar-prod.sh` **avisa**, sin frenar el despliegue ni imprimir la URL, si la de la app no trae un `connection_limit` de 1 a 8.

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
- **Claves de cifrado (`INV_CIFRADO_CLAVE_V<n>`) y el TOTP:**
  - `scripts/cifrar-existentes.ts` re-cifra `crudo` y `encargo`, pero no conoce `usuario.totpSecreto`.
  - El secreto TOTP del dueño se re-cifra con la clave activa cada vez que entra con el código de la app (y cuando enrola o regenera los códigos). Entrar con un código de recuperación no lo re-cifra.
  - Por eso **una clave vieja no se retira hasta que el dueño haya entrado con el código de la app después de rotar**.
  - Si se retira antes, el segundo factor deja de verificar. La salida es `crear-acceso-inicial.sh --email <correo> --reiniciar-totp` y enrolar de nuevo antes de 30 minutos.
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
   - **Si migra, la app vieja queda abajo** desde el respaldo previo hasta que la versión nueva queda healthy. Durante el migrador también se detiene el respaldo diario. Así ningún contenedor de Inversiones retiene tablas mientras migra. Con `--sin-migrar` no se detiene nada.
   - **Ventana conocida:** entre el respaldo previo y la detención del respaldo diario, el diario podría arrancar si justo le toca. La detención lo corta antes del migrador: no queda texto plano y su `.parcial` se borra en un respaldo posterior, pasados 60 minutos. El diario se hace después, porque ese día no quedó marcado.
   - Si falla después de tocar contenedores (incluida esa pausa), **vuelve solo a la imagen que corría**: levanta app, vigía y respaldo con ese sha. Si se re-desplegaba el mismo sha, levanta otra vez ese mismo.
     - Solo vuelve a un sha de 40 hex: si `estado/sha-actual` está dañado, lo dice y no levanta nada.
     - En el primer despliegue no hay imagen a la que volver: lo dice, y lo detenido queda abajo.
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
- el guardián del esquema (`scripts/verificar-esquema.sql`) corre después de `migrate deploy`, con su propio `search_path = public`. Compara contra las definiciones canónicas de PostgreSQL 16:
  - **índices únicos y parciales** (los únicos de Prisma sostienen la idempotencia de las cargas): definición exacta, unicidad, y que estén válidos, listos y vivos. Ningún índice del esquema puede quedar a medias, aunque no esté en la lista;
  - **llaves primarias y foráneas:** definición exacta, con su ON DELETE y ON UPDATE (todas RESTRICT/RESTRICT), y validadas. Toda FK debe tener un índice que empiece por sus columnas;
  - **CHECK y EXCLUDE:** definición exacta y validados. Los de su lista `sin_validar` se aceptan NOT VALID hasta que una migración posterior los valide. Antes de esa migración, el dueño corre `scripts/contar-sin-validar.sql` (solo lectura, solo conteos);
  - **disparadores:** definición exacta (`pg_get_triggerdef`: eventos, `UPDATE OF`, `WHEN` y función) y habilitados. Ninguno sobra y ninguno está deshabilitado, incluidos los internos de las FK;
  - el **md5** del código de cada función escrita a mano;
  - las **extensiones**.

  Si algo falta o cambió, aborta antes de levantar la app. Si la migración misma falla, ver la §10.

## 6 · Respaldos
- **El contenedor `inv-008-respaldo`** es permanente y programa el respaldo él mismo, sin systemd ni cron del host:
  - hace `pg_dump -Fc`, con el rol `inv_dueno` y la clave en las variables de libpq, nunca en los argumentos;
  - lo pasa por `age -r <pública>`, a las 02:30 COT;
  - deja `/var/backups/idc/inversiones/inv-008-AAAAMMDD-HHMMSS[-semanal|-<motivo>].dump.age` con su `.sha256`, los dos `root:respaldo` en 0640;
  - el texto plano nunca toca el disco: si algo falla, no queda ningún archivo.
- **Retención:** 14 diarios, 8 semanales (los del domingo) y 5 extras.
- **Respaldo ya:** `respaldar-base.sh [--motivo x]`. Se lo pide al contenedor y verifica el archivo y su sha256. El despliegue lo corre antes de migrar.
- **Un respaldo a la vez.** El manual (`exec … --ahora`) y el diario corren en el mismo contenedor y comparten un candado (`flock` sobre `/run/respaldo/respaldo.candado`, que se suelta solo si el proceso muere):
  - el manual espera hasta 600 s (`RESPALDO_ESPERA_S`) y, si no lo consigue, sale con 75 sin tocar nada;
  - el diario no espera: lo intenta en el minuto siguiente, sin contarlo como fallo;
  - la marca de fallo de `pg_dump` y el `.parcial` llevan el PID, y un respaldo nunca se sobrescribe: si el nombre ya existe, toma el segundo siguiente;
  - si falla un paso después del cifrado (mover, `.sha256`, grupo o permisos), no queda nada a medias y no cuenta como respaldo: el diario lo reintenta en 15 minutos;
  - los `.parcial` de más de 60 minutos (un respaldo cortado a mitad) se borran en el respaldo siguiente.
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

## 8 · Túnel de Cloudflare (aplicado el 2026-11-21)
**Estado:** lo aplicó el coordinador con el CEO de PI el 2026-11-21: el ingress de `inversiones` y el CNAME. Lo reportó el coordinador; ningún script de Inversiones toca el túnel. El respaldo de la configuración anterior es `/etc/cloudflared/config.yml.bak-inv-20261121`.

| Dato | Valor |
|---|---|
| Túnel | `<id-del-túnel>` (lo tiene el coordinador; no va en este repo público) |
| Servicio | `cloudflared-hermes` (`ExecStart=/usr/local/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run`) |
| Configuración | `/etc/cloudflared/config.yml` |

**Cómo se aplicó** (para repetirlo en un VPS nuevo), siempre en una ventana acordada con el CEO de PI y **solo con el login verificado**:
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
   sudo cloudflared tunnel route dns <id-del-túnel> inversiones.innovadataco.com
   ```
6. **Avisar al CEO de PI ANTES** de `sudo systemctl restart cloudflared-hermes`, que corta unos segundos a PI, BI, piweb y Hermes.
7. **Después:**
   - repetir el paso 1: si cambia cualquier código, se revierte de inmediato;
   - `curl -I https://inversiones.innovadataco.com` debe llevar a `/ingresar`.

**Reversa** (con el CEO de PI avisado, por el mismo corte de unos segundos):
```sh
sudo cp /etc/cloudflared/config.yml.bak-inv-20261121 /etc/cloudflared/config.yml && sudo systemctl restart cloudflared-hermes
```
Después se repite el paso 1. El CNAME `inversiones` queda en el DNS hasta que se borre aparte.

## 9 · Ensayo local (cómo se probó sin el VPS)
- **Proyecto:** `inv-008-prueba`, que solo corre en el Mac o en el CI y nunca donde exista `/opt/inversiones-008`.
- **Override:** sin el puerto de la app, con el vigía apuntando a un Telegram inexistente y los respaldos en una carpeta de prueba.
- **Datos:** secretos ficticios, meminfo y cgroup de prueba para los scripts del host. GitHub se simuló con un `curl` falso.
- **Limpieza:** al final, `docker compose -p inv-008-prueba down -v`, que borra solo ese proyecto.
- **Resultados:** en [capas-pi.md](capas-pi.md#ensayo-local-salidas).

## 10 · Si una migración falla (P3009)
**Qué pasa.** Verificado en el Mac el 2026-11-21 con una migración de ensayo en una base `_test`:
- Prisma corre cada `migration.sql` en **una sola transacción**: si una sentencia falla, la migración se deshace entera y la base queda como estaba antes de ella.
- Pero la fila de esa migración queda en `_prisma_migrations` sin `finished_at`, y **el siguiente `migrate deploy` se niega con P3009** hasta que alguien la resuelva.
- `desplegar-prod.sh` se detiene en el migrador, no levanta la app nueva y su vuelta atrás vuelve a levantar la imagen que había (estaba detenida para migrar).

**Qué se hace:**
1. **No reintentar** el despliegue ni tocar la base. Se lee el error del migrador: código SQLSTATE y mensaje, que no traen valores de las filas.
2. Se avisa al **CEO de 008** con el nombre de la migración y el error.
3. **`prisma migrate resolve --rolled-back <nombre>` es una decisión del CEO, nunca automática.** Ningún script lo corre. Solo se decide después de confirmar dos cosas:
   - que la migración se deshizo entera: sus objetos no existen;
   - que la causa se corrigió. Si la migración ya entró en otra base, la corrección va en una migración **nueva**; nunca se edita la fallida.
4. **Si el CEO lo decide**, se corre con el rol `inv_dueno` en el contenedor del migrador, con el mismo patrón de `crear-acceso-inicial.sh`. Este comando **no se ha probado contra producción**:
   ```sh
   sudo $COMPOSE run --rm -T inv-008-migrador node_modules/.bin/prisma migrate resolve --rolled-back <nombre> --schema prisma/schema.prisma
   ```
   Después se despliega de nuevo, normal.
- Nunca `migrate resolve --applied` para una migración que falló: marcaría como aplicado algo que no está.
- Las migraciones de 008 toman `SET LOCAL lock_timeout = '5s'`. La app vieja y el respaldo diario ya están detenidos mientras migra (§4.3). El `lock_timeout` queda para lo que el despliegue no controla, por ejemplo una sesión de `psql` abierta a mano: si algo retiene una tabla, el migrador falla rápido, se deshace y se sigue este mismo procedimiento.

---
> v2.2 · 2026-11-21 · 04:40 (-05) · Inversiones · Fábrica ECC (frente prod-endurecer) · app y respaldo diario detenidos antes del migrador, con su vuelta atrás; un respaldo a la vez; árbol de root al inicio de todo script con sudo; aviso de `connection_limit`; §8: túnel aplicado y sin el ID en el repo
> v2.1 · 2026-11-21 · 03:27 (-05) · Inversiones · Fábrica ECC (frente base) · §5: el guardián nuevo; §10: migración fallida y P3009 (`migrate resolve` lo decide el CEO)
> v2.0 · 2026-11-21 · 00:40 (-05) · Inversiones · Fábrica ECC (frente producción) · correcciones de la GATE 2 (VPS compartido con PI)
> v1.0 · 2026-11-20 · 23:59 (-05) · Inversiones · Fábrica ECC (frente producción)
