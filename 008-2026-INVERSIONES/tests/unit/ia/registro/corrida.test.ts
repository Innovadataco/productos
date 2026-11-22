// De una corrida de las puertas (generarConPuertas) a las filas FALLIDO que registra el servicio, y el rango del mes
// del tope de la nube (revisión de código, MEDIO 4 y 5): puro, sin base. Cada entrada que sale pasa filaDeResumen.
import { describe, expect, it } from "vitest";
import type { FalloGeneracion } from "@/ia/generador";
import { construirPaquete } from "@/ia/paquete";
import { sha256Hex } from "@/ia/hash";
import type { ResultadoPuertas } from "@/ia/puertas";
import { fallidosDeCorrida } from "@/ia/registro/corrida";
import { filaDeResumen } from "@/ia/registro/fila";
import { rangoDelMes } from "@/ia/registro/mes";
import { ENTRADAS_FICTICIAS } from "../apoyo/hechos.ficticio";

const comun = Object.freeze({
  paquete: construirPaquete(ENTRADAS_FICTICIAS.REGLAS()),
  prompt: Object.freeze({ version: "resumen-reglas-v1", hash: sha256Hex("prompt ficticio de la corrida") }),
  opciones: Object.freeze({ temperature: 0, seed: 42 }),
  validadorVersion: "validador-v1",
});
const falloLocal: FalloGeneracion = Object.freeze({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" });
const falloNube: FalloGeneracion = Object.freeze({ ok: false, puerta: "nube", motivo: "TOPE_MENSUAL", detalle: "SIN_SALDO_DEL_MES" });

describe("fallidosDeCorrida", () => {
  it("FALLO: un FALLIDO por puerta, con su motivo y su detalle, en el orden de las puertas", () => {
    const resultado: ResultadoPuertas = { estado: "FALLO", ok: false, fallos: [falloLocal, falloNube] };
    const entradas = fallidosDeCorrida(resultado, comun);
    expect(entradas.map((e) => [e.puerta, e.motivo, e.detalles])).toEqual([
      ["local", "MODELO_NO_DISPONIBLE", ["CONEXION_RECHAZADA"]],
      ["nube", "TOPE_MENSUAL", ["SIN_SALDO_DEL_MES"]],
    ]);
    for (const e of entradas) expect(filaDeResumen(e).estado).toBe("FALLIDO");
  });

  it("EXITO: los fallos de las puertas anteriores (el éxito lo registra quien valida)", () => {
    const exito = { ok: true, puerta: "nube", salidaCruda: "{}", modelo: "m", modeloDigest: "d", latenciaMs: 7, tokensEntrada: 3, tokensSalida: 1 } as const;
    expect(fallidosDeCorrida({ estado: "EXITO", ok: true, exito, fallosPrevios: [falloLocal] }, comun).map((e) => e.puerta)).toEqual(["local"]);
    expect(fallidosDeCorrida({ estado: "EXITO", ok: true, exito, fallosPrevios: [] }, comun)).toEqual([]);
  });

  it("VISTA_NO_CIEGA: un solo FALLIDO sin puerta, con los códigos de la guarda", () => {
    const [vista, ...resto] = fallidosDeCorrida({ estado: "VISTA_NO_CIEGA", ok: false, motivo: "VISTA_NO_CIEGA", codigos: ["VALOR_DEL_PAQUETE", "NOMBRE_DE_ESPECIE"] }, comun);
    expect(resto).toEqual([]);
    expect(vista).toMatchObject({ estado: "FALLIDO", puerta: null, motivo: "VISTA_NO_CIEGA", detalles: ["VALOR_DEL_PAQUETE", "NOMBRE_DE_ESPECIE"] });
    expect(filaDeResumen(vista!).puerta).toBeNull();
  });

  it("APAGADO: nada que registrar (no es un fallo)", () => {
    expect(fallidosDeCorrida({ estado: "APAGADO", ok: false }, comun)).toEqual([]);
  });

  it("las entradas salen congeladas y no comparten arreglos con el resultado", () => {
    const fallos: [FalloGeneracion] = [falloLocal];
    const [e] = fallidosDeCorrida({ estado: "FALLO", ok: false, fallos }, comun);
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e!.detalles)).toBe(true);
  });
});

describe("rangoDelMes (hora de Colombia, UTC−5 todo el año)", () => {
  it.each([
    ["2027-03-17", "2027-03-01T05:00:00.000Z", "2027-04-01T05:00:00.000Z"],
    ["2027-12-31", "2027-12-01T05:00:00.000Z", "2028-01-01T05:00:00.000Z"],
    ["2028-02-29", "2028-02-01T05:00:00.000Z", "2028-03-01T05:00:00.000Z"],
    ["2027-01-01", "2027-01-01T05:00:00.000Z", "2027-02-01T05:00:00.000Z"],
  ])("el mes de %s es [%s, %s)", (dia, desde, hasta) => {
    const r = rangoDelMes(dia);
    expect([r.desde.toISOString(), r.hasta.toISOString()]).toEqual([desde, hasta]);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it.each(["2027-02-29", "2027-13-01", "17-03-2027", ""])("un día inválido (%s) da RANGO_INVALIDO", (dia) => {
    expect(() => rangoDelMes(dia)).toThrow(expect.objectContaining({ codigo: "RANGO_INVALIDO" }));
  });
});
