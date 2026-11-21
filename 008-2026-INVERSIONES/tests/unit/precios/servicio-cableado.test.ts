// Cableado real del servicio de precios (src/servicio-precios/servicio.ts e iniciarBucle): la carpeta de la huella, el
// log con la hora de Colombia, el intervalo, el corredor que relanza el bundle y las señales. El «proceso» es falso
// (un EventEmitter con su entorno); los hijos, node -e. Datos inventados.
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SALIDA } from "../../../src/servicio-precios/bucle";
import { leerClaveValor } from "../../../src/servicio-precios/estado";
import { dependenciasReales, servirAhora, servirBucle, type Proceso } from "../../../src/servicio-precios/servicio";

vi.setConfig({ testTimeout: 30_000 });

const URL_PRECIOS = "postgresql://inv_precios:clave-ficticia-4613@inv-008-db:5432/inversiones_ficticia_test";
const carpeta = (): string => mkdtempSync(path.join(tmpdir(), "inv-008-precios-cableado-"));
const hasta = (condicion: () => boolean): Promise<void> =>
  vi.waitFor(
    () => {
      if (!condicion()) throw new Error("todavía no");
    },
    { timeout: 10_000, interval: 10 },
  );

/** Un proceso falso: sus señales son un EventEmitter; su stdout, un texto. Los hijos corren `node -e <guion>`. */
function proceso(env: Record<string, string>, guion = "process.exit(0)"): Proceso & { salida: () => string; emitir: (s: NodeJS.Signals) => void; oyentes: () => number } {
  const eventos = new EventEmitter();
  let salida = "";
  return {
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    execPath: process.execPath,
    execArgv: ["-e", guion],
    stdout: { write: (t: string) => (salida += t) },
    once: (s, f) => eventos.once(s, f),
    removeListener: (s, f) => eventos.removeListener(s, f),
    salida: () => salida,
    emitir: (s) => void eventos.emit(s, s),
    oyentes: () => eventos.listenerCount("SIGTERM") + eventos.listenerCount("SIGINT"),
  };
}

describe("dependenciasReales", () => {
  it("la huella va en PRECIOS_ESTADO_DIR (pruebas) o, por defecto, en /estado", () => {
    expect(dependenciasReales(proceso({ PRECIOS_ESTADO_DIR: "/tmp/ficticia" }), "x").dir).toBe("/tmp/ficticia");
    expect(dependenciasReales(proceso({}), "x").dir).toBe("/estado");
    expect(dependenciasReales(proceso({ PRECIOS_ESTADO_DIR: "" }), "x").dir).toBe("/estado");
  });

  it("revisa la credencial de DATABASE_URL (sin devolverla)", () => {
    expect(dependenciasReales(proceso({ DATABASE_URL: URL_PRECIOS }), "x").credencial).toEqual({ ok: true });
    expect(dependenciasReales(proceso({}), "x").credencial).toMatchObject({ ok: false, estado: "SIN_SECRETO" });
  });

  it("el log lleva la hora de Colombia y la etiqueta [precios], una línea por mensaje", () => {
    const p = proceso({});
    dependenciasReales(p, "x").registrar("mensaje ficticio");
    expect(p.salida()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} COT \[precios\] mensaje ficticio\n$/);
  });

  it("el reloj es el del sistema y el programa repite con setInterval hasta que se cancela", async () => {
    const d = dependenciasReales(proceso({}), "x");
    expect(Math.abs(d.ahora() - Date.now())).toBeLessThan(1_000);
    let veces = 0;
    const cancelar = d.programar(() => (veces += 1), 7);
    await hasta(() => veces >= 3);
    cancelar();
    const quedaron = veces;
    await new Promise((ok) => setTimeout(ok, 37));
    expect(veces).toBe(quedaron);
  });

  it("el corredor relanza node con las banderas del proceso, el bundle, la tarea y el entorno", async () => {
    const d = dependenciasReales(proceso({}, "process.exit(process.argv[1] === 'bundle-ficticio.mjs' && process.argv[2] === 'fondo' ? 3 : 1)"), "bundle-ficticio.mjs");
    expect(await d.corredor.correr("fondo", [], 10_000)).toMatchObject({ tarea: "fondo", codigo: "3" });
  });
});

describe("servirAhora", () => {
  it("argumentos malos → 2 y el uso en el log", async () => {
    const p = proceso({ DATABASE_URL: URL_PRECIOS, PRECIOS_ESTADO_DIR: carpeta() });
    expect(await servirAhora(p, "x", ["--desde", "2019-02-30"])).toBe(SALIDA.USO);
    expect(p.salida()).toContain("--ahora [--desde AAAA-MM-DD]");
  });

  it("sin el secreto → 64", async () => {
    const p = proceso({ PRECIOS_ESTADO_DIR: carpeta() });
    expect(await servirAhora(p, "x", [])).toBe(SALIDA.CONFIGURACION);
    expect(p.salida()).toContain("sin INV_PRECIOS_DATABASE_URL");
  });

  it("con SIGTERM a mitad: detiene al hijo, deja la huella en FALLO y suelta las señales", async () => {
    const dir = carpeta();
    const p = proceso({ DATABASE_URL: URL_PRECIOS, PRECIOS_ESTADO_DIR: dir }, "setInterval(() => undefined, 60_000)");
    const corrida = servirAhora(p, "x", ["--desde", "2019-08-23"]);
    await hasta(() => p.salida().includes("corrida (ahora) empieza desde 2019-08-23"));
    await new Promise((ok) => setTimeout(ok, 137));
    p.emitir("SIGTERM");
    expect(await corrida).toBe(SALIDA.FALLO);
    expect(leerClaveValor(readFileSync(path.join(dir, "ultima-corrida"), "utf8"))).toMatchObject({ modo: "ahora", resultado: "FALLO", precios: "SENAL_SIGTERM", fondo: "DETENIDO" });
    expect(p.oyentes()).toBe(0);
  });
});

describe("servirBucle", () => {
  it("sin el secreto: queda en espera con latido; con SIGTERM sale con 0, deja DETENIDO y suelta las señales", async () => {
    const dir = carpeta();
    const p = proceso({ PRECIOS_ESTADO_DIR: dir });
    const fin = servirBucle(p, "x");
    const latido = path.join(dir, "bucle");
    await hasta(() => existsSync(latido) && leerClaveValor(readFileSync(latido, "utf8")).estado === "SIN_SECRETO");
    expect(p.salida()).toContain("sin INV_PRECIOS_DATABASE_URL");
    p.emitir("SIGTERM");
    expect(await fin).toBe(SALIDA.BIEN);
    expect(p.salida()).toContain("detenido por SIGTERM");
    expect(leerClaveValor(readFileSync(latido, "utf8")).estado).toBe("DETENIDO");
    expect(p.oyentes()).toBe(0);
  });

  it("también se detiene con SIGINT (Ctrl-C a mano)", async () => {
    const p = proceso({ PRECIOS_ESTADO_DIR: carpeta() });
    const fin = servirBucle(p, "x");
    await hasta(() => p.salida().includes("arranca:"));
    p.emitir("SIGINT");
    expect(await fin).toBe(SALIDA.BIEN);
    expect(p.salida()).toContain("detenido por SIGINT");
  });
});
