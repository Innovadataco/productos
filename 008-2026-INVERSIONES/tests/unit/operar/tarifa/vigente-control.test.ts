// La tarifa vigente (O5) y el control «la tarifa explica X de N órdenes pasadas», con la tolerancia de 1 peso por orden.
// Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { controlarTarifa, explica } from "@/operar/tarifa/control";
import { vigenteDe, vigentesDe } from "@/operar/tarifa/vigente";
import { orden } from "../simulador/apoyo/estado.ficticio";
import { tarifa, tarifaSimple } from "./apoyo/tarifa.ficticio";

const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe("vigenteDe", () => {
  const lista = [
    tarifa({ version: 1, vigenteDesde: dia("2027-01-11") }),
    tarifa({ version: 4, vigenteDesde: dia("2027-03-02") }),
    tarifa({ version: 2, vigenteDesde: dia("2027-02-09"), lado: "VENTA" }),
    tarifa({ version: 5, vigenteDesde: dia("2027-01-11"), comisionista: "AV" }),
    tarifa({ version: 6, vigenteDesde: dia("2027-09-13") }),
  ];

  it("la de mayor versión del comisionista y el lado con vigencia hasta el día; una futura no rige", () => {
    expect(vigenteDe(lista, "TRII", "COMPRA", dia("2027-03-17"))?.version).toBe(4);
    expect(vigenteDe(lista, "TRII", "COMPRA", dia("2027-03-01"))?.version).toBe(1);
    expect(vigenteDe(lista, "TRII", "COMPRA", dia("2027-03-02"))?.version).toBe(4);
    expect(vigenteDe(lista, "TRII", "COMPRA", dia("2027-01-10"))).toBeUndefined();
    expect(vigenteDe(lista, "AV", "COMPRA", dia("2027-03-17"))?.version).toBe(5);
    expect(vigenteDe(lista, "AV", "VENTA", dia("2027-03-17"))).toBeUndefined();
  });

  it("con dos del mismo día gana la de mayor versión", () => {
    const empate = [tarifa({ version: 8, vigenteDesde: dia("2027-01-11") }), tarifa({ version: 7, vigenteDesde: dia("2027-01-11") })];
    expect(vigenteDe(empate, "TRII", "COMPRA", dia("2027-01-11"))?.version).toBe(8);
  });

  it("vigentesDe da solo los lados que tienen tarifa", () => {
    const v = vigentesDe(lista, "TRII", dia("2027-03-17"));
    expect(v.COMPRA?.version).toBe(4);
    expect(v.VENTA?.version).toBe(2);
    expect(Object.keys(vigentesDe(lista, "AV", dia("2027-03-17")))).toEqual(["COMPRA"]);
    expect(vigentesDe([], "TRII", dia("2027-03-17"))).toEqual({});
  });
});

describe("controlarTarifa", () => {
  const t = tarifaSimple("COMPRA");
  // 0,2731 % de 4.613,27 = 12,5988 (redondeado).
  it("explica una orden con diferencia de hasta 1 peso, y no una de más", () => {
    expect(explica(t, orden("COMPRA", "4613.27", "12.5988"))).toBe(true);
    expect(explica(t, orden("COMPRA", "4613.27", "13.5988"))).toBe(true);
    expect(explica(t, orden("COMPRA", "4613.27", "11.5988"))).toBe(true);
    expect(explica(t, orden("COMPRA", "4613.27", "13.5989"))).toBe(false);
    expect(explica(t, orden("COMPRA", "4613.27", "11.5987"))).toBe(false);
  });

  it("cuenta solo las aprobadas con valor del lado de la tarifa", () => {
    const ordenes = [
      orden("COMPRA", "4613.27", "12.5988"),
      orden("COMPRA", "4613.27", "41.37"),
      orden("COMPRA", "4613.27", "12.5988", "CANCELADO"),
      orden("COMPRA", "0", "0"),
      orden("VENTA", "4613.27", "12.5988"),
    ];
    expect(controlarTarifa(t, ordenes)).toEqual({ estado: "CONTRASTADA", explicadas: 1, total: 2 });
  });

  it("sin órdenes de ese lado, o de A&V (008 solo tiene las de Trii), no hay con qué contrastar", () => {
    expect(controlarTarifa(t, [orden("VENTA", "4613.27", "12.5988")])).toEqual({ estado: "SIN_ORDENES" });
    expect(controlarTarifa(tarifaSimple("COMPRA", { comisionista: "AV" }), [orden("COMPRA", "4613.27", "12.5988")])).toEqual({ estado: "SIN_ORDENES" });
  });

  it("compara el total (comisión + IVA + otros cargos) con la comisión real", () => {
    const completa = tarifa();
    const valor = "13839.81";
    expect(explica(completa, orden("COMPRA", valor, "49.9523"))).toBe(true);
    expect(explica(completa, orden("COMPRA", valor, new Prisma.Decimal("39.1665").toFixed()))).toBe(false);
  });
});
