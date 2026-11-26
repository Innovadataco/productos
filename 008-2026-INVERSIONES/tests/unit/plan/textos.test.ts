// Textos de las pantallas del plan y del diario (fase B, corte 3): exactos, para el dueño y sin recomendar. Puro.
import { describe, expect, it } from "vitest";
import {
  MOTIVOS_SIN_DIVIDENDOS,
  NOTA_INFERENCIA,
  textoAccionDecision,
  textoAccionRegla,
  textoCierre,
  textoCondicion,
  textoConteos,
  textoNivel,
  textoPlazo,
  textoResultado,
} from "@/app/_plan/textos";
import type { ResultadoVista } from "@/app/_plan/tipos";

const IMPERATIVOS = /\b(compre|venda|compra ya|vende ya|recomend\w*|debería|le conviene)\b/i;

const calculado = (cambios: Partial<ResultadoVista> = {}): ResultadoVista => ({
  estado: "CALCULADO", resultadoPesos: "5246", resultadoPrecio: "4730", dividendosPesos: "516", veredicto: "FUNCIONO", verificado: false,
  incluyeDividendos: true, motivoSinDividendos: null, escisionEnVentana: false, fechaObjetivo: "2024-10-20", sinPrecioDesde: null, sinPrecioHasta: null, ...cambios,
});

describe("el último cierre de una especie", () => {
  it("sin negociación: el texto exacto que pidió el CEO, como aviso", () => {
    const t = textoCierre({ estado: "SIN_NEGOCIACION", desde: "2024-11-05", ultimo: "2024-11-01", precio: "505", verificado: false });
    expect(t).toEqual({ principal: "sin negociación desde 5-nov-2024, último cierre 1-nov-2024", detalle: "cierre de $ 505 · sin verificar", aviso: true });
  });

  it("al día: el precio con su fecha y si está verificado con A&V", () => {
    expect(textoCierre({ estado: "AL_DIA", ultimo: "2024-11-22", precio: "1100", verificado: false })).toEqual({ principal: "$ 1.100 · 22-nov-2024", detalle: "sin verificar", aviso: false });
    expect(textoCierre({ estado: "AL_DIA", ultimo: "2024-11-22", precio: "9.5", verificado: true }).detalle).toBe("verificado A&V");
    expect(textoCierre({ estado: "AL_DIA", ultimo: "2024-11-22", precio: "9.500000", verificado: true }).principal).toBe("$ 9,5 · 22-nov-2024");
  });

  it("sin calendario, sin cierre o sin lotes", () => {
    expect(textoCierre({ estado: "SIN_CALENDARIO", ultimo: "2029-12-28", anio: 2029, precio: "10", verificado: false }).principal).toBe(
      "último cierre 28-dic-2029 · sin calendario de la BVC de 2029 para fechar desde cuándo no se negocia",
    );
    expect(textoCierre({ estado: "SIN_CIERRE" }).principal).toBe("sin cierre");
    expect(textoCierre({ estado: "SIN_LOTES" }).principal).toBe("sin cierre: el sistema solo trae cierres de las especies con compras");
    expect(textoCierre({ estado: "NO_APLICA" }).principal).toBe("—");
  });

  it("la nota al pie dice que «sin negociación» es una deducción", () => {
    expect(NOTA_INFERENCIA).toBe("«Sin negociación» se deduce de que no hay cierre en esos días hábiles de la BVC; el sistema no guarda el volumen de los días omitidos.");
  });
});

describe("la regla frente a su nivel", () => {
  it("tocada, en el nivel o a qué distancia", () => {
    expect(textoNivel({ estado: "TOCADA", lado: "BAJO" })).toBe("tocada · cierre bajo el nivel");
    expect(textoNivel({ estado: "TOCADA", lado: "SOBRE" })).toBe("tocada · cierre sobre el nivel");
    expect(textoNivel({ estado: "EN_EL_NIVEL" })).toBe("en el nivel");
    expect(textoNivel({ estado: "A_DISTANCIA", distanciaPct: "9.09" }, { condicion: "CIERRE_SOBRE", nivel: "1200" })).toBe(
      "por debajo del nivel de $ 1.200: tendría que subir 9,09 % para tocarlo (la regla se cumple si cierra por encima)",
    );
    expect(textoNivel({ estado: "A_DISTANCIA", distanciaPct: "-2.72" }, { condicion: "CIERRE_BAJO", nivel: "2300" })).toBe(
      "por encima del nivel de $ 2.300: tendría que bajar 2,72 % para tocarlo (la regla se cumple si cierra por debajo)",
    );
    expect(textoNivel({ estado: "SIN_CIERRE_AL_DIA" })).toBe("sin cierre al día");
    expect(textoNivel({ estado: "SIN_NIVEL" })).toBe("—");
  });

  it("condición, acción de la regla y plazo", () => {
    expect(textoCondicion("CIERRE_BAJO")).toBe("Cierre por debajo de");
    expect(textoCondicion("MONTO_ORDEN_BAJO")).toBe("Monto por orden menor a");
    expect(textoAccionRegla("NO_ACTUAR")).toBe("no actuar");
    expect(textoAccionDecision("VENDER", true)).toBe("Vender (excepción a la regla)");
    expect(textoPlazo("2024-10-31", true)).toBe("venció el 31-oct-2024");
    expect(textoPlazo("2024-12-31", false)).toBe("hasta el 31-dic-2024");
    expect(textoPlazo(null, false)).toBe("sin plazo");
  });
});

describe("el resultado de una decisión", () => {
  it("con dividendos: veredicto y cifra, y el desglose", () => {
    expect(textoResultado(calculado())).toEqual({ principal: "Funcionó · +$ 5.246", notas: ["precio +$ 4.730 · dividendos +$ 516", "cierres sin verificar con A&V"] });
  });

  it("sin dividendos medibles: «solo precio, sin dividendos: <motivo>»", () => {
    const r = textoResultado(calculado({ resultadoPesos: "-500", resultadoPrecio: "-500", dividendosPesos: null, veredicto: "NO_FUNCIONO", verificado: true, incluyeDividendos: false, motivoSinDividendos: "SIN_TENENCIA" }));
    expect(r).toEqual({ principal: "No funcionó · −$ 500", notas: [`solo precio, sin dividendos: ${MOTIVOS_SIN_DIVIDENDOS.SIN_TENENCIA}`] });
  });

  it("con una escisión en la ventana: sin veredicto y dice por qué", () => {
    const r = textoResultado(calculado({ veredicto: null, escisionEnVentana: true, resultadoPesos: "-100" }));
    expect(r.principal).toBe("Sin veredicto · −$ 100");
    expect(r.notas).toContain("hubo una escisión de la especie en la ventana: el precio cae por la escisión");
  });

  it("pendiente, sin precio y sin orden", () => {
    expect(textoResultado({ ...calculado(), estado: "PENDIENTE", fechaObjetivo: "2024-12-22" }).principal).toBe("Pendiente hasta el 22-dic-2024");
    expect(textoResultado({ ...calculado(), estado: "SIN_PRECIO", sinPrecioDesde: "2024-10-06", sinPrecioHasta: "2024-10-13" }).principal).toBe("Sin precio: falta un cierre de Yahoo entre el 6-oct-2024 y el 13-oct-2024");
    expect(textoResultado({ ...calculado(), estado: "SIN_ORDEN" }).principal).toBe("Sin orden enlazada");
  });

  it("los conteos por horizonte, sin sumar pesos", () => {
    expect(textoConteos(30, { funciono: 1, noFunciono: 1, neutro: 0, sinVeredicto: 1, pendiente: 1, sinPrecio: 1, sinOrden: 1 })).toBe(
      "A 30 días: 1 funcionó · 1 no funcionó · 1 sin veredicto · 1 pendiente · 1 sin precio · 1 sin orden enlazada",
    );
    expect(textoConteos(90, { funciono: 2, noFunciono: 0, neutro: 3, sinVeredicto: 0, pendiente: 0, sinPrecio: 0, sinOrden: 0 })).toBe("A 90 días: 2 funcionaron · 3 neutras");
    expect(textoConteos(90, { funciono: 0, noFunciono: 0, neutro: 0, sinVeredicto: 0, pendiente: 0, sinPrecio: 0, sinOrden: 0 })).toBe("A 90 días: ninguna decisión medida");
  });
});

describe("los motivos dicen lo que se mide", () => {
  it("CARGA_NO_CUBRE: se mide por la fecha de la última carga de Trii, no por el contenido del archivo", () => {
    expect(MOTIVOS_SIN_DIVIDENDOS.CARGA_NO_CUBRE).toBe("la última carga de los archivos de Trii es anterior a la fecha objetivo");
  });
});

describe("ningún texto recomienda comprar ni vender", () => {
  it("las frases fijas y las de todas las acciones, condiciones y motivos", () => {
    const todos = [
      NOTA_INFERENCIA,
      ...Object.values(MOTIVOS_SIN_DIVIDENDOS),
      ...(["COMPRAR", "VENDER", "NO_ACTUAR"] as const).flatMap((a) => [textoAccionRegla(a), textoAccionDecision(a, false), textoAccionDecision(a, true)]),
      ...(["NINGUNA", "CIERRE_BAJO", "CIERRE_SOBRE", "MONTO_ORDEN_BAJO", "LIBRE"] as const).map(textoCondicion),
    ];
    for (const t of todos) expect(t, t).not.toMatch(IMPERATIVOS);
  });
});
