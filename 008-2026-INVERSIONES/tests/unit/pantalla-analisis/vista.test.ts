// La vista de /analisis (frente analisis-pantalla, A2): el análisis del motor en texto, sin recalcular nada. Por especie,
// el portafolio, las decisiones y los puntos para revisar con su umbral a la vista. Lo que no se calculó se dice en
// palabras (nunca un 0 inventado). Análisis INVENTADOS (ids FICTICIA-*, días de 2021). Puro.
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { CLAVES_OBSERVACION, CRITERIOS } from "@/analisis/catalogo";
import { observaciones } from "@/analisis/observaciones";
import { textoUmbral } from "@/app/analisis/textos";
import { aVistaAnalisis, type EntradaVista } from "@/app/analisis/vista";
import { analisis, analisisConTodo, cubierta, especie, HOY, riesgo, sinValor, vacio } from "../analisis/fixtures/analisis.ficticio";
import { D, dia, diasHabiles, portafolio, retornosRepetidos, serieDeRetornos } from "../analisis/fixtures/portafolio.ficticio";

const NOMBRES = new Map([["FICTICIA-A", "FICTA"], ["FICTICIA-B", "FICTB"], ["FICTICIA-C", "FICTC"], ["FICTICIA-D", "FICTD"], ["FICTICIA-FIC", "Fondo ficticio"]]);
const entrada = (cambios: Partial<EntradaVista> = {}): EntradaVista => ({
  analisis: analisis(), observaciones: [], nombres: NOMBRES, procedencias: { acciones: [], fondos: new Map() }, diarioTruncado: false, fondosSinValor: [], ...cambios,
});
const textos = (v: unknown): string => JSON.stringify(v);

describe("vista · cabecera", () => {
  it("el día, la versión del cálculo y la referencia de los cierres", () => {
    const v = aVistaAnalisis(entrada());
    expect(v.hoy).toBe("15-jun-2021");
    expect(v.version).toBe("analisis-v1");
    expect(v.referencia).toBe("Cierres hasta el 14-jun-2021.");
    expect(v.cargaDetenida).toBeNull();
  });

  it("sin cierres, y con la carga detenida, lo dice", () => {
    expect(aVistaAnalisis(entrada({ analisis: analisis({ referencia: null }) })).referencia).toBe("Todavía no hay cierres de sus especies.");
    const v = aVistaAnalisis(entrada({ analisis: analisis({ referencia: { dia: "2021-06-04", cargaDetenida: true } }) }));
    expect(v.cargaDetenida).toContain("4-jun-2021");
  });

  it("la procedencia de los cierres se compone por el más viejo (fecha-dato)", () => {
    const v = aVistaAnalisis(entrada({ procedencias: { acciones: [{ dia: "2021-06-14", traidoEn: "2021-06-14 18:37", fuente: "yahoo" }, { dia: "2021-06-11", traidoEn: null, fuente: "yahoo" }], fondos: new Map() } }));
    expect(v.procedenciaAcciones?.masVieja.dia).toBe("2021-06-11");
    expect(v.procedenciaAcciones?.mezcladas).toBe(true);
  });
});

describe("vista · por especie", () => {
  it("los nombres del tablero, el peso, la volatilidad «de precios diarios» y lo que no se calculó en palabras", () => {
    const a = analisis({ especies: [especie("FICTICIA-B", { peso: 0.6123, riesgo: cubierta(0.6123, 0.7137) }), especie("FICTICIA-D", { riesgo: { estado: "SIN_HISTORIA", motivo: "SIN_CIERRES", dias: 0 } }), sinValor("FICTICIA-A")] });
    const v = aVistaAnalisis(entrada({ analisis: a }));
    expect(v.especies.map((e) => e.nombre)).toEqual(["FICTB", "FICTD", "FICTA"]);
    const [b, d, sin] = v.especies;
    expect(b!.peso).toBe("61,2 %");
    expect(b!.volatilidad).toBe("30,0 %");
    expect(b!.contribucion).toBe("71,4 %");
    expect(b!.ventanas).toEqual(["sin historia", "sin historia", "sin historia", "sin historia"]);
    expect(d!.volatilidad).toBe("sin historia suficiente");
    expect(d!.contribucion).toBe("sin historia suficiente");
    expect(sin!.peso).toBe("sin cierre");
    expect(sin!.volatilidad).toBe("sin cierre");
    expect(v.titulos.volatilidad).toBe("Volatilidad anual de precios diarios");
  });

  it("con historia: las cuatro ventanas (total, con dividendos), la caída máxima y el dividendo sobre el precio", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const e = portafolio([{ id: "FICTICIA-A", cantidad: 37, cierres: serieDeRetornos(dias, 1237.4, retornosRepetidos(299)) }]);
    const a = analizar(e);
    const v = aVistaAnalisis(entrada({ analisis: a }));
    const [fila] = v.especies;
    expect(fila!.ventanas.every((t) => /^[+−]?\d+,\d %$/.test(t))).toBe(true);
    expect(fila!.caida).toMatch(/^\d+,\d %$/);
    expect(fila!.dividendo).toBe("0,0 %");
  });

  it("una contribución sin riesgo que repartir no se vuelve 0", () => {
    const v = aVistaAnalisis(entrada({ analisis: analisis({ especies: [especie("FICTICIA-A")] }) }));
    expect(v.especies[0]!.contribucion).toBe("sin riesgo que repartir");
  });
});

describe("vista · portafolio", () => {
  it("concentración, volatilidad de la ventana común y la matriz con sus nombres (null = sin variación)", () => {
    const a = analisis({
      especies: [especie("FICTICIA-A"), especie("FICTICIA-B")],
      concentracion: { especies: 2, primera: { instrumentoId: "FICTICIA-A", peso: 0.5371 }, tresPrimeras: { instrumentoIds: ["FICTICIA-A", "FICTICIA-B"], peso: 1 }, hhi: 0.5027 },
      riesgo: riesgo(["FICTICIA-A", "FICTICIA-B"], [[1, null], [null, 1]]),
    });
    const v = aVistaAnalisis(entrada({ analisis: a }));
    expect(v.portafolio.volatilidad).toBe("21,0 %");
    expect(v.portafolio.ventana).toContain("15-jun-2020");
    expect(v.portafolio.concentracion.join(" ")).toContain("FICTA");
    expect(v.portafolio.concentracion.join(" ")).toContain("53,7 %");
    expect(v.portafolio.matriz).toEqual({ ids: ["FICTICIA-A", "FICTICIA-B"], nombres: ["FICTA", "FICTB"], filas: [{ id: "FICTICIA-A", nombre: "FICTA", celdas: ["1,00", "sin variación"] }, { id: "FICTICIA-B", nombre: "FICTB", celdas: ["sin variación", "1,00"] }] });
  });

  it("sin historia común: no hay matriz ni volatilidad, y lo dice", () => {
    const v = aVistaAnalisis(entrada());
    expect(v.portafolio.matriz).toBeNull();
    expect(v.portafolio.volatilidad).toBe("sin historia suficiente");
  });

  it("el efecto de una caída como la mayor de cada especie, en pesos y sobre el valor de las acciones", () => {
    const a = analisis({ especies: [especie("FICTICIA-A", { efectoCaida: { pesos: D("-1153.31"), fraccionPortafolio: -0.25 } })] });
    expect(aVistaAnalisis(entrada({ analisis: a })).portafolio.efectos).toEqual([{ id: "FICTICIA-A", nombre: "FICTA", pesos: "−$ 1.153", fraccion: "−25,0 %" }]);
  });
});

describe("vista · el fondo", () => {
  it("sin la entrada de fondos: solo las acciones", () => {
    const v = aVistaAnalisis(entrada());
    expect(v.composicion.filas).toEqual([{ id: "acciones", nombre: "Acciones", valor: "$ 4.613", peso: null, procedencia: null }]);
    expect(v.composicion.total).toBeNull();
  });

  it("con el fondo: acciones, fondo y total, con sus pesos y la fecha del valor de unidad", () => {
    const conFondo = { valorTotal: D("42524.74"), pesoAcciones: 0.10848499, fondos: [{ instrumentoId: "FICTICIA-FIC", valor: D("37911.47"), dia: "2021-06-11", peso: 0.89151501 }] };
    const proc = { dia: "2021-06-11", traidoEn: "2021-06-13 07:41", fuente: "sfc:qhpu-8ixx" };
    const v = aVistaAnalisis(entrada({ analisis: analisis({ conFondo }), procedencias: { acciones: [], fondos: new Map([["FICTICIA-FIC", proc]]) } }));
    expect(v.composicion.filas).toEqual([
      { id: "acciones", nombre: "Acciones", valor: "$ 4.613", peso: "10,8 %", procedencia: null },
      { id: "FICTICIA-FIC", nombre: "Fondo ficticio", valor: "$ 37.911", peso: "89,2 %", procedencia: proc },
    ]);
    expect(v.composicion.total).toBe("$ 42.525");
    expect(v.composicion.nota).toContain("solo de las acciones");
  });

  it("un fondo sin valor de unidad hasta hoy se nombra aparte", () => {
    expect(aVistaAnalisis(entrada({ fondosSinValor: ["FICTICIA-FIC"] })).composicion.sinValor).toContain("Fondo ficticio");
  });
});

describe("vista · sus decisiones", () => {
  it("cuántas funcionaron, no funcionaron y fueron neutras, a 30 y 90 días, y el resultado en pesos", () => {
    const d30 = { ...vacio(30), decisiones: 7, veredictos: { FUNCIONO: 3, NO_FUNCIONO: 2, NEUTRO: 1 }, pendientes: 1, totalPesos: D("4613.27") };
    const v = aVistaAnalisis(entrada({ analisis: analisis({ decisiones: { d30, d90: vacio(90), medidas: [] } }) }));
    const [h30, h90] = v.decisiones.horizontes;
    expect(h30!.titulo).toBe("A 30 días");
    expect(h30!.lineas.join(" ")).toContain("3 funcionaron");
    expect(h30!.lineas.join(" ")).toContain("2 no funcionaron");
    expect(h30!.lineas.join(" ")).toContain("$ 4.613");
    expect(h90!.lineas).toEqual(["Sin decisiones registradas."]);
    expect(v.decisiones.truncado).toBeNull();
  });

  it("con el diario recortado lo avisa: la cuenta es parcial", () => {
    expect(aVistaAnalisis(entrada({ diarioTruncado: true })).decisiones.truncado).toContain("parcial");
  });
});

describe("vista · puntos para revisar", () => {
  const { a, reglas } = analisisConTodo();
  const obs = observaciones(a, { reglas }, dia(HOY));
  const v = aVistaAnalisis(entrada({ analisis: a, observaciones: obs }));

  it("una por observación, en el orden del motor, cada una con su umbral a la vista", () => {
    expect(v.puntos).toHaveLength(obs.length);
    expect(v.puntos.every((p) => p.umbral.startsWith("umbral: "))).toBe(true);
    expect(new Set(obs.map((o) => o.clave))).toEqual(new Set(CLAVES_OBSERVACION));
  });

  it("el umbral sale del catálogo: la concentración dice «más de 25 %» y la correlación «0,80 o más»", () => {
    const de = (clave: string) => v.puntos[obs.findIndex((o) => o.clave === clave)]!;
    expect(de("CONCENTRACION_ALTA").umbral).toBe(`umbral: más de ${CRITERIOS.CONCENTRACION_ALTA.umbral * 100} %`);
    expect(de("CORRELACION_ALTA").umbral).toBe("umbral: 0,80 o más");
    expect(de("REGLA_CERCANA").umbral).toBe(`umbral: ${CRITERIOS.REGLA_CERCANA.umbral} % o menos`);
    expect(de("HISTORIA_INSUFICIENTE").umbral).toBe(`umbral: menos de ${CRITERIOS.HISTORIA_INSUFICIENTE.umbral} días`);
  });

  it("los ids opacos no salen en pantalla: se cruzan con los nombres", () => {
    expect(textos(v.puntos)).not.toMatch(/FICTICIA-/);
  });

  it("sin observaciones: lo dice", () => {
    expect(aVistaAnalisis(entrada()).puntos).toEqual([]);
  });
});

describe("vista · revisión (code-reviewer y react-reviewer)", () => {
  it("MEDIO 1 · un dividendo con pagos descartados no se pinta como un 0 limpio: lo dice", () => {
    const a = analisis({ especies: [especie("FICTICIA-A", { dividendo12m: { fraccion: 0, pagos: 0, conBruto: false, descartados: 2 } })] });
    expect(aVistaAnalisis(entrada({ analisis: a })).especies[0]!.dividendo).toBe("0,0 % (2 pagos sin tenencia clara)");
  });

  it("MEDIO 2 · con decisiones pero ninguna con veredicto, no hay un «$ 0» inventado", () => {
    const d30 = { ...vacio(30), decisiones: 3, pendientes: 3 };
    const [h30] = aVistaAnalisis(entrada({ analisis: analisis({ decisiones: { d30, d90: vacio(90), medidas: [] } }) })).decisiones.horizontes;
    expect(h30!.lineas.join(" ")).not.toContain("$ 0");
    expect(h30!.lineas.join(" ")).toContain("Ninguna tiene veredicto todavía");
  });

  it("MEDIO 3 · cada fila lleva su id estable (los nombres pueden repetirse)", () => {
    const nombres = new Map([["FICTICIA-A", "Acciones"], ["FICTICIA-B", "Acciones"]]);
    const a = analisis({ especies: [especie("FICTICIA-A"), especie("FICTICIA-B")], riesgo: riesgo(["FICTICIA-A", "FICTICIA-B"], [[1, 0.37], [0.37, 1]]) });
    const v = aVistaAnalisis(entrada({ analisis: a, nombres }));
    expect(v.especies.map((e) => e.id)).toEqual(["FICTICIA-A", "FICTICIA-B"]);
    expect(v.portafolio.matriz!.ids).toEqual(["FICTICIA-A", "FICTICIA-B"]);
    expect(v.composicion.filas[0]!.id).toBe("acciones");
  });

  it("MEDIO 4 · el conector del umbral sale de la comparación del catálogo, no de un texto fijo", () => {
    const esperado: Record<string, RegExp> = { MAYOR_QUE: /^umbral: más de /, MAYOR_O_IGUAL: / o más/, MENOR_QUE: /^umbral: menos de /, DE_CERO_HASTA: / o menos/, VALOR_ABSOLUTO_HASTA: / o menos/, PASA_EL_NIVEL: /nivel/ };
    for (const clave of CLAVES_OBSERVACION) expect(textoUmbral(clave), clave).toMatch(esperado[CRITERIOS[clave].comparacion]!);
  });

  it("BAJO · una especie sin caída histórica no sale como «$ 0» en el efecto", () => {
    const a = analisis({ especies: [especie("FICTICIA-A", { efectoCaida: { pesos: D(0), fraccionPortafolio: 0 } })] });
    expect(aVistaAnalisis(entrada({ analisis: a })).portafolio.efectos).toEqual([{ id: "FICTICIA-A", nombre: "FICTA", pesos: "sin caída histórica", fraccion: null }]);
  });

  it("BAJO · un peso que no se puede calcular (total cero) se dice", () => {
    const conFondo = { valorTotal: D(0), pesoAcciones: null, fondos: [] };
    expect(aVistaAnalisis(entrada({ analisis: analisis({ valorAcciones: D(0), conFondo }) })).composicion.filas[0]!.peso).toBe("sin valor");
  });
});
