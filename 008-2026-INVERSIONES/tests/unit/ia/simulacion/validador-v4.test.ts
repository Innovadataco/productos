/**
 * `validador-v4`, solo SIMULACION: la salida es `salida-v3` (`{frases, revisar}`), con hasta 4 frases y 2 ítems de «Para
 * revisar»; PARA_REVISAR (SIN_PUNTO, VERBO, ORDEN, FALTA, REPETIDO, LONGITUD), RANGO_CONTRADICE (la palabra de rango tiene
 * que ser la del rango del hecho que se cita) y, desde A7, ATRIBUCION conectado SOLO a SIMULACION (ver
 * `validador-v4.atribucion.test.ts`). DIARIO, REGLAS y ESCENARIOS no cambian: siguen leyendo `salida-v2`.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_DIARIOS } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { LIMITES_SIMULACION, VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { resumenSinIa } from "@/ia/validador/plantilla";
import { segmentosDe } from "@/ia/validador/segmentos";
import { validarSalida } from "@/ia/validador/validar";
import { entradaSimulacion, ENTRADAS_FICTICIAS } from "../apoyo/hechos.ficticio";
import { frase } from "../validador/apoyo/salidas.ficticio";

const paquete = construirPaquete(entradaSimulacion());
const texto = (plantilla: string): string => frase(paquete, plantilla).texto;
const lista = (plantillas: readonly string[]) => plantillas.map((p) => ({ segmentos: segmentosDe(texto(p)) }));
/** La salida `salida-v3`: las frases y los ítems de «Para revisar» dados por plantilla (`{CLAVE}` → la cita de ese hecho). */
const salidaV3 = (frases: readonly string[], revisar: readonly string[]): string => JSON.stringify({ frases: lista(frases), revisar: lista(revisar) });

const PESO = "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.";
const CONTRIBUCION = "La contribución de la especie {ESPECIE_NOMBRE} al riesgo queda en {PUNTO_CONTRIBUCION_RIESGO}, mucho mayor que su peso.";
const CONCENTRACION = "La concentración del portafolio queda en {PUNTO_CONCENTRACION}, elevada.";
const NIVEL = "La cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE} queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.";
const BUENAS = [PESO, CONTRIBUCION, CONCENTRACION, NIVEL];
const ITEMS_BUENOS = ["Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}", "Cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE}, {PUNTO_NIVEL_REGLA}"];

const motivos = (salida: string): readonly string[] => {
  const r = validarSalida(salida, paquete);
  return r.ok ? [] : r.motivos;
};
const hallazgos = (salida: string): readonly string[] => {
  const r = validarSalida(salida, paquete);
  return r.ok ? [] : r.hallazgos.map((h) => h.patron);
};

describe("validador-v4 · la salida buena de SIMULACION publica", () => {
  it("es validador-v4 y publica frases e ítems armados por el código, con las cifras del paquete", () => {
    expect(VERSION_VALIDADOR).toBe("validador-v4");
    const r = validarSalida(salidaV3(BUENAS, ITEMS_BUENOS), paquete);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.resumen.validadorVersion).toBe("validador-v4");
    expect(r.resumen.frases).toHaveLength(4);
    expect(r.resumen.frases[0]?.texto).toBe("El peso de la especie FICTICIA-ALFA queda en 42,5 %, muy elevado.");
    expect(r.resumen.revisar.map((i) => i.texto)).toEqual(["Peso de la especie FICTICIA-ALFA, 42,5 %", "Cercanía al nivel de la regla de la especie FICTICIA-ALFA, 0,8 %"]);
    expect(r.resumen.citados).toEqual(expect.arrayContaining(["H02", "H03", "H04", "H08"]));
    expect(LIMITES_SIMULACION).toEqual({ maxFrases: 4, maxRevisar: 2 });
  });

  it("el punto final de un ítem se normaliza: con o sin punto, se publica sin él", () => {
    const sinPunto = validarSalida(salidaV3(BUENAS, ["Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}"]), paquete);
    const conPunto = validarSalida(salidaV3(BUENAS, ["Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}."]), paquete);
    for (const r of [sinPunto, conPunto]) {
      expect(r.ok, JSON.stringify(r)).toBe(true);
      if (r.ok) expect(r.resumen.revisar.map((i) => i.texto)).toEqual(["Peso de la especie FICTICIA-ALFA, 42,5 %"]);
    }
  });

  it("los ítems son opcionales (revisar vacío) siempre que las ALTA se citen en las frases", () => {
    expect(motivos(salidaV3(BUENAS, []))).toEqual([]);
  });
});

describe("validador-v4 · la forma: salida-v3 solo en SIMULACION", () => {
  it("la forma v2 (sin revisar) no es una salida de SIMULACION", () => {
    const v2 = JSON.stringify({ frases: lista(BUENAS) });
    expect(motivos(v2)).toEqual(["SALIDA_INVALIDA"]);
  });

  it("la forma v3 no es una salida de los tres de hoy, que siguen en salida-v2", () => {
    for (const tipo of TIPOS_DIARIOS) {
      const p = construirPaquete(ENTRADAS_FICTICIAS[tipo]());
      const v3 = JSON.stringify({ frases: [], revisar: [] });
      const r = validarSalida(v3, p);
      expect(r.ok ? [] : r.motivos, tipo).toEqual(["SALIDA_INVALIDA"]);
    }
  });

  it("un campo de más, un __proto__ o texto que no es JSON es SALIDA_INVALIDA", () => {
    expect(motivos(JSON.stringify({ frases: lista(BUENAS), revisar: [], nota: "x" }))).toEqual(["SALIDA_INVALIDA"]);
    expect(motivos(`{"frases":[],"revisar":[],"__proto__":{}}`)).toEqual(["SALIDA_INVALIDA"]);
    expect(motivos("no es json")).toEqual(["SALIDA_INVALIDA"]);
  });
});

describe("validador-v4 · límites de SIMULACION", () => {
  it("más de 4 frases es LONGITUD; 4 caben", () => {
    expect(motivos(salidaV3([...BUENAS, PESO], []))).toContain("LONGITUD");
  });

  it("más de 2 ítems es PARA_REVISAR.LONGITUD", () => {
    const salida = salidaV3(BUENAS, [...ITEMS_BUENOS, "Concentración del portafolio {PUNTO_CONCENTRACION}"]);
    expect(motivos(salida)).toContain("PARA_REVISAR");
    expect(hallazgos(salida)).toContain("PARA_REVISAR.LONGITUD");
  });
});

describe("validador-v4 · PARA_REVISAR", () => {
  it.each([
    ["SIN_PUNTO: un ítem que no cita ningún hecho", ["Peso de la especie", "Cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE}, {PUNTO_NIVEL_REGLA}"], "PARA_REVISAR.SIN_PUNTO"],
    ["VERBO: un ítem con un verbo (los ítems son nominales)", ["Peso de la especie queda {PESO_ESPECIE}"], "PARA_REVISAR.VERBO"],
    ["ORDEN: un ítem de menor importancia antes que uno de mayor", ["Efecto de la caída de la especie {ESPECIE_NOMBRE} en el portafolio {PUNTO_EFECTO_CAIDA}", "Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}"], "PARA_REVISAR.ORDEN"],
    ["REPETIDO: el mismo punto en dos ítems", ["Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}", "Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}"], "PARA_REVISAR.REPETIDO"],
  ])("%s", (_caso, items, patron) => {
    const salida = salidaV3(BUENAS, items);
    expect(motivos(salida)).toContain("PARA_REVISAR");
    expect(hallazgos(salida)).toContain(patron);
  });

  it("FALTA: un punto de importancia ALTA que no se cita en ninguna parte", () => {
    const salida = salidaV3([PESO, CONCENTRACION], ITEMS_BUENOS.slice(0, 1));
    expect(hallazgos(salida)).toContain("PARA_REVISAR.FALTA");
    expect(motivos(salida)).toContain("PARA_REVISAR");
    expect(motivos(salida)).toContain("HECHO_NO_CITADO");
  });

  it("control positivo: el mismo orden con ALTA primero y sin repetir no da PARA_REVISAR", () => {
    const salida = salidaV3(BUENAS, ["Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}", "Efecto de la caída de la especie {ESPECIE_NOMBRE} en el portafolio {PUNTO_EFECTO_CAIDA}"]);
    expect(motivos(salida)).not.toContain("PARA_REVISAR");
  });

  it("un ítem pasa por los mismos controles que una frase (una cifra suelta, una palabra de fuera)", () => {
    expect(motivos(salidaV3(BUENAS, [`Peso de la especie ${texto("{PESO_ESPECIE}")} 7`]))).toContain("CIFRA_SUELTA");
    expect(motivos(salidaV3(BUENAS, ["Peso de la especie {PESO_ESPECIE} comprar"]))).toContain("IDIOMA");
  });
});

describe("validador-v4 · RANGO_CONTRADICE", () => {
  it.each([
    ["una palabra de otro rango del mismo hecho (elevado en un MUY_ELEVADO)", "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, elevado."],
    ["una palabra de rango de otra clave (mediano en el peso)", "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, mediano."],
    ["la palabra de un rango en un hecho que no la tiene (grande en la concentración)", "La concentración del portafolio queda en {PUNTO_CONCENTRACION}, grande."],
    ["una palabra de rango sin ningún hecho que la respalde", "Es muy elevado."],
  ])("%s", (_caso, plantilla) => {
    const salida = salidaV3([plantilla, CONTRIBUCION, NIVEL], []);
    expect(motivos(salida)).toContain("RANGO_CONTRADICE");
  });

  it("control positivo: cada palabra con el rango de su hecho (y su género) no da RANGO_CONTRADICE", () => {
    expect(motivos(salidaV3(BUENAS, ITEMS_BUENOS))).not.toContain("RANGO_CONTRADICE");
    expect(motivos(salidaV3([PESO.replace("muy elevado", "muy elevada"), CONTRIBUCION, CONCENTRACION, NIVEL], []))).not.toContain("RANGO_CONTRADICE");
  });

  it("«cerca» de «muy cerca de su nivel» no se cuenta como la marca de cercanía (los puntos no llevan cercanía)", () => {
    const salida = salidaV3(BUENAS, []);
    expect(motivos(salida)).not.toContain("DIRECCION_CONTRADICE");
  });

  it("un hecho sin rango no admite palabra de rango y una frase sin palabra de rango no da el código", () => {
    expect(motivos(salidaV3([PESO, CONTRIBUCION, NIVEL, "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}."], []))).not.toContain("RANGO_CONTRADICE");
  });
});

describe("validador-v4 · lo de hoy no cambia", () => {
  it.each(TIPOS_DIARIOS)("%s: la plantilla sin IA sigue publicando, y la salida de la plantilla también", (tipo) => {
    const p = construirPaquete(ENTRADAS_FICTICIAS[tipo]());
    expect(resumenSinIa(p).ok).toBe(true);
  });
});
