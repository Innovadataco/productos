// El cableado del ciclo intradía: dependenciasReales lee las variables INV_INTRADIA_* del entorno del proceso, y el
// arranque del bucle deja en el log lo que quedó (encendido o apagado, ciclo, ventana) y los avisos de lo inválido.
import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crearBucle } from "@/servicio-precios/bucle";
import { dependenciasReales, type Proceso } from "@/servicio-precios/servicio";

function proceso(env: Record<string, string>): Proceso & { salida: () => string } {
  const eventos = new EventEmitter();
  let salida = "";
  const dir = mkdtempSync(path.join(tmpdir(), "inv-008-precios-cableado-intradia-"));
  return {
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", PRECIOS_ESTADO_DIR: dir, ...env },
    execPath: process.execPath,
    execArgv: [],
    stdout: { write: (t: string) => (salida += t) },
    once: (s, f) => eventos.once(s, f),
    removeListener: (s, f) => eventos.removeListener(s, f),
    salida: () => salida,
  };
}

describe("dependenciasReales · intradía", () => {
  it("sin variables: la configuración por omisión (APAGADO, 60 s)", () => {
    const d = dependenciasReales(proceso({}), "x");
    expect(d.intradia).toMatchObject({ encendido: false, cicloMs: 60_000, avisos: [] });
  });

  it("lee las variables del entorno del proceso", () => {
    const d = dependenciasReales(proceso({ INV_INTRADIA_ENCENDIDO: "1", INV_INTRADIA_CICLO_SEG: "90" }), "x");
    expect(d.intradia).toMatchObject({ encendido: true, cicloMs: 90_000 });
  });

  it("al arrancar el bucle sin variables, el log dice «intradía APAGADO»; encendido, no", () => {
    const apagado = proceso({});
    crearBucle(dependenciasReales(apagado, "x"));
    expect(apagado.salida()).toContain("intradía APAGADO");
    const encendido = proceso({ INV_INTRADIA_ENCENDIDO: "1" });
    crearBucle(dependenciasReales(encendido, "x"));
    expect(encendido.salida()).not.toContain("APAGADO");
  });

  it("al arrancar el bucle, los avisos de lo inválido van al log SIN repetir el valor", () => {
    const p = proceso({ INV_INTRADIA_CICLO_SEG: "valor-secreto-4613" });
    crearBucle(dependenciasReales(p, "x"));
    expect(p.salida()).toMatch(/intrad[ií]a/i);
    expect(p.salida()).not.toContain("valor-secreto-4613");
  });
});
