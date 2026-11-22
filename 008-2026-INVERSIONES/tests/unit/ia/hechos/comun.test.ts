/**
 * Piezas comunes de los armadores: las marcas (fecha, frescura y origen) solo salen de sus constructores, que no dejan
 * que la fecha y la frescura se contradigan; y el cierre del paquete no deja que nadie pise la versión de los armadores.
 */
import { describe, expect, it } from "vitest";
import { borrador, cerrarPaquete, marcasAtrasadas, marcasConFrescura, marcasDeHoy, marcasDeMercado } from "@/ia/hechos/comun";
import { VERSION_ARMADORES } from "@/ia/hechos/constantes";
import { ErrorArmado } from "@/ia/hechos/errores";
import { CALENDARIO, HOY } from "./apoyo.ficticio";

const codigoDe = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorArmado) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
};

describe("marcas de un hecho", () => {
  it("lo de hoy: la fecha es hoy y la frescura HOY", () => {
    expect(marcasDeHoy(HOY, "PLAN")).toEqual({ fecha: HOY, frescura: "HOY", origen: "PLAN" });
  });

  it("un dato de mercado: la frescura del calendario BVC, o ATRASADO si quien llama sabe que lo está, con su aviso", () => {
    expect(marcasDeMercado("2027-03-16", HOY, CALENDARIO, "CALCULO")).toEqual({ marcas: { fecha: "2027-03-16", frescura: "RECIENTE", origen: "CALCULO" }, avisos: [] });
    expect(marcasDeMercado("2027-03-16", HOY, CALENDARIO, "CALCULO", true).marcas.frescura).toBe("ATRASADO");
    const sinAnio = { noHabiles: new Set<string>(), aniosCubiertos: new Set([2026]) };
    expect(marcasDeMercado("2027-03-15", HOY, sinAnio, "CALCULO").avisos).toEqual(["CALENDARIO_NO_CUBRE"]);
  });

  it("un dato atrasado a sabiendas: ATRASADO, con su fecha, nunca posterior a hoy", () => {
    expect(marcasAtrasadas("2027-03-15", HOY, "CALCULO")).toEqual({ fecha: "2027-03-15", frescura: "ATRASADO", origen: "CALCULO" });
    expect(codigoDe(() => marcasAtrasadas("2027-03-18", HOY, "CALCULO"))).toBe("FECHA_FUTURA");
  });

  it("con la frescura de su módulo (series y fondo): HOY solo si la fecha es hoy; nunca después de hoy", () => {
    expect(marcasConFrescura("2027-03-16", HOY, "RECIENTE", "PUBLICACION_OFICIAL").frescura).toBe("RECIENTE");
    expect(marcasConFrescura(HOY, HOY, "HOY", "PUBLICACION_OFICIAL").frescura).toBe("HOY");
    expect(codigoDe(() => marcasConFrescura("2027-03-16", HOY, "HOY", "PUBLICACION_OFICIAL"))).toBe("FRESCURA_INCOHERENTE");
    expect(codigoDe(() => marcasConFrescura("2027-03-18", HOY, "RECIENTE", "PUBLICACION_OFICIAL"))).toBe("FECHA_FUTURA");
  });

  it("la calidad del borrador sale de las marcas: atrasado es ATRASADO venga de donde venga", () => {
    expect(borrador("ESPECIE_NOMBRE", "FICTICIA-ALFA", "fuente-ficticia", marcasAtrasadas("2027-03-15", HOY, "REGISTRO")).calidad).toBe("ATRASADO");
    expect(borrador("ESPECIE_NOMBRE", "FICTICIA-ALFA", "fuente-ficticia", marcasDeHoy(HOY, "REGISTRO")).calidad).toBe("VERIFICADO");
  });
});

describe("cerrarPaquete", () => {
  const partes = [{ grupos: [{ prioridad: 1, hechos: [borrador("ESPECIE_NOMBRE", "FICTICIA-ALFA", "fuente-ficticia", marcasDeHoy(HOY, "REGISTRO"))] }], avisos: [] }];

  it("la versión de los armadores no se puede pisar desde las versiones de cálculo", () => {
    const paquete = cerrarPaquete("REGLAS", HOY, partes, { hechos: "armadores-ficticio-v9", plan: "plan-ficticio-v3" });
    expect(paquete.versionesCalculo).toEqual({ hechos: VERSION_ARMADORES, plan: "plan-ficticio-v3" });
  });

  it("los avisos previos van primero y los propios después, sin repetir", () => {
    const paquete = cerrarPaquete("REGLAS", HOY, [{ ...partes[0]!, avisos: ["CALENDARIO_NO_CUBRE"] }], {}, ["HISTORIA_CORTA", "CALENDARIO_NO_CUBRE"]);
    expect(paquete.avisos).toEqual(["HISTORIA_CORTA", "CALENDARIO_NO_CUBRE"]);
  });
});
