/**
 * Los dos casos DIARIO grandes (T6): DIARIO-16 (con comparación del día) y DIARIO-17 (sin rueda previa), de diez especies
 * FICTICIA-A a FICTICIA-J, del tamaño de un portafolio real (setenta y tantos hechos, antes del filtro de especies del
 * armador). Los 15 casos viejos y los de REGLAS y ESCENARIOS no cambian (la huella de sus ENTRADAS). Y la opción
 * `--casos <ids>` del arnés elige casos por id. Datos inventados.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { casosInventados, elegirCasos } from "@/ia/evaluacion/casos";
import { CANTIDAD_INVENTADOS, SEMILLA_INVENTADOS, entradasInventadas } from "@/ia/evaluacion/inventados.ficticio";
import { resumenSinIa } from "@/ia/validador/plantilla";

const HUELLA_DIARIO_01_A_15 = "1176d136a097f5f95a057d38be9fb0c3cfd9066602d7310faa7b426d1bb96301";
const HUELLA_REGLAS = "24a257fec37a3550cab4c1bf9046889338c5b74ed06c5f604fd11489d202ab29";
const HUELLA_ESCENARIOS = "aecc94639ad4f4a4cd5d96b1cb6ed657e409b06e5828fcebaa209f6ae00ebac4";
const huella = (x: unknown): string => createHash("sha256").update(JSON.stringify(x, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).digest("hex");
const casos = casosInventados();
const caso = (id: string) => casos.find((c) => c.id === id);

describe("DIARIO-16 y DIARIO-17", () => {
  it("hay 17 DIARIO, 15 REGLAS y 10 ESCENARIOS (42), con ids únicos", () => {
    expect(CANTIDAD_INVENTADOS).toEqual({ DIARIO: 17, REGLAS: 15, ESCENARIOS: 10 });
    expect(casos).toHaveLength(42);
    expect(casos.filter((c) => c.tipo === "DIARIO").map((c) => c.id).slice(-3)).toEqual(["DIARIO-15", "DIARIO-16", "DIARIO-17"]);
    expect(new Set(casos.map((c) => c.id)).size).toBe(42);
  });

  it("los casos viejos no cambian: la huella de sus entradas es la de antes", () => {
    const e = entradasInventadas(SEMILLA_INVENTADOS);
    expect(huella(e.diario.slice(0, 15))).toBe(HUELLA_DIARIO_01_A_15);
    expect(huella(e.reglas)).toBe(HUELLA_REGLAS);
    expect(huella(e.escenarios)).toBe(HUELLA_ESCENARIOS);
  });

  it("DIARIO-16: setenta y nueve hechos, diez especies de FICTICIA-A a FICTICIA-J y la variación del día", () => {
    const p = caso("DIARIO-16")?.paquete;
    expect(p?.hechos).toHaveLength(79);
    const nombres = p?.hechos.filter((h) => h.clave === "ESPECIE_NOMBRE").map((h) => h.valor).sort();
    expect(nombres).toEqual("ABCDEFGHIJ".split("").map((l) => `FICTICIA-${l}`));
    expect(p?.hechos.some((h) => h.clave === "VARIACION_DIA_VALOR")).toBe(true);
    expect(p?.avisos).not.toContain("MOVIMIENTO_SIN_RUEDA_PREVIA");
  });

  it("DIARIO-17: setenta hechos, diez especies, sin variación del día y con SIN_RUEDA_PREVIA", () => {
    const p = caso("DIARIO-17")?.paquete;
    expect(p?.hechos).toHaveLength(70);
    expect(p?.hechos.filter((h) => h.clave === "ESPECIE_NOMBRE")).toHaveLength(10);
    expect(p?.hechos.some((h) => h.clave === "VARIACION_DIA_VALOR")).toBe(false);
    expect(p?.avisos).toContain("MOVIMIENTO_SIN_RUEDA_PREVIA");
  });

  it("los dos son DIARIO de 2027, distintos entre sí, y la plantilla sin IA los publica", () => {
    for (const id of ["DIARIO-16", "DIARIO-17"]) {
      const c = caso(id);
      expect(c?.tipo).toBe("DIARIO");
      expect(c?.paquete.hoy.slice(0, 4)).toBe("2027");
      expect(c !== undefined && resumenSinIa(c.paquete).ok, id).toBe(true);
    }
    expect(caso("DIARIO-16")?.paquete.hash).not.toBe(caso("DIARIO-17")?.paquete.hash);
  });
});

describe("elegirCasos", () => {
  it("devuelve los casos de los ids, en el orden de la lista completa", () => {
    expect(elegirCasos(casos, ["DIARIO-17", "DIARIO-16"])?.map((c) => c.id)).toEqual(["DIARIO-16", "DIARIO-17"]);
    expect(elegirCasos(casos, ["ESCENARIOS-10"])?.map((c) => c.id)).toEqual(["ESCENARIOS-10"]);
  });
  it("un id que no existe da null (el arnés lo cierra en fallo)", () => {
    expect(elegirCasos(casos, ["DIARIO-16", "DIARIO-99"])).toBeNull();
    expect(elegirCasos(casos, [])).toEqual([]);
  });
  it("el resultado está congelado y no toca la lista", () => {
    const r = elegirCasos(casos, ["DIARIO-01"]);
    expect(Object.isFrozen(r)).toBe(true);
    expect(casos).toHaveLength(42);
  });
});
