// `siguienteDesde`: el límite de vigencia de una versión de tarifa para el control de /edicion/tarifas. Datos inventados.
import { describe, expect, it } from "vitest";
import { siguienteDesde } from "@/app/edicion/tarifas/datos";
import { controlarTarifa } from "@/operar/tarifa/control";
import { orden } from "../simulador/apoyo/estado.ficticio";
import { leida, tarifaSimple } from "./apoyo/tarifa.ficticio";

const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const v = (version: number, iso: string, cambios: Parameters<typeof tarifaSimple>[1] = {}, lado: "COMPRA" | "VENTA" = "COMPRA") =>
  leida(tarifaSimple(lado, { version, vigenteDesde: dia(iso), ...cambios }));

describe("siguienteDesde", () => {
  const v1 = v(1, "2027-01-11");
  const v2 = v(2, "2027-03-02");

  it("da el vigenteDesde de la versión posterior del mismo comisionista y lado", () => {
    expect(siguienteDesde([v2, v1], v1)).toEqual(dia("2027-03-02"));
  });

  it("da null si no hay versión posterior", () => {
    expect(siguienteDesde([v2, v1], v2)).toBeNull();
    expect(siguienteDesde([v1], v1)).toBeNull();
  });

  it("ignora versiones de otro lado o de otro comisionista", () => {
    const otraLado = v(3, "2027-02-01", {}, "VENTA");
    const otraCasa = v(4, "2027-02-01", { comisionista: "AV" });
    expect(siguienteDesde([otraCasa, otraLado, v1], v1)).toBeNull();
  });

  it("con versiones fuera de orden toma la más próxima", () => {
    const lejana = v(5, "2027-09-13");
    const cercana = v(3, "2027-04-05");
    expect(siguienteDesde([lejana, v2, cercana, v1], v1)).toEqual(dia("2027-03-02"));
    expect(siguienteDesde([lejana, cercana, v1], v1)).toEqual(dia("2027-04-05"));
  });

  it("el control de v1 no cuenta las órdenes posteriores a v2", () => {
    const ordenes = [orden("COMPRA", "4613.27", "12.5988", "APROBADO", dia("2027-02-01")), orden("COMPRA", "4613.27", "12.5988", "APROBADO", dia("2027-03-10"))];
    expect(controlarTarifa(v1, ordenes, siguienteDesde([v2, v1], v1))).toEqual({ estado: "CONTRASTADA", explicadas: 1, total: 1 });
    expect(controlarTarifa(v1, ordenes, null)).toEqual({ estado: "CONTRASTADA", explicadas: 2, total: 2 });
  });
});
