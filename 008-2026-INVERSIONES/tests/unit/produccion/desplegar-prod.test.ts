// desplegar-prod.sh: el patrón de PI (flock, disco, migraciones antes de servir, healthcheck y
// «DEPLOY VERIFICADO <sha>» como última línea solo si todo pasó), más las guardas de Inversiones:
// candado propio y común con PI, marca de pausa, CI en verde en GitHub, clon en el sha, .tar verificado
// (sha256, etiquetas y disco), las tres imágenes del mismo sha, respaldo antes de migrar, mem = memswap,
// versión verificada antes y después de la espera, y vuelta atrás automática si falla después de migrar.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, crearRepo, entorno, envProduccionFicticio, funcion, git, ruta008, type Llamada } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const COPIAR = [
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

  it("verifica la versión dos veces: al levantar y después de la espera de 10 minutos", async () => {
    const { falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    expect(falsos.llamadas().filter((l) => l[0] === "docker" && l[1] === "exec" && l.join(" ").includes("/api/salud"))).toHaveLength(2);
  });

  it("deja las dos mediciones de memoria (antes y 10 min después de up) en un archivo", async () => {
    const { repo, base, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    const dir = path.join(base, "estado", "mediciones");
    const archivos = readdirSync(dir);
    expect(archivos).toHaveLength(1);
    expect(archivos[0]).toMatch(new RegExp(`^${repo.sha}-\\d{8}-\\d{6}\\.txt$`));
    expect(readFileSync(path.join(dir, archivos[0]!), "utf8")).toMatch(/antes de up[\s\S]*10 min después de up/);
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

  it("purga solo imágenes inv-008-* viejas (también inv-008-vigia): nunca la desplegada ni imágenes ajenas", async () => {
    const viejo = "9".repeat(40);
    const { repo, falsos, env, script } = preparar();
    env.FALSO_IMAGENES = [`inv-008-app:${viejo}`, `inv-008-app:${repo.sha}`, `inv-008-migrador:${viejo}`, `inv-008-vigia:${viejo}`, "pi-app:latest", ""].join("\\n");
    expect((await correr(script, [ID], env)).status).toBe(0);
    const borradas = falsos.llamadas().filter((l) => l[0] === "docker" && l[1] === "image" && l[2] === "rm").map((l) => l[3]);
    expect(borradas.sort()).toEqual([`inv-008-app:${viejo}`, `inv-008-migrador:${viejo}`, `inv-008-vigia:${viejo}`]);
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
    ["la salud cae durante la espera de 10 minutos", { FALSO_SLEEP_ROMPE_SALUD: JSON.stringify({ estado: "degradado", version: "x" }) }],
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

  it("purga los .tar viejos de imagenes/: conserva los del sha actual y del anterior", async () => {
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
    expect((await correr(script, [ID], env)).status).toBe(0);
    expect(readdirSync(dir).sort()).toEqual(
      ["otro-archivo.txt", `inv-008-${"2".repeat(40)}.tar`, `inv-008-${"2".repeat(40)}.tar.sha256`, `inv-008-${repo.sha}.tar`, `inv-008-${repo.sha}.tar.sha256`].sort(),
    );
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

  it("después del migrador levanta los tres permanentes: app, vigía y respaldo", async () => {
    const { falsos, env, script } = preparar();
    expect((await correr(script, [ID], env)).status).toBe(0);
    const ll = falsos.llamadas();
    const final = ll.slice(indice(ll, compose("run", "inv-008-migrador"))).find(compose("up"));
    expect(final).toEqual(expect.arrayContaining(["up", "-d", "--wait", "inv-008-app", "inv-008-vigia", "inv-008-respaldo"]));
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
    expect(ups(base).at(-1)).toMatch(new RegExp(`^up ${repo.sha} .*inv-008-app.*inv-008-vigia.*inv-008-respaldo`));
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
      expect(ups(base).at(-1)).toMatch(new RegExp(`^up ${repo.sha} .*inv-008-app.*inv-008-vigia.*inv-008-respaldo`));
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
