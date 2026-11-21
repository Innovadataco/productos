// Corredor de tareas del servicio de precios: cada tarea (precios, fondo) es un proceso hijo del MISMO bundle con el
// MISMO CLI de scripts/, con plazo (timeout): al vencer, SIGTERM, y SIGKILL si no sale en la gracia. Sin reintentos.
// Aquí el «bundle» es un guion de node -e que se porta como se le pida (salir con un código, colgarse, ignorar SIGTERM).
import { spawn, type SpawnOptions } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GRACIA_MS, PLAZO_TAREA_MS, crearCorredor } from "../../../src/servicio-precios/tareas";

vi.setConfig({ testTimeout: 30_000 });

// process.argv del hijo: [node, «script», tarea, ...opciones]. Las opciones dicen cómo portarse.
const GUION = `
const fs = require("node:fs");
const [, , tarea, orden, valor] = process.argv;
if (orden === "--salir") process.exit(Number(valor));
if (orden === "--anotar") { fs.writeFileSync(valor, JSON.stringify({ argv: process.argv.slice(1), execArgv: process.execArgv, url: process.env.DATABASE_URL ?? null, tarea })); process.exit(0); }
if (orden === "--senal") process.kill(process.pid, "SIGUSR2");
if (orden === "--terco") process.on("SIGTERM", () => undefined);
setInterval(() => undefined, 60_000);
`;

const corredor = (extra: Partial<Parameters<typeof crearCorredor>[0]> = {}) =>
  crearCorredor({
    ejecutable: process.execPath,
    argumentosNode: ["--max-old-space-size=64", "-e", GUION],
    script: "servicio-precios.ficticio.mjs",
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", DATABASE_URL: "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones" },
    // Sin heredar la consola en las pruebas: el hijo escribe en la nada.
    lanzar: (ejecutable: string, args: readonly string[], opciones: SpawnOptions) => spawn(ejecutable, args, { ...opciones, stdio: "ignore" }),
    ...extra,
  });

describe("constantes", () => {
  it("plazo de 15 minutos por tarea y 5 s de gracia entre SIGTERM y SIGKILL", () => {
    expect(PLAZO_TAREA_MS).toBe(15 * 60_000);
    expect(GRACIA_MS).toBe(5_000);
  });
});

describe("crearCorredor · el hijo", () => {
  it("corre node con las mismas banderas, el mismo bundle, la tarea y sus opciones, con el entorno dado", async () => {
    const archivo = path.join(mkdtempSync(path.join(tmpdir(), "inv-008-tareas-")), "anotado.json");
    const r = await corredor().correr("precios", ["--anotar", archivo], 10_000);
    expect(r).toMatchObject({ tarea: "precios", codigo: "0" });
    const visto = JSON.parse(readFileSync(archivo, "utf8")) as { argv: string[]; execArgv: string[]; url: string; tarea: string };
    expect(visto.argv).toEqual(["servicio-precios.ficticio.mjs", "precios", "--anotar", archivo]);
    expect(visto.execArgv).toContain("--max-old-space-size=64");
    expect(visto.url).toBe("postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones");
    expect(visto.tarea).toBe("precios");
  });

  it("lanza sin shell, con la consola heredada (los CLI solo imprimen conteos y códigos) y sin stdin", async () => {
    let opciones: SpawnOptions | undefined;
    let ejecutable = "";
    let args: readonly string[] = [];
    const c = corredor({
      lanzar: (e: string, a: readonly string[], o: SpawnOptions) => {
        [ejecutable, args, opciones] = [e, a, o];
        return spawn(e, a, { ...o, stdio: "ignore" });
      },
    });
    await c.correr("fondo", ["--salir", "0"], 10_000);
    expect(ejecutable).toBe(process.execPath);
    expect(args).toEqual(["--max-old-space-size=64", "-e", GUION, "servicio-precios.ficticio.mjs", "fondo", "--salir", "0"]);
    expect(opciones?.stdio).toEqual(["ignore", "inherit", "inherit"]);
    expect(opciones?.shell).toBeUndefined();
    expect(opciones?.env?.DATABASE_URL).toContain("inv_precios");
  });

  for (const codigo of [0, 1, 2, 3]) {
    it(`sale con ${codigo} → codigo «${codigo}», con su duración`, async () => {
      const r = await corredor().correr("fondo", ["--salir", String(codigo)], 10_000);
      expect(r.codigo).toBe(String(codigo));
      expect(r.tarea).toBe("fondo");
      expect(r.duracionMs).toBeGreaterThanOrEqual(0);
      expect(r.duracionMs).toBeLessThan(10_000);
    });
  }

  it("muere por una señal ajena → SENAL_<nombre>", async () => {
    expect((await corredor().correr("precios", ["--senal"], 10_000)).codigo).toBe("SENAL_SIGUSR2");
  });

  it("se cuelga: al vencer el plazo, SIGTERM → TIEMPO (no espera más)", async () => {
    const r = await corredor().correr("precios", ["--colgar"], 237);
    expect(r.codigo).toBe("TIEMPO");
    expect(r.duracionMs).toBeGreaterThanOrEqual(237);
    expect(r.duracionMs).toBeLessThan(GRACIA_MS);
  });

  it("ignora SIGTERM: al pasar la gracia, SIGKILL → TIEMPO", async () => {
    const r = await corredor({ graciaMs: 413 }).correr("precios", ["--terco"], 237);
    expect(r.codigo).toBe("TIEMPO");
    expect(r.duracionMs).toBeGreaterThanOrEqual(237 + 413);
  });

  it("el ejecutable no existe → NO_ARRANCO (una sola vez, aunque lleguen error y close)", async () => {
    const r = await corredor({ ejecutable: path.join(tmpdir(), "no-existe-node-ficticio") }).correr("fondo", [], 10_000);
    expect(r.codigo).toBe("NO_ARRANCO");
  });
});

describe("crearCorredor · detener (SIGTERM del contenedor)", () => {
  it("detiene al hijo en curso con SIGTERM → SENAL_SIGTERM", async () => {
    const c = corredor();
    const enCurso = c.correr("precios", ["--colgar"], 60_000);
    await new Promise((ok) => setTimeout(ok, 237));
    c.detener();
    expect((await enCurso).codigo).toBe("SENAL_SIGTERM");
  });

  it("si el hijo ignora SIGTERM, lo mata con SIGKILL al pasar la gracia → SENAL_SIGKILL", async () => {
    const c = corredor({ graciaMs: 311 });
    const enCurso = c.correr("precios", ["--terco"], 60_000);
    await new Promise((ok) => setTimeout(ok, 237));
    c.detener();
    expect((await enCurso).codigo).toBe("SENAL_SIGKILL");
  });

  it("sin hijo en curso no hace nada; después de detener, una tarea nueva no arranca (DETENIDO)", async () => {
    const c = corredor();
    c.detener();
    expect(await c.correr("fondo", ["--salir", "0"], 10_000)).toEqual({ tarea: "fondo", codigo: "DETENIDO", duracionMs: 0 });
  });
});
