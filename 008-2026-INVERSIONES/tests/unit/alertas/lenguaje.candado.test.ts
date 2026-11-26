import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prohibidasEn } from "../operar/informe/lenguaje";
import { claveDeAlerta, type Alerta, type BasePrecio, type Sentido, type TipoAlerta } from "@/alertas/tipos";
import { textoDeAlerta } from "@/alertas/texto";

// Candado: 008 informa; nunca recomienda comprar ni vender. Se corre el detector del informe sobre cada combinación.
const D = (v: string) => new Prisma.Decimal(v);
const TIPOS: readonly TipoAlerta[] = ["NIVEL_CRUZADO", "NIVEL_CERCA", "MOVIMIENTO_DIA", "CAIDA_PORTAFOLIO", "DATO_VIEJO", "FECHA_EX"];
const SENTIDOS: ReadonlyArray<Sentido | null> = ["BAJO", "SOBRE", null];
const BASES: ReadonlyArray<BasePrecio | null> = ["INTRADIA", "CIERRE", null];

function combinaciones(): Array<[string, Alerta]> {
  const salida: Array<[string, Alerta]> = [];
  for (const tipo of TIPOS) for (const sentido of SENTIDOS) for (const base of BASES) {
    for (const extra of [true, false]) {
      const datos = {
        nivel: D("100"), precio: D("95"), variacionPct: D(sentido === "SOBRE" ? "4" : "-4"), distanciaPct: extra ? D("1.5") : undefined,
        instante: extra ? new Date("2027-03-01T15:35:00Z") : undefined, conRetraso: extra, esFechaEx: extra,
        fechaEx: new Date("2027-03-03T00:00:00Z"), fechaPago: new Date("2027-04-15T00:00:00Z"), minutosDeEdad: 61, umbralMin: 50,
      };
      salida.push([`${tipo}/${sentido}/${base}/${extra}`, { clave: claveDeAlerta("2027-03-01", tipo, "FICTICIA-A", null, sentido), dia: "2027-03-01", tipo, instrumentoId: "FICTICIA-A", reglaId: null, sentido, base, datos }]);
    }
  }
  return salida;
}

describe("lenguaje de las alertas", () => {
  const todas = combinaciones();
  it("cubre tipo × sentido × base", () => {
    expect(todas).toHaveLength(TIPOS.length * SENTIDOS.length * BASES.length * 2);
  });
  it.each(todas)("%s no usa lenguaje de consejo ni dice «ahora»", (_n, a) => {
    const texto = textoDeAlerta(a, "FICTICIA-A");
    expect(texto.length).toBeGreaterThan(10);
    expect(prohibidasEn(texto)).toEqual([]);
    expect(texto).not.toMatch(/\bahora\b/i);
  });
  it("control positivo: el detector muerde un texto de consejo", () => {
    expect(prohibidasEn("Es buen momento: compre ya, es una oportunidad.")).toEqual(expect.arrayContaining(["buen momento", "compre", "oportunidad"]));
  });
});
