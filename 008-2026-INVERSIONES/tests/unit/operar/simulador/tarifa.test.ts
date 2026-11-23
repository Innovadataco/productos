// La comisión con la tarifa real (O5) en el motor del simulador: la cuenta exacta (mínimo, fijo, IVA sobre la comisión y
// otros cargos, un solo redondeo), que la tarifa del lado manda sobre la historia, que sin la de ese lado se usa la
// historia con su etiqueta, y que una tarifa mal formada es un error de quien llama (RangeError). Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { simularOperacion } from "@/operar/simulador/simular";
import { comisionConTarifa, desgloseConTarifa } from "@/operar/simulador/tarifa";
import { ETIQUETA_COMISION, ETIQUETA_TARIFA, textoComision } from "@/operar/simulador/textos";
import { A, B, CONTEXTO, D, ESTADO, SIN_HISTORIA, exito, operacion } from "./apoyo/estado.ficticio";
import { tarifa, tarifaSimple } from "../tarifa/apoyo/tarifa.ficticio";

describe("desgloseConTarifa", () => {
  it("porcentaje sobre el mínimo, más el fijo; IVA sobre la comisión; otros cargos aparte; un solo redondeo", () => {
    const d = desgloseConTarifa(D("13839.81"), tarifa());
    expect(d.comision.toFixed()).toBe("39.16652111");
    expect(d.iva.toFixed()).toBe("6.779724804141");
    expect(d.otros.toFixed()).toBe("4.00605397");
    expect(d.total.toFixed()).toBe("49.9523");
  });

  it("con un valor chico manda el mínimo (el porcentaje no aparece)", () => {
    const d = desgloseConTarifa(D("23.42"), tarifa());
    expect(d.comision.toFixed()).toBe("8.5");
    expect(d.total.toFixed()).toBe("12.0846");
  });

  it("redondea mitad hacia arriba a 4 decimales al final, no antes", () => {
    expect(comisionConTarifa(D("4613.27"), tarifaSimple()).toFixed()).toBe("12.5988");
    // 0,5 % de 0,01 = 0,00005 → 0,0001 (mitad hacia arriba, a 4 decimales).
    expect(comisionConTarifa(D("0.01"), tarifaSimple("COMPRA", { porcentaje: D("0.5") })).toFixed()).toBe("0.0001");
  });

  it("no muta la tarifa ni el valor", () => {
    const t = Object.freeze(tarifa());
    const v = D("13839.81");
    desgloseConTarifa(v, t);
    expect(v.toFixed()).toBe("13839.81");
    expect(t.otrosCargos).toHaveLength(2);
  });
});

describe("simularOperacion con tarifa", () => {
  it("con la tarifa del lado, la comisión sale de ella y la caja la descuenta", () => {
    const s = exito(simularOperacion(ESTADO, operacion(A, "COMPRAR", 3n, "4613.27"), { ...CONTEXTO, tarifas: { COMPRA: tarifa() } }));
    expect(s.comision.estado).toBe("TARIFA");
    if (s.comision.estado !== "TARIFA") return;
    expect(s.comision.valor.toFixed()).toBe("49.9523");
    expect(s.comision.tarifa.version).toBe(3);
    expect(s.cajaDespues.toFixed()).toBe(D("24071.66").sub("49.9523").toFixed());
    expect(textoComision(s.comision)).toBe(`${ETIQUETA_TARIFA} de Trii para compra · versión 3`);
  });

  it("sin la tarifa de ese lado, la estimada con la historia y su etiqueta (cambio aditivo)", () => {
    const s = exito(simularOperacion(ESTADO, operacion(B, "VENDER", 7n, "11.71"), { ...CONTEXTO, tarifas: { COMPRA: tarifa() } }));
    expect(s.comision.estado).toBe("ESTIMADA");
    expect(textoComision(s.comision)).toContain(ETIQUETA_COMISION);
  });

  it("sin tarifas ni historia, no se estima (como antes)", () => {
    const s = exito(simularOperacion(ESTADO, operacion(A, "COMPRAR", 3n, "4613.27"), SIN_HISTORIA));
    expect(s.comision.estado).toBe("SIN_HISTORIA");
  });

  it("con tarifa y sin historia, igual usa la tarifa; el aviso de caja cuenta la comisión", () => {
    const s = exito(simularOperacion(ESTADO, operacion(A, "COMPRAR", 9n, "4613.27"), { ...SIN_HISTORIA, tarifas: { COMPRA: tarifa() } }));
    expect(s.comision.estado).toBe("TARIFA");
    expect(s.avisos).toContainEqual(expect.objectContaining({ codigo: "COMPRA_SUPERA_CAJA", conComision: true }));
  });

  it("una venta con tarifa de venta: caja + valor − comisión", () => {
    const s = exito(simularOperacion(ESTADO, operacion(B, "VENDER", 7n, "11.71"), { ...CONTEXTO, tarifas: { VENTA: tarifaSimple("VENTA") } }));
    const valor = D("81.97");
    const comision = valor.mul("0.2731").div(100).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    expect(s.cajaDespues.toFixed()).toBe(D("37911.47").add(valor).sub(comision).toFixed());
  });
});

describe("validarContexto: tarifas mal formadas (error de quien llama)", () => {
  const op = operacion(A, "COMPRAR", 3n, "4613.27");
  const malas: [string, unknown][] = [
    ["de otro lado", { COMPRA: tarifa({ lado: "VENTA" }) }],
    ["un lado desconocido", { OTRO: tarifa() }],
    ["porcentaje sobre 100", { COMPRA: tarifa({ porcentaje: D("100.0001") }) }],
    ["IVA negativo", { COMPRA: tarifa({ ivaPct: D("-0.01") }) }],
    ["mínimo en el tope", { COMPRA: tarifa({ minimoPorOrden: D("100000000") }) }],
    ["más de 4 decimales", { COMPRA: tarifa({ fijoPorOrden: D("1.23456") }) }],
    ["comisionista desconocido", { COMPRA: tarifa({ comisionista: "OTRA" as never }) }],
    ["versión 0", { COMPRA: tarifa({ version: 0 }) }],
    ["cuatro cargos", { COMPRA: tarifa({ otrosCargos: Array.from({ length: 4 }, () => ({ nombre: "x", tipo: "FIJO" as const, valor: D("1") })) }) }],
    ["un cargo PCT sobre 100", { COMPRA: tarifa({ otrosCargos: [{ nombre: "x", tipo: "PCT", valor: D("101") }] }) }],
    ["un cargo sin nombre", { COMPRA: tarifa({ otrosCargos: [{ nombre: "", tipo: "FIJO", valor: D("1") }] }) }],
    ["un cargo de tipo desconocido", { COMPRA: tarifa({ otrosCargos: [{ nombre: "x", tipo: "OTRO" as never, valor: D("1") }] }) }],
    ["un monto que no es Decimal", { COMPRA: tarifa({ porcentaje: "0.2731" as never }) }],
    ["una vigencia que no es un día a medianoche UTC", { COMPRA: tarifa({ vigenteDesde: new Date(Date.UTC(2027, 0, 11, 5)) }) }],
    ["una vigencia inválida", { COMPRA: tarifa({ vigenteDesde: new Date(Number.NaN) }) }],
    ["no es un objeto", null],
  ];
  it.each(malas)("lanza RangeError con %s", (_n, tarifas) => {
    expect(() => simularOperacion(ESTADO, op, { ...CONTEXTO, tarifas: tarifas as never })).toThrow(RangeError);
  });

  it("control positivo: la misma tarifa bien formada pasa", () => {
    expect(() => simularOperacion(ESTADO, op, { ...CONTEXTO, tarifas: { COMPRA: tarifa(), VENTA: tarifaSimple("VENTA") } })).not.toThrow();
  });
});
