// De la lectura (Date, CifraOficial) a la vista de /datos-oficiales (texto) (frente datos-oficiales-pantalla, C6a): las
// columnas DATE son el día UTC; la hora de la carga, en Colombia (UTC−5, sin horario de verano), también cuando cruza
// la medianoche UTC. La frescura de la vista solo dice «vale hoy» con cubreHoy. Cifras inventadas.
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/datos-oficiales/catalogo";
import type { CifraOficial } from "@/datos-oficiales/series/consulta";
import { aSerieVista, dia, horaColombia } from "@/app/datos-oficiales/serializar";
import { baseDe } from "./ficticio";

const TRM = CATALOGO.find((s) => s.codigo === "TRM")!;
const cifra = (desde: string, hasta: string, valor: string, traidoEn: string): CifraOficial => ({
  serie: "TRM", valor, unidad: TRM.unidad, desde: new Date(`${desde}T00:00:00Z`), hasta: new Date(`${hasta}T00:00:00Z`), fuente: TRM.fuente, traidoEn: new Date(traidoEn), origen: "OFICIAL",
});

describe("serializar", () => {
  it("el día de una columna DATE y la hora en Colombia, también al cruzar la medianoche UTC", () => {
    expect(dia(new Date("2021-03-17T00:00:00Z"))).toBe("2021-03-17");
    expect(horaColombia(new Date("2021-03-18T03:07:00Z"))).toBe("2021-03-17 22:07");
    expect(horaColombia(new Date("2021-03-17T15:41:59Z"))).toBe("2021-03-17 10:41");
  });

  it("una serie con datos: vigencia, fuente, carga, frescura (valeHoy = cubreHoy) e historia en texto", () => {
    const ultimo = cifra("2021-03-13", "2021-03-15", "3921.17", "2021-03-12T22:03:00Z");
    const vista = aSerieVista({
      serie: TRM, ventana: "ANIO", estado: "CON_DATOS", ultimo,
      frescura: { estado: "ATRASADA", dias: 4, umbralDias: 3, cubreHoy: false },
      historia: [cifra("2021-03-12", "2021-03-12", "3917.43", "2021-03-11T21:00:00Z"), ultimo], variacion: null,
    });
    expect(vista).toEqual({
      ...baseDe("TRM"), estado: "CON_DATOS",
      ultimo: { valor: "3921.17", desde: "2021-03-13", hasta: "2021-03-15", fuente: "sfc:32sa-8pi3", traidoEn: "2021-03-12 17:03" },
      frescura: { estado: "ATRASADA", dias: 4, umbralDias: 3, valeHoy: false },
      historia: [{ desde: "2021-03-12", hasta: "2021-03-12", valor: "3917.43" }, { desde: "2021-03-13", hasta: "2021-03-15", valor: "3921.17" }],
      variacion: null,
    });
  });

  it("sin datos y con error: solo lo del catálogo (nada que se pueda leer como una cifra)", () => {
    expect(aSerieVista({ serie: TRM, ventana: "ANIO", estado: "SIN_DATOS" })).toEqual({ ...baseDe("TRM"), estado: "SIN_DATOS" });
    expect(aSerieVista({ serie: TRM, ventana: "ANIO", estado: "ERROR" })).toEqual({ ...baseDe("TRM"), estado: "ERROR" });
  });
});
