/**
 * Cada punto de una especie lleva la especie, igual que en DIARIO (condición C1 de PI): la vista trae el hecho del nombre
 * (id, clave y etiqueta, NUNCA el valor), la frase cita su id y el CÓDIGO pone el nombre al publicar. Una frase de un punto de
 * una especie sin el nombre da ETIQUETA_NO_COINCIDE (SIN_SUJETO), también un ítem de «Para revisar». Un paquete con dos
 * especies y dos reglas se construye y distingue sus hechos (el ancla de cada regla, como en REGLAS).
 */
import { describe, expect, it } from "vitest";
import { construirPaquete, especieDe, ErrorPaquete } from "@/ia/paquete";
import { fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { segmentosDe } from "@/ia/validador/segmentos";
import { validarSalida } from "@/ia/validador/validar";
import { ESPECIE_BETA, ESPECIE_ALFA, entradaSimulacion, hecho } from "../apoyo/hechos.ficticio";
import { frase } from "../validador/apoyo/salidas.ficticio";
import { presentar } from "@/ia/presentar";

const paquete = construirPaquete(entradaSimulacion());
const lista = (plantillas: readonly string[]) => plantillas.map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) }));
const salida = (frases: readonly string[], revisar: readonly string[] = []): string => JSON.stringify({ frases: lista(frases), revisar: lista(revisar) });
const RESTO = [
  "La contribución de la especie {ESPECIE_NOMBRE} al riesgo queda en {PUNTO_CONTRIBUCION_RIESGO}, mucho mayor que su peso.",
  "La cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE} queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.",
];
const PESO = "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.";
const motivos = (s: string): readonly string[] => {
  const r = validarSalida(s, paquete);
  return r.ok ? [] : r.motivos;
};

describe("el nombre de la especie en SIMULACION (como en DIARIO)", () => {
  it("la vista con el nombre (id, clave y etiqueta) pasa la guarda, sin NOMBRE_DE_ESPECIE y sin el valor", () => {
    const vista = vistaCiega(paquete);
    expect(vista.hechos[0]).toEqual(expect.objectContaining({ clave: "ESPECIE_NOMBRE" }));
    expect(JSON.stringify(vista)).not.toContain(ESPECIE_ALFA);
    expect(fugasDeVistaCiega(vista, paquete)).toEqual([]);
  });

  it("la frase con el nombre publica y el texto publicado trae el nombre (lo puso el código)", () => {
    const r = validarSalida(salida([PESO, ...RESTO]), paquete);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) expect(r.resumen.frases[0]?.texto).toBe(`El peso de la especie ${ESPECIE_ALFA} queda en 42,5 %, muy elevado.`);
  });

  it("una frase de un punto de especie SIN el nombre da ETIQUETA_NO_COINCIDE (SIN_SUJETO)", () => {
    const sin = "El peso de la especie queda en {PESO_ESPECIE}, muy elevado.";
    const r = validarSalida(salida([sin, ...RESTO]), paquete);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hallazgos.map((h) => h.patron)).toContain("ETIQUETA.SIN_SUJETO");
    expect(motivos(salida([sin, ...RESTO]))).toContain("ETIQUETA_NO_COINCIDE");
  });

  it("un ítem de «Para revisar» que cita un punto de especie también exige el nombre", () => {
    const sin = motivos(salida([PESO, ...RESTO], ["Peso de la especie {PESO_ESPECIE}"]));
    expect(sin).toContain("ETIQUETA_NO_COINCIDE");
    const con = validarSalida(salida([PESO, ...RESTO], ["Peso de la especie {ESPECIE_NOMBRE}, {PESO_ESPECIE}"]), paquete);
    expect(con.ok, JSON.stringify(con)).toBe(true);
  });

  it("el punto de la regla se atribuye por su ancla: citar el punto sin el nombre de la especie también da SIN_SUJETO", () => {
    const sin = "La cercanía al nivel de la regla queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.";
    expect(motivos(salida([PESO, RESTO[0] as string, sin]))).toContain("ETIQUETA_NO_COINCIDE");
  });

  it("los puntos del portafolio no piden nombre", () => {
    const r = validarSalida(salida([PESO, ...RESTO, "La concentración del portafolio queda en {PUNTO_CONCENTRACION}, elevada."]), paquete);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });
});

describe("dos especies y dos reglas se construyen y se distinguen", () => {
  const entrada = (() => {
    const base = entradaSimulacion();
    const punto = (id: `H${number}`, clave: string, valor: string, unidad: Parameters<typeof presentar>[1], extra: object) =>
      hecho(id as never, clave as never, valor, presentar(valor, unidad), extra as never);
    return {
      ...base,
      hechos: [
        ...base.hechos,
        hecho("H09", "ESPECIE_NOMBRE", ESPECIE_BETA, ESPECIE_BETA),
        punto("H10", "PESO_ESPECIE", "18.4", "PORCENTAJE", { sujeto: "H09", rango: "ELEVADO", importancia: "MEDIA" }),
        punto("H11", "REGLA_DEL_PLAN", "2027-02-10", "FECHA", { sujeto: "H01" }),
        punto("H12", "PUNTO_NIVEL_REGLA", "2.1", "PORCENTAJE", { sujeto: "H11", rango: "CERCA", importancia: "MEDIA" }),
        punto("H13", "REGLA_DEL_PLAN", "2027-02-11", "FECHA", { sujeto: "H09" }),
        punto("H14", "PUNTO_NIVEL_REGLA", "2.7", "PORCENTAJE", { sujeto: "H13", rango: "CERCA", importancia: "MEDIA" }),
      ],
    } as unknown as ReturnType<typeof entradaSimulacion>;
  })();

  it("se construye (sin HECHO_REPETIDO) con dos especies y dos reglas de la misma especie", () => {
    const grande = construirPaquete(entrada);
    expect(grande.hechos).toHaveLength(14);
    expect(especieDe(grande, "H10")?.valor).toBe(ESPECIE_BETA);
    expect(especieDe(grande, "H12")?.valor).toBe(ESPECIE_ALFA);
    expect(especieDe(grande, "H14")?.valor).toBe(ESPECIE_BETA);
    expect(especieDe(grande, "H08")?.valor).toBe(ESPECIE_ALFA);
  });

  it("la vista del paquete grande es ciega y distingue cada hecho por su especie", () => {
    const grande = construirPaquete(entrada);
    const vista = vistaCiega(grande);
    expect(fugasDeVistaCiega(vista, grande)).toEqual([]);
    expect(vista.hechos.find((h) => h.id === "H10")).toMatchObject({ especie: "H09" });
    expect(vista.hechos.find((h) => h.id === "H12")).toMatchObject({ sujeto: "H11", especie: "H01" });
  });

  it("dos puntos iguales de la misma especie siguen siendo HECHO_REPETIDO (el ancla es lo que distingue una regla de otra)", () => {
    // El duplicado lleva el siguiente id consecutivo (H15): lo que falla es la repetición, no el orden de los ids.
    const repetido = { ...entrada, hechos: [...entrada.hechos, { ...entrada.hechos[1], id: "H15" }] } as unknown as typeof entrada;
    let codigo: string | null = null;
    try {
      construirPaquete(repetido);
    } catch (e) {
      codigo = e instanceof ErrorPaquete ? e.codigo : "OTRO";
    }
    expect(codigo).toBe("HECHO_REPETIDO");
  });
});

describe("quién puede citar el ancla de una regla (destinoValido)", () => {
  /** Un peso más (H09) que cita como sujeto el hecho dado. */
  const conPesoQueCita = (sujeto: string) => {
    const base = entradaSimulacion();
    return { ...base, hechos: [...base.hechos, hecho("H09", "PESO_ESPECIE", "11.2", presentar("11.2", "PORCENTAJE"), { sujeto, rango: "ELEVADO", importancia: "MEDIA" } as never)] } as unknown as typeof base;
  };
  const codigo = (f: () => unknown): string | null => {
    try {
      f();
      return null;
    } catch (e) {
      return e instanceof ErrorPaquete ? e.codigo : "OTRO";
    }
  };

  it("el punto del nivel de la regla puede citar un ancla; el peso de una especie no", () => {
    expect(codigo(() => construirPaquete(entradaSimulacion()))).toBeNull();
    // El peso cita al nombre (H01) sin problema; si cita el ancla de una regla (H07), no es una especie.
    expect(codigo(() => construirPaquete(conPesoQueCita("H01")))).toBe("HECHO_REPETIDO");
    expect(codigo(() => construirPaquete(conPesoQueCita("H07")))).toBe("SUJETO_NO_ES_ESPECIE");
  });
});

