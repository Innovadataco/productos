# Inversiones · despliegue en producción

Cómo se despliega, se revierte, se respalda, se restaura y se cargan los datos del dueño en el **VPS de producción compartido con PI** (D-015).
- **El VPS:** x86_64, con Docker y el almacén de containerd. Proveedor, sistema y versiones: <ver ESTADO en la gestión>.
- **Marcadores.** El repo es público: las rutas y los nombres del VPS no van aquí. Sus valores están en el `ESTADO.md` privado de la gestión:
  - `<raíz>`: la carpeta base de Inversiones en el VPS, la que contiene al clon `<raíz>/repo`. <ver ESTADO en la gestión>
  - `<respaldos>`: la carpeta de los respaldos cifrados, la del CEO de PI. <ver ESTADO en la gestión>
  - `<respaldos-IDC>`: la carpeta de respaldos de IDC que la contiene. <ver ESTADO en la gestión>
  - `<servicio-del-túnel>`, `<config-del-túnel>`, `<certificado-del-túnel>` e `<id-del-túnel>`: el túnel de PI (§8). <ver ESTADO en la gestión>
- **Ningún script trae esas rutas escritas:**
  - la raíz se **deriva** de la ubicación del clon (`produccion-comun.sh`: `raiz_derivada` y sus anclas);
  - la carpeta de respaldos sale de la **configuración no secreta** `<raíz>/inv-008.conf` (§2).

**Reglas que no se negocian** (Jelk: «no tocar gesmovil ni pi, solo inversiones, ojo no puede dañar nada»):
- **Escritura: solo tres destinos.** Los scripts lo hacen cumplir: toda ruta pasa por `ruta_escribible` y cada vecina tiene su prueba en rojo.
  - `<raíz>/`, completo;
  - `/var/lock/despliegue-vps.lock`, ese archivo, que es el candado común con PI;
  - `<respaldos>/`, esa carpeta, sin subcarpetas: los respaldos cifrados.
- **Lo que nunca se toca:** la carpeta de PI, los contenedores de PI y de BI, y los de otros proyectos del VPS.
- **Docker:** solo con el proyecto `inv-008-prod`, siempre por la variable `COMPOSE`.
  - Nunca un comando global (`system prune`, `image prune -a`, `volume prune`, `stop $(docker ps -q)`).
  - Ningún comando de Docker nombra contenedores de PI, de BI ni de otros proyectos del VPS, ni siquiera para leer.
- **Sistema:** ningún script toca `ufw`, `systemctl`, `/etc/` ni el `crontab` de root.
  - El respaldo diario lo programa su propio contenedor.
  - El túnel **no lo configura ningún script**: se aplicó a mano (§8).
- **Red:**
  - desde internet solo se llega a los puertos que deja pasar ufw: <ver ESTADO en la gestión>;
  - el único puerto de Inversiones es `127.0.0.1:5008`, nunca `0.0.0.0`, y lo publica `inv-008-entrada`;
  - **la app no tiene salida a internet:** vive solo en redes `internal` (`inv-008-red-interna`, con la base, e `inv-008-red-entrada`, con la entrada) y no publica puertos;
  - **las dos redes `internal` aíslan la puerta de enlace** (`driver_opts: com.docker.network.bridge.gateway_mode_ipv4: isolated`): el puente no tiene dirección del host, así que ni la app ni la base llegan al **host** por ahí. Sin aislar, una red `internal` sí llegaba a los servicios del host por su puerta de enlace (medición en el VPS: <ver ESTADO en la gestión>; en el Mac, capas-pi.md). Necesita Docker 28 o más. `desplegar-prod.sh` revisa la opción **y su efecto** (la red sin puerta de enlace del host); el alcance real hacia el host lo probó el ensayo, el script no lo prueba;
  - la base no publica ningún puerto y vive solo en `inv-008-red-interna`;
  - con salida a internet, en `inv-008-red`, solo la entrada (para publicar) y el vigía (Telegram).
- **Alcance de «la app sin salida»** (decisión del CEO, dicho tal cual):
  - si alguien compromete la app, no puede abrir conexiones hacia internet ni resolver nombres de afuera. Pero **sí puede sacar datos por la respuesta del túnel**: responder lo que quiera a quien le pide. «Sin salida» no impide eso;
  - `Cf-Connecting-IP` (los topes por IP) lo pone Cloudflare y la entrada lo pasa tal cual. En `127.0.0.1:5008` solo lo puede falsificar quien ya está en el host; dentro del proyecto, también un contenedor de 008 que llegue a `inv-008-entrada:5008` (hoy, el vigía, que no expone nada). Es aceptable: la barrera principal es el bloqueo por cuenta;
  - **el camino lateral al host por la puerta de enlace del puente** quedó cerrado en este mismo cambio (alcance ampliado por el CEO): las redes `internal` van aisladas. La red con salida (`inv-008-red`) no se aísla: por su puerta de enlace publica la entrada y sale el vigía.
- **Construcción:** se construye en el Mac, nunca en el VPS.

Documentos relacionados:
- [convivencia-pi.md](convivencia-pi.md): pausa (incluida la que hace PI en sus despliegues, con su propio código), memoria, criterio de corte y vigía.
- [capas-pi.md](capas-pi.md): las 12 capas de seguridad de PI, con su evidencia.

## 1 · Piezas

| Pieza | Qué es |
|---|---|
| `inv-008-app:<sha>` | La app (Next standalone). Usuario 10008, solo lectura, escucha en 5008 **sin publicar nada y sin salida a internet**. La misma imagen corre `inv-008-entrada`. |
| `inv-008-migrador:<sha>` | `prisma migrate deploy`, el guardián del esquema y los privilegios de `inv_app`. Además corre las cargas y el acceso inicial (`tsx`, rol `inv_dueno`). Es de un solo uso. |
| `inv-008-vigia:<sha>` | Imagen mínima: alpine, sin node ni prisma. Lleva `age`, `curl`, certificados y `pg_dump` 16. La usan el vigía y el respaldo. |
| Servicios de `inv-008-prod` | Permanentes, con `restart: always`: `inv-008-db` (Postgres 16, 70:70, sin puertos, red interna), `inv-008-app` (solo redes internal), `inv-008-entrada` (el relé del túnel), `inv-008-vigia` (solo avisa) e `inv-008-respaldo` (respaldo diario, `0:<gid respaldo>` sin capacidades: la excepción documentada). De un solo uso, con `restart: "no"` y `run --rm`: `inv-008-migrador`. |
| `inv-008-entrada` | **Relé TCP (capa 4)** en `node -e`, con la imagen de la app: copia bytes entre `127.0.0.1:5008` del host y `inv-008-app:5008`, sin leer el HTTP. Por eso `Cf-Connecting-IP`, el Host y las cabeceras de la app (CSP, HSTS…) pasan tal cual, sin quitar ni duplicar nada. Destino fijo (no es un relé abierto), sin variables ni secretos, sin volúmenes, 32m y 32 pids, sin log de los clientes, inactividad de 120 s y 64 conexiones como máximo. Existe porque una red `internal` no publica puertos. Su código está en el compose y lo ejecuta `tests/unit/produccion/entrada.test.ts`. |
| `<raíz>/repo` | Clon por HTTPS del repo público. De root y sin escritura para el grupo ni para otros: todo script con sudo lo revisa al empezar (§2, «Árbol de root»). |
| `<raíz>/.env.inversiones.production` | **El único archivo de producción**: root, 600, fuera de git. Plantilla sin valores: [`env-inversiones-production.example`](env-inversiones-production.example). |
| `<raíz>/inv-008.conf` | **La configuración no secreta**: una sola línea, `INV_RESPALDOS_DIR=<respaldos>`. root, 644, fuera de git. Plantilla: [`inv-008.conf.example`](inv-008.conf.example). La escribe quien despliega (§2). |
| `<raíz>/estado/` | El sha y la imagen actuales y anteriores, las mediciones, la línea base de OOM y la **marca de pausa `pausado`**. |
| `<raíz>/imagenes/` | Los `.tar` que llegan del Mac. Se conservan los del sha actual y del anterior. |
| `<raíz>/run/despliegue-inv-008.lock` | El candado de Inversiones. |
| `/var/lock/despliegue-vps.lock` | El candado común con PI. |
| `<respaldos>/` | Los `.dump.age` con su `.sha256`, `root:respaldo` en 0640, en la carpeta del CEO de PI (`root:respaldo`, 750). Su ruta sale de `inv-008.conf`. |

**La variable de todo, incluida la reversa** (los scripts la arman igual, en `armar_compose`):
```sh
B='<raíz>'   # <ver ESTADO en la gestión>
R="$(sed -n 's/^INV_RESPALDOS_DIR=//p' "$B/inv-008.conf")"
COMPOSE="env INV_RESPALDOS_DIR=$R INV_RUTA_PAUSA=$B/repo/008-2026-INVERSIONES/scripts/pausar-008.sh docker compose -p inv-008-prod -f $B/repo/008-2026-INVERSIONES/docker-compose.prod.yml --env-file $B/.env.inversiones.production"
```
- **Las dos primeras variables no son secretas y las pone el script, nunca el archivo de producción** (los scripts se niegan si este las define):
  - la carpeta de respaldos, leída de `inv-008.conf` y validada;
  - la ruta de la pausa, que va en el aviso del vigía.

  La variable de entorno manda sobre `--env-file`.
- **A mano no se valida nada:** para lo que levanta el respaldo, use los scripts.
- **Si falta `INV_RESPALDOS_DIR`,** el compose toma una ruta que no existe.
  - Todo comando interpola igual: `down`, `ps`, `exec`, `logs`.
  - Solo un `up` que cree el respaldo falla cerrado, sin crear ninguna carpeta (bind en sintaxis larga con `create_host_path: false`).
- El archivo de producción se usa **solo para interpolar**: ningún servicio usa `env_file`.
- Cada servicio declara en `environment:` únicamente sus variables:

| Servicio | Variables |
|---|---|
| app | su URL con `inv_app`, `AUTH_SECRET`, `CIFRADO_CLAVE_ACTIVA`, `CIFRADO_CLAVE_V1` y `APP_ORIGEN` |
| migrador | su URL con `inv_dueno`, las de cifrado y `APP_ORIGEN` |
| base | `POSTGRES_PASSWORD` |
| respaldo | la URL con `inv_dueno`, la clave **pública** de `age` y el gid de `respaldo` |
| vigía | Telegram y la ruta de la pausa |

- **Límite conocido:** el valor de esas variables se ve con `docker inspect <contenedor>` (root y el grupo `docker`). Las **imágenes** no traen ninguno.

## 2 · Preparar el VPS (una sola vez)
Todo como root y todo dentro de los tres destinos permitidos.
```sh
B='<raíz>'   # <ver ESTADO en la gestión>
sudo install -d -m 755 "$B"
sudo install -d -m 700 "$B/estado" "$B/imagenes" "$B/run"
sudo git clone https://github.com/Innovadataco/productos.git "$B/repo"
sudo chmod -R go-w "$B/repo"
```
- **El clon tiene que llamarse `repo`, dentro de la raíz.** Los scripts derivan la raíz de su propia ubicación: la carpeta que contiene a `repo/008-2026-INVERSIONES`.
- **Anclas, fatales para todo script en producción:** la raíz y sus padres hasta `/` son de root, sin escritura del grupo ni de otros y sin enlaces, y el archivo de producción es de root, 600 y regular.
  - Si fallan, el script no corre (salvo `pausar-008.sh`, que sí corre, ver abajo).
  - `pausar-008.sh` no escribe nada: hace un `down` de último recurso por nombre de proyecto y sale con error («SIN marca»).

**La configuración no secreta** (`<raíz>/inv-008.conf`):
- **Cuándo:** antes del primer despliegue que la usa, y **antes de poner el clon en ese sha**.
- **Quién:** quien despliega, con sudo. No lleva secretos.
- **Lo que pasa sin ella:** `desplegar-prod.sh`, `reanudar-008.sh` y `respaldar-base.sh` se niegan («falta la configuración no secreta»). La pausa, la medición, los roles, el acceso inicial y la carga no la necesitan.
```sh
sudo sh -c 'umask 022; f=<raíz>/inv-008.conf; printf "INV_RESPALDOS_DIR=%s\n" "<respaldos>" > "$f"; chown root:root "$f"; chmod 644 "$f"'
```
**Lo que validan los scripts** (si algo no cumple, se niegan antes de tocar nada y dicen qué):
- **El archivo:** regular, de root, sin escritura del grupo ni de otros, y con exactamente una línea útil.
- **La forma de la carpeta:** ruta absoluta de caracteres `[A-Za-z0-9_./-]`, sin `//`, `.` ni `..`, y sin enlaces en ningún componente.
- **Dueño y permisos:** existe, es de root, del grupo `respaldo` (`INV_RESPALDO_GID`, nunca 0) y en **750**: el grupo lee y entra sin escribir, y nadie más. La copia diaria de IDC la baja con el usuario del grupo `respaldo`: si cambian el dueño o los permisos, esa copia se corta en silencio. Sus padres son solo de root.
- **Contenido:** solo respaldos de 008.
- **Lugar:** fuera de `<raíz>`, sin contenerla ni ser un ancestro suyo.

**El montaje del host, `nosuid,noexec`** (lo hace el CEO de PI; por ahora los scripts **solo avisan**):
- **Por qué en el host:**
  - El contenedor de respaldo escribe como root del contenedor. Un archivo setuid o ejecutable que dejara ahí, un usuario del grupo `respaldo` podría correrlo en el host.
  - Docker no aplica `nosuid` ni `noexec` a un bind: el kernel ignora esos bits en el bind inicial. El ensayo lo mostró: `rw,relatime` dentro del contenedor.
  - Aunque los aplicara, solo cubrirían la vista del contenedor.
- **Qué revisan los scripts:** `revisar_montaje_respaldos` lee con `findmnt -no OPTIONS -T <respaldos>` las opciones del montaje que contiene la carpeta, sin tocar nada.
  - Hoy, si faltan, avisa y sigue (`INV_MONTAJE_RESPALDOS_FATAL=0`).
  - Cuando el CEO de PI confirme el montaje, se cambia a 1 en un PR de una línea, y desde ahí aborta.

La carpeta se revalida antes de cada `up` que monta el respaldo. **Revisión previa, de solo lectura** (no debe imprimir nada, y el conteo debe dar 0):
```sh
R="$(sed -n 's/^INV_RESPALDOS_DIR=//p' <raíz>/inv-008.conf)"
p="$R"; while :; do sudo find "$p" -maxdepth 0 \( ! -user root -o -perm -0020 -o -perm -0002 -o -type l \) -print; [ "$p" = / ] && break; p="$(dirname "$p")"; done
sudo find "$R" -maxdepth 0 ! -group "$(getent group respaldo | cut -d: -f3)" -print
sudo find "$R" -mindepth 1 -maxdepth 1 ! -name 'inv-008-*.dump.age' ! -name 'inv-008-*.dump.age.sha256' ! -name '.inv-008-*.parcial' ! -name '.ultimo-diario' -print | wc -l
```

**Árbol de root.** Todo script con sudo, justo después de fijar el proyecto, revisa que lo que corre como root (o decide qué corre) sea solo de root (`revisar_arbol` en `produccion-comun.sh`):
- los padres de `008-2026-INVERSIONES/` hasta `/`, sin recursión: quien escribe en un padre puede cambiar la carpeta entera;
- `scripts/` completo y `docker-compose.prod.yml`: sin otro dueño, sin escritura del grupo ni de otros y sin enlaces simbólicos;
- `.git`, `.git/config` y `.git/hooks`: el despliegue corre `git status` como root, y git puede ejecutar `core.fsmonitor` o el hook `post-index-change`;
- el archivo de producción: de root y en 600;
- la configuración no secreta, si existe: de root, sin escritura del grupo ni de otros y sin enlaces (decide el único bind de escritura del respaldo).

Si algo no cumple, el script se niega y nombra las rutas. **`pausar-008.sh` solo avisa**, para no frenar un corte de emergencia (sus anclas, en cambio, sí son fatales: ver arriba).

**Límite:** un script no responde por sí mismo. Cuando la revisión corre, bash ya leyó ese script y `produccion-comun.sh`; si alguien pudo cambiarlos, también pudo quitar la revisión. Lo que sí cuida es lo que se lee después (los otros scripts, el compose y el SQL de roles), la cadena de padres y la configuración de git, ante un permiso mal puesto. La garantía de fondo es la misma de siempre: el clon lo escribe solo root.

Revisión previa, de solo lectura (no debe imprimir nada):
```sh
B='<raíz>'   # <ver ESTADO en la gestión>
p="$B/repo/008-2026-INVERSIONES"; while :; do sudo find "$p" -maxdepth 0 \( ! -user root -o -perm -0020 -o -perm -0002 -o -type l \) -print; [ "$p" = / ] && break; p="$(dirname "$p")"; done
sudo find "$B/repo/.git" -maxdepth 0 \( ! -user root -o -perm -0020 -o -perm -0002 -o -type l \) -print
sudo find "$B/repo/008-2026-INVERSIONES/scripts" "$B/repo/008-2026-INVERSIONES/docker-compose.prod.yml" "$B/repo/.git/config" "$B/repo/.git/hooks" "$B/inv-008.conf" \( ! -user root -o -perm -0020 -o -perm -0002 -o -type l \) -print
sudo find "$B/.env.inversiones.production" -maxdepth 0 \( ! -user root -o -perm -0040 -o -perm -0004 -o -perm -0020 -o -perm -0002 -o -type l \) -print
```

**La carpeta de respaldos** `<respaldos>/` ya existe y **no se toca**: la montó el CEO de PI, como `root:respaldo` en 750. Su ruta va en `inv-008.conf`.
- Los archivos de Inversiones quedan ahí `root:respaldo` en 0640, como pidió.
- Para eso, el contenedor `inv-008-respaldo` corre como `0:<gid de respaldo>`: root **del contenedor**, sin ninguna capacidad. Es la única excepción a «no root» (capas-pi.md #4).
- Lo único que hace falta es el gid numérico del grupo `respaldo`:
  ```sh
  getent group respaldo | cut -d: -f3      # → INV_RESPALDO_GID del archivo de producción
  ```

**El archivo de producción.**
- Las claves se generan en el VPS y van directo al archivo, sin pasar por la pantalla ni por el historial.
- `openssl rand -hex` deja solo letras y números, que van en la URL sin codificar. `crear-roles-prod.sh` acepta solo letras, números y `. _ ~ -`, de 32 o más caracteres.
```sh
sudo sh -c 'umask 077; f=<raíz>/.env.inversiones.production; {
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
- `INV_CIFRADO_CLAVE_ACTIVA`: `v<n>` (p. ej. `v1`), con su `INV_CIFRADO_CLAVE_V<n>` en el archivo (lo lee `src/cifrado/llavero.ts`, líneas 3-4);
- `INV_AGE_PUBLICA`;
- `INV_TELEGRAM_BOT_TOKEN` e `INV_TELEGRAM_CHAT_ID`: son **el mismo bot y el mismo chat de las tareas programadas** (decisión de Jelk).
  - Los pone **Jelk**, o un script que él corre, sin que pasen por el chat ni por un log.
  - La Fábrica no los lee: ni en pruebas ni en scripts se toca `~/.config/odin/`.

**`INV_PRECIOS_DATABASE_URL`, el rol `inv_precios` del servicio de precios.** **El rol existe desde que Jelk corre `crear-roles-prod.sh` una vez** (decisión del CEO): el script lo crea siempre, y la línea solo decide si entra.
- **Sin la línea,** `crear-roles-prod.sh` deja `inv_precios` **NOLOGIN y sin clave**, también si antes tenía LOGIN, y lo avisa. Quitar la línea lo desactiva; las conexiones abiertas siguen hasta que se cierren.
- **Con la línea,** le da LOGIN y su clave en una sola sentencia, por la entrada estándar. Con la línea vacía o mal formada, aborta sin tocar Docker (y tampoco rota las otras dos claves).
- **Mientras el rol no exista** (nadie corrió el script desde este cambio), el migrador omite sus permisos con un aviso y el despliegue sigue igual: no depende de `crear-roles-prod.sh`, que maneja secretos y solo corre Jelk.
- **Formato:** `postgresql://inv_precios:<clave>@inv-008-db:5432/inversiones?connection_limit=2`, con una clave de `openssl rand -hex 32` distinta de las otras dos.
- **La agrega Jelk en el VPS, sin verla,** cuando este cambio ya esté desplegado. Agrega la línea solo si no existe, con salto de línea previo si al archivo le falta; si `openssl` falla, no escribe nada. Deja el archivo en 600:
  ```sh
  sudo sh -c 'umask 077; f=<raíz>/.env.inversiones.production; if ! grep -q "^INV_PRECIOS_DATABASE_URL=" "$f"; then k="$(openssl rand -hex 32)" && [ ${#k} -eq 64 ] || { echo "openssl falló: no se escribió nada"; exit 1; }; [ -z "$(tail -c1 "$f")" ] || echo >> "$f"; printf "INV_PRECIOS_DATABASE_URL=postgresql://inv_precios:%s@inv-008-db:5432/inversiones?connection_limit=2\n" "$k" >> "$f"; fi; chmod 600 "$f"; stat -c "%a %U" "$f"; grep -cx "INV_PRECIOS_DATABASE_URL=postgresql://inv_precios:[0-9a-f]\{64\}@inv-008-db:5432/inversiones?connection_limit=2" "$f"'
  ```
  - Debe imprimir `600 root` y `1`. La clave no sale en pantalla ni en el historial.
  - Si imprime `0`, la línea ya estaba con otro formato y el comando no la tocó. `crear-roles-prod.sh` abortaría con ella: corríjala con `sudo nano`, sin mostrar la pantalla.
- **Después,** `sudo <raíz>/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh`. Debe decir «creando o actualizando inv_dueno, inv_app e inv_precios (con su clave; claves por stdin)» y `roles listos: inv_app, inv_dueno, inv_precios`. Sin la línea dice «(sin LOGIN)» en los dos mensajes.
- **Los permisos de tablas llegan con el siguiente despliegue que corra el migrador** (no con `--sin-migrar`): los da `privilegios.sql`. Hasta entonces `inv_precios` no lee nada.
- **Lo que puede escribir lo acotan disparadores** (migración `20261121231049_precios_integridad`, para todo rol que no sea dueño de las tablas):
  - un cierre VERIFICADO solo si cuadra (±1 %) con la certificación de A&V de ese día, y con su referencia y su desviación exactas;
  - solo la fuente del servicio (`yahoo` o la SFC), sin precios ni valores fuera del rango del código (también NaN) ni días futuros;
  - `traidoEn` y `reemplazadoEn` los pone la base; solo se retira un vigente, nunca se reabre, se vuelve a fechar ni se borra.
  - el guardián del esquema detiene el despliegue si `inv_app` o `inv_precios` llegan a ser miembros del dueño de esas tablas (eso los eximiría).
  - **Riesgo residual:** con su clave, un precio falso dentro del ±1 % de la valoración de A&V entra como VERIFICADO (la base lo recalcula con el precio que recibe); se pueden insertar precios falsos NO_VERIFICADO, también en días con certificación y de cualquier instrumento; retirar vigentes de cualquier fuente, también en masa y sin sucesor (la historia queda, pero la valoración se queda sin cierre), e insertar valores de unidad falsos dentro del rango de la SFC. La base no puede comparar contra Yahoo ni contra la SFC.
- **Restauración (§6):** desde que el rol existe, los respaldos traen sus GRANT, y `pg_restore --exit-on-error` se detendría en el primero si el rol faltara. Como `crear-roles-prod.sh` lo crea siempre (NOLOGIN sin la línea), la restauración ya no depende de la línea, y la restauración trimestral del Mac no necesita una URL ficticia. Se ensayó en `inv-008-prueba`: con el rol NOLOGIN, `pg_restore` sale con 0; sin el rol, se detiene.
- **Para cortarle el acceso:** quitar la línea y correr `crear-roles-prod.sh` (queda NOLOGIN y sin clave), o rotar su clave.

**Clave de `age`.** Se genera en el Mac. La **privada** va directo al gestor de contraseñas de Jelk y **nunca** va al VPS. Al VPS solo va la **pública** (`age1…`).
```sh
docker run --rm --entrypoint age-keygen inv-008-vigia:<sha>
#   «# public key: age1…»  → INV_AGE_PUBLICA
#   «AGE-SECRET-KEY-1…»    → gestor de contraseñas de Jelk (no se guarda en disco)
```

**Rotación:**
- **Cuándo:** todas las claves una vez al año y ante cualquier sospecha.
- **Claves de los roles** (también la de `inv_precios`): se cambian en el archivo y se corre `crear-roles-prod.sh`.
- **`INV_AUTH_SECRET`:** rotarlo cierra las sesiones.
- **Claves de cifrado (`INV_CIFRADO_CLAVE_V<n>`) y el TOTP:**
  - `scripts/cifrar-existentes.ts` re-cifra `crudo` y `encargo`, pero no conoce `usuario.totpSecreto`.
  - El secreto TOTP del dueño se re-cifra con la clave activa cada vez que entra con el código de la app (y cuando enrola o regenera los códigos). Entrar con un código de recuperación no lo re-cifra.
  - Por eso **una clave vieja no se retira hasta que el dueño haya entrado con el código de la app después de rotar**.
  - Si se retira antes, el segundo factor deja de verificar. La salida es `crear-acceso-inicial.sh --email <correo> --reiniciar-totp` y enrolar de nuevo antes de 30 minutos.
- **Token de Telegram:** si se rota, se actualiza en el Mac (`~/.config/odin/`, lo hace Jelk) y en el VPS. Después se recrea solo el vigía:
  ```sh
  sudo env INV_TAG=$(sudo cat <raíz>/estado/sha-actual) $COMPOSE up -d --no-deps inv-008-vigia
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
3. **Enviar directo a `<raíz>/imagenes/`**, sin pasar por `/tmp`, con el usuario de SSH del VPS:
   ```sh
   rsync -a --rsync-path="sudo rsync" ~/inv-008-envio/inv-008-<sha>.tar* <usuario>@<vps>:<raíz>/imagenes/
   ```

**Integridad.** Son dos almacenes de containerd, y la imagen se compara así, sin confiar en el `.Id` entre máquinas:
- **(a) El `.tar`:** su sha256 se calcula en el Mac y se verifica en el VPS antes de `docker load`. Lo hace `--cargar`. En el Mac, `docker save` dio el mismo sha256 dos veces.
- **(b) El `manifest.json` del `.tar`:** debe traer solo `inv-008-app`, `inv-008-migrador` e `inv-008-vigia` del mismo sha.
- **(c) El disco:** debe haber 15 GB más dos veces el tamaño del `.tar` libres.
- **(d) Las imágenes:** las tres deben tener `revision == <sha>`.
- **(e) El contenedor:** `docker inspect` de la app debe dar `.Image` igual a la imagen cargada.

## 4 · Primer despliegue (en el VPS, en este orden)
0. **Escribir `<raíz>/inv-008.conf`** (§2), si todavía no existe.
1. **Poner el clon en el sha:**
   ```sh
   sudo git -C <raíz>/repo fetch && sudo git -C <raíz>/repo checkout <sha>
   ```
2. **Crear los roles:** `sudo <raíz>/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh`
   - Levanta solo la base y le pasa las claves a `psql` por la entrada estándar.
   - `inv_dueno` queda dueño de todo. Las funciones que cree no son ejecutables por PUBLIC.
   - `inv_app` solo lee, más las escrituras del login, por columna:
     - `usuario`: UPDATE de `claveHash`, `sesionVersion` y `bloqueadoHasta`, y del TOTP (`totpSecreto`, `totpActivadoEn`, `totpUltimoPaso`, `presesionHash`);
     - `token_acceso`: UPDATE de `usadoEn`;
     - `intento_ingreso`: INSERT;
     - `codigo_recuperacion`: INSERT, y UPDATE de `usadoEn` y `anuladoEn` (nunca DELETE).
   - `inv_precios`, si el rol existe (desde la primera corrida de `crear-roles-prod.sh`, §2). Todo por columna, con lo que usan `precios:actualizar` y `actualizar-fondo`:
     - lee las especies y los fondos de `instrumento`, de `lote` solo `instrumentoId` (qué especies tienen lote), los símbolos y clases, el calendario, y de la certificación solo la fecha de corte y el precio de valoración;
     - `precio_cierre` y `valor_unidad_fondo`: INSERT sin `reemplazadoEn` (lo que inserta nace vigente) y UPDATE solo de `reemplazadoEn`;
     - nada de usuario, órdenes, filas crudas, cantidades ni costos; sin DELETE ni TRUNCATE.
     - lo que escribe lo acotan los disparadores de `20261121231049_precios_integridad` (§2): un VERIFICADO solo si cuadra con la certificación del día, nada de reabrir, volver a fechar ni borrar. **Riesgo residual** (detalle en §2): un precio falso dentro del ±1 % entra como VERIFICADO; precios falsos NO_VERIFICADO de cualquier día e instrumento; retiros de vigentes, también en masa; valores de unidad falsos dentro del rango.
   - Esos permisos los aplica el migrador. Los de `inv_precios` se omiten, con un aviso, mientras el rol no exista.
3. **Desplegar:**
   ```sh
   sudo <raíz>/repo/008-2026-INVERSIONES/scripts/desplegar-prod.sh <id-imagen> \
     --cargar <raíz>/imagenes/inv-008-<sha>.tar <sha256-del-Mac>
   ```
   - Solo cuenta como desplegado si la **última línea** es `DEPLOY VERIFICADO <sha>`. Tarda unos 10 minutos.
   - **El despliegue se niega si** existe la marca de pausa, si PI tiene el candado común o si se ve un despliegue de PI. El `deploy-prod.sh` de PI toma el mismo candado (SPEC-980 de PI) y espera hasta 900 s.
   - Si la app sale o se reinicia (`instrumentation.ts` sin `AUTH_SECRET` o sin `APP_ORIGEN`), falla.
   - **Si migra, la app vieja queda abajo** desde antes del respaldo previo hasta que la versión nueva queda healthy. Durante el migrador también se detiene el respaldo diario. Así ningún contenedor de Inversiones retiene tablas mientras migra. Con `--sin-migrar` no se detiene nada.
   - **Ventana conocida:** entre el respaldo previo y la detención del respaldo diario, el diario podría arrancar si justo le toca. La detención lo corta antes del migrador: no queda texto plano y su `.parcial` se borra en un respaldo posterior, pasados 60 minutos. El diario se hace después, porque ese día no quedó marcado.
   - **Después del `up`** exige, antes de dar nada por bueno:
     - la app y la entrada corriendo de una vez y con la imagen enviada;
     - `/api/salud` con la versión del sha, pedido **dentro de la entrada** (el camino del túnel) y, en producción, también en `127.0.0.1:5008` del host;
     - la app y la base sin puertos y solo en redes `internal` con la puerta de enlace aislada (revisa cada red);
     - **la app sin salida a internet**: la entrada resuelve la sonda (`api.telegram.org`, el único destino de 008 hacia afuera) y llega a su IP por el 443 (control positivo); desde la app, la misma IP falla por **falta de ruta** y el nombre no resuelve. Un tiempo agotado o un rechazo no cuentan como prueba: el despliegue se detiene.
   - Si falla después de tocar contenedores (incluida esa pausa), **vuelve solo a la imagen que corría**: levanta app, entrada, vigía y respaldo con ese sha, con el compose del clon. Si se re-desplegaba el mismo sha, levanta otra vez ese mismo.
     - Solo vuelve a un sha de 40 hex: si `estado/sha-actual` está dañado, lo dice y no levanta nada.
     - En el primer despliegue no hay imagen a la que volver: lo dice, y lo detenido queda abajo.
4. **Acceso inicial, que es también la recuperación de acceso.** Lo corre **Jelk por SSH**, no la Fábrica, y **antes de cargar los datos reales**:
   ```sh
   sudo <raíz>/repo/008-2026-INVERSIONES/scripts/crear-acceso-inicial.sh --email <correo> [--reiniciar-totp]
   ```
   - Corre `crear-acceso-inicial.ts` en el migrador, con `inv_dueno` y `APP_ORIGEN`.
   - Imprime **una vez** `${APP_ORIGEN}/definir-clave#t=<token>`. No se guarda en ningún archivo; `run --rm` borra el log del contenedor al terminar.
5. **Verificar el login** en `127.0.0.1:5008` (la entrada, hasta la app): sin sesión, la app redirige a `/ingresar` y las API responden 401.
   ```sh
   curl -sI http://127.0.0.1:5008/ | head -3
   ```
6. **Primer respaldo, antes de cargar los datos reales:**
   ```sh
   sudo <raíz>/repo/008-2026-INVERSIONES/scripts/respaldar-base.sh --motivo primero
   ```
7. **Cargar los datos del dueño: vía B, la importación fresca (§11).**
   - Va después de la prueba de restauración y del acceso inicial con su TOTP. Es el orden obligatorio con Jelk.
   - El volcado de solo datos (vía A) **no se usa** (§12).
8. **Abrir el túnel** (sección 8): lo aplica el coordinador con el CEO de PI. **Al final.**
9. **Anotar** el sha en `ESTADO.md` de la gestión.

## 5 · Despliegues siguientes y reversa
- **Siguiente versión:** pasos 3 y 4.0–4.3.
  - **La primera versión que deriva la raíz** (sin rutas escritas en el repo) necesita `<raíz>/inv-008.conf` **antes** de poner el clon en su sha. Sin ella, `desplegar-prod.sh` se niega sin tocar nada.
  - Ese despliegue recrea `inv-008-respaldo` (cambió la forma de su bind) e `inv-008-vigia` (recibe la ruta de la pausa).
  - El script se niega a migrar hacia atrás: el sha nuevo debe descender del que corre.
  - Conserva la imagen y el `.tar` actuales y anteriores, y purga solo las `inv-008-*` viejas.
- **Reversa por etiqueta, sin migrar y sin consultar GitHub** (sirve con GitHub caído). Acepta la imagen actual o la anterior. **El clon NO se mueve:** se queda en el sha que corre (`estado/sha-actual`) y solo la imagen vuelve atrás:
  ```sh
  sudo <raíz>/repo/008-2026-INVERSIONES/scripts/desplegar-prod.sh "inv-008-app:$(sudo cat <raíz>/estado/sha-anterior)" --sin-migrar
  ```
  - **Cambio de contrato (frente app-sin-salida):** antes, la reversa exigía el clon en el sha de la imagen. Ahora `verificar_clon` acepta, solo con `--sin-migrar`, el clon en el sha que corre y una imagen anterior (su sha es ancestro del clon). Es la misma combinación que ya usaba la vuelta atrás automática: la imagen vieja con el compose nuevo. Así la reversa nunca vuelve a una topología vieja.
  - **Por qué:** con el clon en un sha de antes de la entrada, el compose viejo vuelve a publicar el 5008 en la app mientras la entrada (huérfana) lo tiene tomado. Medido en el Mac: el primer `up` falla con el sitio caído, y un segundo `up` deja la app `healthy` y con éxito aparente, pero sin puerto y solo en la red interna (sitio caído). `desplegar-prod.test.ts` prueba que la reversa a un sha anterior al cambio deja el sitio arriba.
  - **Si el clon ya se movió a un sha de antes de la entrada** (el script de ese sha no conoce la entrada): primero, con el clon todavía en el sha nuevo, `sudo $COMPOSE rm -sf inv-008-entrada`; después la reversa; al final, verificar por el túnel (§4.5). La red `inv-008-prod_inv-008-red-entrada` queda huérfana hasta un `down` con el compose nuevo.
  - Una reversa a un sha de antes de la raíz derivada debería servir: esos scripts usan las mismas carpetas físicas, y `inv-008.conf` no les estorba. **Por verificar:** el código anterior no está en este clon.
- **El primer despliegue con la entrada** (la app sale de `inv-008-red`):
  - **Antes:** quien tiene acceso al VPS confirma que el pool de direcciones de Docker tiene una subred libre: la red nueva `inv-008-red-entrada` toma una. Si no hay, falla el `up` y también la vuelta atrás, que usa el mismo compose. Dato: <ver ESTADO en la gestión>.
  - El `up` recrea la app (sin puerto y con sus redes nuevas) y crea la entrada después de que la app queda `healthy`. En el Mac, el corte del cambio fue de unos 4 s. Si migra, la app ya estaba abajo desde el respaldo previo.
  - **Las redes de antes se recrean con un `down` SIN `-v`.** `inv-008-red-interna` cambia sus `driver_opts` (el aislamiento), y Compose no recrea en su lugar una red con contenedores conectados: en el ensayo, el `up` falló («container … is not connected to the network»), la vuelta atrás también, y el sitio quedó caído. Por eso `desplegar-prod.sh` detecta las redes internal que ya existen sin aislar y, después de validar la carpeta de respaldos y de revisar otra vez a PI, hace primero `$COMPOSE down` (sin `-v`: el volumen de la base y los respaldos quedan); el `up` las crea nuevas. Desde ese `down`, la vuelta atrás levanta todo otra vez si algo falla.
  - **Corte de minutos, una sola vez:** ese despliegue baja todo Inversiones, la base incluida, desde el `down` hasta que la versión nueva queda `healthy`: el respaldo previo, el migrador y los `up --wait` (hasta 180 s cada uno). No son los ~4 s del cambio de la entrada. Hágalo en una ventana avisada. Una reversa con `--sin-migrar` que encuentre redes viejas también hace ese `down`.
  - **Después del `checkout`, lo primero es `desplegar-prod.sh`.** Los otros scripts que levantan contenedores (`crear-roles-prod.sh`, `crear-acceso-inicial.sh`, `cargar-prod.sh`) se corren después de ese despliegue, con las redes ya nuevas.
  - La versión de Compose del VPS: **por verificar** (<ver ESTADO en la gestión>); el ensayo usó la 5.3.1.
  - El túnel no cambia: sigue entrando a `127.0.0.1:5008`. No se reinicia nada del host.
  - **Verificación a mano después** (además de lo que verifica el script):
    ```sh
    docker port $(sudo $COMPOSE ps -q inv-008-entrada) 5008   # 127.0.0.1:5008
    docker port $(sudo $COMPOSE ps -q inv-008-app)            # vacío
    for r in inv-008-red-interna inv-008-red-entrada; do sudo docker network inspect -f '{{.Internal}} {{index .Options "com.docker.network.bridge.gateway_mode_ipv4"}}' inv-008-prod_$r; done   # true isolated, las dos
    sudo docker exec $(sudo $COMPOSE ps -q inv-008-app) nslookup -type=a api.telegram.org   # sin respuesta (SERVFAIL)
    sudo docker exec $(sudo $COMPOSE ps -q inv-008-vigia) curl -sS -o /dev/null -w '%{http_code}\n' --max-time 10 https://api.telegram.org/   # 302: el vigía sí sale
    curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<dominio de la app>/              # 307 …/ingresar
    curl -s -w ' %{http_code}\n' https://<dominio de la app>/api/no-existe                            # 401
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
  - deja `<respaldos>/inv-008-AAAAMMDD-HHMMSS[-semanal|-<motivo>].dump.age` con su `.sha256`, los dos `root:respaldo` en 0640;
  - el texto plano nunca toca el disco: si algo falla, no queda ningún archivo.
- **Retención:** 14 diarios, 8 semanales (los del domingo) y 5 extras.
- **Respaldo ya:** `respaldar-base.sh [--motivo x]`. Se lo pide al contenedor y verifica el archivo y su sha256. El despliegue lo corre antes de migrar.
- **Un respaldo a la vez.** El manual (`exec … --ahora`) y el diario corren en el mismo contenedor y comparten un candado (`flock` sobre `/run/respaldo/respaldo.candado`, que se suelta solo si el proceso muere):
  - el manual espera hasta 600 s (`RESPALDO_ESPERA_S`) y, si no lo consigue, sale con 75 sin tocar nada;
  - el diario no espera: lo intenta en el minuto siguiente, sin contarlo como fallo;
  - la marca de fallo de `pg_dump` y el `.parcial` llevan el PID, y un respaldo nunca se sobrescribe: si el nombre ya existe, toma el segundo siguiente;
  - si falla un paso después del cifrado (mover, `.sha256`, grupo o permisos), no queda nada a medias y no cuenta como respaldo: el diario lo reintenta en 15 minutos;
  - los `.parcial` de más de 60 minutos (un respaldo cortado a mitad) se borran en el respaldo siguiente.
- **Copia fuera del VPS:** la hace la **infraestructura de IDC**, que copia `<respaldos-IDC>/` completo al Mac cada día. Inversiones no configura nada para eso.
- **Restauración, siempre con la clave privada fuera del VPS.** La clave sale del gestor de contraseñas de Jelk y entra a `age` por la entrada estándar (`age -d -i -`), nunca en un archivo. Hay dos casos.

**(A) Volumen nuevo, o el VPS perdido.** Con el VPS perdido, primero la §2 completa, incluida `inv-008.conf`. En el VPS:
```sh
$COMPOSE up -d --wait inv-008-db                           # la base nace vacía (POSTGRES_DB)
sudo <raíz>/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh   # crea también inv_precios (NOLOGIN sin su línea): sin él, pg_restore se detendría en sus GRANT
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
```
- Use la imagen del sha que corría al tomar el respaldo, o una posterior. El guardián de una imagen anterior a una migración del respaldo se detiene: ve sus objetos como sobrantes (p. ej., los disparadores de `…_precios_integridad`).
```sh
sudo env INV_TAG=<sha> $COMPOSE up -d --wait                    # app, entrada, vigía y respaldo (necesita $R: ver §1)
```

**(B) Reemplazar una base existente.** Antes, un respaldo previo, con la app todavía arriba: `sudo <raíz>/repo/008-2026-INVERSIONES/scripts/respaldar-base.sh --motivo pre-reemplazo`. El `DROP` no tiene vuelta atrás.
1. `$COMPOSE stop inv-008-app inv-008-vigia inv-008-respaldo`
2. `$COMPOSE exec -T inv-008-db psql -U postgres -c 'DROP DATABASE inversiones WITH (FORCE)' -c 'CREATE DATABASE inversiones OWNER inv_dueno'`
3. Seguir como en (A) desde `crear-roles-prod.sh`.

**Prueba de restauración mensual** (y la primera, antes de retirar el chat de inversiones, D-013). La corre **Jelk en la Terminal de macOS**. Así la corrió el 2026-11-21, y funcionó.
- **Dónde va la clave:** siempre en la Terminal de macOS, **nunca en una sesión de Claude ni en un chat**, ni siquiera un fragmento.
- **Qué clave es:** la clave maestra de los respaldos, **la misma de PI y BI**. Si se expone, hay que volver a cifrar los respaldos de los tres productos.
- **Cómo entra:** sale del gestor de contraseñas al portapapeles y entra por la entrada estándar (`pbpaste`). Nunca se guarda en un archivo.
- **Antes de copiarla:**
  - apague el **Portapapeles Universal** (Handoff, en Ajustes del Sistema → General → AirDrop y Handoff), para que no viaje a otros dispositivos de Apple;
  - pause cualquier gestor con historial del portapapeles (Raycast, Alfred, Paste…): `pbcopy < /dev/null` solo vacía el portapapeles actual, no ese historial.
- **La sesión:** use una pestaña nueva de la Terminal y ciérrela al terminar. Así no quedan activos `umask`, `V` ni `D`.
- **Qué prueba:** que la clave abre el respaldo y que `pg_restore` lo lee entero. Solo imprime conteos.
- **Lo que no prueba:** la restauración real en una base, con la app respondiendo `ok`. Esa es la prueba fuerte.
- **Frecuencias** (decisión del CEO, 2026-11-21; la agenda, en `ESTADO.md` de la gestión):
  - **Mensual:** esta prueba ligera, abrir la clave y leer el respaldo, con conteos.
  - **Trimestral:** la restauración real del caso (A) en un proyecto de prueba del Mac, con los conteos por tabla iguales y la app respondiendo `ok`. La primera, antes de 2027-02-21.
  - **Caso (B):** se prueba cuando cambie el esquema de respaldo.

1. **Carpeta de trabajo, en el home y en 700.**
   - **Por qué en el home:** Docker Desktop no ve `/private/tmp` ni el `TMPDIR` de macOS. Si la carpeta ya existe, de un intento anterior, bórrela primero (paso 4).
   - **El sha256** debe decir `OK`.
   - **Qué imagen:** `<sha>` es el que corre (`estado/sha-actual`) o cualquier otro retenido; la imagen del vigía de cada sha trae `age` y `pg_restore`.
   - **Si la imagen no está en el Mac** (`docker image inspect "$V"` falla), cárguela con `docker load -i` desde el `.tar` que guardó `construir-imagen.sh`, después de verificar su sha256. Si no, `docker run` intentaría bajarla de internet.
   - **La plataforma:** la imagen es amd64 y en el Mac corre emulada; el aviso de plataforma de Docker es normal.
   ```sh
   umask 077
   mkdir -m 700 ~/inv-008-restauracion && cp ~/<copia>/inversiones/inv-008-<fecha>.dump.age ~/<copia>/inversiones/inv-008-<fecha>.dump.age.sha256 ~/inv-008-restauracion/
   (cd ~/inv-008-restauracion && shasum -a 256 -c inv-008-<fecha>.dump.age.sha256)
   V=inv-008-vigia:<sha>
   D=(docker run --rm -i --network none --platform linux/amd64)
   ```
2. **Identificar la clave sin mostrarla.** Copie la clave del gestor y derive su pública. Debe ser igual a la pública de producción (`INV_AGE_PUBLICA`, <ver ESTADO en la gestión>).
   ```sh
   pbpaste | "${D[@]}" --entrypoint age-keygen "$V" -y
   ```
   - **Si `age-keygen` dice que la clave no es válida,** es porque el gestor la guardó sin el prefijo. En ese paso y en el siguiente, cambie `pbpaste` por `{ printf 'AGE-SECRET-KEY-'; pbpaste; }`.
   - **Al terminar, antes del paso 4,** guárdela completa en el gestor, con el prefijo.
3. **Verificar, solo con conteos y sin red.** `age` descifra, `pg_restore -f -` lee el respaldo entero y `awk` cuenta las tablas con datos y las filas de `orden` y `lote`, sin imprimir valores. Todo pasa por una tubería: el volcado en claro nunca toca el disco.
   ```sh
   pbpaste | "${D[@]}" -v ~/inv-008-restauracion:/r:ro --entrypoint sh "$V" -c \
     'set -o pipefail; age -d -i - /r/inv-008-<fecha>.dump.age | pg_restore -f - | awk '\''/^COPY /{t=$2;n=0;next} /^\\\.$/{if(t!=""){if(n>0)c++; if(t=="public.orden")o=n; if(t=="public.lote")l=n}; t="";next} t!=""{n++} END{if(c==0){print "FALLÓ: no se leyó ninguna tabla (vea el error de arriba)"; exit 1} printf "tablas con datos: %d · orden: %d · lote: %d\n",c,o,l}'\'' || echo "FALLÓ: la prueba no pasó"'
   ```
   - **Resultado bueno:** una sola línea `tablas con datos: … · orden: … · lote: …`, sin ningún `FALLÓ`, y los tres números iguales a los de producción en la fecha del respaldo. Esos números los da el CEO desde la base, o salen de `ESTADO.md` si ese día no hubo cargas.
   - **Cualquier `FALLÓ`, aunque haya números,** es una prueba fallida.
   - **Si `age` falla,** la clave no corresponde a ese respaldo.
   - **Si `pg_restore` falla,** el archivo está dañado: se prueba con otro respaldo y se avisa al CEO.
4. **Limpiar el portapapeles y la carpeta**, aunque algún paso haya fallado. Después, cierre la pestaña.
   ```sh
   pbcopy < /dev/null
   rm -rf ~/inv-008-restauracion
   ```
5. **Anotar** en `ESTADO.md` la fecha, el respaldo usado y el resultado. Solo conteos.

## 7 · Las imágenes no traen secretos
```sh
docker history --no-trunc inv-008-app:<sha> | grep -Ei 'password|secret|clave|token|postgresql://' || echo "historial sin secretos"
docker image inspect -f '{{json .Config.Env}}' inv-008-app:<sha>
docker run --rm --entrypoint sh inv-008-app:<sha> -c 'find / -xdev \( -name ".env" -o -name ".env.*" \)'   # vacío
```
Las mismas tres revisiones valen para `inv-008-migrador` e `inv-008-vigia`.

## 8 · Túnel de Cloudflare (aplicado el 2026-11-21)
**Estado:** lo aplicó el coordinador con el CEO de PI el 2026-11-21: el ingress de `inversiones` y el CNAME. Lo reportó el coordinador; ningún script de Inversiones toca el túnel. El respaldo de la configuración anterior: <ver ESTADO en la gestión>.

| Dato | Valor (repo público: todos en el ESTADO de la gestión) |
|---|---|
| Túnel | `<id-del-túnel>` |
| Servicio del host y cómo arranca | `<servicio-del-túnel>` |
| Configuración | `<config-del-túnel>` |
| Certificado | `<certificado-del-túnel>` |

**Cómo se aplicó** (para repetirlo en un VPS nuevo), siempre en una ventana acordada con el CEO de PI y **solo con el login verificado**:
1. **Antes:** guardar el código HTTP de PI, BI y piweb:
   ```sh
   for h in pi bi piweb; do printf '%s ' $h; curl -sI https://$h.innovadataco.com | head -1; done
   ```
2. **Respaldo:** `sudo cp <config-del-túnel> <config-del-túnel>.bak-inv-$(date +%Y%m%d)`
3. **Las dos líneas.** Se agregan justo antes de `- service: http_status:404`, sin tocar ninguna otra:
   ```yaml
     - hostname: inversiones.innovadataco.com
       service: http://127.0.0.1:5008
   ```
   El `diff` contra el respaldo debe mostrar solo esas 2 líneas, y no debe haber una regla comodín antes.
4. **Validar:** `sudo cloudflared tunnel ingress validate --config <config-del-túnel>`
5. **DNS:** con `<certificado-del-túnel>`, y después de verificar que no exista un registro `inversiones`:
   ```sh
   sudo cloudflared tunnel route dns <id-del-túnel> inversiones.innovadataco.com
   ```
6. **Avisar al CEO de PI ANTES** de `sudo systemctl restart <servicio-del-túnel>`, que corta unos segundos a todo lo que pasa por el túnel (PI, BI, piweb y los demás hostnames).
7. **Después:**
   - repetir el paso 1: si cambia cualquier código, se revierte de inmediato;
   - `curl -I https://inversiones.innovadataco.com` debe llevar a `/ingresar`.

**Reversa** (con el CEO de PI avisado, por el mismo corte de unos segundos):
```sh
sudo cp <respaldo-de-la-config-del-túnel> <config-del-túnel> && sudo systemctl restart <servicio-del-túnel>   # <ver ESTADO en la gestión>
```
Después se repite el paso 1. El CNAME `inversiones` queda en el DNS hasta que se borre aparte.

## 9 · Ensayo local (cómo se probó sin el VPS)
- **Proyecto:** `inv-008-prueba`. Solo corre en el Mac o en el CI, nunca como root, y nunca desde un clon cuya raíz derivada tenga el archivo de producción (el VPS).
- **Candado del ensayo:** quien lo usa toma el candado de carpeta acordado entre los frentes (`mkdir`) y lo suelta (`rmdir`) al terminar.
- **Override:** la entrada publica en otro puerto del Mac (nunca el 5008 ni el 5438) y el vigía apunta a un Telegram inexistente. Los respaldos van en una carpeta de prueba, por la misma `inv-008.conf` de la base de prueba.
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
- Cuatro de las 14 migraciones toman `SET LOCAL lock_timeout = '5s'`: `fk_restrict_indices`, `usuario_transiciones_checks`, `asignacion_coherente` y `precios_integridad`. La app vieja y el respaldo diario ya están detenidos mientras migra (§4.3). El `lock_timeout` queda para lo que el despliegue no controla, por ejemplo una sesión de `psql` abierta a mano: si algo retiene una tabla, el migrador falla rápido, se deshace y se sigue este mismo procedimiento.


## 11 · Carga de los datos del dueño: vía B, la importación fresca
**Decisión del CEO, tomada con un ensayo en el Mac** (ESTADO, 2026-11-21): la importación fresca se hace en la base de producción ya migrada, con los CLI de `main`. Cifra al escribir (0 filas en claro) y deja las cargas a nombre del dueño de producción.

**Antes de empezar (obligatorio):**
1. **El orden con Jelk** (ESTADO):
   1. la prueba de restauración del respaldo, con su clave privada;
   2. su acceso inicial (`crear-acceso-inicial.sh`, §4.4) y el enrolamiento del TOTP;
   3. recién entonces, la carga.

   El dueño ya existe cuando se carga. Por eso `--crear-dueno` **no se acepta en producción**: `inv-cargar` lo rechaza, y un correo mal escrito sale con 2 sin crear nada.
2. **Avisar al CEO de PI en una línea, por trazabilidad.** El candado común resuelve la exclusión: el `deploy-prod.sh` de PI lo toma (SPEC-980 de PI, activa), espera hasta 900 s y, si no lo obtiene, aborta limpio con salida 3. `cargar-prod.sh` lo toma sin esperar y se niega si PI lo tiene.
3. **Respaldo previo:** `sudo <raíz>/repo/008-2026-INVERSIONES/scripts/respaldar-base.sh --motivo pre-carga`.

**Quién y cómo.**
- **Quién:** la corre **Jelk**, o quien él designe, con la Fábrica guiando. La Fábrica nunca lee los archivos del dueño.
- **Cómo:** cada paso sale del Mac con un sobre por SSH, y en el VPS no queda ninguna copia:
  ```sh
  scripts/armar-sobre.sh <cabecera-privada> [<archivo>] | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh <comando>
  ```
- **Si el usuario de SSH no es root,** va `sudo -n` delante de la ruta. `cargar-prod.sh` no se eleva por sí mismo: no comprueba root.
- **La cabecera** es un archivo privado del Mac, junto a los datos del dueño. Lleva un argumento del CLI por línea, por ejemplo (valores inventados):
  ```text
  --email
  dueno@ejemplo.ficticio
  ```
  - Para un comando sin argumentos va vacía (`/dev/null`). También para `importar-precios` e `importar-valores-fondo`, que no llevan opciones.
  - Para uno con argumentos sin datos reales, sirve `<(printf '%s\n' --ensayo)`.
  - Los valores reales nunca se escriben en la línea de comandos: quedarían en el historial.
- **En la línea de comandos del VPS solo va el nombre del comando**, de una lista cerrada. Nada real queda en el registro de sudo ni en `ps` del host.
- **`armar-sobre.sh`:**
  - agrega el tamaño y el sha256 del archivo: si el SSH se corta, el contenedor lo detecta y no carga nada;
  - se niega a escribir en una terminal.
- **`cargar-prod.sh` (host):**
  - toma los dos candados, se niega con la marca de pausa o con PI desplegando, y usa el sha de `estado/sha-actual`;
  - pasa el sobre **intacto** al migrador (`run --rm -T --no-deps … inv-cargar <comando>`) y no escribe nada en disco.
- **`inv-cargar` (contenedor):**
  - comprueba que el contenedor no use swap;
  - deja el archivo en un temporal 600, en una carpeta 700 del tmpfs `/tmp`;
  - corre el CLI y borra el temporal **siempre**, también si el CLI falla o llega una señal;
  - sin volcados de memoria (`ulimit -c 0` y `ulimits core: 0`).
- **Salida:** solo conteos y códigos, como los CLI.
  - La carga sale con el código del CLI: 0 bien; 1, 2 o 3 según cada CLI.
  - Con **64** si `inv-cargar` se niega sin correr el CLI (uso, correo, swap, tamaño o sha256 del archivo): es distinto de los códigos de los CLI.
  - Con **1** si `cargar-prod.sh` se niega antes de correr (marca de pausa, candado común tomado o PI desplegando, sin sha registrado, comando fuera de la lista, árbol de root). El mensaje empieza por `[cargar-prod]`.
- **Riesgo residual aceptado por el CEO:**
  - qué: los parámetros (correo, especies, cifras de `registrar-escision` y `lote-escision`, código, clase y nombre del fondo de `registrar-fondo`; correo, código del fondo, fecha, unidades y monto de `registrar-movimiento-fondo`) van en el argv del CLI **dentro** del contenedor, y root los ve con `ps` mientras corre;
  - no quedan en disco salvo que se active la auditoría de `execve` del host;
  - además, el sobre pasa por la memoria del host (sshd, el cliente de Docker y dockerd), que sí puede bajar al swap del host: el `memory.swap.max = 0` solo cubre el contenedor;
  - seguimiento: que los CLI lean sus parámetros desde stdin o desde un archivo.

**Orden.** Cada paso debe salir bien: si no, se para y se avisa al CEO de 008.

| # | Paso | `cargar-prod.sh` | Cabecera | Archivo |
|---|---|---|---|---|
| 1 | Órdenes de Trii | `importar-trii` | `--email` y el correo | el CSV de órdenes |
| 2 | Caja de Trii | `importar-trii` | igual | el CSV de caja |
| 3 | Una vez por escisión | `registrar-escision` | `--origen`, `--destino` y `--fecha`, más las opcionales | — |
| 4 | Dividendos, **después** de las escisiones | `importar-trii` | igual que 1 | el CSV de dividendos |
| 5 | Lotes | `construir-lotes` | vacía | — |
| 6 | Una vez por lote de escisión | `lote-escision` | `--destino`, `--fecha-evento`, `--cantidad` y `--costo-unitario` | — |
| 7 | Lotes otra vez | `construir-lotes` | vacía | — |
| 8 | La ficha, primero en ensayo | `importar-plan` | `--email` y el correo | la ficha |
| 9 | La ficha, aplicada | `importar-plan` | `--email`, el correo y `--aplicar` | la ficha |
| 10 | El fondo (FIC), una sola vez y antes de la certificación, que lo exige registrado | `registrar-fondo` | `--codigo` y su código de la SFC, `--participacion` y su clase (si la tiene), `--nombre` y el nombre | — |
| 11 | La certificación de A&V, que concilia y marca los cierres que faltan | `importar-certificacion` | `--email`, el correo, `--fecha-corte` y la fecha; `--fondo` y su código solo la primera vez | el PDF |
| 12 | Los valores de unidad del fondo, con el del día del corte | `importar-valores-fondo` | vacía (`/dev/null`) | el CSV de valores que exportó el Mac (abajo) |
| 12 bis | La constitución del fondo (unidades y aporte del extracto del FIC), una sola vez: primero en ensayo y después con `--aplicar` | `registrar-movimiento-fondo` | `--email` y el correo, `--fondo` y su código de la SFC, `--fecha` y el día, `--unidades` y `--monto` (abajo); `--aplicar` solo la segunda vez | — |
| 13 | Los precios, que se verifican al escribir contra la certificación ya cargada | `importar-precios` | vacía (`/dev/null`) | el CSV de cierres que exportó el Mac (abajo) |
| 14 | La conciliación otra vez, con los valores del fondo y los precios ya cargados | `conciliar-certificacion` | `--fecha-corte` y la fecha | — |

**El fondo (pasos 10 y 12).** Producción no tiene salida a internet: el migrador no llega a la SFC (datos.gov.co).
1. **Registrarlo (paso 10), por el sobre y sin red.** La cabecera (privada; valores inventados):
   ```text
   --codigo
   9990001
   --participacion
   907
   --nombre
   Fondo ficticio
   ```
   ```sh
   scripts/armar-sobre.sh <cabecera-del-fondo> | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh registrar-fondo
   ```
   - `inv-cargar` admite solo esas tres opciones, cada una una vez: `--codigo`, de 1 a 12 dígitos (el `codigo_negocio` de la SFC); `--participacion`, opcional, de 1 a 6 dígitos (el `tipo_participacion`: la SFC usa de 1 a 3, p. ej. `800`); `--nombre`, de 1 a 200 bytes, sin caracteres de control y sin «-» al inicio. El CLI manda: el nombre, hasta 120 caracteres.
   - Arma `--registrar --codigo … [--participacion …] --nombre …` para `scripts/actualizar-fondo.ts` (el mismo `registrarFondo` del Mac). Su modo con red (`--desde`, `--hasta`) no pasa: sale con 64.
   - Es idempotente: otra vez da «ya existía» y no cambia nada (tampoco el nombre). Con otra clase, sale con 1 y `CLASE_DISTINTA`.
2. **Los valores de unidad (paso 12): se exportan en el Mac del dueño y viajan en el sobre.**
   - **La SFC publica con T−2.** Verificado en el ensayo de este frente (un sábado): el último valor publicado de un fondo público era el del miércoles anterior. La conciliación usa **solo** el valor del día exacto del corte (regla del CEO): si todavía no está, el fondo queda en «sin valor de unidad al corte» (`sin_valor_unidad_al_corte`) y nunca se toma el de otro día. Se espera a que salga y se repiten los pasos 12 y 14.
   - **En el Mac, con red.** La lista de fondos (privada: dice qué fondo tiene el dueño) lleva una línea por fondo, `<codigo>,<participacion>` (o solo `<codigo>` si no tiene clase registrada); `#` comenta; hasta 10. La crea el dueño en su carpeta privada; que la Fábrica la saque de producción no está decidido (por decidir por el CEO Inversiones, como con los precios):
     ```sh
     umask 077
     npm run -s fondo:exportar -- --fondos <carpeta-privada>/fondos.txt --desde <fecha> > <carpeta-privada>/valores-fondo.csv.parcial \
       && mv <carpeta-privada>/valores-fondo.csv.parcial <carpeta-privada>/valores-fondo.csv
     ```
     - `-s`, el `.parcial` y el `&& mv`: igual que con los precios (abajo).
     - **`umask 077` es obligatorio:** el exportador se niega a escribir en una terminal y también en un archivo que otros pueden leer (`SALIDA_NO_PRIVADA`, salida 2, sin pedir nada a la SFC).
     - Pide a la SFC (`obtenerValores`, el de `actualizar-fondo`: sin redirecciones, con plazo y tope de bytes) en serie, con una pausa entre fondos; `--hasta` por defecto es hoy y el rango llega a 1830 días.
     - Por stderr, por línea de la lista: cuántos valores y el último día. **Si el último día es anterior al corte, el del corte aún no está publicado** (T−2).
     - Salida: 0 bien · 3 algún fondo quedó fuera (por su línea) o trajo valores de unidad inválidos (`SFC_VALOR_INVALIDO`; el CSV trae el resto) · 2 uso o lista ilegible · 1 lista inválida, sin valores o error.
   - **El CSV viaja por stdin, en el sobre:** `scripts/armar-sobre.sh /dev/null <carpeta-privada>/valores-fondo.csv | ssh <vps> …/scripts/cargar-prod.sh importar-valores-fondo`. `inv-cargar` lo deja en el temporal `valores-fondo.csv` (tope 2 MiB, sin opciones) y `importar-valores-fondo` (`npm run -s fondo:importar`) lo valida **entero** antes de abrir la base: con un error no guarda nada.
     - **Por el mismo camino que `actualizar-fondo`** (`src/fondo/guardar.ts`): fondos FIC activos, la misma fuente (`sfc:qhpu-8ixx`), versionado y lotes con reintento. Reimportar el mismo CSV no escribe nada.
     - Salida 3: un código sin fondo FIC activo (`FONDO_NO_REGISTRADO`, por su línea; no escribe nada de él: falta el paso 10), una clase distinta de la registrada (`CLASE_DISTINTA`), un fallo del guardado o un dato atrasado (`ATRASADO`: el último valor es de hace más de 7 días frente a hoy).
     - **Importe siempre un CSV recién exportado:** uno viejo vuelve a escribir los valores que trae, aunque la SFC los haya corregido después (la versión anterior queda en la historia).
   - **Formato exacto** (`src/fondo/csv-valores.ts`): solo ASCII imprimible y LF, sin BOM, CR, tabuladores ni comillas; el encabezado exacto `codigo_fic,participacion,fecha,valor_unidad,valor_fondo`; una línea por día, cada una terminada en LF, sin líneas vacías y de hasta 80 bytes:
     - `codigo_fic`: de 1 a 12 dígitos; `participacion`: vacía o de 1 a 6 dígitos, la misma en todas las líneas del fondo;
     - `fecha`: `20AA-MM-DD`, una fecha que existe y no es posterior a hoy;
     - `valor_unidad`: el decimal canónico que deja el lector de la SFC (sin ceros sobrantes, hasta 8 decimales, sin exponente), > 0 y ≤ 10 000 000;
     - `valor_fondo`: vacío o el decimal canónico (hasta 4 decimales);
     - ningún par (fondo, fecha) repetido; al menos una línea; hasta 20 000 líneas y 10 fondos.

     Ejemplo inventado:
     ```text
     codigo_fic,participacion,fecha,valor_unidad,valor_fondo
     9990001,907,2024-03-11,10001.25,500000000.1235
     9990001,907,2024-03-12,10002,
     ```
   - **Las unidades del fondo** (cuántas tiene el dueño) no las carga este paso: las registra el paso 12 bis (abajo). Sin ellas, el fondo queda en `fondo_sin_unidades` aunque el valor del corte esté. **El CSV de este paso debe cubrir también el día de la constitución** (`--desde` ese día o antes): el paso 12 bis lo exige.

**La constitución del fondo (paso 12 bis): las unidades y el aporte que dice el extracto del FIC.** Ningún archivo los trae: el CSV de caja de Trii solo tiene depósitos y retiros, y la certificación, el saldo al corte. Sin este paso, la conciliación dice `fondo_sin_unidades` (fondo) y `aporte_fic_sin_registrar` (efectivo).
1. **La cabecera** (privada; valores inventados). Las cifras, tal cual el extracto: punto decimal, sin miles; unidades hasta 8 decimales y monto (lo que salió de la caja, en COP) hasta 4. Una sola fecha: la del cargo en caja y la asignación de las unidades.
   ```text
   --email
   dueno@ejemplo.ficticio
   --fondo
   4613927
   --fecha
   2027-03-17
   --unidades
   1237.48215
   --monto
   5713946.2817
   ```
   ```sh
   scripts/armar-sobre.sh <cabecera-de-la-constitucion> | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh registrar-movimiento-fondo
   ```
   - **Primero sin `--aplicar` (ensayo):** valida todo contra la base y no escribe. Si sale 0, se agrega `--aplicar` como última línea de la cabecera y se repite.
   - `inv-cargar` admite solo `--email`, `--fondo` (de 1 a 12 dígitos), `--fecha` (`AAAA-MM-DD`), `--unidades` y `--monto` (dígitos con un punto, hasta 40 caracteres) y `--aplicar`, cada una una vez; las cinco primeras son obligatorias. Arma el argv de `scripts/registrar-movimiento-fondo.ts` en orden fijo. La precisión, el rango y la fecha los decide el CLI.
2. **Qué hace** (`src/fondo/movimiento.ts`, el único camino que escribe estas tablas): en una transacción, el ajuste de caja (−monto, `APORTE_FIC`, fuente `EXTRACTO`) y la `CONSTITUCION` del fondo enlazada, de la misma fecha. Es una sola por fondo y no se edita: la base no deja cambiarla ni borrarla.
   - **Contraste:** el monto debe ser unidades × el valor de unidad de la SFC **de ese mismo día**, con ±0,5 %. Si no cuadra (`MONTO_NO_CUADRA_CON_VALOR_UNIDAD`) o falta ese valor (`SIN_VALOR_UNIDAD_DEL_DIA`), se niega sin escribir nada. Se revisan en el extracto el día y el valor de unidad; no se fuerza.
   - Repetirla con los mismos datos da «ya estaba registrada» y no escribe. Con otros datos, `CONSTITUCION_DISTINTA`: no se cambia (la corrección, si hace falta, será un ajuste aparte que decide el CEO de 008).
3. **Salida:** 0 ensayo, registrada o ya existía · 1 error de la base · 2 datos inválidos · 3 rechazado (no escribió nada) · 64 si `inv-cargar` se niega. Con cualquier salida distinta de 0, el CLI termina con «Vía B: pare la carga y avise al CEO de 008». Nunca imprime las cifras, el correo ni el código del fondo: solo ids internos y códigos.

**Los precios (paso 13): se exportan en el Mac del dueño y viajan en el sobre.** Producción no tiene salida a internet: la app y el migrador no llegan a Yahoo.
1. **En el Mac del dueño, que sí tiene red,** se exportan los cierres. La lista de nemotécnicos (uno por línea; `#` comenta) la crea el dueño en su carpeta privada. **La Fábrica lo corre con los símbolos del portafolio solo con orden del CEO Inversiones** (decisión del CEO, 2026-11-21): saca la lista de producción (acción activa con lotes) sin imprimirla, la deja con el CSV en una carpeta 700 (`umask 077`) y la borra al terminar, junto con el CSV. Para la Fábrica, `<carpeta-privada>` es esa carpeta 700 que ella crea: nunca escribe en la carpeta privada del dueño. Con la misma orden corre también el paso 2:
   ```sh
   umask 077
   npm run -s precios:exportar -- --nemos <carpeta-privada>/nemos.txt --desde <fecha> > <carpeta-privada>/precios.csv.parcial \
     && mv <carpeta-privada>/precios.csv.parcial <carpeta-privada>/precios.csv
   ```
   - **`-s` es obligatorio:** sin él, npm escribe su encabezado en stdout y queda dentro del CSV (el importador lo rechaza por el encabezado). Sirve también `npx tsx scripts/exportar-precios.ts …`.
   - **El `&& mv`:** la shell crea el archivo aunque el exportador falle; con `.parcial` y `mv`, solo un CSV completo (salida 0) queda con su nombre. Con salida 3 (alguna especie quedó fuera, por su línea de la lista), el CSV de las demás es válido: se decide a conciencia si se usa (`mv` a mano) o se repite.
   - **El CSV no es público:** el conjunto de especies es la composición del portafolio. Va en `<carpeta-privada>`, con `umask 077`; nunca al repo. El exportador se niega a escribirlo en una terminal y por stderr solo da conteos, códigos y números de línea de la lista.
   - Pide `<NEMO>.CL` en serie, con una pausa entre pedidos; `--hasta` por defecto es hoy y el rango llega a 1830 días. Nunca deja una barra que aún no es definitiva **al exportar** (la de hoy antes de la hora).
2. **El CSV viaja por stdin, en el sobre,** como los demás archivos: `scripts/armar-sobre.sh /dev/null <carpeta-privada>/precios.csv | ssh <vps> …/scripts/cargar-prod.sh importar-precios`. `inv-cargar` lo deja en el temporal `precios.csv` (tope 4 MiB) y `precios:importar` lo valida **entero** antes de abrir la base: con un error no guarda nada.
   - «Todo o nada» es la validación. La escritura es por barra, como en `precios:actualizar`: si la carga se corta a mitad, queda lo guardado hasta ahí y repetir el mismo paso completa sin duplicar.
   - **Duración:** `cargar-prod.sh` tiene tomado el candado común mientras corre, y el deploy de PI espera hasta 900 s. En el ensayo de `inv-008-prueba` en el Mac (2026-11-21, migrador con `cpus: 0.5` y 256 MiB, datos inventados), 51 000 filas de 40 especies, unas 47 800 escrituras, tardaron 60 s, con 85 MiB de memoria como máximo; 3850 filas, 6 s. En el VPS falta medirlo: si la carga es grande, avise al CEO de PI antes.
3. **Formato exacto** (`src/precios/csv-cierres.ts`): solo ASCII imprimible y LF, sin BOM, CR, tabuladores ni comillas; el encabezado exacto `nemotecnico,fecha,cierre,volumen`; una línea por barra, cada una terminada en LF, sin líneas vacías y de hasta 80 bytes:
   - `nemotecnico`: `[A-Z0-9]{2,20}`;
   - `fecha`: `20AA-MM-DD`, una fecha que existe;
   - `cierre`: decimal canónico (sin ceros sobrantes, hasta 6 decimales, sin exponente), > 0 y ≤ 10 000 000;
   - `volumen`: vacío (Yahoo no lo trajo) o un entero ≥ 0 de hasta 15 dígitos;
   - ningún par (nemotécnico, fecha) repetido; al menos una fila; hasta 60 000 filas y 40 especies.

   Ejemplo inventado:
   ```text
   nemotecnico,fecha,cierre,volumen
   FICTA,2024-03-12,1234.5,800
   FICTA,2024-03-13,1240,
   ```
4. **Por el mismo camino que `precios:actualizar`:** mismas especies (acción activa con lotes), la misma fuente `yahoo`, versión con guarda, las omisiones de SPEC-13 (día no hábil y volumen 0 se omiten; el año sin calendario sale con 3) y la verificación contra la certificación del mismo día. Reimportar el mismo CSV no escribe nada.

**Qué esperar de cada paso:**
- **Un CSV por llamada:** el tipo (órdenes, caja o dividendos) sale del encabezado, no del nombre. El nombre que guarda la base es fijo (`trii.csv`): el nombre real no llega al VPS.
- **Antes de las escisiones,** `importar-trii` avisa que no hay eventos: es lo esperado en los pasos 1 y 2. En el paso 4 no debe salir.
- **`registrar-escision` con salida 3:** había dividendos importados como ordinarios. En la vía B no debe pasar: si pasa, se para.
- **`construir-lotes` con salida 3:** son avisos, no un error. En el paso 5 puede dar 3 por la escisión; en el 7 debe dar 0, o 3 con los avisos explicados.
- **`importar-plan` con salida 3:** había otra importación en curso: se reintenta.
- **`registrar-fondo` (paso 10):** imprime el id interno del fondo, «creado» o «ya existía» y la clase; nunca el código ni el nombre.
- **`importar-certificacion` (paso 11):** concilia al cargar; sin los cierres del día de corte, el valor sale `sin_precio_al_corte`, y el fondo, `fondo_sin_unidades` o `sin_valor_unidad_al_corte`. Es lo esperado: lo resuelven los pasos 12 a 14. Su «siguiente paso» en producción ya es este (vía B), no `precios:actualizar`.
- **`importar-valores-fondo` (paso 12):** imprime `CSV de valores del fondo · filas · fondos` y el reporte de `actualizar-fondo` (valores nuevos y revisados, el último dato de cada fondo por su id interno).
- **`registrar-movimiento-fondo` (paso 12 bis):** el ensayo imprime el id interno del fondo y «No se escribió nada»; con `--aplicar`, los ids del fondo, del movimiento y del ajuste de caja. Después, el fondo deja `fondo_sin_unidades` en la conciliación del paso 14, y el efectivo deja `aporte_fic_sin_registrar`: pasa a cuadrar o a `partida_sin_fuente`, la brecha que ningún archivo explica todavía.
- **`importar-precios` (paso 13):** imprime `CSV de cierres · filas · especies` y el reporte de `precios:actualizar`. Si el CSV cubre el día de corte, «verificados en el rango» cuenta los cierres de ese día que cuadran (±1 %) con la certificación; uno que no cuadra queda NO_VERIFICADO y lo muestra la conciliación del paso 14. Con salida 3: especies sin acción activa con lotes (`ESPECIE_NO_REGISTRADA`, por su línea del CSV), otro símbolo de Yahoo registrado (`SIMBOLO_DISTINTO`), un fallo del guardado o un año sin calendario: se para y se avisa.
- **`conciliar-certificacion` (paso 14):** guarda una conciliación nueva, ahora con los valores del fondo y los precios; la anterior queda en la historia.

**Después de la carga:**
1. **Revisión, de solo lectura:**
   - `contar-bloqueadas.sql`, en el VPS: `sudo $COMPOSE exec -T inv-008-db psql -X -v ON_ERROR_STOP=1 -U inv_dueno -d inversiones < $B/repo/008-2026-INVERSIONES/scripts/contar-bloqueadas.sql` (solo conteos);
   - y `construir-lotes` con `--ensayo`, por `cargar-prod.sh`.
2. **Cuadre del costo total por especie contra el portal de A&V** (la madre y el hijo de la escisión). Lo mira **Jelk**; la Fábrica reporta solo **sí o no**.
3. **Precios y valores del fondo:** ya entraron en los pasos 12 y 13 (vía B). Cuando exista el servicio de precios (otro frente), `precios:actualizar` y `actualizar-fondo` los versionan encima: son las mismas fuentes (`yahoo` y `sfc:qhpu-8ixx`). Para ponerlos al día antes de eso, se repiten los pasos 12 a 14 con un `--desde` reciente.
4. **Anotar** en `ESTADO.md` de la gestión: el resultado de cada paso, sin valores.

## 12 · Vía A, el volcado de solo datos: NO USAR
El ensayo del CEO (ESTADO, 2026-11-21) mostró tres razones:
1. **Copia el usuario local,** que en producción tiene otro id: la FK `carga_archivo.cargadoPorId` apuntaría a un usuario que no es el dueño de producción.
2. **Choca con `calendario_bvc`:** lo siembran las migraciones, así que la copia falla por llave duplicada.
3. **`pg_dump` avisa de FK circulares** en `lote`, `decision` y `enlace_decision_orden`. Su propio aviso dice que ese volcado de solo datos podría no restaurarse sin desactivar disparadores o quitar las restricciones.

---
> v2.13 · 2026-11-21 · 20:50 (-05) · Inversiones · Fábrica Inversiones (frente fondo-movimientos-via-b) · §11: paso 12 bis `registrar-movimiento-fondo` (la constitución del fondo por el sobre: cabecera, ensayo y `--aplicar`, contraste con el valor de unidad del mismo día, salidas y la frase de parar); el CSV del paso 12 cubre el día de la constitución; riesgo residual del argv con sus cifras
> v2.12 · 2026-11-21 · 18:32 (-05) · Inversiones · Fábrica Inversiones (frente precios-integridad) · §2: `inv_precios` existe desde la primera corrida de `crear-roles-prod.sh` (NOLOGIN y sin clave sin su línea; quitarla lo desactiva), la restauración ya no depende de la línea (ensayada), los disparadores de `20261121231049_precios_integridad` y el riesgo residual completo; §4: permisos «si el rol existe»; §6 (A): `crear-roles-prod.sh` crea `inv_precios` y el guardián de una imagen anterior ve sobrantes; §10: las 4 migraciones con `lock_timeout`
> v2.11 · 2026-11-21 · 17:48 (-05) · Inversiones · Fábrica Inversiones (frente fondo-carga) · §11: el fondo por la vía B: paso 10 `registrar-fondo` por el sobre (lista blanca), paso 12 los valores de unidad (`fondo:exportar` en el Mac con `umask 077` → `importar-valores-fondo` por el sobre, camino único), formato exacto del CSV, la regla T−2 (solo el valor del día del corte) y el hueco de las unidades del fondo; los pasos de los precios pasan de 10–12 a 11, 13 y 14 (la numeración v2.11 sigue a la v2.10 de main)
> v2.10 · 2026-11-21 · 17:01 (-05) · Inversiones · Fábrica Inversiones (frente precios-rol) · §2: `INV_PRECIOS_DATABASE_URL` opcional, cómo la agrega Jelk sin verla (y sin escribir nada si `openssl` falla), cuándo llegan los permisos y por qué la línea no se quita (restauración); §4: los permisos por columna de `inv_precios`
> v2.9 · 2026-11-21 · 16:03 (-05) · Inversiones · Fábrica Inversiones (frente reglas-exportar-restauracion) · §6: frecuencias de las pruebas de restauración (mensual ligera, trimestral real del caso (A), (B) al cambiar el esquema); §11: `precios:exportar` con los símbolos del portafolio, la Fábrica solo con orden del CEO Inversiones
> v2.8 · 2026-11-21 · 15:46 (-05) · Inversiones · Fábrica Inversiones (frente runbook-restauracion) · §6: la prueba de restauración mensual con el comando que corrió Jelk (identificar la clave con `age-keygen -y`, el prefijo que falta, verificar solo con conteos en `--network none` y `--platform linux/amd64`, carpeta 700 en el home, limpieza) y sus avisos (Terminal de macOS, clave maestra compartida con PI y BI)
> v2.7 · 2026-11-21 · 11:14 (-05) · Inversiones · Fábrica ECC (frente precios-carga) · §11: pasos 10 a 12 (certificación, precios por `precios:exportar` en el Mac y `importar-precios` por el sobre, y la conciliación otra vez); formato exacto del CSV de cierres; `-s`, `.parcial` y `&& mv`, `umask 077`; «Después de la carga» sin el pendiente de precios
> v2.6 · 2026-11-21 · 07:34 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · la carpeta de respaldos en 750 (la copia de IDC depende de eso); montaje del host `nosuid,noexec` revisado por los scripts (por ahora avisa): un bind de Docker no los aplica
> v2.5 · 2026-11-21 · 07:05 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · revisiones de seguridad y de código: SPEC-980 de PI activa (aviso en una línea, el candado común resuelve la exclusión); salida 64 de `inv-cargar`; el sobre en la memoria del host como riesgo residual; cita de Jelk restituida
> v2.5 · 2026-11-21 · 09:28 (-05) · Inversiones · Fábrica ECC (frente app-sin-salida) · la app sin salida a internet: solo redes internal, con la puerta de enlace aislada, detrás de `inv-008-entrada` (relé TCP en node, el único con 127.0.0.1:5008); verificación de no salida con control positivo; reversa con el clon en el sha que corre (cambio de contrato de `verificar_clon`); alcance de «sin salida»; primer despliegue con la entrada (down sin -v para recrear las redes)
> v2.4 · 2026-11-21 · 06:57 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · revisión contra el código: sin nombres de otros proyectos ni de firewall; privilegios de `inv_app` completos (TOTP y `codigo_recuperacion`); `crear-acceso-inicial.sh` con sus argumentos; salida 1 de `cargar-prod.sh`; `sudo -n` sin elevación propia; `lock_timeout` en 3 de 12 migraciones; respaldo previo antes del `DROP` de la vía (B)
> v2.3 · 2026-11-21 · 06:50 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · sin rutas ni nombres del VPS en el repo público (marcadores; raíz derivada; `inv-008.conf` para la carpeta de respaldos); §11: carga del dueño por la vía B, por stdin y sin copias en el VPS (`armar-sobre.sh`, `cargar-prod.sh`, `inv-cargar`); §12: vía A «NO USAR»
> v2.2 · 2026-11-21 · 04:40 (-05) · Inversiones · Fábrica ECC (frente prod-endurecer) · app y respaldo diario detenidos antes del migrador, con su vuelta atrás; un respaldo a la vez; árbol de root al inicio de todo script con sudo; aviso de `connection_limit`; §8: túnel aplicado y sin el ID en el repo
> v2.1 · 2026-11-21 · 03:27 (-05) · Inversiones · Fábrica ECC (frente base) · §5: el guardián nuevo; §10: migración fallida y P3009 (`migrate resolve` lo decide el CEO)
> v2.0 · 2026-11-21 · 00:40 (-05) · Inversiones · Fábrica ECC (frente producción) · correcciones de la GATE 2 (VPS compartido con PI)
> v1.0 · 2026-11-20 · 23:59 (-05) · Inversiones · Fábrica ECC (frente producción)
