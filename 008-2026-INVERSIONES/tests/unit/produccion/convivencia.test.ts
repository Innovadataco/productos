// Convivencia con PI en el VPS compartido: medir-memoria.sh, vigilar-convivencia.sh (una pasada: detecta
// y detiene solo Inversiones), pausar-008.sh / reanudar-008.sh (sin tocar datos) y crear-acceso-inicial.sh.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, ruta008, type Llamada } from "./falsos";

// Cada prueba corre scripts de bash con varios procesos: con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

const MEDIR = ruta008("scripts/medir-memoria.sh");
const VIGILAR = ruta008("scripts/vigilar-convivencia.sh");
const PAUSAR = ruta008("scripts/pausar-008.sh");
const REANUDAR = ruta008("scripts/reanudar-008.sh");
const ACCESO = ruta008("scripts/crear-acceso-inicial.sh");

const meminfo = (disponibleKb: number, swapLibreKb = 2_590_000) =>
  [
    "MemTotal:        8123456 kB",
    "MemFree:          512000 kB",
    `MemAvailable:   ${disponibleKb} kB`,
    "SwapTotal:       4194300 kB",
    `SwapFree:       ${swapLibreKb} kB`,
  ].join("\n") + "\n";

function preparar(extra: Record<string, string> = {}, disponibleKb = 4_078_000) {
  const base = carpetaTemporal("convivencia");
  envProduccionFicticio(base);
  const falsos = crearFalsos(base);
  const archivoMem = path.join(base, "meminfo");
  writeFileSync(archivoMem, meminfo(disponibleKb));
  const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, INV_MEMINFO: archivoMem, ...extra });
  return { base, falsos, env, archivoMem };
}

const docker = (ll: Llamada[]) => ll.filter((l) => l[0] === "docker");
/** Ninguna llamada a docker que cambie algo nombra un contenedor de PI, BI, Gesmovil o Hermes. */
const nadaAjenoTocado = (ll: Llamada[]) =>
  docker(ll).filter((l) => !["ps", "inspect", "stats"].includes(l[1]!) && l.some((a) => /(^|\/)(pi-|bi-|gesmovil|hermes)/i.test(a)));

describe("medir-memoria.sh", () => {
  it("reporta MemAvailable y SwapFree en MiB, más docker stats, y lo deja en el archivo", async () => {
    const { base, env } = preparar();
    const salida = path.join(base, "estado", "mediciones", "m.txt");
    const r = await correr(MEDIR, ["--etiqueta", "antes de up", "--salida", salida], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/antes de up/);
    expect(r.stdout).toMatch(/MemAvailable: 3982 MiB/);
    expect(r.stdout).toMatch(/SwapFree: 2529 MiB de 4095 MiB/);
    expect(r.stdout).toMatch(/inv-008-prod-inv-008-app-1/);
    expect(readFileSync(salida, "utf8")).toBe(r.stdout);
  });

  it("docker stats solo de los contenedores de inv-008-prod (nunca de PI ni de otros)", async () => {
    const { falsos, env } = preparar();
    expect((await correr(MEDIR, [], env)).status).toBe(0);
    const stats = docker(falsos.llamadas()).find((l) => l[1] === "stats")!;
    expect(stats.slice(-2)).toEqual(["cidapp", "ciddb"]);
    expect(docker(falsos.llamadas()).some((l) => l[1] === "compose" && l.includes("ps") && l.includes("-q"))).toBe(true);
  });

  it("avisa cuando MemAvailable está bajo el umbral de corte de 1 GiB", async () => {
    const { env } = preparar({}, 900_000);
    expect((await correr(MEDIR, [], env)).stdout).toMatch(/bajo el umbral de corte/);
  });

  it("falla si no puede leer meminfo", async () => {
    const { env } = preparar();
    expect((await correr(MEDIR, [], { ...env, INV_MEMINFO: "/no/existe" })).status).not.toBe(0);
  });

  it("opción desconocida: falla sin medir ni llamar a Docker", async () => {
    const { falsos, env } = preparar();
    const r = await correr(MEDIR, ["--forzar"], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/opción desconocida/);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("sin contenedores del proyecto: lo dice y no llama a docker stats", async () => {
    const { falsos, env } = preparar({ FALSO_CID_APP: "", FALSO_CID_DB: "" });
    const r = await correr(MEDIR, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/sin contenedores de inv-008-prueba corriendo/);
    expect(docker(falsos.llamadas()).some((l) => l[1] === "stats")).toBe(false);
  });

  it("--salida acumula: la medición de antes y la de después quedan en el mismo archivo", async () => {
    const { base, env } = preparar();
    const salida = path.join(base, "estado", "mediciones", "m.txt");
    expect((await correr(MEDIR, ["--etiqueta", "antes de up", "--salida", salida], env)).status).toBe(0);
    expect((await correr(MEDIR, ["--etiqueta", "10 min después de up", "--salida", salida], env)).status).toBe(0);
    expect(readFileSync(salida, "utf8")).toMatch(/== antes de up[\s\S]*== 10 min después de up/);
  });

  it("candado de rutas: no escribe la medición fuera de la raíz", async () => {
    const { env } = preparar();
    expect((await correr(MEDIR, ["--salida", "/tmp/inv-008-medicion-fuera.txt"], env)).status).not.toBe(0);
    expect(existsSync("/tmp/inv-008-medicion-fuera.txt")).toBe(false);
  });
});

describe("vigilar-convivencia.sh · una pasada: solo detecta e informa (el corte es manual)", () => {
  const conCgroup = (oom: number, extra: Record<string, string> = {}, disponibleKb = 4_078_000) => {
    const p = preparar(extra, disponibleKb);
    const cgroup = path.join(p.base, "cgroup");
    mkdirSync(path.join(cgroup, "system.slice"), { recursive: true });
    const fijar = (n: number) => writeFileSync(path.join(cgroup, "system.slice", "memory.events"), `oom ${n}\noom_kill ${n}\n`);
    fijar(oom);
    return { ...p, fijar, env: { ...p.env, INV_CGROUP: cgroup } };
  };

  it("todo bien: sale con 0 y deja la línea base del OOM jerárquico", async () => {
    const { base, env } = conCgroup(3);
    const r = await correr(VIGILAR, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(path.join(base, "estado", "convivencia-oom.txt"), "utf8").trim()).toBe("3");
  });

  it("un OOM nuevo en el VPS (oom_kill jerárquico sube): sale con 3 y da el comando de corte, sin detener nada", async () => {
    const { falsos, fijar, env } = conCgroup(3);
    expect((await correr(VIGILAR, [], env)).status).toBe(0);
    fijar(4);
    const r = await correr(VIGILAR, [], env);
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/OOM/);
    expect(r.stderr).toContain("/opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/pausar-008.sh");
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("MemAvailable bajo 1 GiB: sale con 3 sin detener nada", async () => {
    const { falsos, env } = conCgroup(0, {}, 1_000_000);
    expect((await correr(VIGILAR, [], env)).status).toBe(3);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("un contador más bajo (reinicio del VPS) no es un OOM: nueva línea base", async () => {
    const { fijar, env } = conCgroup(9);
    await correr(VIGILAR, [], env);
    fijar(0);
    expect((await correr(VIGILAR, [], env)).status).toBe(0);
  });

  it("nunca usa Docker: ni sobre pi-* ni sobre nada", async () => {
    const { falsos, fijar, env } = conCgroup(1, {}, 500_000);
    await correr(VIGILAR, [], env);
    fijar(2);
    await correr(VIGILAR, [], env);
    expect(docker(falsos.llamadas())).toEqual([]);
    expect(nadaAjenoTocado(falsos.llamadas())).toEqual([]);
  });

  it("sin cgroup legible, falla (no se vigila a ciegas)", async () => {
    const { env } = preparar();
    expect((await correr(VIGILAR, [], { ...env, INV_CGROUP: "/no/existe" })).status).not.toBe(0);
  });
});

describe("pausar-008.sh y reanudar-008.sh · la pausa sobrevive a un reinicio del VPS", () => {
  const SHA = "5".repeat(40);
  const conEstado = (extra: Record<string, string> = {}) => {
    const p = preparar({ FALSO_TAGS: "", ...extra });
    p.env.FALSO_TAGS = path.join(p.base, "tags.txt");
    mkdirSync(path.join(p.base, "estado"), { recursive: true });
    writeFileSync(path.join(p.base, "estado", "sha-actual"), `${SHA}\n`);
    return p;
  };
  const marca = (base: string) => path.join(base, "estado", "pausado");

  it("pausar: escribe la marca ANTES del down, y el down es sin -v (los datos quedan)", async () => {
    const { base, falsos, env } = conEstado();
    const r = await correr(PAUSAR, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(marca(base))).toBe(true);
    const ll = docker(falsos.llamadas());
    expect(ll.filter((l) => l.includes("down"))).toHaveLength(1);
    expect(ll.flat().some((a) => ["-v", "--volumes", "rm", "kill", "stop"].includes(a))).toBe(false);
    expect(ll.every((l) => l[1] === "compose" && l[3] === "inv-008-prueba")).toBe(true);
    expect(falsos.llamadas().some((l) => l[0] === "flock")).toBe(true);
  });

  it("pausar: la marca existe antes de que corra el down", async () => {
    const { base, env } = conEstado();
    const sonda = path.join(base, "marca-al-bajar.txt");
    // El docker falso deja constancia de si la marca existía cuando llegó el down.
    const r = await correr(PAUSAR, [], { ...env, FALSO_SONDA_MARCA: marca(base), FALSO_SONDA_SALIDA: sonda });
    expect(r.status).toBe(0);
    expect(readFileSync(sonda, "utf8").trim()).toBe("marca-presente");
  });

  it("reanudar: up -d --wait con el sha que corre y borra la marca", async () => {
    const { base, env } = conEstado();
    writeFileSync(marca(base), "pausa\n");
    const r = await correr(REANUDAR, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(marca(base))).toBe(false);
    expect(readFileSync(path.join(base, "tags.txt"), "utf8")).toMatch(new RegExp(`^up ${SHA} .*up -d --wait`, "m"));
  });

  it("reanudar se niega con «PI desplegando» si el candado común está tomado", async () => {
    const { base, falsos, env } = conEstado({ FALSO_FLOCK_OCUPADO: "9" });
    writeFileSync(marca(base), "pausa\n");
    const r = await correr(REANUDAR, [], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/PI desplegando/);
    expect(existsSync(marca(base))).toBe(true);
    expect(docker(falsos.llamadas()).some((l) => l.includes("up"))).toBe(false);
  });

  it("reanudar se niega si un proceso de PI está desplegando o construyendo (segunda barrera)", async () => {
    const { falsos, env } = conEstado({ FALSO_PS: "bash\n/bin/bash -x ./scripts/deploy-prod.sh\n" });
    expect((await correr(REANUDAR, [], env)).status).not.toBe(0);
    expect(docker(falsos.llamadas()).some((l) => l.includes("up"))).toBe(false);
  });

  it("reanudar sin despliegue registrado (sin sha-actual) no hace nada", async () => {
    const { base, falsos, env } = conEstado();
    rmSync(path.join(base, "estado", "sha-actual"));
    expect((await correr(REANUDAR, [], env)).status).not.toBe(0);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("pausar con otra operación de Inversiones en curso (candado propio): no deja marca ni toca Docker", async () => {
    const { base, falsos, env } = conEstado({ FALSO_FLOCK_OCUPADO: "8" });
    expect((await correr(PAUSAR, [], env)).status).not.toBe(0);
    expect(existsSync(marca(base))).toBe(false);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("pausar toma solo el candado propio: funciona aunque PI tenga el común (la pausa de emergencia no espera a PI)", async () => {
    const { base, falsos, env } = conEstado({ FALSO_FLOCK_OCUPADO: "9" });
    const r = await correr(PAUSAR, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(marca(base))).toBe(true);
    expect(falsos.llamadas().filter((l) => l[0] === "flock").map((l) => l.at(-1))).toEqual(["8"]);
  });

  it("pausar sanea el motivo: la marca no lleva comillas, sustituciones ni separadores de comandos", async () => {
    const { base, env } = conEstado();
    expect((await correr(PAUSAR, ["corte; $(touch /tmp/x) `id` | y > z"], env)).status).toBe(0);
    const texto = readFileSync(marca(base), "utf8");
    expect(texto).toMatch(/corte/);
    expect(texto).not.toMatch(/[;$`|>()]/);
  });

  it("pausar: si el down falla, sale con error y la marca queda (la pausa se mantiene)", async () => {
    const { base, env } = conEstado({ FALSO_DOWN_RC: "1" });
    expect((await correr(PAUSAR, [], env)).status).not.toBe(0);
    expect(existsSync(marca(base))).toBe(true);
  });

  it("reanudar con estado/sha-actual malformado: no toca Docker ni borra la marca", async () => {
    const { base, falsos, env } = conEstado();
    writeFileSync(path.join(base, "estado", "sha-actual"), "latest\n");
    writeFileSync(marca(base), "pausa\n");
    expect((await correr(REANUDAR, [], env)).status).not.toBe(0);
    expect(docker(falsos.llamadas())).toEqual([]);
    expect(existsSync(marca(base))).toBe(true);
  });

  it("reanudar con otra operación de Inversiones en curso (candado propio): no toca Docker", async () => {
    const { base, falsos, env } = conEstado({ FALSO_FLOCK_OCUPADO: "8" });
    writeFileSync(marca(base), "pausa\n");
    expect((await correr(REANUDAR, [], env)).status).not.toBe(0);
    expect(docker(falsos.llamadas())).toEqual([]);
    expect(existsSync(marca(base))).toBe(true);
  });

  it("reanudar falla (y deja la marca) si el up --wait no queda healthy", async () => {
    const { base, env } = conEstado({ FALSO_UP_RC: "1" });
    writeFileSync(marca(base), "pausa\n");
    expect((await correr(REANUDAR, [], env)).status).not.toBe(0);
    expect(existsSync(marca(base))).toBe(true);
  });
});

describe("crear-acceso-inicial.sh · recuperación de acceso (lo corre Jelk por SSH)", () => {
  it("corre crear-acceso-inicial.ts en el migrador (rol inv_dueno) con tsx y le pasa los argumentos", async () => {
    const { falsos, env } = preparar({ INV_TAG: "1".repeat(40) });
    const r = await correr(ACCESO, ["--email", "dueno@ejemplo.invalid"], env);
    expect(r.status, r.stderr).toBe(0);
    const ll = docker(falsos.llamadas());
    expect(ll).toHaveLength(1);
    expect(ll[0]).toEqual(
      expect.arrayContaining(["run", "--rm", "-T", "inv-008-migrador", "node_modules/.bin/tsx", "scripts/crear-acceso-inicial.ts", "--email", "dueno@ejemplo.invalid"]),
    );
  });

  it("con la marca de pausa se niega, sin tocar Docker", async () => {
    const { base, falsos, env } = preparar({ INV_TAG: "1".repeat(40) });
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "pausado"), "pausa\n");
    const r = await correr(ACCESO, ["--email", "dueno@ejemplo.invalid"], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/pausa/);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("toma los dos candados sin esperar; con el común ocupado dice «PI desplegando»", async () => {
    const ok = preparar({ INV_TAG: "1".repeat(40) });
    expect((await correr(ACCESO, [], ok.env)).status).toBe(0);
    expect(ok.falsos.llamadas().filter((l) => l[0] === "flock")).toHaveLength(2);
    const ocupado = preparar({ INV_TAG: "1".repeat(40), FALSO_FLOCK_OCUPADO: "9" });
    const r = await correr(ACCESO, [], ocupado.env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/PI desplegando/);
    expect(docker(ocupado.falsos.llamadas())).toEqual([]);
  });

  it("sin despliegue registrado ni INV_TAG, no corre", async () => {
    const { falsos, env } = preparar();
    expect((await correr(ACCESO, [], env)).status).not.toBe(0);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  for (const malo of ["latest", "1".repeat(39), "1".repeat(41), "G".repeat(40), `${"1".repeat(40)} x`, "$(id)"]) {
    it(`INV_TAG «${malo}» no es un sha de 40 hex: se niega sin tocar Docker`, async () => {
      const { falsos, env } = preparar({ INV_TAG: malo });
      const r = await correr(ACCESO, ["--email", "dueno@ejemplo.invalid"], env);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/40 hex/);
      expect(docker(falsos.llamadas())).toEqual([]);
    });
  }

  it("sin INV_TAG usa el sha de estado/sha-actual para el migrador", async () => {
    const { base, env } = preparar();
    const sha = "2".repeat(40);
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), `${sha}\n`);
    const runs = path.join(base, "runs.txt");
    const r = await correr(ACCESO, ["--email", "dueno@ejemplo.invalid"], { ...env, FALSO_RUN_TAGS: runs });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(runs, "utf8")).toMatch(new RegExp(`^run ${sha} .*inv-008-migrador`, "m"));
  });

  it("estado/sha-actual malformado (sin INV_TAG): se niega sin tocar Docker", async () => {
    const { base, falsos, env } = preparar();
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "sha-actual"), "inv-008-app:latest\n");
    const r = await correr(ACCESO, [], env);
    expect(r.status).not.toBe(0);
    expect(docker(falsos.llamadas())).toEqual([]);
  });

  it("no guarda nada en disco (el enlace se imprime una sola vez)", async () => {
    expect(readFileSync(ACCESO, "utf8")).not.toMatch(/\btee\b|>>?\s*"?\$|\bmktemp\b/);
  });
});
