/**
 * Lo que el arnés dice por la terminal (E7): solo conteos y códigos, nunca textos, cifras, nombres ni el destino; y el
 * código de salida (0 terminó, 3 sin modelo o cortado, 1 si la red vigilada rechazó algo, que es un defecto).
 */
import { describe, expect, it } from "vitest";
import { casosInventados } from "@/ia/evaluacion/casos";
import { codigoDeSalida, lineasDeCasos, lineasDeFin } from "@/ia/evaluacion/reporte";

const RED_LIMPIA = { tags: 81, generar: 80, rechazados: 0 };

describe("codigoDeSalida", () => {
  it("0 completa; 3 sin modelo o cortada; 1 si la red vigilada rechazó un pedido", () => {
    expect(codigoDeSalida({ estado: "COMPLETA", corridas: 80, motivo: null, detalle: null }, RED_LIMPIA)).toBe(0);
    expect(codigoDeSalida({ estado: "SIN_MODELO", corridas: 0, motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE" }, RED_LIMPIA)).toBe(3);
    expect(codigoDeSalida({ estado: "CORTADA_POR_SENAL", corridas: 3, motivo: null, detalle: null }, RED_LIMPIA)).toBe(3);
    expect(codigoDeSalida({ estado: "CORTADA_POR_FALLOS", corridas: 3, motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE" }, RED_LIMPIA)).toBe(3);
    expect(codigoDeSalida({ estado: "COMPLETA", corridas: 80, motivo: null, detalle: null }, { ...RED_LIMPIA, rechazados: 1 })).toBe(1);
  });
});

describe("lineasDeCasos y lineasDeFin", () => {
  it("los casos: conteos por tipo y la línea base, sin nombres ni cifras del paquete", () => {
    const casos = casosInventados();
    const texto = lineasDeCasos(casos, "INVENTADOS").join("\n");
    expect(texto).toContain("40");
    expect(texto).toMatch(/DIARIO 15/);
    expect(texto).toMatch(/REGLAS 15/);
    expect(texto).toMatch(/ESCENARIOS 10/);
    expect(texto).not.toContain("FICTICIA");
    for (const h of casos[0]!.paquete.hechos.filter((x) => x.valor.length > 4)) expect(texto).not.toContain(h.presentacion);
  });

  it("el fin: estado, corridas, motivo y conteo de la red; nada más", () => {
    const texto = lineasDeFin("qwen2.5:14b", { estado: "SIN_MODELO", corridas: 0, motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE" }, RED_LIMPIA).join("\n");
    expect(texto).toContain("SIN_MODELO");
    expect(texto).toContain("DIGEST_NO_COINCIDE");
    expect(texto).toContain("qwen2.5:14b");
    expect(texto).not.toMatch(/http:\/\/|\d+\.\d+\.\d+\.\d+/);
  });
});
