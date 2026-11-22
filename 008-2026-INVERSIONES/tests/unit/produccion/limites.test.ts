// Los límites de memoria de 008 (mem_limit = memswap_limit, el invariante acordado con PI), reaplicados sin reiniciar nada.
// El defecto (producción, 2026-11-21): cada noche un `daemon-reload` de systemd en el host (una tarea de qemu-ga) deja
// memory.swap.max en max en el cgroup de todo contenedor que corre, y docker inspect sigue diciendo Memory = MemorySwap.
// La base de 008, que casi nunca se recrea, queda con swap; verificar_memswap lo veía DESPUÉS de migrar y todo despliegue
// hacía vuelta atrás. Ahora:
//  - desplegar-prod.sh reaplica los límites antes de tocar nada (antes del respaldo previo y de migrar) y otra vez antes
//    de verificar_memswap;
//  - reanudar-008.sh, después de su up;
//  - reaplicar-limites-008.sh lo hace a mano;
//  - medir-memoria.sh avisa con el comando si un contenedor de 008 tiene swap.
// docker, flock, curl, ps y sleep son falsos (falsos/); el cgroup es una carpeta temporal. Valores inventados.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, crearRepo, DIR_008, entorno, envProduccionFicticio, funcion, git, ruta008, type Llamada } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const PROYECTO = "inv-008-prueba";
// Límites inventados (437 MiB y 586 MiB), distintos del valor por defecto del docker falso.
const MEM_APP = 458227712;
const MEM_DB = 614465536;
const ID_APP = "3b9f".repeat(16);
const ID_DB = "7e21".repeat(16);
const ID_AJENO = "5c08".repeat(16);
const NOMBRE_APP = `${PROYECTO}-inv-008-app-1`;
const NOMBRE_DB = `${PROYECTO}-inv-008-db-1`;
const IMAGEN = `sha256:${"d".repeat(64)}`;
const COPIAR = ["Dockerfile", "docker-compose.prod.yml", "scripts/produccion-comun.sh", "scripts/desplegar-prod.sh", "scripts/respaldar-base.sh", "scripts/medir-memoria.sh", "scripts/vigilar-convivencia.sh", "scripts/reanudar-008.sh"];
const CHECKS = JSON.stringify({
  total_count: 2,
  check_runs: [
    { name: "inv-gate", status: "completed", conclusion: "success", completed_at: "2027-03-09T14:23:00Z" },
    { name: "app-008", status: "completed", conclusion: "success", completed_at: "2027-03-09T14:19:00Z" },
  ],
});

type Cgroup = { max?: string; swapMax?: string; swapCurrent?: string };

/** Base de prueba con el archivo de producción ficticio, el cgroup simulado y la tabla de límites del docker falso. */
function base(prefijo: string) {
  const dir = carpetaTemporal(prefijo);
  envProduccionFicticio(dir);
  mkdirSync(path.join(dir, "respaldos"), { recursive: true });
  const cgroup = path.join(dir, "cgroup");
  mkdirSync(path.join(cgroup, "system.slice"), { recursive: true });
  writeFileSync(path.join(cgroup, "system.slice", "memory.events"), "oom 0\noom_kill 0\n");
  const limites = path.join(dir, "limites");
  mkdirSync(limites, { recursive: true });
  const scope = (id: string) => path.join(cgroup, "system.slice", `docker-${id}.scope`);
  /** El contenedor `cid` con lo declarado (HostConfig) y su cgroup (por defecto, al día: memory.max = mem y swap.max = 0). */
  const contenedor = (cid: string, datos: { proyecto?: string; nombre: string; mem: number; swap?: number; id: string }, cg: Cgroup = {}) => {
    const proyecto = datos.proyecto ?? PROYECTO;
    writeFileSync(path.join(limites, cid), `${proyecto}|/${datos.nombre}|${datos.mem}|${datos.swap ?? datos.mem}|${datos.id}\n`);
    mkdirSync(scope(datos.id), { recursive: true });
    writeFileSync(path.join(scope(datos.id), "memory.max"), `${cg.max ?? datos.mem}\n`);
    writeFileSync(path.join(scope(datos.id), "memory.swap.max"), `${cg.swapMax ?? "0"}\n`);
    if (cg.swapCurrent !== undefined) writeFileSync(path.join(scope(datos.id), "memory.swap.current"), `${cg.swapCurrent}\n`);
  };
  const falsos = crearFalsos(dir);
  const meminfo = path.join(dir, "meminfo");
  writeFileSync(meminfo, "MemTotal: 7913473 kB\nMemAvailable: 3617293 kB\nSwapTotal: 4191233 kB\nSwapFree: 2483117 kB\n");
  const env = entorno(falsos, {
    INV_PROYECTO: PROYECTO,
    INV_BASE: dir,
    INV_MEMINFO: meminfo,
    INV_CGROUP: cgroup,
    FALSO_LIMITES: limites,
    FALSO_TAGS: path.join(dir, "tags.txt"),
  });
  return { dir, cgroup, scope, contenedor, falsos, env };
}
type Base = ReturnType<typeof base>;

/** La app y la base de 008, cada una con sus límites; `db` cambia el cgroup (o lo declarado) de la base. */
function appYBase(b: Base, db: Cgroup & { mem?: number; swap?: number } = {}, app: Cgroup = {}) {
  b.contenedor("cidapp", { nombre: NOMBRE_APP, mem: MEM_APP, id: ID_APP }, app);
  b.contenedor("ciddb", { nombre: NOMBRE_DB, mem: db.mem ?? MEM_DB, swap: db.swap, id: ID_DB }, db);
}

/** Un despliegue con un sha que corre (anterior): si algo se tocara con la trampa puesta, habría vuelta atrás. */
function despliegue(db: Cgroup & { mem?: number; swap?: number } = {}, app: Cgroup = {}) {
  const b = base("limites-desplegar");
  const repo = crearRepo(COPIAR);
  const corria = repo.sha;
  git(repo.dir, ["commit", "-q", "--allow-empty", "-m", "segundo"]);
  const sha = git(repo.dir, ["rev-parse", "HEAD"]);
  mkdirSync(path.join(b.dir, "estado"), { recursive: true });
  writeFileSync(path.join(b.dir, "estado", "sha-actual"), `${corria}\n`);
  writeFileSync(path.join(b.dir, "estado", "imagen-actual"), `sha256:${"a".repeat(64)}\n`);
  appYBase(b, db, app);
  Object.assign(b.env, {
    INV_ESPERA_MEDICION_S: "0",
    FALSO_ID: IMAGEN,
    FALSO_SHA: sha,
    FALSO_SALUD: JSON.stringify({ estado: "ok", version: sha }),
    FALSO_SALUD_ARCHIVO: path.join(b.dir, "salud-falsa.json"),
    FALSO_CHECKS: CHECKS,
    FALSO_COMPARE: JSON.stringify({ status: "ahead" }),
    FALSO_RESPALDOS_DIR: path.join(b.dir, "respaldos"),
  });
  return { ...b, repo, sha, corria, script: path.join(repo.dir008, "scripts/desplegar-prod.sh") };
}

const ultimaLinea = (s: string) => s.trim().split("\n").at(-1);
const indice = (ll: Llamada[], pred: (l: Llamada) => boolean) => ll.findIndex(pred);
const compose = (sub: string, ...mas: string[]) => (l: Llamada) => l[0] === "docker" && l[1] === "compose" && l.includes(sub) && mas.every((m) => l.includes(m));
const updates = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker" && l[1] === "update");
const update = (mem: number, cid: string) => ["docker", "update", "--memory", String(mem), "--memory-swap", String(mem), cid];
const leer = (archivo: string) => readFileSync(archivo, "utf8").trim();
/** Lo que el despliegue no debe haber hecho si abortó antes de tocar nada. */
function sinTocarNada(ll: Llamada[], stderr: string) {
  expect(ll.some(compose("up")), "ningún up (tampoco el de una vuelta atrás)").toBe(false);
  expect(ll.some(compose("stop")), "la app vieja no se detuvo").toBe(false);
  expect(ll.some(compose("exec", "inv-008-respaldo")), "sin respaldo previo").toBe(false);
  expect(ll.some(compose("run", "inv-008-migrador")), "sin migrar").toBe(false);
  expect(stderr).not.toMatch(/vuelta atrás/i);
}

describe("desplegar-prod.sh · reaplica los límites ANTES de tocar nada", () => {
  it("la base con memory.swap.max = max: un docker update con su HostConfig.Memory antes del respaldo previo y de migrar, una línea de log, y despliega", async () => {
    const p = despliegue({ swapMax: "max", swapCurrent: "4613" });
    const r = await correr(p.script, [IMAGEN], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${p.sha}`);
    const ll = p.falsos.llamadas();
    expect(updates(ll)).toEqual([update(MEM_DB, "ciddb")]);
    const i = indice(ll, (l) => l[1] === "update");
    expect(i).toBeLessThan(indice(ll, compose("up", "inv-008-db", "inv-008-respaldo")));
    expect(i).toBeLessThan(indice(ll, compose("exec", "inv-008-respaldo")));
    expect(i).toBeLessThan(indice(ll, compose("run", "inv-008-migrador")));
    const lineas = r.stderr.split("\n").filter((l) => l.includes("límites reaplicados"));
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toMatch(new RegExp(`límites reaplicados a ${NOMBRE_DB}: memory\\.swap\\.max max → 0\\b.*en swap: 4613 bytes`));
    expect(leer(path.join(p.scope(ID_DB), "memory.swap.max"))).toBe("0");
    expect(r.stderr).toMatch(/límites de memoria: 2 contenedor\(es\) de inv-008-prueba revisados, 1 corregido\(s\)/);
  });

  it("los valores salen del HostConfig del MISMO contenedor: cada uno con su Memory, aunque su MemorySwap diga otra cosa", async () => {
    const p = despliegue({ swapMax: "max", swap: MEM_DB * 2 }, { swapMax: "max" });
    const r = await correr(p.script, [IMAGEN], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(updates(p.falsos.llamadas())).toEqual([update(MEM_APP, "cidapp"), update(MEM_DB, "ciddb")]);
    expect(r.stderr).toMatch(new RegExp(`límites reaplicados a ${NOMBRE_DB}: .*MemorySwap ${MEM_DB * 2} → ${MEM_DB}`));
  });

  it("memory.max que no coincide con lo declarado también se reaplica (con el Memory del contenedor)", async () => {
    const p = despliegue({ max: "max" });
    const r = await correr(p.script, [IMAGEN], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(updates(p.falsos.llamadas())).toEqual([update(MEM_DB, "ciddb")]);
    expect(leer(path.join(p.scope(ID_DB), "memory.max"))).toBe(String(MEM_DB));
  });

  it("todo al día: ningún docker update", async () => {
    const p = despliegue();
    const r = await correr(p.script, [IMAGEN], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(updates(p.falsos.llamadas())).toEqual([]);
  });

  it("si falla el docker update: aborta ANTES de migrar, sin tocar nada más y sin vuelta atrás", async () => {
    const p = despliegue({ swapMax: "max" });
    const r = await correr(p.script, [IMAGEN], { ...p.env, FALSO_UPDATE_RC: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(new RegExp(`no se pudieron reaplicar los límites de ${NOMBRE_DB}`));
    sinTocarNada(p.falsos.llamadas(), r.stderr);
    expect(leer(path.join(p.dir, "estado", "sha-actual"))).toBe(p.corria);
  });

  it("si después del update el cgroup sigue con swap: aborta ANTES de migrar", async () => {
    const p = despliegue({ swapMax: "max" });
    const r = await correr(p.script, [IMAGEN], { ...p.env, FALSO_UPDATE_NO_APLICA: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(new RegExp(`${NOMBRE_DB} sigue mal después de reaplicar.*memory\\.swap\\.max = max`));
    expect(updates(p.falsos.llamadas())).toHaveLength(1);
    sinTocarNada(p.falsos.llamadas(), r.stderr);
  });

  it("un contenedor ajeno (otra etiqueta de proyecto) nunca se toca: aborta sin ningún docker update, tampoco a los propios", async () => {
    const p = despliegue({ swapMax: "max" });
    p.contenedor("cidajeno", { proyecto: "otro-proyecto", nombre: "otro-proyecto-web-1", mem: MEM_APP, id: ID_AJENO }, { swapMax: "max" });
    const r = await correr(p.script, [IMAGEN], { ...p.env, FALSO_CIDS_PS: "cidapp\\nciddb\\ncidajeno\\n" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/otro-proyecto-web-1 no lleva la etiqueta del proyecto inv-008-prueba/);
    expect(updates(p.falsos.llamadas())).toEqual([]);
    expect(leer(path.join(p.scope(ID_AJENO), "memory.swap.max"))).toBe("max");
    sinTocarNada(p.falsos.llamadas(), r.stderr);
  });

  it("un contenedor sin límite declarado (HostConfig.Memory = 0): aborta sin inventar uno", async () => {
    const p = despliegue({ mem: 0, swap: 0, swapMax: "max" });
    const r = await correr(p.script, [IMAGEN], p.env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(new RegExp(`${NOMBRE_DB} no tiene un límite de memoria declarado`));
    expect(updates(p.falsos.llamadas())).toEqual([]);
    sinTocarNada(p.falsos.llamadas(), r.stderr);
  });

  it("si compose ps falla, no se da por bueno: aborta sin tocar nada", async () => {
    const p = despliegue();
    const r = await correr(p.script, [IMAGEN], { ...p.env, FALSO_COMPOSE_PS_RC: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no se pudieron listar los contenedores de inv-008-prueba/);
    sinTocarNada(p.falsos.llamadas(), r.stderr);
  });
});

describe("desplegar-prod.sh · otra vez antes de verificar mem = memswap", () => {
  it("si el reload pasa a mitad del despliegue (la base, que el up no recrea, vuelve a max): la corrige después del up y despliega", async () => {
    const p = despliegue();
    const r = await correr(p.script, [IMAGEN], { ...p.env, FALSO_ROMPER_EN_UP: path.join(p.scope(ID_DB), "memory.swap.max") });
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${p.sha}`);
    const ll = p.falsos.llamadas();
    expect(updates(ll)).toEqual([update(MEM_DB, "ciddb")]);
    expect(indice(ll, (l) => l[1] === "update")).toBeGreaterThan(indice(ll, compose("up", "inv-008-app")));
  });

  it("y si ese update falla: no queda desplegado y vuelve a la imagen que corría", async () => {
    const p = despliegue();
    const r = await correr(p.script, [IMAGEN], { ...p.env, FALSO_ROMPER_EN_UP: path.join(p.scope(ID_DB), "memory.swap.max"), FALSO_UPDATE_RC: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toMatch(/DEPLOY VERIFICADO/);
    expect(r.stderr).toMatch(/vuelta atrás/i);
    expect(leer(path.join(p.dir, "tags.txt")).split("\n").at(-1)).toMatch(new RegExp(`^up ${p.corria} .*inv-008-app`));
  });
});

describe("reaplicar_limites · el cgroup ilegible", () => {
  it("en producción aborta sin tocar nada: no se sabe si el contenedor usa swap", () => {
    const b = base("limites-prod");
    const r = funcion(
      ruta008("scripts/produccion-comun.sh"),
      "INV_PROYECTO_ACTIVO=inv-008-prod; COMPOSE=(docker compose -p inv-008-prod); reaplicar_limites",
      entorno(b.falsos, { FALSO_PROYECTO: "inv-008-prod" }),
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no se pudo leer el cgroup de inv-008-prod-cidapp-1/);
    expect(updates(b.falsos.llamadas())).toEqual([]);
  });

  it("en el proyecto de prueba (el cgroup de Colima no se ve desde el Mac) lo avisa y revisa solo HostConfig", () => {
    const b = base("limites-prueba-sin-cgroup");
    const r = funcion(ruta008("scripts/produccion-comun.sh"), `INV_PROYECTO_ACTIVO=${PROYECTO}; COMPOSE=(docker compose -p ${PROYECTO}); reaplicar_limites`, {
      ...entorno(b.falsos),
      INV_CGROUP: path.join(b.dir, "no-existe"),
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/sin el cgroup de inv-008-prueba-cidapp-1 .*solo se revisa HostConfig/);
    expect(updates(b.falsos.llamadas())).toEqual([]);
  });
});

describe("verificar_memswap (sigue después de la reaplicación)", () => {
  const verificar = (b: Base) =>
    funcion(ruta008("scripts/desplegar-prod.sh"), "preparar_entorno; armar_compose --sin-respaldos; verificar_memswap", b.env);

  it("aborta si un contenedor tiene memory.swap.max distinto de 0", () => {
    const b = base("limites-memswap");
    appYBase(b, { swapMax: "max" });
    const r = verificar(b);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/puede usar swap \(memory\.swap\.max = max\)/);
  });

  it("aborta si HostConfig dice Memory ≠ MemorySwap", () => {
    const b = base("limites-memswap-hostconfig");
    appYBase(b, { swap: MEM_DB * 2 });
    expect(verificar(b).stderr).toMatch(/el tope de memoria no es real/);
  });

  it("pasa con todo al día", () => {
    const b = base("limites-memswap-ok");
    appYBase(b);
    expect(verificar(b).status).toBe(0);
  });
});

describe("reanudar-008.sh · reaplica los límites después de su up", () => {
  function pausado() {
    const b = base("limites-reanudar");
    const repo = crearRepo(COPIAR);
    mkdirSync(path.join(b.dir, "estado"), { recursive: true });
    writeFileSync(path.join(b.dir, "estado", "sha-actual"), `${repo.sha}\n`);
    writeFileSync(path.join(b.dir, "estado", "pausado"), "pausa ficticia\n");
    appYBase(b, { swapMax: "max" });
    return { ...b, marca: path.join(b.dir, "estado", "pausado"), script: path.join(repo.dir008, "scripts/reanudar-008.sh") };
  }

  it("el docker update va después del up y la marca se borra", async () => {
    const p = pausado();
    const r = await correr(p.script, [], p.env);
    expect(r.status, r.stderr).toBe(0);
    const ll = p.falsos.llamadas();
    expect(updates(ll)).toEqual([update(MEM_DB, "ciddb")]);
    expect(indice(ll, (l) => l[1] === "update")).toBeGreaterThan(indice(ll, compose("up")));
    expect(existsSync(p.marca)).toBe(false);
  });

  it("si el update falla, sale con error y la marca de pausa se mantiene", async () => {
    const p = pausado();
    const r = await correr(p.script, [], { ...p.env, FALSO_UPDATE_RC: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no se pudieron reaplicar los límites/);
    expect(existsSync(p.marca)).toBe(true);
  });
});

describe("reaplicar-limites-008.sh · el comando a mano", () => {
  const REAPLICAR = ruta008("scripts/reaplicar-limites-008.sh");

  it("corrige los que están mal (un update cada uno, con su Memory), una línea por corrección, sin reiniciar nada", async () => {
    const b = base("limites-comando");
    appYBase(b, { swapMax: "max" }, { swapMax: "max" });
    const r = await correr(REAPLICAR, [], b.env);
    expect(r.status, r.stderr).toBe(0);
    const ll = b.falsos.llamadas();
    expect(updates(ll)).toEqual([update(MEM_APP, "cidapp"), update(MEM_DB, "ciddb")]);
    expect(r.stderr.split("\n").filter((l) => l.includes("límites reaplicados"))).toHaveLength(2);
    // Solo lee (compose ps, inspect) y reaplica (update): nada se reinicia, detiene, recrea ni baja.
    const docker = ll.filter((l) => l[0] === "docker");
    expect(docker.every((l) => (l[1] === "compose" && l.includes("ps")) || l[1] === "inspect" || l[1] === "update"), JSON.stringify(docker)).toBe(true);
    expect(ll.filter((l) => l[0] === "flock").map((l) => l.at(-1))).toEqual(["8", "9"]);
  });

  it("con todo al día: ningún update y sale con 0", async () => {
    const b = base("limites-comando-ok");
    appYBase(b);
    const r = await correr(REAPLICAR, [], b.env);
    expect(r.status, r.stderr).toBe(0);
    expect(updates(b.falsos.llamadas())).toEqual([]);
    expect(r.stderr).toMatch(/0 corregido\(s\)/);
  });

  it("si el update falla, sale con error", async () => {
    const b = base("limites-comando-falla");
    appYBase(b, { swapMax: "max" });
    expect((await correr(REAPLICAR, [], { ...b.env, FALSO_UPDATE_RC: "1" })).status).not.toBe(0);
  });

  it("con PI desplegando (el candado común tomado) se niega sin tocar Docker", async () => {
    const b = base("limites-comando-pi");
    appYBase(b, { swapMax: "max" });
    const r = await correr(REAPLICAR, [], { ...b.env, FALSO_FLOCK_OCUPADO: "9" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/PI desplegando/);
    expect(b.falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
  });

  it("no lleva argumentos", async () => {
    const b = base("limites-comando-args");
    const r = await correr(REAPLICAR, ["--todo"], b.env);
    expect(r.status).not.toBe(0);
    expect(b.falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
  });
});

describe("medir-memoria.sh · avisa si un contenedor de 008 puede usar swap", () => {
  const MEDIR = ruta008("scripts/medir-memoria.sh");

  it("con memory.swap.max = max lo dice explícito, con el comando de reaplicar (ruta real del clon), en stdout y en el archivo; sale con 0 y no corrige nada", async () => {
    const b = base("limites-medir");
    appYBase(b, { swapMax: "max" });
    const salida = path.join(b.dir, "estado", "mediciones", "m.txt");
    const r = await correr(MEDIR, ["--salida", salida], b.env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`⚠️  ${NOMBRE_DB} puede usar swap (memory.swap.max = max`);
    expect(r.stdout).toContain(`sudo ${path.join(realpathSync(DIR_008), "scripts/reaplicar-limites-008.sh")}`);
    expect(r.stdout).not.toContain(NOMBRE_APP);
    expect(readFileSync(salida, "utf8")).toBe(r.stdout);
    expect(updates(b.falsos.llamadas())).toEqual([]);
  });

  it("con todo al día no avisa", async () => {
    const b = base("limites-medir-ok");
    appYBase(b);
    const r = await correr(MEDIR, [], b.env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).not.toMatch(/puede usar swap/);
  });
});
