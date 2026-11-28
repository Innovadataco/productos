/**
 * La plantilla publica IGUAL que antes del refactor de `frasesParaLosHechos` (T4): la salida cruda de `salidaDePlantilla`
 * para los casos inventados originales (los 40) y 211 paquetes al azar con semilla fija no cambia ni un carácter. La huella
 * se tomó con el código anterior; si cambia, la plantilla cambió de conducta (y, con ella, lo que publica el nivel 0).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { casosInventados } from "@/ia/evaluacion/casos";
import { salidaDePlantilla } from "@/ia/validador/plantilla";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteAlAzarConTope } from "./apoyo/salidas.ficticio";

const HUELLA_40_CASOS = "85ea02ca536e352b15a58799495735114702c7f8ea6564fa4adca72c9bfb75e9";
const HUELLA_211_AL_AZAR = "44b2aed004dcc77e0b622025a4d9dbed7ddc83126a08ed706b16242fe617e96d";
const CANTIDAD_AL_AZAR = 211;
const SEMILLA = 40_961;
const sha = (partes: readonly string[]): string => createHash("sha256").update(JSON.stringify(partes)).digest("hex");
/** Los casos que existían antes de T6 (DIARIO-16 y siguientes son nuevos). */
const ORIGINALES = (id: string): boolean => !/^DIARIO-(1[6-9]|[2-9][0-9])$/u.test(id);

describe("la plantilla publica igual que hoy", () => {
  it("los casos inventados originales dan la misma salida cruda", () => {
    const casos = casosInventados().filter((c) => ORIGINALES(c.id));
    expect(casos).toHaveLength(40);
    expect(sha(casos.map((c) => salidaDePlantilla(c.paquete)))).toBe(HUELLA_40_CASOS);
  });

  it("211 paquetes al azar con semilla fija dan la misma salida cruda", () => {
    const prng = crearPrng(SEMILLA);
    const salidas = Array.from({ length: CANTIDAD_AL_AZAR }, () => salidaDePlantilla(paqueteAlAzarConTope(prng)));
    expect(new Set(salidas).size).toBeGreaterThan(100);
    expect(sha(salidas)).toBe(HUELLA_211_AL_AZAR);
  });
});
