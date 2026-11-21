# AGENTS.md · 008 · INVERSIONES

Sistema personal de seguimiento de un portafolio de inversiones: importa las exportaciones de la casa de bolsa, calcula posiciones, costo, dividendos y rentabilidad (TWR), trae precios y envía reportes por Telegram y en una web con gráficas. Es de solo lectura: no opera ni guarda credenciales de plataformas de inversión.

## Stack (D-008, igual al de la fábrica)
- Web y API: Next.js (App Router) + React, Node 22 (fijar en `.nvmrc` y `engines`, igual que el CI).
- Datos: Prisma + PostgreSQL 16 en **contenedor propio** (`docker-compose.yml` del producto, sobre Colima). Puerto local **5438**.
- Tareas programadas (precios al cierre, valor del fondo, reporte diario): pg-boss sobre la misma PostgreSQL.
- Reportes: bot de Telegram.
- App local en el puerto **5008**. Producción: `docker-compose.prod.yml` en el VPS compartido con PI, proyecto `inv-008-prod`. Procedimiento en la sección «Producción» de abajo.
- **No crear otras bases de datos ni otros servicios** fuera del compose del producto.

## Cómo se trabaja: solo ECC (orden de Jelk, 2026-11-20)
008 se construye **solo con la metodología de ECC** (affaan-m/ECC v2.2.3). No hay SPEC numeradas ni radicados.
1. **PRD** (`/plan-prd`, en la gestión privada) → **`/plan`**.
2. **Orquestador** según el caso: `/orch-add-feature` (nuevo), `/orch-fix-defect` (defecto o hallazgo), `/orch-change-feature` (cambiar algo que funciona) o `/orch-refine-code` (refactor sin cambiar el comportamiento).
3. **Pasos completos:**
   - `planner` → `tdd-workflow` (prueba que falla primero) → implementación;
   - `code-reviewer` + `security-reviewer`, más `react-reviewer` o `database-reviewer` si aplica;
   - `verification-loop` → `/quality-gate` → PR → merge con CI en verde.
   - Si hay pantalla, `e2e-runner` con la app corriendo.
4. **Cada PR** lleva una sección **«ECC usado»** con los comandos, skills y agentes que corrieron.
5. **Ramas y staging:**
   - Rama `work/inv-<nombre-corto>` desde `origin/main`, en worktree propio. Base del PR: `main`.
   - Varios frentes en paralelo, cada uno en su worktree y sin tocar los mismos archivos. Merge de a uno.
   - Staging solo de rutas de `008-2026-INVERSIONES/`. Nunca `git add -A` ni `git add .`.

## Guardianes del CI (correr local antes de pedir revisión)
Workflow: `.github/workflows/inv.yml` · check agregado: `inv-gate`.

| Comando (desde la raíz del repo) | Qué verifica |
|---|---|
| `bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.test.sh` | Que el candado de datos reales sigue mordiendo (prueba por mutación) |
| `bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.sh` | Que no hay extractos, exportaciones, capturas, bases, comprimidos, claves ni `.env` versionados (lee las rutas crudas con `-z`, también con tildes) |
| `bash 008-2026-INVERSIONES/scripts/ci/frontera-008.test.sh` | Que el candado de frontera sigue mordiendo (prueba por mutación) |
| `bash 008-2026-INVERSIONES/scripts/ci/frontera-008.sh origin/main` | Que la rama solo toca `008-2026-INVERSIONES/` e `inv.yml`, contando un renombre como borrado + alta (si toca algo más, ese PR lo mergea el CEO de PI) |

**App**, desde `008-2026-INVERSIONES/` con Node 22 (`.nvmrc`) y `npm ci`:

| Comando | Qué verifica |
|---|---|
| `npm run typecheck` | Tipos de TypeScript (`next typegen` y `tsc --noEmit`, modo estricto; `next-env.d.ts` se genera, no se versiona) |
| `npm test` | Pruebas unitarias, incluidos los candados del esquema (sin `Float`, dinero en `Decimal`, acciones en `BigInt`, trazabilidad, sin archivo original) y de infraestructura (un solo servicio, base en el 5438, app en el 5008) |
| `npm run db:up && npm run test:integracion` | Integración contra la base `inversiones_test` del compose: reinicia esa base con las migraciones y verifica que existan y muerdan los CHECK, los índices parciales, la exclusión de vigencias y la regla de solo inserción. Se niega a correr si la base no termina en `_test` |
| `npm run build` | Que la app compila (`next build`) |
| `npm run importar:trii -- --email <correo> <archivos.csv>` | Carga local de los CSV de Trii. Solo para datos del dueño en su base; en el repo, solo fixtures `.ficticio.csv` |
| `npm run escision:registrar -- --origen <NEMO> --destino <NEMO> --fecha AAAA-MM-DD …` | Registro local de eventos de escisión, antes de cargar dividendos. Datos reales: solo en la base del dueño |
| `npm run lotes:construir` · `npm run lote:escision -- …` | Lotes desde las órdenes, ventas FIFO y lote de escisión con costo del portal. Datos reales: solo en la base del dueño |
| `npm run precios:actualizar [-- --desde …]` | Cierres diarios de Yahoo `.CL`, versionados y verificados contra la certificación. Cada corrida re-verifica también los cierres iguales: si la verificación cambió (llegó, cambió o ya no está la certificación del día), versiona el mismo precio y lo cuenta como «re-verificado»; para una certificación con corte fuera de los últimos 10 días, corra `-- --desde <corte>`. Consulta un servicio externo con los símbolos del portafolio: solo desde la máquina del dueño o el servidor |
| `npm run precios:depurar -- --desde AAAA-MM-DD [--aplicar --base <nombre>]` | Retira (`reemplazadoEn`, nada se borra) los cierres de Yahoo ya guardados de días no hábiles o sin negociación (volumen 0). Sin `--aplicar` es un ensayo con conteos; aplicar solo con el arreglo desplegado donde corran las cargas, y dos veces (la segunda da 0). Se revierte con `precios:actualizar -- --desde <día>` si Yahoo trae después volumen. Consulta Yahoo: solo desde la máquina del dueño o el servidor |
| `npm run test:e2e` | Playwright (`playwright.config.ts`): flujos de punta a punta (ingreso, definir clave, tablero, cabeceras). Levanta `next dev` y siembra la base e2e (`tests/e2e/sembrar.ts`). Por verificar si requiere `npm run db:up` antes |
| `npm run db:up && npm run test:cobertura` | Cobertura **unida** de unidad + integración (`@vitest/coverage-v8`, blobs y `vitest --merge-reports`). Es un alias de `test:cobertura:unida`, que encadena `:unidad` (limpia los blobs), `:integracion` (por `scripts/integracion.mjs`, con su candado de base `_test` y su reinicio; solo acepta `--coverage`, `--reporter=default\|blob` y `--outputFile.blob=node_modules/.cache/cobertura-blobs/<archivo>.json`) y `:unir`. La medida válida es la cadena completa: un `:unir` suelto mide los blobs que haya (solo `:unidad` los limpia), y los sub-scripts existen para el CI, que los corre en ese orden. Los únicos pisos están en `vitest.cobertura.config.ts` y se miden sobre lo unido: statements 92, branches 93, functions 97 y lines 92 (lo medido en main el 2026-11-21 menos 1 punto). Todos quedan por encima del 80 % de ECC, y el candado (`tests/unit/cobertura/`) no deja bajarlos de los aprobados ni de 80. Las suites separadas no tienen pisos: cada una sola mide mal. El e2e no entra en la medida. **El CI todavía no la corre** (pendiente del cambio de `inv.yml`) |

**Datos y producción** (comandos fuera de `npm test`):

| Comando | Dónde se corre | Qué hace |
|---|---|---|
| `npx tsx scripts/importar-plan.ts --ficha <ruta.md> --email <correo-del-dueño> [--aplicar]` | Mac, con la base del dueño | Carga el plan desde la ficha. Sin `--aplicar` no escribe. Datos reales: solo en la base del dueño |
| `npx tsx scripts/actualizar-fondo.ts [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]` · `--registrar --codigo <n> [--participacion <n>] --nombre <texto>` | Mac o servidor del dueño | Valor de unidad diario de los fondos desde la SFC (consulta un servicio externo). Imprime solo conteos y códigos |
| `npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>` | Mac o servidor, con la base del dueño | Importa la certificación PDF de Acciones & Valores (lector propio acotado; filas crudas y `encargo` cifrados; reimportar no duplica; una fila inválida rechaza el archivo) y la concilia por fecha de corte. La fecha de corte es obligatoria: el PDF no la trae. `--fondo` solo la primera vez, para vincular el NIT del fondo. Imprime solo conteos, códigos y el siguiente paso: `npm run precios:actualizar -- --desde <corte>` para verificar los cierres de ese día (no lo corre: llama a la red); en producción (`NODE_ENV=production`, sin red), la vía B: `cargar-prod.sh importar-precios` y después `conciliar-certificacion`. Datos reales: solo en la base del dueño |
| `npx tsx scripts/conciliar-certificacion.ts --fecha-corte AAAA-MM-DD` | Mac o servidor, con la base del dueño | Vuelve a conciliar la certificación de esa fecha (después de traer precios o de registrar lotes, unidades del fondo o ajustes de caja). Guarda una conciliación nueva; la anterior queda en la historia. Imprime solo el resultado, conteos y códigos de motivo |
| `npm run -s precios:exportar -- --nemos <lista.txt> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <cierres.csv.parcial>` | Mac del dueño (con red; sin base) | Vía B de los precios: pide a Yahoo `<NEMO>.CL` de la lista privada (la crea el dueño; con orden del CEO, la saca la Fábrica) y escribe por stdout el CSV de cierres públicos (formato en `src/precios/csv-cierres.ts` y `produccion.md` §11). `-s` es obligatorio (si no, el encabezado de npm queda dentro del CSV). Se niega a escribir en una terminal; por stderr solo conteos, códigos y líneas de la lista. Salida: 0 · 3 alguna especie quedó fuera · 2 uso · 1 error. **La Fábrica lo corre con los símbolos del portafolio solo con orden del CEO Inversiones:** saca la lista de producción (acción activa con lotes) sin imprimirla, la deja con el CSV en una carpeta 700 (`umask 077`), nunca en la carpeta privada del dueño, y la borra al terminar, junto con el CSV |
| `npm run -s precios:importar -- --archivo <cierres.csv>` | Servidor (por `cargar-prod.sh importar-precios`) o Mac | Carga ese CSV por el mismo camino que `precios:actualizar` (`src/precios/guardar.ts`): valida el archivo entero antes de abrir la base (todo o nada), mismas especies (acción activa con lotes), fuente `yahoo`, omisiones de SPEC-13 y verificación contra la certificación. `ESPECIE_NO_REGISTRADA` o `SIMBOLO_DISTINTO` salen con 3. Sin red |
| `npx tsx scripts/cifrar-existentes.ts` · `--aplicar --base <nombre>` · `--re-cifrar --base <nombre>` | Mac o servidor, con la base del dueño | Cifrado de lo existente (#11). Sin flags es ensayo y no escribe. Se corre con los importadores detenidos, con respaldo previo, y dos veces (la segunda debe dar 0 cambios). Datos reales: solo en la base del dueño |
| `scripts/crear-acceso-inicial.sh` (VPS, por SSH) · `crear-acceso-inicial.ts` | VPS, lo corre el dueño (no la Fábrica) | Crea el acceso inicial con `inv_dueno`; imprime una sola vez el enlace de definir clave. Se corre antes de cargar datos reales |
| `scripts/construir-imagen.sh <sha> [--guardar <carpeta>]` | Mac | Construye las tres imágenes desde `git archive <sha>`, corre `npm audit --omit=dev --audit-level=high` y verifica el sha de cada imagen |
| `sudo scripts/desplegar-prod.sh <inv-008-app:<sha>> [--cargar <tar> <sha256>] [--sin-migrar]` | VPS, con sudo | Despliega con respaldo previo, migraciones, healthcheck y convivencia. Sin «DEPLOY VERIFICADO <sha>» como última línea, no se dio por desplegado |
| `scripts/respaldar-base.sh [--motivo <x>]` | VPS | Respaldo cifrado ya (lo pide al contenedor `inv-008-respaldo`) |
| `scripts/crear-roles-prod.sh` | VPS, con sudo | Crea los roles de la base de producción (claves desde el único archivo de secretos): `inv_dueno`, `inv_app` y, solo si el archivo trae `INV_PRECIOS_DATABASE_URL`, `inv_precios` (servicio de precios; sin la línea lo omite y avisa, mal formada aborta). Sus permisos, por columna, los da el migrador (`docker/migrador/privilegios.sql`) |
| `scripts/pausar-008.sh` · `scripts/reanudar-008.sh` | VPS, con sudo | Pausa (`down` sin `-v`, con marca) y reanudación de Inversiones |
| `scripts/medir-memoria.sh` · `scripts/vigilar-convivencia.sh` | VPS | Medición de memoria y revisión de convivencia con PI. Solo informan: el corte es manual |

En los comandos de datos reales: **solo con la base del dueño, y nunca datos reales en el repo.**

Cada cambio que agregue código suma aquí sus guardianes y su job en `inv.yml`, con `needs` en `inv-gate`. `inv.yml` está fuera de la zona de ECC: ese cableado va en un PR aparte que mergea el CEO de PI.

**Migraciones:** créelas con `npx prisma migrate dev --create-only` y revise el SQL antes de aplicarlas. La migración inicial trae reglas escritas a mano (CHECK, índices parciales, exclusión y disparadores de solo inserción) que Prisma no conoce; si una migración nueva las borra, `npm run test:integracion` se pone rojo.

## Datos (regla dura)
- **Los datos reales nunca entran al repo**: ni montos, ni cuentas, ni posiciones, ni extractos, ni capturas; tampoco en seeds, tests o fixtures. Viven solo en la base de datos del servidor y en sus secretos.
- Los datos de prueba son **inventados** y van en archivos marcados `.ficticio.` (ej. `tests/fixtures/ordenes.ficticio.csv`).

## ECC: instalación y merge autónomo
**Merge y despliegue autónomos (D-011).** Cada cambio entra por PR con CI verde y con la revisión de `code-reviewer` y `security-reviewer` registrada en el PR.
- Si se cumple, ECC mergea (de a uno, nunca con `main` en rojo) y despliega.
- Los PR que tocan archivos fuera de `008-2026-INVERSIONES/` los mergea el CEO de PI.
- El CEO de 008 audita después de cada merge y puede ordenar detener.
- ECC está instalado solo en el clon de trabajo propio de 008, nunca a nivel global ni en la raíz de este repo ni en la de la gestión.
- El CLI de ECC (`ecc.js install`) escribe su base de estado en `$HOME/.claude/ecc/state.db`. Se corre con `HOME` apuntando al clon y primero con `--dry-run`.
- Prohibido que ECC instale git hooks o toque `core.hooksPath` en este repo, o que escriba memoria o reglas en archivos compartidos.

## Frontera de 008 y su límite
- **Zona de ECC:** `008-2026-INVERSIONES/**` y nada más. El check `frontera-008-main` (`.github/workflows/inv-frontera.yml`, con `pull_request_target`) lo toma GitHub **siempre de `main`**, así que un PR no lo puede aflojar. Cualquier cambio fuera de la zona, incluidos `inv.yml` e `inv-frontera.yml`, da rojo, y ese PR lo revisa y lo mergea el CEO de PI.
- **Checks obligatorios (2026-11-20):** el ruleset «Gate CI - main» exige `verificar_base`, `pi-gate`, `bi-gate`, **`inv-gate`** y **`frontera-008-main`**, y que todo entre por PR. Si la frontera o las pruebas de 008 dan rojo, GitHub bloquea el merge. En los PR de PI esos dos checks salen «skipped» y no los frenan.
- **Límite conocido:** la frontera se activa por el **nombre** de la rama (`work/inv-*`). Protege de **errores** de ECC, no de un ECC que use otra rama. Por eso la regla de ECC también es parte de la barrera: **solo ramas `work/inv-<nombre-corto>`.**
- **Cambios de 008 en `.github` (raros):** los hace el **CEO de 008**, no ECC, en una rama **`work/pi-*`** de PI (allí `frontera-008-main` se omite), y los revisa y mergea el **CEO de PI**. ECC no abre ramas `work/pi-*`.

## Cómo se cierra un cambio
1. Orquestador de ECC completo con «ECC usado» en el PR.
2. CI en verde: los 5 checks obligatorios del repo.
3. Merge y despliegue por ECC (D-011).
4. `ESTADO.md` de la gestión al día.
5. Auditoría del CEO de 008.

## Producción (VPS compartido con PI, D-015)
Procedimiento completo: [`docs/despliegue/produccion.md`](docs/despliegue/produccion.md) (piezas, primer despliegue, despliegues siguientes y reversa, respaldos, túnel) y [`docs/despliegue/convivencia-pi.md`](docs/despliegue/convivencia-pi.md) (pausa obligatoria en cada despliegue de PI, medición de memoria, corte manual, vigía).

- **Sin rutas ni nombres del VPS en el repo (es público).**
  - Se escriben marcadores: `<raíz>` es la carpeta base, la que contiene al clon `<raíz>/repo`; `<respaldos>`, la de los respaldos cifrados; `<servicio-del-túnel>`, el servicio del túnel.
  - Sus valores, «<ver ESTADO en la gestión>».
  - Los scripts derivan la raíz de su ubicación y leen la carpeta de respaldos de la configuración no secreta `<raíz>/inv-008.conf`.
  - Lo cuida `tests/unit/produccion/sin-literales-infra.test.ts`, con patrones genéricos.
- **Proyecto Docker:** `inv-008-prod` (en el Mac, `inv-008-prueba`), siempre por la variable `COMPOSE`. Ningún comando global de Docker ni nombre de contenedor de PI, de BI ni de otros proyectos del VPS.
- **Secretos:** un solo archivo, `<raíz>/.env.inversiones.production` (root, 600, fuera de git). Plantilla sin valores: `docs/despliegue/env-inversiones-production.example`. Ningún agente escribe, copia ni imprime sus valores.
- **Configuración no secreta:** `<raíz>/inv-008.conf` (root, 644). Lleva una sola línea, `INV_RESPALDOS_DIR`. Plantilla: `docs/despliegue/inv-008.conf.example`.
- **Flujo:** sha de `main` con CI `inv` en verde (`inv-gate` y `app-008` en success) → `scripts/construir-imagen.sh <sha> --guardar <carpeta>` en el Mac → envío del `.tar` a `<raíz>/imagenes/` → `scripts/desplegar-prod.sh` en el VPS.
- **Red:** la app **sin salida a internet**, solo en redes `internal` y sin puertos. El único puerto, `127.0.0.1:5008`, lo publica `inv-008-entrada`, un relé TCP en node con la imagen de la app (capa 4: `Cf-Connecting-IP` y las cabeceras pasan tal cual). La base, solo en la red interna. Las redes `internal` aíslan la puerta de enlace (`gateway_mode_ipv4: isolated`): ni la app ni la base llegan al host. El vigía conserva su salida para Telegram. Su alcance y su límite, en `produccion.md` («Red»).
- **Verificación:** se da por desplegado solo con **«DEPLOY VERIFICADO <sha>»** como última línea de `desplegar-prod.sh`. Antes de esa línea verifica la salud por la entrada, la app y la base solo en redes `internal` y la app sin salida, con control positivo desde la entrada. Después, `/api/salud` debe devolver `version` igual al sha desplegado.
- **Reversa:** el clon **se queda** en el sha que corre; `desplegar-prod.sh inv-008-app:<sha anterior> --sin-migrar` (sin consultar GitHub) vuelve solo la imagen, con el compose actual, y nunca a una topología vieja (`produccion.md` §5).
- **Carga de los datos del dueño:** vía B, la importación fresca (`produccion.md` §11).
  - Va por stdin y sin copias en el VPS: `scripts/armar-sobre.sh` en el Mac → `ssh` → `scripts/cargar-prod.sh` → `inv-cargar` en el migrador.
  - La corre Jelk o quien él designe; nunca la Fábrica sola.
  - Después de las órdenes, los lotes y la ficha: la certificación (`importar-certificacion`), los precios (`precios:exportar` en el Mac → `importar-precios` por el sobre) y `conciliar-certificacion` otra vez.
  - La vía A (volcado de solo datos) no se usa.
- **Prohibido:** `docker compose down -v` y borrar volúmenes. Para bajar la app, `pausar-008.sh`.
- **Escritura y sistema:** los scripts solo escriben en `<raíz>/`, el candado común `/var/lock/despliegue-vps.lock` (contrato con PI) y `<respaldos>/`. No tocan ufw, systemctl, `/etc/` ni el crontab de root.
- El estado del despliegue lo lleva `ESTADO.md` de la gestión (fuera de este repo).
- **Gastos:** cualquier servidor, dominio o servicio pago necesita el sí del dueño antes.

## Prohibido
- Secretos, datos personales, negocio o legal en el repo (es público).
- Cambios a mano sobre la base de producción.
- Tocar carpetas o workflows de otros productos.

---
> v1.24 · 2026-11-21 · 16:53 (-05) · INV · Fábrica Inversiones (frente precios-rol) · `crear-roles-prod.sh` también crea `inv_precios` si el archivo trae su URL
> v1.23 · 2026-11-21 · 16:03 (-05) · INV · Fábrica Inversiones (frente reglas-exportar-restauracion) · `precios:exportar` con los símbolos del portafolio: la Fábrica solo con orden del CEO Inversiones (decisión del CEO, 2026-11-21)
> v1.22 · 2026-11-21 · 10:48 (-05) · INV · Fábrica ECC (frente precios-carga) · `precios:exportar` (Mac) y `precios:importar` (vía B, camino único de escritura); en la carga, certificación → precios → conciliación
> v1.21 · 2026-11-21 · 09:28 (-05) · INV · Fábrica ECC (frente app-sin-salida) · la app sin salida a internet detrás de `inv-008-entrada`, redes internal con la puerta de enlace aislada; la reversa con el clon en el sha que corre
> v1.20 · 2026-11-21 · 08:34 (-05) · INV · Fábrica Inversiones · cobertura unida (`test:cobertura` = unidad + integración con `--merge-reports`, pisos 92/93/97/92); se retiran los pisos separados
> v1.19 · 2026-11-21 · 06:57 (-05) · INV · Fábrica ECC (frente infra-literales) · sin nombres de otros proyectos del VPS en la sección de producción; reversa con el clon en el sha anterior
> v1.18 · 2026-11-21 · 06:50 (-05) · INV · Fábrica ECC (frente infra-literales) · sin rutas ni nombres del VPS (marcadores, raíz derivada, `inv-008.conf`); carga del dueño por la vía B, por stdin y sin copias en el VPS
> v1.17 · 2026-11-21 · 05:38 (-05) · INV · Fábrica Inversiones · certificación de A&V: `importar-certificacion` y `conciliar-certificacion` (hito 1, PR-B)
> v1.16 · 2026-11-21 · 04:38 (-05) · INV · Fábrica Inversiones · `precios:actualizar` re-verifica los cierres iguales contra la certificación (`--desde <corte>`)
> v1.15 · 2026-11-21 · 04:24 (-05) · INV · Fábrica Inversiones · pisos de cobertura en `test:cobertura` (solo muerden con `--coverage`)
> v1.14 · 2026-11-21 · 03:40 (-05) · INV · Fábrica Inversiones · comando `precios:depurar` (SPEC-13: cierres de días no hábiles o sin negociación)
> v1.13 · 2026-11-21 · 02:08 (-05) · INV · Fábrica Inversiones · producción con su procedimiento real (`produccion.md`, `convivencia-pi.md`, `inv-008-prod`, `.env` 600, `DEPLOY VERIFICADO`); guardianes de e2e y cobertura; comandos de datos y de producción verificados en `package.json` y `scripts/`
> v1.12 · 2026-11-20 · 21:16 (-05) · INV · Fábrica ECC · solo ECC por orden de Jelk: sin SPEC, radicados ni manual 02; ramas `work/inv-<nombre-corto>`; «ECC usado» en cada PR
> v1.11 · 2026-11-20 · 19:39 (-05) · INV · Fábrica ECC · INV-SPEC-13: precios de Yahoo
> v1.10 · 2026-11-20 · 19:22 (-05) · INV · Fábrica ECC · INV-SPEC-12: lotes, FIFO y lote de escisión
> v1.9 · 2026-11-20 · 18:35 (-05) · INV · Fábrica ECC · INV-SPEC-10: comando de eventos de escisión
> v1.8 · 2026-11-20 · 18:04 (-05) · INV · Fábrica ECC · INV-SPEC-8: comando de importación de Trii
> v1.7 · 2026-11-20 · 17:22 (-05) · INV · Fábrica ECC · INV-SPEC-5: guardianes de la app (tipos, pruebas unitarias e integración, build) y regla de migraciones
> v1.6 · 2026-11-20 · ≈17:16 (-05) · INV · Fábrica ECC · INV-SPEC-4: candados de punta a punta (rutas crudas con `-z`, frontera sin renombres, más extensiones y claves)
> v1.5 · 2026-11-20 · CEO 008 · frontera desde main (INV-SPEC-3) y su límite conocido
> v1.4 · 2026-11-20 · CEO 008 · candado de frontera y workflow que no corre en PRs de PI (condiciones 5 y 6 del CEO de PI)
> v1.6 · 2026-11-20 · CEO 008 · inv-gate y frontera-008-main obligatorios; procedimiento para cambios de 008 en .github (INV-SPEC-13)
> v1.3 · 2026-11-20 · CEO 008 · merge y despliegue autónomos de ECC (D-011)
> v1.2 · 2026-11-20 · CEO 008 · ECC como metodología de 008 (D-010)
> v1.1 · 2026-11-20 · CEO 008 · stack definido (D-008): el de la fábrica, puertos 5438/5008
> v1.0 · 2026-11-20 · CEO 008 · creación desde la plantilla del manual 02
