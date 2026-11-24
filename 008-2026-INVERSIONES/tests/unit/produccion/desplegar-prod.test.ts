// desplegar-prod.sh: el patrón de PI (flock, disco, migraciones antes de servir, healthcheck y
// «DEPLOY VERIFICADO <sha>» como última línea solo si todo pasó), más las guardas de Inversiones:
// candado propio y común con PI, marca de pausa, CI en verde en GitHub, clon en el sha, .tar verificado
// (sha256, etiquetas y disco), las tres imágenes del mismo sha, respaldo antes de migrar, mem = memswap,
// versión verificada antes y después de la espera (por la entrada, el camino del túnel), la app sin salida a
// internet (con control positivo desde la entrada) y vuelta atrás automática si falla después de migrar. La
// reversa (--sin-migrar) corre con el compose del sha que corre: nunca cruza a una topología vieja. La espera de la
// medición después de up (acuerdo con el CEO de PI): 120 s si el despliegue es solo de código, 600 s si cambian los
// servicios, los límites o la imagen base (o no se puede saber), y en la corta un piso de memoria que la extiende.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, crearRepo, entorno, envProduccionFicticio, funcion, git, idArchivo, leer008, ruta008, rutaEnPath, type Entorno, type Llamada } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const COPIAR = [
  "Dockerfile",
  "docker-compose.prod.yml",
  "scripts/produccion-comun.sh",
  "scripts/desplegar-prod.sh",
  "scripts/respaldar-base.sh",
  "scripts/medir-memoria.sh",
  "scripts/vigilar-convivencia.sh",
];
const ID = `sha256:${"d".repeat(64)}`;
const checks = (inv: string, app: string) =>
  JSON.stringify({
    total_count: 3,
    check_runs: [
      { name: "inv-gate", status: "completed", conclusion: inv, completed_at: "2026-11-20T10:00:00Z" },
      { name: "app-008", status: "completed", conclusion: app, completed_at: "2026-11-20T09:59:00Z" },
      { name: "candado-datos-reales", status: "completed", conclusion: "success", completed_at: "2026-11-20T09:58:00Z" },
    ],
  });

function preparar(extra: Record<string, string> = {}) {
  const repo = crearRepo(COPIAR);
  const base = carpetaTemporal("desplegar");
  envProduccionFicticio(base);
  mkdirSync(path.join(base, "respaldos"), { recursive: true });
  const cgroup = path.join(base, "cgroup");
  mkdirSync(path.join(cgroup, "system.slice"), { recursive: true });
  writeFileSync(path.join(cgroup, "system.slice", "memory.events"), "oom 0\noom_kill 0\n");
  const falsos = crearFalsos(base);
  const archivoMem = path.join(base, "meminfo");
  writeFileSync(archivoMem, "MemTotal: 8000000 kB\nMemAvailable: 4000000 kB\nSwapTotal: 4194300 kB\nSwapFree: 2590000 kB\n");
  const env = entorno(falsos, {
    INV_PROYECTO: "inv-008-prueba",
    INV_BASE: base,
    INV_MEMINFO: archivoMem,
    INV_CGROUP: cgroup,
    INV_ESPERA_MEDICION_S: "0",
    FALSO_ID: ID,
    FALSO_SHA: repo.sha,
    FALSO_SALUD: JSON.stringify({ estado: "ok", version: repo.sha }),
    FALSO_SALUD_ARCHIVO: path.join(base, "salud-falsa.json"),
    FALSO_CHECKS: checks("success", "success"),
    FALSO_COMPARE: JSON.stringify({ status: "ahead" }),
    FALSO_RESPALDOS_DIR: path.join(base, "respaldos"),
    FALSO_TAGS: path.join(base, "tags.txt"),
    ...extra,
  });
  return { repo, base, falsos, env, script: path.join(repo.dir008, "scripts/desplegar-prod.sh") };
}

/** Un .tar con su manifest.json (como el de `docker save`) y su sha256. */
function crearTar(dir: string, etiquetas: string[], relleno = 0) {
  const fuente = carpetaTemporal("tar");
  writeFileSync(path.join(fuente, "manifest.json"), JSON.stringify([{ Config: "x", RepoTags: etiquetas, Layers: [] }]));
  if (relleno) writeFileSync(path.join(fuente, "capa.bin"), Buffer.alloc(relleno));
  const tar = path.join(dir, "imagenes.tar");
  spawnSync("tar", ["-cf", tar, "-C", fuente, ...(relleno ? ["manifest.json", "capa.bin"] : ["manifest.json"])]);
  const sha = funcion(ruta008("scripts/produccion-comun.sh"), `sha256_de "${tar}"`).stdout.trim();
  return { tar, sha };
}
const tresEtiquetas = (sha: string) => [`inv-008-app:${sha}`, `inv-008-migrador:${sha}`, `inv-008-vigia:${sha}`];

const ultimaLinea = (s: string) => s.trim().split("\n").at(-1);
/** La única línea que la retención imprime en modo prueba (con el prefijo de informar). */
const MENSAJE_RETENCION_PRUEBA = "[desplegar-prod] retención: modo prueba (inv-008-prueba), no se borra ninguna imagen ni .tar";
const lineasDeRetencion = (stderr: string) => stderr.split("\n").filter((l) => l.includes("retención"));
const indice = (ll: Llamada[], pred: (l: Llamada) => boolean) => ll.findIndex(pred);
const compose = (sub: string, ...mas: string[]) => (l: Llamada) => l[0] === "docker" && l[1] === "compose" && l.includes(sub) && mas.every((m) => l.includes(m));
const llamadasCompose = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker" && l[1] === "compose");

describe("desplegar-prod.sh · camino feliz", () => {
  it("termina con «DEPLOY VERIFICADO <sha>» como última línea y registra el estado", async () => {
    const { repo, base, env, script } = preparar();
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${repo.sha}`);
    expect(readFileSync(path.join(base, "estado", "sha-actual"), "utf8").trim()).toBe(repo.sha);
    expect(readFileSync(path.join(base, "estado", "imagen-actual"), "utf8").trim()).toBe(ID);
  });

  it("orden: candados → disco → PI → CI → base y respaldo → roles → app detenida → respaldo → respaldo diario detenido → migrador → app → versión", async () => {
    const { falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    const ll = falsos.llamadas();
    expect(ll.filter((l) => l[0] === "flock")).toHaveLength(2);
    const pasos = [
      indice(ll, (l) => l[0] === "flock"),
      indice(ll, (l) => l[0] === "df"),
      indice(ll, (l) => l[0] === "ps"),
      indice(ll, (l) => l[0] === "curl" && l.join(" ").includes("check-runs")),
      indice(ll, compose("up", "inv-008-db", "inv-008-respaldo")),
      indice(ll, compose("exec", "psql")),
      indice(ll, compose("stop", "inv-008-app")),
      indice(ll, compose("exec", "inv-008-respaldo")),
      indice(ll, compose("stop", "inv-008-respaldo")),
      indice(ll, compose("run", "inv-008-migrador")),
      indice(ll, compose("up", "inv-008-app")),
      indice(ll, (l) => l[0] === "docker" && l[1] === "exec" && l.join(" ").includes("http://127.0.0.1:5008/api/salud")),
    ];
    for (const p of pasos) expect(p).toBeGreaterThanOrEqual(0);
    expect([...pasos].sort((a, b) => a - b)).toEqual(pasos);
  });

  it("verifica la versión dos veces: al levantar y después de la espera de la medición", async () => {
    const { falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    expect(falsos.llamadas().filter((l) => l[0] === "docker" && l[1] === "exec" && l.join(" ").includes("/api/salud"))).toHaveLength(2);
  });

  it("deja las dos mediciones de memoria (antes de up y después de la espera, con los segundos reales) en un archivo", async () => {
    const { repo, base, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    const dir = path.join(base, "estado", "mediciones");
    const archivos = readdirSync(dir);
    expect(archivos).toHaveLength(1);
    expect(archivos[0]).toMatch(new RegExp(`^${repo.sha}-\\d{8}-\\d{6}\\.txt$`));
    // La etiqueta dice la espera que hubo (aquí INV_ESPERA_MEDICION_S=0), no «10 min» si no fueron 10 min.
    expect(readFileSync(path.join(dir, archivos[0]!), "utf8")).toMatch(/== antes de up[\s\S]*== 0 s después de up/);
  });

  it("el migrador corre con run --rm y todo con el sha nuevo (INV_TAG)", async () => {
    const { repo, base, falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    expect(falsos.llamadas().find(compose("run", "inv-008-migrador"))).toEqual(expect.arrayContaining(["run", "--rm", "-T", "inv-008-migrador"]));
    for (const linea of readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n")) expect(linea).toMatch(new RegExp(`^up ${repo.sha} `));
  });

  it("acepta la imagen por etiqueta (inv-008-app:<sha>)", async () => {
    const { repo, env, script } = preparar();
    const r = await correr(script, [`inv-008-app:${repo.sha}`], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${repo.sha}`);
  });

  // Defecto reproducido: en un ensayo en el Mac (inv-008-prueba) la retención borró imágenes inv-008-*:<sha> que eran
  // las de producción (la Fábrica las construye en el Mac y las envía al VPS). La purga en producción, más abajo.
  it("modo prueba: la retención no lista ni borra ninguna imagen y lo dice en una sola línea", async () => {
    const viejo = "9".repeat(40);
    const { repo, falsos, env, script } = preparar();
    env.FALSO_IMAGENES = [`inv-008-app:${viejo}`, `inv-008-app:${repo.sha}`, `inv-008-migrador:${viejo}`, `inv-008-vigia:${viejo}`, "pi-app:latest", ""].join("\\n");
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${repo.sha}`);
    const deImagen = falsos.llamadas().filter((l) => l[0] === "docker" && l[1] === "image");
    expect(deImagen.some((l) => l[2] === "inspect"), "control positivo: el registro ve las llamadas de imagen").toBe(true);
    expect(deImagen.filter((l) => l[2] === "rm" || l[2] === "ls")).toEqual([]);
    expect(lineasDeRetencion(r.stderr)).toEqual([MENSAJE_RETENCION_PRUEBA]);
  });
});

describe("desplegar-prod.sh · guardas que abortan sin DEPLOY VERIFICADO", () => {
  const casos: Array<[string, Record<string, string>, string[]?]> = [
    ["CI rojo (inv-gate failure)", { FALSO_CHECKS: checks("failure", "success") }],
    ["app-008 saltado", { FALSO_CHECKS: checks("success", "skipped") }],
    ["sin check-runs", { FALSO_CHECKS: JSON.stringify({ total_count: 0, check_runs: [] }) }],
    ["GitHub no responde", { FALSO_CURL_RC: "22" }],
    ["sha fuera de main", { FALSO_COMPARE: JSON.stringify({ status: "diverged" }) }],
    ["disco bajo 15 GB", { FALSO_DF_KB: String(14 * 1024 * 1024) }],
    ["otro despliegue de Inversiones (candado propio)", { FALSO_FLOCK_OCUPADO: "8" }],
    ["PI desplegando (candado común)", { FALSO_FLOCK_OCUPADO: "9" }],
    ["PI desplegando (proceso)", { FALSO_PS: "bash\\n/bin/bash -x ./scripts/deploy-prod.sh\\n" }],
    ["imagen de otro sha que el clon", { FALSO_SHA: "e".repeat(40) }],
    ["migrador ausente", { FALSO_IMAGEN_FALTA: "MIGRADOR" }],
    ["vigía ausente", { FALSO_IMAGEN_FALTA: "VIGIA" }],
    ["imagen arm64", { FALSO_ARQ: "arm64" }],
    ["faltan los roles", { FALSO_ROLES: "0" }],
    ["falla el respaldo", { FALSO_RESPALDO_RC: "2" }],
    ["falla el migrador (o el guardián del esquema)", { FALSO_MIGRADOR_RC: "1" }],
    ["la app no queda healthy (solo falla su up)", { FALSO_UP_FALLA_TAG: "NUEVO" }],
    ["la app se reinició (instrumentation.ts sale sin AUTH_SECRET)", { FALSO_ESTADO_APP: "running 2" }],
    ["el contenedor corre otra imagen", { FALSO_IMAGEN_CONTENEDOR: `sha256:${"f".repeat(64)}` }],
    ["/api/salud con otra versión", { FALSO_SALUD: JSON.stringify({ estado: "ok", version: "local" }) }],
    ["/api/salud degradado", { FALSO_SALUD_DEGRADADO: "1" }],
    ["memoria con swap (Memory ≠ MemorySwap)", { FALSO_MEMSWAP: "402653184 805306368" }],
    ["la salud cae durante la espera de la medición", { FALSO_SLEEP_ROMPE_SALUD: JSON.stringify({ estado: "degradado", version: "x" }) }],
    ["LA APP TIENE SALIDA a internet (llega a la IP de la sonda)", { FALSO_NC_APP_RC: "0", FALSO_NC_APP_MSG: "" }],
    ["la app no llega, pero por tiempo agotado y no por falta de ruta (ambiguo)", { FALSO_NC_APP_MSG: "nc: timed out" }],
    ["la app no llega porque el destino rechaza (Connection refused: sí hay ruta)", { FALSO_NC_APP_MSG: "nc: 203.0.113.7 (203.0.113.7:443): Connection refused" }],
    ["falla el control positivo en los tres intentos (la entrada tampoco llega): la prueba no probaría nada", { FALSO_NC_ENTRADA_RC: "1" }],
    ["la entrada no resuelve el destino de la sonda (sin control positivo)", { FALSO_NSLOOKUP_ENTRADA: "** server can't find api.telegram.org: SERVFAIL\\n", FALSO_NSLOOKUP_ENTRADA_RC: "1" }],
    ["la app resuelve nombres de internet (DNS externo)", { FALSO_NSLOOKUP_APP: "Name:\\tapi.telegram.org\\nAddress: 203.0.113.9\\n", FALSO_NSLOOKUP_APP_RC: "0" }],
    ["la app publica un puerto (debe quedar solo detrás de la entrada)", { FALSO_PUERTO_APP: "5008/tcp -> 127.0.0.1:5008" }],
    ["la app está en una red con salida", { FALSO_REDES_APP: "inv-008-prueba_inv-008-red inv-008-prueba_inv-008-red-interna", FALSO_REDES_CON_SALIDA: "inv-008-prueba_inv-008-red" }],
    ["la base está en una red con salida", { FALSO_REDES_DB: "inv-008-prueba_inv-008-red-interna inv-008-prueba_inv-008-red", FALSO_REDES_CON_SALIDA: "inv-008-prueba_inv-008-red" }],
    ["la red interna de la base, internal pero sin aislar la puerta de enlace (llegaría al host)", { FALSO_REDES_SIN_AISLAR: "inv-008-prueba_inv-008-red-interna" }],
    ["la red de la entrada, internal pero sin aislar la puerta de enlace (la app llegaría al host)", { FALSO_REDES_SIN_AISLAR: "inv-008-prueba_inv-008-red-entrada" }],
    ["la red interna dice isolated pero tiene puerta de enlace del host (el demonio no aplicó el aislamiento)", { FALSO_REDES_CON_GW: "inv-008-prueba_inv-008-red-interna" }],
    ["no hay contenedor de la entrada", { FALSO_CID_ENTRADA: "" }],
    ["la entrada se reinició (no quedó corriendo de una vez)", { FALSO_ESTADO_ENTRADA: "running 1" }],
    ["la entrada corre otra imagen que la enviada", { FALSO_IMAGEN_ENTRADA: `sha256:${"e".repeat(64)}` }],
    ["id inválido", {}, ["no-es-un-id"]],
    ["opción desconocida", {}, ["--forzar"]],
  ];
  for (const [nombre, extra, args] of casos) {
    it(nombre, async () => {
      const { repo, base, env, script } = preparar(extra);
      if (extra.FALSO_IMAGEN_FALTA === "MIGRADOR") env.FALSO_IMAGEN_FALTA = `inv-008-migrador:${repo.sha}`;
      if (extra.FALSO_IMAGEN_FALTA === "VIGIA") env.FALSO_IMAGEN_FALTA = `inv-008-vigia:${repo.sha}`;
      if (extra.FALSO_SALUD_DEGRADADO) env.FALSO_SALUD = JSON.stringify({ estado: "degradado", version: repo.sha });
      if (extra.FALSO_UP_FALLA_TAG) env.FALSO_UP_FALLA_TAG = repo.sha;
      const r = await correr(script, args ?? [ID], env);
      expect(r.status).not.toBe(0);
      expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
      if (!extra.FALSO_SLEEP_ROMPE_SALUD) expect(existsSync(path.join(base, "estado", "sha-actual"))).toBe(false);
    });
  }

  it("el candado común ocupado dice «PI desplegando»", async () => {
    const { env, script } = preparar({ FALSO_FLOCK_OCUPADO: "9" });
    expect((await correr(script, [ID], env)).stderr).toMatch(/PI desplegando/);
  });

  it("con la marca de pausa, se niega antes de tocar nada", async () => {
    const { base, falsos, env, script } = preparar();
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "pausado"), "pausa manual\n");
    const r = await correr(script, [ID], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/pausa/);
    expect(llamadasCompose(falsos.llamadas())).toEqual([]);
    // La marca se lee DESPUÉS de tomar el candado (nadie la puede poner o quitar entre medio).
    expect(falsos.llamadas().filter((l) => l[0] === "flock").length).toBeGreaterThanOrEqual(1);
  });

  it("CI rojo, disco o PI: aborta antes de cualquier docker compose", async () => {
    const extras: Array<Record<string, string>> = [{ FALSO_CHECKS: checks("failure", "success") }, { FALSO_DF_KB: "1" }, { FALSO_PS: "deploy-prod.sh\\n" }];
    for (const extra of extras) {
      const { falsos, env, script } = preparar(extra);
      await correr(script, [ID], env);
      expect(llamadasCompose(falsos.llamadas())).toEqual([]);
    }
  });

  it("si falla el migrador, la app nunca se levanta", async () => {
    const { falsos, env, script } = preparar({ FALSO_MIGRADOR_RC: "1" });
    await correr(script, [ID], env);
    expect(falsos.llamadas().some(compose("up", "inv-008-app"))).toBe(false);
  });

  it("clon con cambios sin commit: aborta", async () => {
    const { repo, env, script } = preparar();
    writeFileSync(path.join(repo.dir008, "docker-compose.prod.yml"), "cambiado: sí\n");
    expect((await correr(script, [ID], env)).status).not.toBe(0);
  });

  it("sha que no desciende del que corre: aborta (no se migra hacia atrás)", async () => {
    const { base, falsos, env, script } = preparar();
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${"7".repeat(40)}\n`);
    expect((await correr(script, [ID], env)).status).not.toBe(0);
    expect(falsos.llamadas().some(compose("run", "inv-008-migrador"))).toBe(false);
  });

  it("OOM nuevo o memoria baja al final: sale con 3, sin DEPLOY VERIFICADO y SIN detener nada (el corte es manual)", async () => {
    const { base, falsos, env, script } = preparar();
    const archivoMem = path.join(base, "meminfo-bajo");
    writeFileSync(archivoMem, "MemTotal: 8000000 kB\nMemAvailable: 900000 kB\nSwapTotal: 4194300 kB\nSwapFree: 100000 kB\n");
    const r = await correr(script, [ID], { ...env, INV_MEMINFO: archivoMem });
    expect(r.status).toBe(3);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    const ll = falsos.llamadas();
    // La espera explícita (0 s) es menor que la completa: el piso la extiende hasta los 600 s antes de rendirse.
    expect(ll.filter((l) => l[0] === "sleep").map((l) => l[1])).toEqual(["0", "600"]);
    expect(ll.some((l) => l.includes("down"))).toBe(false);
    // Las únicas detenciones son las de antes del migrador (app y respaldo diario).
    expect(ll.slice(indice(ll, compose("run", "inv-008-migrador"))).some((l) => l.includes("stop"))).toBe(false);
  });
});

describe("desplegar-prod.sh · vuelta atrás automática si falla después de migrar", () => {
  it("si el up de la app falla, vuelve a levantar la imagen que corría (sha-actual)", async () => {
    const { repo, base, env, script } = preparar();
    git(repo.dir, ["commit", "-q", "--allow-empty", "-m", "segundo"]);
    const nuevo = git(repo.dir, ["rev-parse", "HEAD"]);
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${repo.sha}\n`);
    writeFileSync(path.join(base, "estado", "imagen-actual"), `sha256:${"a".repeat(64)}\n`);
    const r = await correr(script, [ID], { ...env, FALSO_SHA: nuevo, FALSO_SALUD: JSON.stringify({ estado: "ok", version: nuevo }), FALSO_UP_FALLA_TAG: nuevo });
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/vuelta atrás/i);
    const ups = readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n");
    expect(ups.at(-1)).toMatch(new RegExp(`^up ${repo.sha} .*inv-008-app`));
    expect(readFileSync(path.join(base, "estado", "sha-actual"), "utf8").trim()).toBe(repo.sha);
  });

  it("en el primer despliegue no hay imagen anterior: falla sin vuelta atrás", async () => {
    const { repo, base, env, script } = preparar();
    const r = await correr(script, [ID], { ...env, FALSO_UP_FALLA_TAG: repo.sha });
    expect(r.status).not.toBe(0);
    const ups = readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n");
    expect(ups.every((l) => l.startsWith(`up ${repo.sha} `))).toBe(true);
  });
});

describe("desplegar-prod.sh · reversa (--sin-migrar) y carga del .tar", () => {
  it("--sin-migrar acepta la imagen actual o la anterior, no migra y NO consulta GitHub", async () => {
    for (const archivo of ["imagen-actual", "imagen-anterior"]) {
      const { base, falsos, env, script } = preparar({ FALSO_CURL_RC: "22" });
      expect((await correr(script, [ID, "--sin-migrar"], env)).status).not.toBe(0);
      mkdirSync(path.join(base, "estado"), { recursive: true });
      writeFileSync(path.join(base, "estado", archivo), `${ID}\n`);
      const r = await correr(script, [ID, "--sin-migrar"], env);
      expect(r.status, `${archivo}: ${r.stderr}`).toBe(0);
      expect(falsos.llamadas().some(compose("run", "inv-008-migrador"))).toBe(false);
      expect(falsos.llamadas().some((l) => l[0] === "curl")).toBe(false);
    }
  });

  it("--cargar verifica el sha256 del .tar ANTES de docker load", async () => {
    const { repo, base, falsos, env, script } = preparar();
    const { tar, sha } = crearTar(base, tresEtiquetas(repo.sha));
    expect((await correr(script, [ID, "--cargar", tar, "0".repeat(64)], env)).status).not.toBe(0);
    expect(falsos.llamadas().some((l) => l[1] === "load")).toBe(false);
    const bueno = await correr(script, [ID, "--cargar", tar, sha], env);
    expect(bueno.status, bueno.stderr).toBe(0);
    expect(falsos.llamadas().find((l) => l[1] === "load")).toEqual(["docker", "load", "-i", tar]);
  });

  it("--cargar rechaza un .tar con etiquetas ajenas o de otro sha", async () => {
    for (const etiquetas of [[...tresEtiquetas("1".repeat(40)), "pi-app:latest"], ["inv-008-app:" + "2".repeat(40)], []]) {
      const { base, falsos, env, script } = preparar();
      const { tar, sha } = crearTar(base, etiquetas);
      expect((await correr(script, [ID, "--cargar", tar, sha], env)).status).not.toBe(0);
      expect(falsos.llamadas().some((l) => l[1] === "load")).toBe(false);
    }
  });

  it("--cargar exige 15 GB más dos veces el .tar libres antes de cargar", async () => {
    const { repo, base, falsos, env, script } = preparar({ FALSO_DF_KB: String(15 * 1024 * 1024 + 1024) });
    const { tar, sha } = crearTar(base, tresEtiquetas(repo.sha), 2 * 1024 * 1024);
    expect((await correr(script, [ID, "--cargar", tar, sha], env)).status).not.toBe(0);
    expect(falsos.llamadas().some((l) => l[1] === "load")).toBe(false);
  });

  it("modo prueba: la retención no borra ningún .tar de imagenes/, tampoco los de shas viejos", async () => {
    const { repo, base, env, script } = preparar();
    const dir = path.join(base, "imagenes");
    mkdirSync(dir);
    for (const s of ["1".repeat(40), "2".repeat(40), repo.sha]) {
      writeFileSync(path.join(dir, `inv-008-${s}.tar`), "x");
      writeFileSync(path.join(dir, `inv-008-${s}.tar.sha256`), "x");
    }
    writeFileSync(path.join(dir, "otro-archivo.txt"), "x");
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-anterior"), `${"2".repeat(40)}\n`);
    const antes = readdirSync(dir).sort();
    expect(antes).toHaveLength(7);
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(readdirSync(dir).sort()).toEqual(antes);
    expect(lineasDeRetencion(r.stderr)).toEqual([MENSAJE_RETENCION_PRUEBA]);
  });

  it("modo prueba: la reversa (--sin-migrar) tampoco borra imágenes", async () => {
    const { base, falsos, env, script } = preparar();
    env.FALSO_IMAGENES = [...tresEtiquetas("9".repeat(40)), ""].join("\\n");
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "imagen-actual"), `${ID}\n`);
    const r = await correr(script, [ID, "--sin-migrar"], env);
    expect(r.status, r.stderr).toBe(0);
    expect(falsos.llamadas().filter((l) => l[0] === "docker" && l[1] === "image" && (l[2] === "rm" || l[2] === "ls"))).toEqual([]);
    expect(lineasDeRetencion(r.stderr)).toEqual([MENSAJE_RETENCION_PRUEBA]);
  });
});

describe("desplegar-prod.sh · pausa antes del migrador (la app vieja no retiene tablas) y su reversa", () => {
  const conEstado = (sha: string, imagen = ID) => {
    const p = preparar();
    mkdirSync(path.join(p.base, "estado"), { recursive: true });
    writeFileSync(path.join(p.base, "estado", "sha-actual"), `${sha}\n`);
    writeFileSync(path.join(p.base, "estado", "imagen-actual"), `${imagen}\n`);
    return p;
  };
  const ups = (base: string) => readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n");

  it("revisa PI antes de detener la app (si PI aparece, no se detiene nada)", async () => {
    const { falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    const ll = falsos.llamadas();
    const roles = indice(ll, compose("exec", "psql"));
    const stopApp = indice(ll, compose("stop", "inv-008-app"));
    const ps = ll.findIndex((l, i) => i > roles && l[0] === "ps");
    expect(ps).toBeGreaterThan(roles);
    expect(ps).toBeLessThan(stopApp);
  });

  it("después del migrador levanta los cuatro permanentes: app, entrada, vigía y respaldo", async () => {
    const { falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    const ll = falsos.llamadas();
    const final = ll.slice(indice(ll, compose("run", "inv-008-migrador"))).find(compose("up"));
    expect(final).toEqual(expect.arrayContaining(["up", "-d", "--wait", "inv-008-app", "inv-008-entrada", "inv-008-vigia", "inv-008-respaldo"]));
  });

  it("con --sin-migrar no detiene nada (no hay migración que proteger)", async () => {
    const { falsos, env, script } = conEstado("7".repeat(40));
    const r = await correr(script, [ID, "--sin-migrar"], env);
    expect(r.status, r.stderr).toBe(0);
    expect(falsos.llamadas().some(compose("stop"))).toBe(false);
  });

  it("re-desplegar el mismo sha con el migrador fallido: la vuelta atrás levanta otra vez la app detenida", async () => {
    const { repo, base, env, script } = preparar();
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${repo.sha}\n`);
    writeFileSync(path.join(base, "estado", "imagen-actual"), `${ID}\n`);
    const r = await correr(script, [ID], { ...env, FALSO_MIGRADOR_RC: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/vuelta atrás/i);
    expect(ups(base).at(-1)).toMatch(new RegExp(`^up ${repo.sha} .*inv-008-app.*inv-008-entrada.*inv-008-vigia.*inv-008-respaldo`));
  });

  for (const [nombre, falla] of [
    ["el migrador (o el guardián del esquema)", { FALSO_MIGRADOR_RC: "1" }],
    ["el respaldo previo (con la app ya detenida)", { FALSO_RESPALDO_RC: "2" }],
  ] as const) {
    it(`si falla ${nombre}, vuelve a levantar app, vigía y respaldo con el sha que corría`, async () => {
      const { repo, base, env, script } = preparar();
      git(repo.dir, ["commit", "-q", "--allow-empty", "-m", "segundo"]);
      const nuevo = git(repo.dir, ["rev-parse", "HEAD"]);
      mkdirSync(path.join(base, "estado"), { recursive: true });
      writeFileSync(path.join(base, "estado", "sha-actual"), `${repo.sha}\n`);
      writeFileSync(path.join(base, "estado", "imagen-actual"), `sha256:${"a".repeat(64)}\n`);
      const r = await correr(script, [ID], { ...env, ...falla, FALSO_SHA: nuevo, FALSO_SALUD: JSON.stringify({ estado: "ok", version: nuevo }) });
      expect(r.status).not.toBe(0);
      expect(ups(base).at(-1)).toMatch(new RegExp(`^up ${repo.sha} .*inv-008-app.*inv-008-entrada.*inv-008-vigia.*inv-008-respaldo`));
      expect(readFileSync(path.join(base, "estado", "sha-actual"), "utf8").trim()).toBe(repo.sha);
    });
  }

  for (const [nombre, falla] of [
    ["el migrador", { FALSO_MIGRADOR_RC: "1" }],
    ["el respaldo previo", { FALSO_RESPALDO_RC: "2" }],
  ] as const) {
    it(`primer despliegue y falla ${nombre}: no hay imagen a la que volver, no inventa una y lo dice`, async () => {
      const { repo, base, env, script } = preparar(falla);
      const r = await correr(script, [ID], env);
      expect(r.status).not.toBe(0);
      expect(ups(base).every((l) => l.startsWith(`up ${repo.sha} `) && !l.includes("inv-008-app"))).toBe(true);
      expect(r.stderr).toMatch(/no hay imagen a la que volver/);
    });
  }

  it("la vuelta atrás nunca levanta un sha que no sea de 40 hex (estado/sha-actual dañado)", async () => {
    const { repo, base, env, script } = preparar();
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), "latest\n");
    writeFileSync(path.join(base, "estado", "imagen-actual"), `${ID}\n`);
    const r = await correr(script, [ID, "--sin-migrar"], { ...env, FALSO_UP_FALLA_TAG: repo.sha });
    expect(r.status).not.toBe(0);
    expect(ups(base).some((l) => l.startsWith("up latest "))).toBe(false);
    expect(r.stderr).toMatch(/no se vuelve/);
  });
});

describe("desplegar-prod.sh · la app sin salida a internet, detrás de la entrada", () => {
  const execs = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker" && l[1] === "exec");
  const posicion = (ll: Llamada[], cid: string, programa: string) => execs(ll).findIndex((l) => l[2] === cid && l[3] === programa);

  it("la salud con la versión se pide DENTRO de la entrada (el camino del túnel), nunca en la app", async () => {
    const { base, env, script } = preparar();
    const registro = path.join(base, "execs.txt");
    const r = await correr(script, [ID], { ...env, FALSO_EXECS: registro });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(registro, "utf8").trim().split("\n")).toEqual(["cidentrada", "cidentrada"]);
  });

  it("prueba la no salida con control positivo: la entrada resuelve la sonda y llega; la app no llega (sin ruta) ni resuelve", async () => {
    const { falsos, env, script } = preparar();
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    const ll = falsos.llamadas();
    // -v: sin él, el nc de busybox no dice POR QUÉ no conectó (medido en la imagen de la app).
    const sonda = ["nc", "-z", "-v", "-w", "5", "203.0.113.7", "443"];
    expect(execs(ll)).toContainEqual(["docker", "exec", "cidentrada", ...sonda]);
    expect(execs(ll)).toContainEqual(["docker", "exec", "cidapp", ...sonda]);
    expect(execs(ll)).toContainEqual(["docker", "exec", "cidentrada", "nslookup", "-type=a", "api.telegram.org"]);
    expect(execs(ll)).toContainEqual(["docker", "exec", "cidapp", "nslookup", "-type=a", "api.telegram.org"]);
    // El control positivo va ANTES: si la entrada no llega, la prueba de la app no prueba nada.
    expect(posicion(ll, "cidentrada", "nc")).toBeLessThan(posicion(ll, "cidapp", "nc"));
    expect(r.stderr).toMatch(/la app no tiene salida a internet/);
  });

  it("revisa una por una las redes de la app y de la base: todas internal y con la puerta de enlace aislada", async () => {
    const { falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    const redes = falsos.llamadas().filter((l) => l[0] === "docker" && l[1] === "inspect" && l.join(" ").includes(".Internal") && !l.join(" ").includes("bridge.name"));
    expect(new Set(redes.map((l) => l.at(-1)))).toEqual(new Set(["inv-008-prueba_inv-008-red-entrada", "inv-008-prueba_inv-008-red-interna"]));
    for (const l of redes) {
      expect(l.join(" ")).toContain('{{index .Options "com.docker.network.bridge.gateway_mode_ipv4"}}');
      // El efecto, no solo la opción: una red aislada no tiene puerta de enlace del host.
      expect(l.join(" ")).toContain("{{range .IPAM.Config}}{{.Gateway}}{{end}}");
    }
  });

  it("una red internal sin aislar la puerta de enlace detiene el despliegue y lo dice", async () => {
    const { env, script } = preparar({ FALSO_REDES_SIN_AISLAR: "inv-008-prueba_inv-008-red-entrada" });
    const r = await correr(script, [ID], env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/sin aislar la puerta de enlace/);
  });

  it("el control positivo se reintenta (depende de un tercero): si la entrada llega al segundo intento, el despliegue sigue", async () => {
    const { base, falsos, env, script } = preparar({ FALSO_NC_ENTRADA_FALLAS: "1" });
    const r = await correr(script, [ID], { ...env, FALSO_CONTADOR_NC: path.join(base, "contador-nc.txt") });
    expect(r.status, r.stderr).toBe(0);
    expect(execs(falsos.llamadas()).filter((l) => l[2] === "cidentrada" && l[3] === "nc")).toHaveLength(2);
  });

  it("si el control positivo nunca llega, lo dice como caída externa (no como salida de la app) y no hay DEPLOY VERIFICADO", async () => {
    const { falsos, env, script } = preparar({ FALSO_NC_ENTRADA_RC: "1" });
    const r = await correr(script, [ID], env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/control positivo caído/);
    expect(execs(falsos.llamadas()).filter((l) => l[2] === "cidentrada" && l[3] === "nc")).toHaveLength(3);
    // Sin control positivo, la prueba de la app ni se intenta.
    expect(execs(falsos.llamadas()).some((l) => l[2] === "cidapp" && l[3] === "nc")).toBe(false);
  });

  it("si la app tiene salida, no hay DEPLOY VERIFICADO y lo dice en mayúsculas", async () => {
    const { env, script } = preparar({ FALSO_NC_APP_RC: "0", FALSO_NC_APP_MSG: "" });
    const r = await correr(script, [ID], env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/LA APP TIENE SALIDA A INTERNET/);
  });
});

describe("desplegar-prod.sh · redes de una versión anterior (sin aislar): down sin -v antes de levantar", () => {
  // Medido en el Mac (Compose 5.3.1): Compose no recrea en su lugar una red internal cuyas driver_opts cambiaron si hay
  // contenedores conectados («container … is not connected to the network»); el up falla y la vuelta atrás también.
  // Con un down previo (sin -v), el up crea las redes nuevas sin problema.
  const VIEJA = "inv-008-prueba_inv-008-red-interna";

  it("si la red interna existe sin aislar, baja el proyecto con down SIN -v antes de levantar la base, y despliega", async () => {
    const { repo, falsos, env, script } = preparar({ FALSO_REDES_VIEJAS: VIEJA });
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${repo.sha}`);
    const ll = falsos.llamadas();
    const down = indice(ll, compose("down"));
    expect(down).toBeGreaterThanOrEqual(0);
    expect(ll[down]).not.toContain("-v");
    expect(ll[down]).not.toContain("--volumes");
    expect(down).toBeLessThan(indice(ll, compose("up", "inv-008-db", "inv-008-respaldo")));
    expect(r.stderr).toMatch(/redes de una versión anterior/);
  });

  it("con las redes al día o sin redes todavía, no baja nada", async () => {
    const extras: Array<Record<string, string>> = [{}, { FALSO_REDES_AL_DIA: `${VIEJA} inv-008-prueba_inv-008-red-entrada` }];
    for (const extra of extras) {
      const { falsos, env, script } = preparar(extra);
      expect((await correr(script, [ID], env)).status).toBe(0);
      expect(falsos.llamadas().some(compose("down"))).toBe(false);
    }
  });

  it("después de ese down, si algo falla, la vuelta atrás levanta todo con el sha que corría (aunque sea el mismo)", async () => {
    const { repo, base, env, script } = preparar({ FALSO_REDES_VIEJAS: VIEJA, FALSO_ROLES: "0" });
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${repo.sha}\n`);
    writeFileSync(path.join(base, "estado", "imagen-actual"), `${ID}\n`);
    const r = await correr(script, [ID, "--sin-migrar"], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/vuelta atrás/i);
    const ups = readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n");
    expect(ups.at(-1)).toMatch(new RegExp(`^up ${repo.sha} .*inv-008-app.*inv-008-entrada.*inv-008-vigia.*inv-008-respaldo`));
  });

  it("valida la carpeta de respaldos ANTES de ese down: si dejó de ser válida, no baja nada", async () => {
    const { base, falsos, env, script } = preparar({ FALSO_REDES_VIEJAS: VIEJA });
    const r = await correr(script, [ID], { ...env, FALSO_BORRAR_EN_PS: path.join(base, "respaldos") });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/carpeta de respaldos dejó de pasar la validación/);
    expect(falsos.llamadas().some(compose("down"))).toBe(false);
  });

  it("revisa otra vez que PI no esté desplegando justo antes de ese down", async () => {
    const { falsos, env, script } = preparar({ FALSO_REDES_VIEJAS: VIEJA });
    expect((await correr(script, [ID], env)).status).toBe(0);
    const ll = falsos.llamadas();
    const down = indice(ll, compose("down"));
    const ps = ll.slice(0, down).map((l, i) => (l[0] === "ps" ? i : -1)).filter((i) => i >= 0);
    expect(ps.length).toBeGreaterThanOrEqual(2);
    expect(ll.slice(ps.at(-1)! + 1, down).some(compose("up"))).toBe(false);
  });

  it("si el down falla, se detiene sin levantar nada a medias", async () => {
    const { falsos, env, script } = preparar({ FALSO_REDES_VIEJAS: VIEJA, FALSO_DOWN_RC: "1" });
    const r = await correr(script, [ID], env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(falsos.llamadas().some(compose("up", "inv-008-db"))).toBe(false);
  });
});

describe("desplegar-prod.sh · reversa con el compose del sha que corre (el clon no se mueve)", () => {
  // viejo = repo.sha: la imagen anterior, de antes del cambio de topología. nuevo = el sha que corre, y donde está el clon.
  const conCambio = () => {
    const p = preparar();
    git(p.repo.dir, ["commit", "-q", "--allow-empty", "-m", "cambio de topología"]);
    const nuevo = git(p.repo.dir, ["rev-parse", "HEAD"]);
    const estado = path.join(p.base, "estado");
    mkdirSync(estado, { recursive: true });
    writeFileSync(path.join(estado, "sha-actual"), `${nuevo}\n`);
    writeFileSync(path.join(estado, "imagen-actual"), `sha256:${"a".repeat(64)}\n`);
    writeFileSync(path.join(estado, "sha-anterior"), `${p.repo.sha}\n`);
    writeFileSync(path.join(estado, "imagen-anterior"), `${ID}\n`);
    return { ...p, viejo: p.repo.sha, nuevo };
  };

  it("ALTO reproducido: la reversa a un sha anterior al cambio deja el sitio ARRIBA (app y entrada con el sha anterior, salud por la entrada)", async () => {
    const { repo, base, falsos, env, script, viejo, nuevo } = conCambio();
    const r = await correr(script, [`inv-008-app:${viejo}`, "--sin-migrar"], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${viejo}`);
    const ups = readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n");
    expect(ups.at(-1)).toMatch(new RegExp(`^up ${viejo} .*inv-008-app.*inv-008-entrada.*inv-008-vigia.*inv-008-respaldo`));
    // Nada se baja ni se borra a mano: la topología (la del compose que corre) no cambia en la reversa.
    expect(falsos.llamadas().some((l) => l[0] === "docker" && l[1] === "compose" && (l.includes("rm") || l.includes("down")))).toBe(false);
    expect(git(repo.dir, ["rev-parse", "HEAD"])).toBe(nuevo);
    expect(readFileSync(path.join(base, "estado", "sha-actual"), "utf8").trim()).toBe(viejo);
    expect(r.stderr).toMatch(/reversa con el compose del clon .*desde el sha que corre/);
  });

  it("la reversa con el clon más adelante que el sha que corre (un despliegue que falló) usa ese compose y deja el sitio arriba", async () => {
    const { repo, base, env, script, viejo } = conCambio();
    git(repo.dir, ["commit", "-q", "--allow-empty", "-m", "despliegue que falló: el clon quedó aquí"]);
    const r = await correr(script, [`inv-008-app:${viejo}`, "--sin-migrar"], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${viejo}`);
    const ups = readFileSync(path.join(base, "tags.txt"), "utf8").trim().split("\n");
    expect(ups.at(-1)).toMatch(new RegExp(`^up ${viejo} .*inv-008-app.*inv-008-entrada`));
  });

  it("la reversa con el clon en un sha que no desciende del que corre (otra rama): aborta sin tocar contenedores", async () => {
    const { repo, falsos, env, script, viejo } = conCambio();
    git(repo.dir, ["checkout", "-q", "-b", "otra", viejo]);
    git(repo.dir, ["commit", "-q", "--allow-empty", "-m", "otra rama, que no trae el sha que corre"]);
    const r = await correr(script, [`inv-008-app:${viejo}`, "--sin-migrar"], env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(llamadasCompose(falsos.llamadas())).toEqual([]);
  });

  it("la reversa a una imagen que no es anterior al clon (su sha no es ancestro del que corre): aborta", async () => {
    const { falsos, env, script } = conCambio();
    const r = await correr(script, [ID, "--sin-migrar"], { ...env, FALSO_SHA: "e".repeat(40) });
    expect(r.status).not.toBe(0);
    expect(llamadasCompose(falsos.llamadas())).toEqual([]);
  });

  it("sin --sin-migrar el clon tiene que estar en el sha de la imagen (las migraciones van con su código)", async () => {
    const { falsos, env, script, viejo } = conCambio();
    const r = await correr(script, [`inv-008-app:${viejo}`], env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(falsos.llamadas().some(compose("run", "inv-008-migrador"))).toBe(false);
  });
});

describe("desplegar-prod.sh · tamaño del pool de la app (connection_limit): solo avisa, no bloquea", () => {
  const sinValor = (texto: string) => {
    expect(texto).not.toContain("c".repeat(64));
    expect(texto).not.toMatch(/postgresql:\/\//);
  };

  it("sin connection_limit en la URL de la app: avisa sin imprimir la URL y despliega igual", async () => {
    const { repo, base, env, script } = preparar();
    envProduccionFicticio(base, { INV_APP_DATABASE_URL: `postgresql://inv_app:${"c".repeat(64)}@inv-008-db:5432/inversiones?schema=public` });
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${repo.sha}`);
    expect(r.stderr).toMatch(/sin connection_limit en la URL de la app/);
    sinValor(r.stderr + r.stdout);
  });

  it("connection_limit por encima del tope (20, con inv_app limitado a 10): avisa y despliega igual", async () => {
    const { base, env, script } = preparar();
    envProduccionFicticio(base, { INV_APP_DATABASE_URL: `postgresql://inv_app:${"c".repeat(64)}@inv-008-db:5432/inversiones?schema=public&connection_limit=20` });
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/connection_limit/);
    sinValor(r.stderr + r.stdout);
  });

  it("con connection_limit=5 (el de la plantilla) no avisa", async () => {
    const { env, script } = preparar();
    const r = await correr(script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).not.toMatch(/connection_limit/);
  });
});

// La retención borra solo en producción. El modo producción no corre entero como usuario (exige las anclas de root),
// así que aquí se prueban las funciones con `funcion` y el proyecto fijado DESPUÉS del source. Cinturón: antes de
// nada, el docker que resuelve el PATH tiene que ser el falso (si no, sale 97 sin llamar a nada); y el control
// positivo de producción exige ver los `docker image ls` en el registro del falso.
describe("desplegar-prod.sh · retención: borra solo en producción", () => {
  const script = ruta008("scripts/desplegar-prod.sh");
  const actual = "a".repeat(40);
  const anterior = "b".repeat(40);
  const viejo = "c".repeat(40);
  const CINTURON = '[ "$(command -v docker)" = "$FALSO_BIN/docker" ] || exit 97';
  const fijar = (proyecto: string | null) =>
    [
      CINTURON,
      proyecto === null ? "unset INV_PROYECTO_ACTIVO" : `INV_PROYECTO_ACTIVO='${proyecto}'`,
      'INV_RAIZ="$T_BASE"',
      'INV_ESTADO_DIR="$T_BASE/estado"',
      `SHA='${actual}'`,
    ].join("; ");
  const borradas = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker" && l[1] === "image" && l[2] === "rm").map((l) => l[3]);

  /** Raíz temporal con el sha anterior en estado/, .tar de tres shas y un archivo ajeno; el docker falso lista imágenes de los tres y una ajena. */
  function prepararRetencion() {
    const base = carpetaTemporal("retencion");
    const falsos = crearFalsos(base);
    mkdirSync(path.join(base, "estado"));
    writeFileSync(path.join(base, "estado", "sha-anterior"), `${anterior}\n`);
    const dir = path.join(base, "imagenes");
    mkdirSync(dir);
    for (const s of [actual, anterior, viejo]) {
      writeFileSync(path.join(dir, `inv-008-${s}.tar`), "x");
      writeFileSync(path.join(dir, `inv-008-${s}.tar.sha256`), "x");
    }
    writeFileSync(path.join(dir, "otro-archivo.txt"), "x");
    const imagenes = [...tresEtiquetas(actual), ...tresEtiquetas(anterior), ...tresEtiquetas(viejo), "pi-app:latest", ""];
    const env = entorno(falsos, { FALSO_BIN: falsos.fijos, FALSO_IMAGENES: imagenes.join("\\n"), T_BASE: base });
    return { dir, falsos, env };
  }
  const conservados = [`inv-008-${actual}.tar`, `inv-008-${actual}.tar.sha256`, `inv-008-${anterior}.tar`, `inv-008-${anterior}.tar.sha256`, "otro-archivo.txt"].sort();

  it("retencion_permitida: verdadera solo con inv-008-prod (cualquier otro valor, vacío o sin definir: falsa)", () => {
    expect(funcion(script, "INV_PROYECTO_ACTIVO=inv-008-prod; retencion_permitida").status).toBe(0);
    for (const otro of ["inv-008-prueba", "inv-008", "", "INV-008-PROD", "inv-008-prod "]) {
      expect(funcion(script, `INV_PROYECTO_ACTIVO='${otro}'; retencion_permitida`).status, `«${otro}»`).not.toBe(0);
    }
    expect(funcion(script, "unset INV_PROYECTO_ACTIVO; retencion_permitida").status).not.toBe(0);
  });

  it("producción (retener, como lo llama main): borra solo las imágenes y los .tar de shas que no son el actual ni el anterior", () => {
    const { dir, falsos, env } = prepararRetencion();
    const r = funcion(script, `${fijar("inv-008-prod")}; retener`, env);
    expect(r.status, r.stderr).toBe(0);
    const ll = falsos.llamadas();
    expect(ll.filter((l) => l[0] === "docker" && l[1] === "image" && l[2] === "ls"), "control positivo: corrió el docker falso").toHaveLength(3);
    expect(borradas(ll).sort()).toEqual(tresEtiquetas(viejo).sort());
    expect(readdirSync(dir).sort()).toEqual(conservados);
    expect(r.stderr).not.toContain("modo prueba");
  });

  it("producción (purgar_imagenes y purgar_tars): igual que antes de la corrección", () => {
    const { dir, falsos, env } = prepararRetencion();
    const r = funcion(script, `${fijar("inv-008-prod")}; purgar_imagenes; purgar_tars`, env);
    expect(r.status, r.stderr).toBe(0);
    expect(borradas(falsos.llamadas()).sort()).toEqual(tresEtiquetas(viejo).sort());
    expect(readdirSync(dir).sort()).toEqual(conservados);
  });

  for (const [nombre, proyecto] of [
    ["inv-008-prueba", "inv-008-prueba"],
    ["inv-008 (desarrollo)", "inv-008"],
    ["proyecto vacío", ""],
    ["proyecto sin definir", null],
  ] as const) {
    it(`${nombre}: purgar_imagenes y purgar_tars no llaman a docker ni borran ningún .tar`, () => {
      const { dir, falsos, env } = prepararRetencion();
      const antes = readdirSync(dir).sort();
      const r = funcion(script, `${fijar(proyecto)}; purgar_imagenes; purgar_tars`, env);
      expect(r.status, r.stderr).toBe(0);
      expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
      expect(readdirSync(dir).sort()).toEqual(antes);
    });
  }
});

describe("desplegar-prod.sh · funciones puras", () => {
  const script = ruta008("scripts/desplegar-prod.sh");

  it("decidir_disco: el umbral es el mínimo aceptable", async () => {
    expect(funcion(script, "decidir_disco 14 15").stdout.trim()).toBe("ABORTAR");
    expect(funcion(script, "decidir_disco 15 15").stdout.trim()).toBe("SEGUIR");
  });

  it("evaluar_ci: exige inv-gate y app-008 en success", async () => {
    expect(funcion(script, "evaluar_ci", process.env, checks("success", "success")).stdout.trim()).toBe("VERDE");
    expect(funcion(script, "evaluar_ci", process.env, checks("success", "failure")).stdout.trim()).toBe("ROJO");
    expect(funcion(script, "evaluar_ci", process.env, "no es json").stdout.trim()).toBe("ROJO");
  });

  it("puerto_publicado_ok: solo 127.0.0.1:5008, nunca 0.0.0.0 ni [::]", async () => {
    expect(funcion(script, 'puerto_publicado_ok "127.0.0.1:5008"').status).toBe(0);
    expect(funcion(script, 'puerto_publicado_ok "0.0.0.0:5008"').status).not.toBe(0);
    expect(funcion(script, `puerto_publicado_ok "127.0.0.1:5008
[::]:5008"`).status).not.toBe(0);
    expect(funcion(script, 'puerto_publicado_ok ""').status).not.toBe(0);
  });

  it("ipv4_de_nslookup: la primera IPv4 de la respuesta, nunca la del servidor DNS; nada (y falla) si no resolvió", async () => {
    const leer = (texto: string) => funcion(script, "ipv4_de_nslookup", process.env, texto);
    const busybox = "Server:\t\t127.0.0.11\nAddress:\t127.0.0.11:53\n\nNon-authoritative answer:\nName:\tapi.telegram.org\nAddress: 203.0.113.7\nAddress: 203.0.113.8\n";
    expect(leer(busybox).stdout.trim()).toBe("203.0.113.7");
    expect(leer("Name:      api.telegram.org\nAddress 1: 203.0.113.8 api.telegram.org\n").stdout.trim()).toBe("203.0.113.8");
    for (const sin of ["Server:\t\t127.0.0.11\nAddress:\t127.0.0.11:53\n\n** server can't find api.telegram.org: SERVFAIL\n", "", "Name:\tx\nAddress: 999.1.1\n"]) {
      const r = leer(sin);
      expect(r.status, sin).not.toBe(0);
      expect(r.stdout.trim()).toBe("");
    }
  });

  it("falla_sin_ruta: solo «Network unreachable» o «No route to host»; nunca un tiempo agotado, un rechazo o un mensaje vacío", async () => {
    const ok = (msg: string) => funcion(script, `falla_sin_ruta "${msg}"`).status;
    expect(ok("nc: 203.0.113.7 (203.0.113.7:443): Network unreachable")).toBe(0);
    expect(ok("nc: can't connect to remote host (203.0.113.7): Network unreachable")).toBe(0);
    expect(ok("nc: can't connect to remote host (203.0.113.7): No route to host")).toBe(0);
    for (const malo of ["nc: timed out", "nc: 203.0.113.7 (203.0.113.7:443): Connection refused", "", "wget: bad address 'x'"]) expect(ok(malo), malo).not.toBe(0);
  });

  it("salud_ok: estado ok con la versión exacta; degradado, otra versión o algo ilegible no", async () => {
    const sha = "a".repeat(40);
    const ok = (json: string) => funcion(script, `salud_ok '${json}' "${sha}"`).status;
    expect(ok(JSON.stringify({ estado: "ok", version: sha }))).toBe(0);
    for (const malo of [JSON.stringify({ estado: "degradado", version: sha }), JSON.stringify({ estado: "ok", version: "b".repeat(40) }), "no es json", ""]) expect(ok(malo), malo).not.toBe(0);
  });

  it("imagenes_a_purgar: solo inv-008-app/migrador/vigia:<sha> que no son la actual ni la anterior", async () => {
    const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
    const entrada = [`inv-008-app:${a}`, `inv-008-app:${b}`, `inv-008-app:${c}`, `inv-008-migrador:${c}`, `inv-008-vigia:${c}`, `pi-app:${c}`, "inv-008-app:latest", "bi-app:x"].join("\n");
    const r = funcion(script, `imagenes_a_purgar "${a}" "${b}"`, process.env, entrada + "\n");
    expect(r.stdout.trim().split("\n")).toEqual([`inv-008-app:${c}`, `inv-008-migrador:${c}`, `inv-008-vigia:${c}`]);
  });

  it("etiquetas_del_tar_ok: solo las tres inv-008-* del mismo sha", async () => {
    const sha = "a".repeat(40);
    const ok = (etiquetas: string[]) => funcion(script, `etiquetas_del_tar_ok "${sha}"`, process.env, etiquetas.join("\n") + "\n").status;
    expect(ok(tresEtiquetas(sha))).toBe(0);
    expect(ok([...tresEtiquetas(sha), "pi-app:latest"])).not.toBe(0);
    expect(ok(tresEtiquetas("b".repeat(40)))).not.toBe(0);
    expect(ok([`inv-008-app:${sha}`])).not.toBe(0);
  });

  it("pool_app_ok: connection_limit único, entero de 1 a 8, sin ceros a la izquierda", async () => {
    const url = (consulta: string) => `postgresql://inv_app:${"c".repeat(64)}@inv-008-db:5432/inversiones${consulta}`;
    const ok = (consulta: string) => funcion(script, `pool_app_ok "${url(consulta)}"`).status;
    for (const bueno of ["?schema=public&connection_limit=5", "?connection_limit=1", "?schema=public&connection_limit=8"]) expect(ok(bueno), bueno).toBe(0);
    for (const malo of ["", "?schema=public", "?connection_limit=0", "?connection_limit=9", "?connection_limit=05", "?connection_limit=", "?connection_limit=x", "?connection_limit=5&connection_limit=5", "?xconnection_limit=5"]) {
      expect(ok(malo), malo).not.toBe(0);
    }
  });
});

// Acuerdo con el CEO de PI: la medición «después de up» espera 120 s si el despliegue es solo de código y 600 s si hay
// un servicio nuevo, cambia un límite o cambia la imagen base, o si no se puede saber. Se decide sin red: el clon en el
// sha nuevo contra el sha que corre (estado/sha-actual). En la espera corta, un piso de memoria (MemAvailable 1 GiB,
// SwapFree 512 MiB) la extiende hasta 600 s; si sigue bajo, no hay DEPLOY VERIFICADO y los candados no se sueltan antes.
describe("desplegar-prod.sh · espera de la medición: 120 s si es solo código, 600 s si cambian servicios, límites o la imagen base", () => {
  type Preparado = ReturnType<typeof preparar>;
  const sleeps = (p: Preparado) => p.falsos.llamadas().filter((l) => l[0] === "sleep").map((l) => l[1]);
  const lineasEspera = (stderr: string) => stderr.split("\n").filter((l) => l.includes("espera de la medición"));
  const MEMINFO_SANA = "MemTotal: 7913473 kB\nMemAvailable: 3617293 kB\nSwapTotal: 4191233 kB\nSwapFree: 2483117 kB\n";
  const MEMINFO_SWAP_BAJO = "MemTotal: 7913473 kB\nMemAvailable: 3617293 kB\nSwapTotal: 4191233 kB\nSwapFree: 94613 kB\n";
  const MEMINFO_MEM_BAJA = "MemTotal: 7913473 kB\nMemAvailable: 861937 kB\nSwapTotal: 4191233 kB\nSwapFree: 2483117 kB\n";
  const COMPOSE = "docker-compose.prod.yml";

  /** Lo que corre es repo.sha (estado/sha-actual) y no hay INV_ESPERA_MEDICION_S: la espera la decide la comparación. */
  function conCorriendo(meminfo = MEMINFO_SANA): Preparado {
    const p = preparar();
    delete p.env.INV_ESPERA_MEDICION_S;
    writeFileSync(p.env.INV_MEMINFO!, meminfo);
    const estado = path.join(p.base, "estado");
    mkdirSync(estado, { recursive: true });
    writeFileSync(path.join(estado, "sha-actual"), `${p.repo.sha}\n`);
    writeFileSync(path.join(estado, "imagen-actual"), `sha256:${"a".repeat(64)}\n`);
    return p;
  }

  /** Un commit con `cambiar` aplicado al clon (que queda en él) y el despliegue de ese sha. */
  async function desplegarCambio(p: Preparado, cambiar: (dir008: string) => void = () => {}, extra: Entorno = {}) {
    cambiar(p.repo.dir008);
    git(p.repo.dir, ["add", "-A"]);
    git(p.repo.dir, ["commit", "-q", "--allow-empty", "-m", "cambio"]);
    const nuevo = git(p.repo.dir, ["rev-parse", "HEAD"]);
    const r = await correr(p.script, [ID], { ...p.env, FALSO_SHA: nuevo, FALSO_SALUD: JSON.stringify({ estado: "ok", version: nuevo }), ...extra });
    return { r, nuevo };
  }

  /** Reemplaza `de` por `a` en un archivo del clon. Exige que `de` esté: si no, el caso no probaría nada. */
  function editar(dir008: string, archivo: string, de: string, a: string) {
    const ruta = path.join(dir008, archivo);
    const texto = readFileSync(ruta, "utf8");
    expect(texto, `${archivo} trae «${de}»`).toContain(de);
    writeFileSync(ruta, texto.replace(de, a));
  }

  /**
   * Variables para el sleep versionado de falsos/ (no escribe un sleep propio): anota qué descriptores de los candados
   * (8, el propio; 9, el común con PI) siguen abiertos en cada sleep y, en el sleep de `enSegundos`, cambia el meminfo
   * o la salud. Sin `cambio`, solo anota. Se pasan como `extra` de desplegarCambio.
   */
  function sleepQueMira(p: Preparado, cambio?: { enSegundos: string; meminfo?: string; salud?: string }) {
    const fds = path.join(p.base, "sleep-fds.txt");
    const meminfoNuevo = path.join(p.base, "meminfo-despues");
    if (cambio?.meminfo) writeFileSync(meminfoNuevo, cambio.meminfo);
    const env: Entorno = {
      FALSO_SLEEP_FDS: fds,
      ...(cambio ? { FALSO_SLEEP_EN: cambio.enSegundos } : {}),
      ...(cambio?.meminfo ? { FALSO_SLEEP_MEMINFO: meminfoNuevo } : {}),
      ...(cambio?.salud ? { FALSO_SLEEP_ROMPE_SALUD: cambio.salud } : {}),
    };
    return { env, candados: () => readFileSync(fds, "utf8").trim().split("\n") };
  }

  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila para
  // todo el Mac: con la máquina cargada son segundos por archivo. Por eso sleepQueMira no escribe un sleep propio:
  // usa el versionado de falsos/, que responde según variables FALSO_SLEEP_*.
  it("sleepQueMira no crea un sleep nuevo: el del PATH es el versionado (falsos/sleep) y la carpeta propia queda vacía", () => {
    const p = conCorriendo();
    sleepQueMira(p, { enSegundos: "480", meminfo: MEMINFO_SANA });
    expect(readdirSync(p.falsos.bin)).toEqual([]);
    expect(idArchivo(rutaEnPath(p.env, "sleep"))).toBe(idArchivo(ruta008("tests/unit/produccion/falsos/sleep")));
  });

  const medicionesDe = (p: Preparado) => {
    const dir = path.join(p.base, "estado", "mediciones");
    return readFileSync(path.join(dir, readdirSync(dir)[0]!), "utf8");
  };

  it("solo código (mismo compose y mismos FROM): espera 120 s, lo dice en una línea y despliega", async () => {
    const p = conCorriendo();
    const { r, nuevo } = await desplegarCambio(p, (d) => writeFileSync(path.join(d, "codigo.ficticio.ts"), "export const x = 4613;\n"));
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${nuevo}`);
    expect(sleeps(p)).toEqual(["120"]);
    const lineas = lineasEspera(r.stderr);
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toMatch(/espera de la medición: 120 s · solo código/);
    expect(lineas[0]).toContain(p.repo.sha);
    expect(medicionesDe(p)).toMatch(/== antes de up[\s\S]*== 120 s después de up/);
  });

  it("un cambio del compose que no toca servicios, límites ni imágenes (un comentario, una variable): 120 s", async () => {
    const p = conCorriendo();
    const { r } = await desplegarCambio(p, (d) => {
      editar(d, COMPOSE, "# cpu_shares bajo: PI tiene prioridad.", "# cpu_shares bajo: PI tiene prioridad siempre.");
      editar(d, COMPOSE, "RESPALDO_HORA: ${INV_RESPALDO_HORA:-0230}", "RESPALDO_HORA: ${INV_RESPALDO_HORA:-0317}");
    });
    expect(r.status, r.stderr).toBe(0);
    expect(sleeps(p)).toEqual(["120"]);
  });

  const cambios600: Array<[string, (d: string) => void, RegExp]> = [
    ["un mem_limit cambiado", (d) => editar(d, COMPOSE, "mem_limit: 384m", "mem_limit: 437m"), /inv-008-app mem_limit 437m/],
    ["solo un memswap_limit cambiado", (d) => editar(d, COMPOSE, "memswap_limit: 384m", "memswap_limit: 437m"), /inv-008-app memswap_limit 437m/],
    ["los cpus de un servicio", (d) => editar(d, COMPOSE, "cpus: 0.05", "cpus: 0.07"), /inv-008-vigia cpus 0\.07/],
    [
      "un servicio nuevo",
      (d) => editar(d, COMPOSE, "\n  inv-008-vigia:\n", "\n  inv-008-nuevo:\n    image: inv-008-vigia:${INV_TAG:-sin-desplegar}\n    mem_limit: 37m\n    memswap_limit: 37m\n\n  inv-008-vigia:\n"),
      /servicio inv-008-nuevo/,
    ],
    ["otra imagen de la base (otro digest)", (d) => editar(d, COMPOSE, "postgres:16-alpine@sha256:1d5b", "postgres:16-alpine@sha256:9d5b"), /inv-008-db image/],
    ["un FROM del Dockerfile (la imagen base)", (d) => editar(d, "Dockerfile", "FROM alpine:3.24@", "FROM alpine:3.27@"), /imagen base.*alpine:3\.27/],
  ];
  for (const [nombre, cambiar, detalle] of cambios600) {
    it(`${nombre}: espera 600 s y dice por qué en una línea`, async () => {
      const p = conCorriendo();
      const { r, nuevo } = await desplegarCambio(p, cambiar);
      expect(r.status, r.stderr).toBe(0);
      expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${nuevo}`);
      expect(sleeps(p)).toEqual(["600"]);
      const lineas = lineasEspera(r.stderr);
      expect(lineas).toHaveLength(1);
      expect(lineas[0]).toMatch(/espera de la medición: 600 s · /);
      expect(lineas[0]).toMatch(detalle);
    });
  }

  it("primer despliegue (sin estado/sha-actual): 600 s", async () => {
    const p = preparar();
    delete p.env.INV_ESPERA_MEDICION_S;
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(sleeps(p)).toEqual(["600"]);
    expect(lineasEspera(r.stderr)).toEqual([expect.stringMatching(/espera de la medición: 600 s · sin un sha que corre/)]);
  });

  // La reversa compara lo mismo: el compose del clon (que no se mueve) y el FROM del sha de la imagen, contra lo que corre.
  const reversas: Array<[string, (d: string) => void, string]> = [
    ["con el mismo Dockerfile y el mismo compose", () => {}, "120"],
    ["a una imagen de otro FROM", (d) => editar(d, "Dockerfile", "FROM alpine:3.24@", "FROM alpine:3.27@"), "600"],
  ];
  for (const [nombre, cambiar, espera] of reversas) {
    it(`reversa (--sin-migrar) ${nombre}: ${espera} s`, async () => {
      const p = conCorriendo();
      const viejo = p.repo.sha;
      cambiar(p.repo.dir008);
      git(p.repo.dir, ["add", "-A"]);
      git(p.repo.dir, ["commit", "-q", "--allow-empty", "-m", "lo que corre"]);
      const corre = git(p.repo.dir, ["rev-parse", "HEAD"]);
      const estado = path.join(p.base, "estado");
      writeFileSync(path.join(estado, "sha-actual"), `${corre}\n`);
      writeFileSync(path.join(estado, "sha-anterior"), `${viejo}\n`);
      writeFileSync(path.join(estado, "imagen-anterior"), `${ID}\n`);
      const r = await correr(p.script, [`inv-008-app:${viejo}`, "--sin-migrar"], p.env);
      expect(r.status, r.stderr).toBe(0);
      expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${viejo}`);
      expect(sleeps(p)).toEqual([espera]);
      expect(lineasEspera(r.stderr)).toHaveLength(1);
    });
  }

  it("INV_ESPERA_MEDICION_S explícito sigue mandando (como hoy) y la línea dice qué daba la comparación", async () => {
    const p = conCorriendo();
    const { r } = await desplegarCambio(p, (d) => editar(d, COMPOSE, "mem_limit: 384m", "mem_limit: 437m"), { INV_ESPERA_MEDICION_S: "613" });
    expect(r.status, r.stderr).toBe(0);
    expect(sleeps(p)).toEqual(["613"]);
    expect(lineasEspera(r.stderr)).toEqual([expect.stringMatching(/espera de la medición: 613 s · INV_ESPERA_MEDICION_S explícito \(la comparación daba 600 s: /)]);
  });

  it("INV_ESPERA_MEDICION_S con ceros a la izquierda se lee en base 10 (0613 son 613 s, no 395 en octal)", async () => {
    const p = conCorriendo();
    const { r } = await desplegarCambio(p, () => {}, { INV_ESPERA_MEDICION_S: "0613" });
    expect(r.status, r.stderr).toBe(0);
    expect(sleeps(p)).toEqual(["613"]);
  });

  for (const malo of ["abc", "-1", "1e3", "123457", " 37"]) {
    it(`INV_ESPERA_MEDICION_S inválido («${malo}»): se niega antes de tomar los candados`, async () => {
      const p = preparar({ INV_ESPERA_MEDICION_S: malo });
      const r = await correr(p.script, [ID], p.env);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/INV_ESPERA_MEDICION_S debe ser un entero/);
      expect(p.falsos.llamadas().some((l) => l[0] === "flock")).toBe(false);
    });
  }

  it("120 s con SwapFree bajo el piso: extiende hasta 600 s con los candados tomados, mide otra vez y, si sigue bajo, sale con 3 sin DEPLOY VERIFICADO", async () => {
    const p = conCorriendo(MEMINFO_SWAP_BAJO);
    const mira = sleepQueMira(p);
    const { r, nuevo } = await desplegarCambio(p, undefined, mira.env);
    expect(r.status, r.stderr).toBe(3);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(sleeps(p)).toEqual(["120", "480"]);
    // La espera corta y la extensión corren con los descriptores de los dos candados abiertos (no se sueltan antes).
    expect(mira.candados()).toEqual(["120: 8 9", "480: 8 9"]);
    expect(r.stderr).toMatch(/memoria bajo el piso a los 120 s \(SwapFree 92 MiB < 512 MiB\): se extiende la espera 480 s/);
    expect(r.stderr).toMatch(/MEMORIA BAJO EL PISO después de 600 s \(SwapFree 92 MiB < 512 MiB\): sin DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/pausar-008\.sh/);
    expect(medicionesDe(p)).toMatch(/== antes de up[\s\S]*== 120 s después de up[\s\S]*== 600 s después de up \(espera extendida\)/);
    // Sin corte automático ni vuelta atrás: el sha nuevo corre, respondió sano y queda registrado. El corte es manual.
    expect(readFileSync(path.join(p.base, "estado", "sha-actual"), "utf8").trim()).toBe(nuevo);
    const ll = p.falsos.llamadas();
    expect(ll.slice(indice(ll, compose("run", "inv-008-migrador"))).some((l) => l.includes("stop") || l.includes("down"))).toBe(false);
    expect(readFileSync(path.join(p.base, "tags.txt"), "utf8").trim().split("\n").at(-1)).toMatch(new RegExp(`^up ${nuevo} `));
  });

  it("120 s con MemAvailable bajo 1 GiB: también extiende y, si sigue bajo, sale con 3 sin DEPLOY VERIFICADO", async () => {
    const p = conCorriendo(MEMINFO_MEM_BAJA);
    const { r } = await desplegarCambio(p);
    expect(r.status).toBe(3);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(sleeps(p)).toEqual(["120", "480"]);
    expect(r.stderr).toMatch(/la memoria sigue bajo el piso a los 600 s \(MemAvailable 841 MiB < 1024 MiB\)/);
  });

  it("120 s bajo el piso que se recupera en la extensión: mide otra vez, sigue y termina con DEPLOY VERIFICADO", async () => {
    const p = conCorriendo(MEMINFO_SWAP_BAJO);
    const mira = sleepQueMira(p, { enSegundos: "480", meminfo: MEMINFO_SANA });
    const { r, nuevo } = await desplegarCambio(p, undefined, mira.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${nuevo}`);
    expect(sleeps(p)).toEqual(["120", "480"]);
    expect(r.stderr).toMatch(/la memoria volvió sobre el piso a los 600 s/);
  });

  it("si la salud cae durante la extensión, vuelve a la imagen que corría (como en cualquier falla después del up)", async () => {
    const p = conCorriendo(MEMINFO_SWAP_BAJO);
    const mira = sleepQueMira(p, { enSegundos: "480", salud: JSON.stringify({ estado: "degradado", version: "x" }) });
    const { r } = await desplegarCambio(p, undefined, mira.env);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/vuelta atrás/i);
    expect(readFileSync(path.join(p.base, "tags.txt"), "utf8").trim().split("\n").at(-1)).toMatch(new RegExp(`^up ${p.repo.sha} .*inv-008-app`));
    expect(readFileSync(path.join(p.base, "estado", "sha-actual"), "utf8").trim()).toBe(p.repo.sha);
  });

  it("el piso es solo del camino corto: con 600 s y SwapFree bajo no extiende (convivencia mira MemAvailable y OOM)", async () => {
    const p = conCorriendo(MEMINFO_SWAP_BAJO);
    const { r, nuevo } = await desplegarCambio(p, (d) => editar(d, COMPOSE, "mem_limit: 384m", "mem_limit: 437m"));
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${nuevo}`);
    expect(sleeps(p)).toEqual(["600"]);
  });

  it("ningún script de producción suelta los candados antes de salir (ni flock -u ni cierra los descriptores 8 y 9)", () => {
    for (const archivo of ["scripts/desplegar-prod.sh", "scripts/produccion-comun.sh"]) {
      expect(leer008(archivo), archivo).not.toMatch(/flock\s+-u|[89]>&-|[89]<&-/);
    }
  });
});

describe("desplegar-prod.sh · funciones de la espera: resumen del compose y del Dockerfile, piso de memoria", () => {
  const script = ruta008("scripts/desplegar-prod.sh");
  const resumenCompose = (texto: string) => funcion(script, "resumen_compose", process.env, texto).stdout.trim().split("\n");
  const resumenDockerfile = (texto: string) => funcion(script, "resumen_dockerfile", process.env, texto).stdout.trim().split("\n");

  it("resumen_compose del compose real: los ocho servicios (con precios, D-018, e IA, E6), sus límites e imágenes, y nada del bloque literal del relé", () => {
    const r = resumenCompose(leer008("docker-compose.prod.yml"));
    expect(r.filter((l) => l.startsWith("servicio "))).toEqual([
      "servicio inv-008-app",
      "servicio inv-008-db",
      "servicio inv-008-entrada",
      "servicio inv-008-ia",
      "servicio inv-008-migrador",
      "servicio inv-008-precios",
      "servicio inv-008-respaldo",
      "servicio inv-008-vigia",
    ]);
    for (const l of [
      "inv-008-app mem_limit 384m", "inv-008-app memswap_limit 384m", "inv-008-app cpus 0.5", "inv-008-app cpu_shares 256", "inv-008-app image inv-008-app:${INV_TAG:-sin-desplegar}",
      "inv-008-precios mem_limit 96m", "inv-008-precios memswap_limit 96m", "inv-008-precios cpus 0.25", "inv-008-precios cpu_shares 256", "inv-008-precios image inv-008-app:${INV_TAG:-sin-desplegar}",
    ]) {
      expect(r).toContain(l);
    }
    expect(r).not.toContain("INDETERMINADO");
    expect(r.some((l) => /const|process|servidor/.test(l))).toBe(false);
  });

  it("resumen_compose: la sangría de los servicios se detecta (4 espacios) y la salida va ordenada", () => {
    expect(resumenCompose("services:\n    uno:\n        image: x\n        mem_limit: 37m\n    dos:\n        image: y\n")).toEqual([
      "dos image y",
      "servicio dos",
      "servicio uno",
      "uno image x",
      "uno mem_limit 37m",
    ]);
  });

  it("resumen_compose: los límites de deploy van con su ruta (un límite no se confunde con una reserva)", () => {
    const texto = "services:\n  uno:\n    deploy:\n      resources:\n        limits:\n          memory: 37m\n          cpus: '0.37'\n        reservations:\n          cpus: '0.13'\n";
    expect(resumenCompose(texto)).toEqual(["servicio uno", "uno deploy.resources.limits.cpus '0.37'", "uno deploy.resources.limits.memory 37m", "uno deploy.resources.reservations.cpus '0.13'"]);
  });

  it("resumen_compose: el contenido de un bloque literal (| o >-) no se lee como YAML; los comentarios tampoco", () => {
    const texto = "services:\n  uno:\n    entrypoint:\n      - |\n        memory: 99m\n        cpus: 9\n      - otro\n    command: >-\n      mem_limit: 77m\n    # mem_limit: 55m\n    mem_limit: 37m  # el de verdad\n";
    expect(resumenCompose(texto)).toEqual(["servicio uno", "uno mem_limit 37m"]);
  });

  const indeterminados: Array<[string, string]> = [
    ["sin services", "name: x\nvolumes:\n  datos:\n"],
    ["un alias", "x-lim: &lim 37m\nservices:\n  uno:\n    mem_limit: *lim\n"],
    ["un alias en una lista", "services:\n  uno:\n    networks:\n      - *red\n"],
    ["una fusión <<", "x-base: &base\n  mem_limit: 37m\nservices:\n  uno:\n    <<: *base\n"],
    ["include", "include:\n  - otro.yml\nservices:\n  uno:\n    image: x\n"],
    ["extends", "services:\n  uno:\n    extends:\n      service: dos\n"],
    ["una etiqueta !reset", "services:\n  uno:\n    mem_limit: !reset null\n"],
    ["un límite interpolado (depende del archivo de producción, fuera de git)", "services:\n  uno:\n    mem_limit: ${INV_LIMITE:-37m}\n"],
    ["una imagen interpolada que no es la de INV_TAG", "services:\n  uno:\n    image: ${OTRA_IMAGEN}\n"],
    // Revisión de seguridad (MEDIO): formas del YAML que el resumen no lee y que esconderían un cambio de límites.
    ["una clave entre comillas dobles", 'services:\n  uno:\n    "mem_limit": 1237m\n'],
    ["una clave entre comillas simples", "services:\n  uno:\n    'mem_limit': 1237m\n"],
    ["un mapa en línea (flow)", "services:\n  uno:\n    deploy: {resources: {limits: {memory: 1237m}}}\n"],
    ["un servicio en línea (flow)", "services:\n  uno: {image: x, mem_limit: 1237m}\n"],
    ["un mapa en línea dentro de una lista", "services:\n  uno:\n    volumes:\n      - {type: tmpfs, target: /x}\n"],
  ];
  for (const [nombre, texto] of indeterminados) {
    it(`resumen_compose con ${nombre}: INDETERMINADO (la espera completa)`, () => {
      expect(resumenCompose(texto)).toContain("INDETERMINADO");
    });
  }

  it("resumen_dockerfile del Dockerfile real: sus FROM en orden y nada indeterminado (sus LABEL y RUN de varias líneas no cuentan)", () => {
    const esperado = leer008("Dockerfile").split("\n").filter((l) => /^FROM\s/i.test(l));
    expect(esperado.length).toBeGreaterThan(1);
    expect(resumenDockerfile(leer008("Dockerfile"))).toEqual(esperado);
  });

  it("resumen_dockerfile: FROM en minúscula, ARG globales y la continuación de un FROM cuentan; un ARG de etapa y lo que continúa otra instrucción no", () => {
    const texto = ["# syntax=docker/dockerfile:1", "ARG BASE=node:22", "from ${BASE} AS uno", "ARG DE_ETAPA=37", "LABEL a=b \\", "FROM falso-dentro-de-un-label", "FROM alpine \\", "  AS dos", ""].join("\n");
    expect(resumenDockerfile(texto)).toEqual(["ARG BASE=node:22", "from ${BASE} AS uno", "FROM alpine \\   AS dos"]);
  });

  for (const [nombre, texto] of [
    ["sin FROM", "ARG X=37\nRUN true\n"],
    ["con otro carácter de escape (# escape=)", "# escape=`\nFROM alpine `\n  AS uno\n"],
  ] as const) {
    it(`resumen_dockerfile ${nombre}: INDETERMINADO`, () => {
      expect(resumenDockerfile(texto)).toContain("INDETERMINADO");
    });
  }

  const piso = (meminfo: string) => {
    const archivo = path.join(carpetaTemporal("piso"), "meminfo");
    writeFileSync(archivo, meminfo);
    return funcion(script, "INV_PROYECTO_ACTIVO=inv-008-prueba; memoria_bajo_piso", { ...process.env, INV_MEMINFO: archivo });
  };
  const meminfo = (disponible: number, swapLibre: number) => `MemTotal: 7913473 kB\nMemAvailable: ${disponible} kB\nSwapTotal: 4191233 kB\nSwapFree: ${swapLibre} kB\n`;

  it("memoria_bajo_piso: MemAvailable < 1 GiB o SwapFree < 512 MiB; en el borde exacto, no", () => {
    expect(piso(meminfo(1048576, 524288)).stdout).toBe("");
    expect(piso(meminfo(1048575, 524288)).stdout).toBe("MemAvailable 1023 MiB < 1024 MiB\n");
    expect(piso(meminfo(1048576, 524287)).stdout).toBe("SwapFree 511 MiB < 512 MiB\n");
    expect(piso(meminfo(861937, 94613)).stdout).toBe("MemAvailable 841 MiB < 1024 MiB y SwapFree 92 MiB < 512 MiB\n");
  });

  it("memoria_bajo_piso: sin SwapFree legible, o sin swap (SwapFree 0), cuenta como bajo el piso: no se da por buena una memoria sin medir", () => {
    expect(piso("MemTotal: 7913473 kB\nMemAvailable: 3617293 kB\n").stdout).toMatch(/no se pudo leer SwapFree/);
    expect(piso(meminfo(3617293, 0)).stdout).toBe("SwapFree 0 MiB < 512 MiB\n");
  });

  it("los awk de la espera usan solo ERE portable (mawk del VPS): sin anclas dentro de un grupo ni \\t entre corchetes", () => {
    const fuente = leer008("scripts/desplegar-prod.sh");
    for (const f of ["resumen_compose", "resumen_dockerfile"]) {
      const desde = fuente.indexOf(`${f}() {`);
      const cuerpo = fuente.slice(desde, fuente.indexOf("\n}\n", desde));
      expect(desde, f).toBeGreaterThan(-1);
      expect(cuerpo.length, f).toBeGreaterThan(200);
      expect(cuerpo, f).not.toMatch(/\(\^|\|\$\)|\[[^\]]*\\t[^\]]*\]/);
    }
  });

  it("diferencias: si solo cambia el orden lo dice (la decisión ya es la espera completa)", () => {
    expect(funcion(script, "diferencias $'FROM a AS x\\nFROM b AS y' $'FROM b AS y\\nFROM a AS x'").stdout).toBe("mismas líneas en otro orden");
  });

  it("diferencias: sin caracteres de control en el log y cada línea acotada", () => {
    const r = funcion(script, `diferencias 'servicio uno' $'servicio uno\\nuno image x\\033[31m${"y".repeat(300)}'`).stdout;
    expect(r).toContain("ahora «uno image x");
    expect(r).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f]/);
    expect(r.length).toBeLessThan(220);
  });

  it("archivo_en_sha lee el commit del clon aunque haya un objeto de reemplazo o un GIT_DIR en el entorno (git corre como root)", () => {
    const repo = crearRepo([], { "nota.ficticio.txt": "original 4613\n" });
    const otraNota = path.join(carpetaTemporal("reemplazo"), "nota.txt");
    writeFileSync(otraNota, "reemplazo 1237\n");
    const original = git(repo.dir, ["rev-parse", `${repo.sha}:008-2026-INVERSIONES/nota.ficticio.txt`]);
    git(repo.dir, ["replace", original, git(repo.dir, ["hash-object", "-w", otraNota])]);
    const leer = (env: Entorno) => funcion(script, `INV_DIR_008='${repo.dir008}'; archivo_en_sha '${repo.sha}' nota.ficticio.txt`, env).stdout;
    expect(leer(process.env)).toBe("original 4613\n");
    const otro = crearRepo([], { "nota.ficticio.txt": "de otro repo 37911\n" });
    expect(leer({ ...process.env, GIT_DIR: path.join(otro.dir, ".git") })).toBe("original 4613\n");
  });

  it("motivo_espera_completa: sin un sha que corre de 40 hex (también una opción disfrazada) o con uno que el clon no tiene, da la espera completa", () => {
    const repo = crearRepo(["docker-compose.prod.yml", "Dockerfile"]);
    const motivo = (corre: string) => funcion(script, `INV_DIR_008='${repo.dir008}'; motivo_espera_completa '${corre}' '${repo.sha}'`).stdout.trim();
    expect(motivo(repo.sha)).toBe("");
    for (const malo of ["", "latest", "--output=x", "A".repeat(40)]) expect(motivo(malo), malo).toMatch(/sin un sha que corre/);
    expect(motivo("7".repeat(40))).toMatch(/no se pudo leer/);
  });
});

// El servicio de IA (E6) de punta a punta con el docker falso: se verifica con los permanentes y se prueba su salida.
describe("desplegar-prod.sh · servicio de IA (inv-008-ia)", () => {
  it("verifica el servicio de IA y dice que no llega a internet (la regla de PI corta)", async () => {
    const p = preparar();
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain("el servicio de IA corre con la credencial de inv_ia");
    expect(r.stderr).toContain("el servicio de IA no llega a internet");
    expect(r.stderr).not.toContain("clave-ficticia-37911");
    expect(r.stderr).not.toContain("token-ficticio-4613");
  });

  it("si llega a internet: AVISA y despliega (D-026); con INV_IA_EXIGIR_SIN_SALIDA=1, aborta", async () => {
    const aviso = preparar({ FALSO_NC_IA_RC: "0" });
    const r = await correr(aviso.script, [ID], aviso.env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain("⚠️  EL SERVICIO DE IA TIENE SALIDA A INTERNET");
    const estricto = preparar({ FALSO_NC_IA_RC: "0", INV_IA_EXIGIR_SIN_SALIDA: "1" });
    const e = await correr(estricto.script, [ID], estricto.env);
    expect(e.status).not.toBe(0);
    expect(e.stdout).not.toContain("DEPLOY VERIFICADO");
  });

  it.each([
    ["no está healthy", { FALSO_SALUD_IA: "unhealthy" }, "el servicio de IA no está healthy"],
    ["publica un puerto", { FALSO_PUERTO_IA: "8008/tcp -> 0.0.0.0:8008\n" }, "el servicio de IA publica puertos"],
    ["está en otra red", { FALSO_REDES_IA: "inv-008-prueba_inv-008-red inv-008-prueba_inv-008-red-interna" }, "el servicio de IA está en otras redes"],
    ["su red tiene a alguien más", { FALSO_RED_IA: "false|br-inv008-ia|2" }, "la red del servicio de IA no es la esperada"],
    ["recibe una clave ajena", { FALSO_ENV_IA: "TZ=America/Bogota\nCIFRADO_CLAVE_V1=x\n" }, "recibe variables que no son suyas: CIFRADO_CLAVE_V1"],
    ["trae la credencial de otro rol", { FALSO_ENV_IA: "DATABASE_URL=postgresql://inv_app:clave-ficticia-37911@inv-008-db:5432/inversiones\n" }, "no es la de inv_ia en inv-008-db"],
    ["la imagen no trae el bundle", { FALSO_BUNDLE_IA_RC: "1" }, "no trae el bundle del servicio de IA"],
    ["el contenedor no tiene nc", { FALSO_NC_IA_FALTA: "1" }, "no tiene nc: su salida a internet no se puede probar"],
  ])("%s: no hay DEPLOY VERIFICADO", async (_n, extra, mensaje) => {
    const p = preparar(extra);
    const r = await correr(p.script, [ID], p.env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(mensaje);
    expect(r.stderr).not.toContain("clave-ficticia-37911");
    expect(r.stdout).not.toContain("DEPLOY VERIFICADO");
  });

  it("sin la credencial ni el token: despliega y avisa que queda en espera", async () => {
    const p = preparar({ FALSO_ENV_IA: "TZ=America/Bogota\nDATABASE_URL=\nINV_IA_SERVICIO_TOKEN=\n" });
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain("sin INV_IA_DATABASE_URL: queda en espera");
    expect(r.stderr).toContain("sin INV_IA_SERVICIO_TOKEN");
  });
});
