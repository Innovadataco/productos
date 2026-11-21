# Inversiones · convivencia con PI en el VPS compartido

Inversiones comparte el VPS de producción con PI (D-015). **PI tiene prioridad** y Inversiones no le quita recursos ni toca nada suyo.

**Cómo se garantiza:**
- `mem_limit` igual a `memswap_limit` en cada contenedor, y `cpu_shares: 256`;
- la **pausa obligatoria** en cada despliegue de PI;
- un candado común;
- el criterio de corte, que es **manual**, con dos herramientas que solo leen:
  - el vigía `inv-008-vigia`, que avisa por Telegram;
  - una revisión de una pasada.

**Ninguna herramienta de Inversiones usa Docker sobre `pi-*`.** El OOM se lee del cgroup jerárquico en solo lectura, la memoria de `/proc/meminfo`, y nunca se usan el socket de Docker ni `/var/lib/docker`.
- **Riesgo cerrado:** `pi-app` ya no monta `docker.sock` ([productos#993](https://github.com/Innovadataco/productos/pull/993), `pi-docker-guard`). El riesgo de que un `pi-app` comprometido leyera los secretos o la base de Inversiones por el socket ya no existe.

## 1 · Pausa obligatoria en cada despliegue de PI
**La medición del CEO de PI:**
- durante su build, `MemAvailable` llegó a un mínimo de **1.593 MB**;
- con los **1.152 MiB** de Inversiones quedarían unos **0,4 GB**;
- por eso, pausar Inversiones en **cada** despliegue de PI es **obligatorio**.

**La pausa la hace PI, con su propio código, en su `deploy-prod.sh`.** No llama a `pausar-008.sh`. Su procedimiento (lo hace PI, no Inversiones):
1. **Al inicio:** `docker stop` de los contenedores con la etiqueta `com.docker.compose.project=inv-008-prod`. Compose la pone en todos los permanentes de Inversiones; en el ensayo, lo comprobó `docker ps --filter label=…`. PI guarda esos IDs.
2. **Al final**, con una trampa aunque falle, `docker start` de esos mismos IDs, **salvo que exista la marca de pausa** `/opt/inversiones-008/estado/pausado`. Si existe, PI no reanuda.
3. **Mientras despliega,** PI tiene el candado común `/var/lock/despliegue-vps.lock`. Inversiones no despliega, ni reanuda, ni crea roles, ni corre el acceso inicial mientras esté tomado.

**Para el código de PI (lo escribe PI, no Inversiones):** el `docker stop` por etiqueta tiene que aceptar una **lista vacía**. Con Inversiones en pausa (`pausar-008.sh` hace `down`), no hay ningún contenedor de `inv-008-prod`, y `docker stop` sin argumentos falla. Por ejemplo:
```sh
ids=$(docker ps -q --filter label=com.docker.compose.project=inv-008-prod)
[ -z "$ids" ] || docker stop $ids
```
Al final, si la lista guardada está vacía o existe la marca de pausa, no se hace `start`.

## 2 · Pausa manual o corte (Inversiones)
| | Comando |
|---|---|
| Pausar | `sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/pausar-008.sh [motivo]` |
| Reanudar | `sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/reanudar-008.sh` |

**Pausar:**
1. Revisa el árbol de root ([produccion.md](produccion.md) §2), pero **solo avisa**: un permiso mal puesto no frena el corte.
2. Toma el candado de Inversiones. Solo ese: no espera el común, así que sirve aunque PI esté desplegando.
3. Escribe la **marca `/opt/inversiones-008/estado/pausado`** (ruta fija) **antes** de bajar.
4. Hace `$COMPOSE down` **sin `-v`**: no queda ningún contenedor, y la base y los respaldos quedan intactos. Si el `down` falla, sale con error y la marca queda: la pausa se mantiene.

**Por qué con `down`:** con `stop`, `restart: always` volvería a levantar Inversiones al reiniciar el VPS o Docker. Con `down` no hay contenedores que reiniciar, así que la pausa sobrevive a un reinicio. Mientras exista la marca:
- `desplegar-prod.sh` se niega;
- PI no reanuda Inversiones.

**Reanudar:**
1. Revisa el árbol de root: si no es solo de root, se niega.
2. Exige que `estado/sha-actual` sea un sha de 40 hex.
3. Toma el candado de Inversiones y el común **sin esperar**. Si el común está tomado, se niega con «PI desplegando».
4. Revisa además que no haya un proceso de despliegue o de build de PI, como segunda barrera.
5. Hace `up -d --wait` con ese sha.
6. Borra la marca solo si todo quedó healthy.

**Los mismos pasos a mano:**
```sh
COMPOSE="docker compose -p inv-008-prod -f /opt/inversiones-008/repo/008-2026-INVERSIONES/docker-compose.prod.yml --env-file /opt/inversiones-008/.env.inversiones.production"
# Pausar:
sudo sh -c 'date > /opt/inversiones-008/estado/pausado'
sudo $COMPOSE down
# Reanudar (sin PI desplegando):
sudo env INV_TAG=$(sudo cat /opt/inversiones-008/estado/sha-actual) $COMPOSE up -d --wait
sudo rm /opt/inversiones-008/estado/pausado
```

**Ojo:** mientras Inversiones está en pausa, no hay respaldo diario, porque su contenedor también está abajo. Después de reanudar, conviene correr `respaldar-base.sh`.

## 3 · Medición de memoria
`scripts/medir-memoria.sh` lee `MemAvailable` y `SwapFree` de `/proc/meminfo`, más `docker stats --no-stream` **solo de los contenedores de `inv-008-prod`**.
- **En el despliegue:** `desplegar-prod.sh` lo corre antes de `up` y 10 minutos después. Las dos mediciones quedan en `/opt/inversiones-008/estado/mediciones/<sha>-<fecha>.txt`.
- **A mano:**
  ```sh
  sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/medir-memoria.sh --etiqueta "en reposo"
  ```

**Referencia** (coordinador, 2026-11-20, en reposo):
- `MemAvailable`: 3,89 GiB;
- `SwapFree`: 2,47 GiB de 4 GiB.

**Presupuesto de Inversiones**, en mem = memswap:

| Contenedor | Límite |
|---|---|
| app | 384m |
| base | 512m |
| respaldo | 128m |
| vigía | 32m |
| migrador (un solo uso) | 256m |

Corriendo en reposo, el techo es de **1.056 MiB**.

## 4 · Criterio de corte (el corte es MANUAL)
Se detiene Inversiones, con `pausar-008.sh`, si se da cualquiera de estas condiciones:
- `MemAvailable` en reposo baja de **1 GiB**;
- un contenedor sufre un OOM.

**`scripts/vigilar-convivencia.sh`**, una sola pasada:
- **Qué lee:** la memoria y el `oom_kill` **jerárquico** de `/sys/fs/cgroup/system.slice/memory.events`, que persiste aunque el contenedor muerto se recree.
- **Qué hace:** si se cumple el criterio, lo informa con el comando de corte y sale con 3. **No detiene nada.**
- **En el despliegue:** `desplegar-prod.sh` la corre al final; si sale con 3, no imprime `DEPLOY VERIFICADO`.

## 5 · El vigía (`inv-008-vigia`): solo avisa por Telegram
- **Lo que lee:**
  - `MemAvailable` y `SwapFree`, cada `VIGIA_INTERVALO_S` (60 s);
  - el `oom_kill` **jerárquico** del cgroup: `system.slice` con el driver systemd, el del VPS; `docker/` con cgroupfs, el de Colima;
  - para identificar el contenedor, cada `docker-<id>.scope`: si su contador bajó, el contenedor se recreó tras el OOM.
- **Lo que monta:** solo `/proc/meminfo` y `/sys/fs/cgroup`, en solo lectura. **Nunca** el socket ni `/var/lib/docker`.
- **Endurecimiento:**
  - imagen mínima `inv-008-vigia`, sin node;
  - usuario 10008, `read_only`, `cap_drop: ALL`, `no-new-privileges` e `init`;
  - 32m de memoria (igual a memswap), `cpus: 0.05`, `restart: always` y healthcheck por latido.
- **Red:** `inv-008-red`, con salida a internet. La red no filtra por dominio: el código solo llama a la API de Telegram con `curl`, que valida TLS con los certificados de la imagen.
- **El token:** va a `curl` por la entrada estándar (`-K -`) y **nunca en sus argumentos**, así que no se ve en `ps`.
- **Variables:** `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`, que son **el mismo bot y el mismo chat de las tareas programadas**.
  - Los pone Jelk, o un script suyo, sin pasar por el chat ni por un log.
  - Si se rota el token, se actualiza en el Mac (`~/.config/odin/`) y en el VPS.
  - Además: `VIGIA_UMBRAL_MEMAVAILABLE_MIB` (1024 por defecto).
- **Máquina de estados, sin spam:**
  - **OK → ALERTA:** avisa una vez, por memoria bajo el umbral o por un OOM nuevo.
  - **ALERTA → PEOR:** vuelve a avisar solo si `MemAvailable` baja 256 MiB más o si hay otro OOM.
  - **ALERTA → RESUELTO:** avisa una vez, y solo cuando `MemAvailable` está en el umbral más 256 MiB o más **durante 3 pasadas seguidas** y **sin OOM en los últimos 15 minutos**.
  - Si Telegram falla, reintenta en la pasada siguiente.
  - El estado vive en tmpfs: un reinicio puede repetir una alerta.
- **El aviso trae:**
  - la hora COT, `MemAvailable`, `SwapFree` y el umbral;
  - si hubo OOM: el id corto del contenedor (o «recreado») y `docker ps --no-trunc | grep <id>`;
  - el comando de corte: `ssh pi-vps sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/pausar-008.sh`.
  - No lleva el token ni datos de Inversiones.
- **El vigía nunca actúa.**

### Control positivo en el VPS
Lo ejecuta el coordinador con Jelk después del primer despliegue (condición del CEO de PI).
1. Anotar la hora. Poner a propósito `INV_VIGIA_UMBRAL_MEMAVAILABLE_MIB=7168` en `/opt/inversiones-008/.env.inversiones.production` (con `sudo nano`).
2. Recrear **solo el vigía:**
   ```sh
   sudo env INV_TAG=$(sudo cat /opt/inversiones-008/estado/sha-actual) $COMPOSE up -d --no-deps inv-008-vigia
   ```
3. En menos de 2 minutos debe llegar al Telegram de Jelk un «⚠️ ALERTA» con la hora COT, el umbral de 7168 MiB y el comando de corte. Se comprueba en el log, que no trae el token:
   ```sh
   sudo docker logs --since 5m $(sudo $COMPOSE ps -q inv-008-vigia)
   #   «… [vigia] aviso ALERTA enviado (memoria bajo el umbral; MemAvailable … MiB)»
   ```
4. **Restaurar** el umbral (borrar la línea) y repetir el paso 2. Llegará un «✅ RESUELTO» unos 3 minutos después.
5. **Evidencia:** la hora y la línea del log, sin el token, van al PR o a `ESTADO.md`.

## 6 · Reglas del VPS para Inversiones
- Se escribe SOLO en los tres destinos permitidos: `/opt/inversiones-008/`, `/var/lock/despliegue-vps.lock` y `/var/backups/idc/inversiones/`.
- Nunca se toca `/opt/proteccion-infantil/`, ni los contenedores `pi-*` o `bi-*`, ni Gesmovil ni Hermes.
- Antes de reiniciar `cloudflared-hermes` se avisa al CEO de PI: [produccion.md](produccion.md#8--túnel-de-cloudflare-aplicado-el-2026-11-21).
- `desplegar-prod.sh` toma los dos candados y revisa los procesos de PI en tres momentos: antes de empezar, antes de migrar y antes de `up`.

---
> v2.1 · 2026-11-21 · 04:40 (-05) · Inversiones · Fábrica ECC (frente prod-endurecer) · pausa y reanudación con el árbol de root y el sha validado; enlace al §8 nuevo
> v2.0 · 2026-11-21 · 00:45 (-05) · Inversiones · Fábrica ECC (frente producción) · correcciones de la GATE 2
> v1.0 · 2026-11-20 · 23:59 (-05) · Inversiones · Fábrica ECC (frente producción)
