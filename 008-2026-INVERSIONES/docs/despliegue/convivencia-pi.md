# Inversiones · convivencia con PI en el VPS compartido

Inversiones comparte el VPS de producción con PI (D-015). **PI tiene prioridad** y Inversiones no le quita recursos ni toca nada suyo.

**Marcadores** (repo público; los valores, en el ESTADO de la gestión): `<raíz>` es la carpeta base de Inversiones en el VPS, la que contiene al clon `<raíz>/repo`; `<respaldos>`, la carpeta de los respaldos cifrados. Ver [produccion.md](produccion.md).

**Lo único compartido con PI:** el candado común y la marca de pausa `<raíz>/estado/pausado`. PI no usa `pausar-008.sh`: ese script es de las operaciones de 008.

**Cómo se garantiza:**
- `mem_limit` igual a `memswap_limit` en cada contenedor, y `cpu_shares: 256`;
- la **pausa condicional** en los despliegues de PI (D-019): solo si su preflight de memoria arranca bajo;
- un candado común;
- el criterio de corte, que es **manual**, con dos herramientas que solo leen:
  - el vigía `inv-008-vigia`, que avisa por Telegram;
  - una revisión de una pasada.

**Ninguna herramienta de Inversiones usa Docker sobre los contenedores de PI.** El OOM se lee del cgroup jerárquico en solo lectura, la memoria de `/proc/meminfo`, y nunca se usan el socket de Docker ni `/var/lib/docker`.
- **Riesgo cerrado:** el contenedor de la app de PI ya no monta `docker.sock` ([productos#993](https://github.com/Innovadataco/productos/pull/993), con el guardia de PI). El riesgo de que un contenedor de PI comprometido leyera los secretos o la base de Inversiones por el socket ya no existe.

## 1 · Pausa condicional en los despliegues de PI (D-019)
**La medición del CEO de PI:** durante su build, `MemAvailable` llegó a un mínimo de **1.593 MB**; con los **1.152 MiB** de Inversiones quedarían unos **0,4 GB**. Por eso, hasta D-019, PI pausaba Inversiones en todos sus despliegues.

**D-019 (decisión de Jelk, 2026-11-21): la pausa deja de ser obligatoria.**
- **Cuándo la hay:** el `deploy-prod.sh` de PI corre un **preflight de memoria** al inicio. Pausa Inversiones **solo para ese build** si arranca con `MemAvailable` < **1 GiB** o `SwapFree` < **512 MB**.
- **Si no se cumple ninguna de las dos,** Inversiones sigue arriba durante el build de PI.
- **La marca de pausa y el candado común siguen como están acordados.**
- **Inversiones no cambia nada de su lado.** El criterio de corte manual (§4) y el vigía (§5) siguen vigentes.
- **Un aviso del vigía durante un build de PI sin pausa es esperable:** con la medición de arriba, `MemAvailable` puede bajar del umbral de 1 GiB mientras dura el build. El aviso no obliga a cortar: la decisión sigue siendo manual (§4). Si el corte se repite en varios builds, se revisa D-019 con Jelk.

**Cuando pausa, la hace PI, con su propio código, en su `deploy-prod.sh`.** No llama a `pausar-008.sh`. Su procedimiento (lo hace PI, no Inversiones):
1. **Al inicio, si el preflight lo pide:** `docker stop` de los contenedores con la etiqueta `com.docker.compose.project=inv-008-prod`. Compose la pone en todos los permanentes de Inversiones, también en `inv-008-entrada`; en el ensayo, lo comprobó `docker ps --filter label=…`. PI guarda esos IDs.
   - El `docker start` de vuelta no sigue el orden de Compose: la entrada puede arrancar antes que la app. Está bien: resuelve la app en cada conexión. Lo midió el ensayo del frente app-sin-salida (stop por etiqueta y start con la app al final: 307, 401 y 200 por la entrada).
2. **Al final**, con una trampa aunque falle, `docker start` de esos mismos IDs, **salvo que exista la marca de pausa** `<raíz>/estado/pausado`. Si existe, PI no reanuda.
3. **Mientras despliega, PI tiene el candado común** (`/var/lock/despliegue-vps.lock`).
   - Lo toma desde su SPEC-980, ya activa. Espera hasta 900 s y, si no lo obtiene, aborta limpio con salida 3.
   - Inversiones lo toma sin esperar en `desplegar-prod.sh`, `reanudar-008.sh`, `crear-roles-prod.sh`, `crear-acceso-inicial.sh`, `cargar-prod.sh` y `reaplicar-limites-008.sh`. Si PI lo tiene, se niega con «PI desplegando».
   - Antes de una carga se avisa al CEO de PI en una línea, solo por trazabilidad: la exclusión la resuelve el candado ([produccion.md](produccion.md) §11).

**Para el código de PI (lo escribe PI, no Inversiones):** el `docker stop` por etiqueta tiene que aceptar una **lista vacía**. Con Inversiones en pausa (`pausar-008.sh` hace `down`), no hay ningún contenedor de `inv-008-prod`, y `docker stop` sin argumentos falla. Por ejemplo:
```sh
ids=$(docker ps -q --filter label=com.docker.compose.project=inv-008-prod)
[ -z "$ids" ] || docker stop $ids
```
Al final, si la lista guardada está vacía o existe la marca de pausa, no se hace `start`.

## 2 · Pausa manual o corte (Inversiones)
| | Comando |
|---|---|
| Pausar | `sudo <raíz>/repo/008-2026-INVERSIONES/scripts/pausar-008.sh [motivo]` |
| Reanudar | `sudo <raíz>/repo/008-2026-INVERSIONES/scripts/reanudar-008.sh` |

**Pausar** (nunca se rompe por interpolación):
1. **Anclas de la raíz** ([produccion.md](produccion.md) §2). Si están rotas:
   - no escribe nada;
   - hace un `down` de último recurso solo con el nombre del proyecto;
   - sale con error: «Inversiones abajo SIN marca de pausa».
2. Revisa el árbol de root, pero **solo avisa**: un permiso mal puesto no frena el corte.
3. Toma el candado de Inversiones. Solo ese: no espera el común, así que sirve aunque PI esté desplegando.
   - Si otra operación de Inversiones lo tiene (por ejemplo, un despliegue), se niega: el despliegue podría volver a levantar lo que se baje.
   - Primero se corta el despliegue (Ctrl-C: su vuelta atrás) y después se pausa.
4. Escribe la **marca `<raíz>/estado/pausado`** **antes** de bajar. Si no se puede escribir (disco lleno, ruta rota), baja igual y sale con error: «SIN marca».
5. **El `down`, siempre sin `-v`:** no queda ningún contenedor, y la base y los respaldos quedan intactos.
   - Va solo con el nombre del proyecto (`docker compose -p inv-008-prod down`, sin `-f` ni `--env-file`). Así no interpola nada ni lee la configuración no secreta, y una variable que falte no lo frena.
   - Si ese `down` falla, prueba con el compose del clon, con la carpeta de respaldos en el valor por defecto.
   - Si los dos fallan, sale con error y la marca queda: la pausa se mantiene.

**Por qué con `down`:** con `stop`, `restart: always` volvería a levantar Inversiones al reiniciar el VPS o Docker. Con `down` no hay contenedores que reiniciar, así que la pausa sobrevive a un reinicio. Mientras exista la marca:
- `desplegar-prod.sh` se niega;
- PI no reanuda Inversiones.

**Reanudar:**
1. Revisa el árbol de root: si no es solo de root, se niega.
2. Exige que `estado/sha-actual` sea un sha de 40 hex, y la configuración no secreta válida, porque el `up` levanta el respaldo.
3. Toma el candado de Inversiones y el común **sin esperar**. Si el común está tomado, se niega con «PI desplegando».
4. Revisa además que no haya un proceso de despliegue o de build de PI, como segunda barrera.
5. Hace `up -d --wait` con ese sha, después de revalidar la carpeta de respaldos.
6. Borra la marca solo si todo quedó healthy.

**La pausa a mano** (no interpola nada):
```sh
B='<raíz>'   # <ver ESTADO en la gestión>
sudo sh -c "date > $B/estado/pausado"
sudo docker compose -p inv-008-prod down
```
**La reanudación,** con `reanudar-008.sh` (toma los candados y valida la carpeta de respaldos antes del `up`). A mano, solo si ese script no sirve: no toma los candados ni valida nada, así que antes hay que comprobar que PI no esté desplegando. Usa el `$COMPOSE` de [produccion.md](produccion.md) §1 (lleva la carpeta):
```sh
sudo env INV_TAG=$(sudo cat "$B/estado/sha-actual") $COMPOSE up -d --wait && sudo rm "$B/estado/pausado"
```

**Ojo:** mientras Inversiones está en pausa, no hay respaldo diario, porque su contenedor también está abajo. Después de reanudar, conviene correr `respaldar-base.sh`.

## 3 · Medición de memoria
`scripts/medir-memoria.sh` lee `MemAvailable` y `SwapFree` de `/proc/meminfo`, más `docker stats --no-stream` **solo de los contenedores de `inv-008-prod`**.
- **En el despliegue:** `desplegar-prod.sh` lo corre antes de `up` y después de la espera de la medición (120 o 600 s; [produccion.md §5](produccion.md)). En la espera corta, si `MemAvailable` está bajo 1 GiB o `SwapFree` bajo 512 MiB, la espera se extiende a 600 s y se mide otra vez: son tres mediciones. Quedan en `<raíz>/estado/mediciones/<sha>-<fecha>.txt`.
- **A mano:**
  ```sh
  sudo <raíz>/repo/008-2026-INVERSIONES/scripts/medir-memoria.sh --etiqueta "en reposo"
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
| entrada (relé TCP) | 32m |
| precios | 96m |
| IA | 128m |
| alertas | 64m |
| migrador (un solo uso) | 256m |

Corriendo en reposo, el techo es de **1.376 MiB**: 1.088 MiB (app, base, respaldo, vigía y entrada) más precios (96), IA (128) y alertas (64). El migrador, de un solo uso, no cuenta. Los tres servicios nuevos son límites, **sin medir en el VPS**: se miden en el primer despliegue con `medir-memoria.sh` (la espera de 600 s) y, para alertas, con una evaluación forzada (`produccion.md`, «El servicio de las alertas»). La entrada, medida en el Mac (arm64): unos 9 MiB en reposo y 14,7 MiB de pico con 60 conexiones quietas. En amd64, **por verificar** en la medición del despliegue. Un OOM de la entrada cuenta para el criterio de corte, como cualquier otro.

## 4 · Criterio de corte (el corte es MANUAL)
Se detiene Inversiones, con `pausar-008.sh`, si se da cualquiera de estas condiciones:
- `MemAvailable` en reposo baja de **1 GiB**;
- un contenedor sufre un OOM.

**`scripts/vigilar-convivencia.sh`**, una sola pasada:
- **Qué lee:** la memoria y el `oom_kill` **jerárquico** de `/sys/fs/cgroup/system.slice/memory.events`, que persiste aunque el contenedor muerto se recree.
- **Qué hace:** si se cumple el criterio, lo informa con el comando de corte y sale con 3. **No detiene nada.**
- **En el despliegue:** `desplegar-prod.sh` la corre al final; si sale con 3, no imprime `DEPLOY VERIFICADO`.
  - El piso de memoria de la espera corta (§3) también sale con 3 y sin `DEPLOY VERIFICADO`, con el aviso «MEMORIA BAJO EL PISO…». Nada se detiene: el sha nuevo queda registrado y el corte es manual, con `pausar-008.sh`.

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
- **Red:** `inv-008-red`, con salida a internet. La red no filtra por dominio: el código solo llama a la API de Telegram con `curl`, que valida TLS con los certificados de la imagen. La comparte solo con `inv-008-entrada` (que publica el puerto del túnel); la app y la base no están en esa red.
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
  - el comando de corte: `ssh pi-vps sudo <raíz>/repo/008-2026-INVERSIONES/scripts/pausar-008.sh`.
    - El vigía lo arma con la ruta real del clon, `VIGIA_RUTA_PAUSA`, que le pasan los scripts.
    - Si se recrea a mano sin esa variable, el aviso lleva el marcador `<raíz>` y remite al ESTADO.
  - No lleva el token ni datos de Inversiones.
- **El vigía nunca actúa.**

### Control positivo en el VPS
Lo ejecuta el coordinador con Jelk después del primer despliegue (condición del CEO de PI).
1. Anotar la hora. Poner a propósito `INV_VIGIA_UMBRAL_MEMAVAILABLE_MIB=7168` en `<raíz>/.env.inversiones.production` (con `sudo nano`).
2. Recrear **solo el vigía:**
   ```sh
   sudo env INV_TAG=$(sudo cat <raíz>/estado/sha-actual) $COMPOSE up -d --no-deps inv-008-vigia
   ```
3. En menos de 2 minutos debe llegar al Telegram de Jelk un «⚠️ ALERTA» con la hora COT, el umbral de 7168 MiB y el comando de corte. Se comprueba en el log, que no trae el token:
   ```sh
   sudo docker logs --since 5m $(sudo $COMPOSE ps -q inv-008-vigia)
   #   «… [vigia] aviso ALERTA enviado (memoria bajo el umbral; MemAvailable … MiB)»
   ```
4. **Restaurar** el umbral (borrar la línea) y repetir el paso 2. Llegará un «✅ RESUELTO» unos 3 minutos después.
5. **Evidencia:** la hora y la línea del log, sin el token, van al PR o a `ESTADO.md`.

## 6 · Reglas del VPS para Inversiones
- Se escribe SOLO en los tres destinos permitidos: `<raíz>/`, `/var/lock/despliegue-vps.lock` (el candado común) y `<respaldos>/` (de `inv-008.conf`).
- Nunca se toca la carpeta de PI, ni los contenedores de PI o de BI, ni los de otros proyectos del VPS.
- Antes de reiniciar `<servicio-del-túnel>` se avisa al CEO de PI: [produccion.md](produccion.md#8--túnel-de-cloudflare-aplicado-el-2026-11-21).
- `desplegar-prod.sh` toma los dos candados y revisa los procesos de PI en tres momentos: antes de empezar, antes de migrar y antes de `up`.

---
> v2.6 · 2026-11-21 · 23:26 (-05) · Inversiones · Fábrica Inversiones (frente docs-tanda-21nov) · §1: `reaplicar-limites-008.sh` toma el candado común; §3: la medición antes de `up` y después de la espera (120 o 600 s), con el piso que extiende a 600 s (tres mediciones); §4: el piso de la espera corta también sale con 3 sin DEPLOY VERIFICADO (v2.6 sobre la v2.5)
> v2.5 · 2026-11-21 · 16:57 (-05) · Inversiones · Fábrica Inversiones (frente convivencia-d019) · D-019: la pausa de Inversiones en los despliegues de PI ya no es obligatoria; PI pausa solo para ese build si su preflight arranca con MemAvailable < 1 GiB o SwapFree < 512 MB; marca de pausa y candado común sin cambios
> v2.4 · 2026-11-21 · 07:05 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · SPEC-980 de PI activa: PI toma el candado común y espera hasta 900 s; la pausa baja aunque no pueda escribir la marca, y con un despliegue en curso se niega; marcador `<raíz>` en el aviso del vigía
> v2.3 · 2026-11-21 · 06:57 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · sin nombres de contenedores ni de proyectos ajenos (salvo el alias SSH del Mac, decidido); reanudación manual marcada como excepción; `crear-roles-prod.sh` y `crear-acceso-inicial.sh` también toman el candado común
> v2.3 · 2026-11-21 · 08:42 (-05) · Inversiones · Fábrica ECC (frente app-sin-salida) · la entrada en la pausa por etiqueta y en el presupuesto (techo de 1.088 MiB); el vigía comparte `inv-008-red` solo con la entrada
> v2.2 · 2026-11-21 · 06:50 (-05) · Inversiones · Fábrica ECC (frente infra-literales) · marcadores en vez de rutas del VPS; la pausa no interpola (down por nombre de proyecto, marca antes, anclas); lo compartido con PI es solo el candado común y la marca; el deploy de PI aún no toma el candado común (SPEC-980): avisar al CEO de PI
> v2.2 · 2026-11-26 · 06:10 (-05) · Inversiones · Fábrica Inversiones (frente alertas-pantalla, PR-C) · presupuesto con precios (96m), IA (128m) y alertas (64m): techo en reposo de 1.376 MiB
> v2.1 · 2026-11-21 · 04:40 (-05) · Inversiones · Fábrica ECC (frente prod-endurecer) · pausa y reanudación con el árbol de root y el sha validado; enlace al §8 nuevo
> v2.0 · 2026-11-21 · 00:45 (-05) · Inversiones · Fábrica ECC (frente producción) · correcciones de la GATE 2
> v1.0 · 2026-11-20 · 23:59 (-05) · Inversiones · Fábrica ECC (frente producción)
