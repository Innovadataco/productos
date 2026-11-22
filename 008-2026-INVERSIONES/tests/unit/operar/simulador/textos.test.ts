// Textos del simulador, exactos: las etiquetas de la comisión que pidió el brief, los errores y avisos claros, las
// reglas con lo que el dueño escribió en su plan y las afectaciones como información. Datos inventados.
import { describe, expect, it } from "vitest";
import { precio } from "@/app/_plan/formato";
import {
  COMISION_SIN_HISTORIA,
  ETIQUETA_COMISION,
  NOTA_CAJA_SIN_COMISION,
  NOTA_VALORACION,
  textoAfectacion,
  textoAviso,
  textoComision,
  textoError,
  textoPesos,
  textoRegla,
} from "@/operar/simulador/textos";
import { A, B, C, D, idDe, regla } from "./apoyo/estado.ficticio";

describe("comisión", () => {
  it("las etiquetas exactas del brief", () => {
    expect(ETIQUETA_COMISION).toBe("estimada con su historia; la tarifa real puede ser distinta");
    expect(COMISION_SIN_HISTORIA).toBe("sin historia: no se estima");
    expect(NOTA_CAJA_SIN_COMISION).toBe("La caja de después no incluye comisión: sin historia de ese lado no se estima.");
    expect(NOTA_VALORACION).toBe("Las acciones se valoran a su último cierre; la caja se mueve al precio límite de la orden.");
  });

  it("estimada: la etiqueta, en cuántas órdenes se basa y de qué lado (va en la estimación); sin historia: no se estima", () => {
    expect(textoComision({ estado: "ESTIMADA", lado: "VENTA", valor: D("14.5678"), ordenesBase: 1 })).toBe(
      "estimada con su historia; la tarifa real puede ser distinta · con 1 orden de venta",
    );
    expect(textoComision({ estado: "ESTIMADA", lado: "COMPRA", valor: D("288.3295"), ordenesBase: 4613 })).toBe(
      "estimada con su historia; la tarifa real puede ser distinta · con 4.613 órdenes de compra",
    );
    expect(textoComision({ estado: "SIN_HISTORIA" })).toBe("sin historia: no se estima");
  });
});

describe("errores", () => {
  it("uno claro por código", () => {
    expect(textoError({ codigo: "LADO_INVALIDO" })).toBe("La operación no es una compra ni una venta.");
    expect(textoError({ codigo: "CANTIDAD_NO_POSITIVA" })).toBe("La cantidad no es un número entero mayor que cero.");
    expect(textoError({ codigo: "CANTIDAD_FUERA_DE_RANGO" })).toBe("La cantidad es demasiado grande para calcularla con exactitud.");
    expect(textoError({ codigo: "PRECIO_NO_POSITIVO" })).toBe("El precio límite no es un número mayor que cero.");
    expect(textoError({ codigo: "PRECIO_FUERA_DE_ESCALA" })).toBe("El precio límite tiene más de 6 decimales o es demasiado grande para calcularlo con exactitud.");
    expect(textoError({ codigo: "ESPECIE_DESCONOCIDA" })).toBe("La especie no está en su portafolio en 008: no hay cantidad ni cierre para simular.");
    expect(textoError({ codigo: "VENTA_SUPERA_TENENCIA", tiene: 1237n, pide: 4613n })).toBe("La venta es de 4.613 acciones y usted tiene 1.237.");
    expect(textoError({ codigo: "ORDEN_FUERA_DE_RANGO" })).toBe("El valor de la orden, o el de la posición que deja, es demasiado grande para calcularlo con exactitud.");
  });
});

describe("avisos", () => {
  it("comprar por más de la caja: dice si cuenta la comisión y que la caja puede estar atrasada", () => {
    const base = { codigo: "COMPRA_SUPERA_CAJA", caja: D("37911.47"), necesario: D("44114.3944") } as const;
    expect(textoAviso({ ...base, conComision: true })).toBe(
      "El valor de la compra más la comisión estimada pasa la caja registrada. La caja puede estar atrasada: el cálculo sigue con la registrada.",
    );
    expect(textoAviso({ ...base, conComision: false })).toBe(
      "El valor de la compra pasa la caja registrada (sin comisión: no hay historia para estimarla). La caja puede estar atrasada: el cálculo sigue con la registrada.",
    );
  });

  it("especies sin cierre, en singular y en plural", () => {
    const e = (n: string) => ({ instrumentoId: idDe(n), nemotecnico: n });
    expect(textoAviso({ codigo: "ESPECIES_SIN_CIERRE", especies: [e(B)] })).toBe("Sin cierre: FICTICIA-B. Su valor y su peso no se calculan, y los pesos de las demás no la cuentan.");
    expect(textoAviso({ codigo: "ESPECIES_SIN_CIERRE", especies: [e(B), e(C)] })).toBe(
      "Sin cierre: FICTICIA-B, FICTICIA-C. Su valor y su peso no se calculan, y los pesos de las demás no las cuentan.",
    );
  });
});

describe("afectaciones: información, no un juicio", () => {
  const deA = (cambios: Parameters<typeof regla>[0]) => regla({ instrumentoId: idDe(A), ...cambios });

  it("monto y nivel (sus tres frentes)", () => {
    const r = deA({ condicion: "MONTO_ORDEN_BAJO", nivel: D("461337.41") });
    expect(textoAfectacion({ tipo: "MONTO_ORDEN_BAJO" }, r)).toBe("El valor de esta orden queda por debajo del monto mínimo por orden de su regla.");
    expect(textoAfectacion({ tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "TOCADA", lado: "BAJO" } }, r)).toBe("El precio de esta orden queda por debajo del nivel de su regla.");
    expect(textoAfectacion({ tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "TOCADA", lado: "SOBRE" } }, r)).toBe("El precio de esta orden queda por encima del nivel de su regla.");
    expect(textoAfectacion({ tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "EN_EL_NIVEL" } }, r)).toBe("El precio de esta orden queda en el nivel de su regla.");
  });

  it("otra acción: lo que dice su plan para la especie, con su cantidad y su condición tal cual (no una instrucción suelta)", () => {
    const otra = { tipo: "OTRA_ACCION" } as const;
    expect(textoAfectacion(otra, deA({ accion: "VENDER", cantidad: 41n, condicion: "CIERRE_SOBRE", nivel: D("5137.11") }))).toBe(
      "Su plan para esta especie dice: vender 41 si el cierre queda por encima de $ 5.137,11.",
    );
    expect(textoAfectacion(otra, deA({ accion: "COMPRAR" }))).toBe("Su plan para esta especie dice: comprar.");
    expect(textoAfectacion(otra, deA({ accion: "NO_ACTUAR", cantidad: 1237n }))).toBe("Su plan para esta especie dice: no actuar 1.237.");
  });
});

describe("la regla, con lo que escribió en su plan", () => {
  it("de la especie: acción, cantidad, condición y nivel", () => {
    const r = regla({ instrumentoId: idDe(A), condicion: "CIERRE_SOBRE", nivel: D("4600.130000"), accion: "VENDER", cantidad: 41n });
    expect(textoRegla(r, A)).toBe("Su regla de FICTICIA-A dice: vender 41 si el cierre queda por encima de $ 4.600,13.");
    expect(textoRegla({ ...r, condicion: "CIERRE_BAJO", nivel: D("4613.000001"), cantidad: 4613n }, A)).toBe(
      "Su regla de FICTICIA-A dice: vender 4.613 si el cierre queda por debajo de $ 4.613,000001.",
    );
  });

  it("de portafolio: dice «portafolio» y no el nombre de la especie operada", () => {
    const r = regla({ condicion: "MONTO_ORDEN_BAJO", nivel: D("461337.41") });
    expect(textoRegla(r, A)).toBe("Su regla de portafolio dice: no actuar si el monto por orden es menor que $ 461.337,41.");
  });

  it("sin condición, con y sin cantidad", () => {
    expect(textoRegla(regla({ instrumentoId: idDe(B), accion: "COMPRAR", cantidad: 37n }), B)).toBe("Su regla de FICTICIA-B dice: comprar 37.");
    expect(textoRegla(regla({ instrumentoId: idDe(B), accion: "NO_ACTUAR" }), B)).toBe("Su regla de FICTICIA-B dice: no actuar.");
  });

  it("escrita (LIBRE): su texto tal cual", () => {
    expect(textoRegla(regla({ instrumentoId: idDe(A), condicion: "LIBRE", detalle: "siempre orden límite, ficticio" }), A)).toBe(
      "Su regla de FICTICIA-A dice: no actuar · lo que escribió: «siempre orden límite, ficticio».",
    );
  });

  it("lo escrito sale en una sola línea y sin caracteres de control ni de dirección (no falsea la frase que sigue)", () => {
    const detalle = "orden límite\u202E»; Su plan dice: otra cosa\nsegunda\u0007 línea \u2066x\u2069";
    expect(textoRegla(regla({ instrumentoId: idDe(A), condicion: "LIBRE", detalle }), A)).toBe(
      "Su regla de FICTICIA-A dice: no actuar · lo que escribió: «orden límite»; Su plan dice: otra cosa segunda línea x».",
    );
  });

  it("una regla de cierre sin nivel (no pasa la validación) no inventa un nivel", () => {
    expect(textoRegla(regla({ instrumentoId: idDe(A), condicion: "CIERRE_BAJO", nivel: null, accion: "VENDER" }), A)).toBe(
      "Su regla de FICTICIA-A dice: vender si el cierre queda por debajo de un nivel sin dato.",
    );
  });
});

describe("pesos en texto: exactos y con el mismo formato que la pantalla del plan", () => {
  it("sin punto flotante ni notación exponencial", () => {
    expect(textoPesos(D("0.0000001"))).toBe("$ 0,0000001");
    expect(textoPesos(D("99999999999999.999999"))).toBe("$ 99.999.999.999.999,999999");
    expect(textoPesos(D("-6202.9244"))).toBe("−$ 6.202,9244");
  });

  it("igual que precio() de la app en valores de hasta 6 decimales y 15 cifras", () => {
    for (const v of ["4613.27", "4600.130000", "11.71", "461337.41", "0.000001", "823.19", "37911.47", "1237", "913711.4613"]) {
      expect(textoPesos(D(v)), v).toBe(precio(v));
    }
  });
});
