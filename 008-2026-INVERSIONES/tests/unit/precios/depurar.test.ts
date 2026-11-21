// precios:depurar (SPEC-13), parte pura: qué cierres vigentes ya guardados sobran y los conteos que prueban
// los supuestos de volumen antes de aplicar. Datos inventados.
import { describe, expect, it } from "vitest";
import { clasificarVigentes, diagnosticar } from "@/precios/depurar";
import { leerCalendario } from "@/precios/negociacion";
import type { Cierre } from "@/precios/yahoo";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const CALENDARIO = leerCalendario([{ dia: utc("2024-03-28"), esHabil: false }]); // jueves festivo ficticio
const DESPUES = new Date("2024-04-10T20:00:00Z");
const vigente = (dia: string) => ({ id: `v-${dia}`, fecha: utc(dia) });
const barra = (dia: string, precio: string, volumen: number | null): Cierre => ({ fecha: utc(dia), precio, volumen });

describe("clasificarVigentes", () => {
  const vigentes = [vigente("2024-03-26"), vigente("2024-03-27"), vigente("2024-03-28"), vigente("2024-03-30"), vigente("2024-04-01"), vigente("2019-03-12")];
  const barras = [barra("2024-03-26", "100", 1500), barra("2024-03-27", "100", 0), barra("2024-03-28", "100", 0), barra("2024-04-01", "101", null), barra("2019-03-12", "90", 700)];

  it("festivo y fin de semana por calendario; volumen 0 por Yahoo; sin calendario solo se cuenta", () => {
    expect(clasificarVigentes(vigentes, barras, DESPUES, CALENDARIO)).toEqual({
      noHabil: ["v-2024-03-28", "v-2024-03-30"],
      sinNegociacion: ["v-2024-03-27"],
      sinCalendario: 1,
      aunNoDefinitivos: 0,
    });
  });

  it("si Yahoo falló (null), los días no hábiles se retiran igual y los hábiles no se tocan", () => {
    expect(clasificarVigentes(vigentes, null, DESPUES, CALENDARIO)).toEqual({ noHabil: ["v-2024-03-28", "v-2024-03-30"], sinNegociacion: [], sinCalendario: 1, aunNoDefinitivos: 0 });
  });

  it("un vigente de hoy antes de la hora definitiva no se toca: se cuenta como aún no definitivo", () => {
    const r = clasificarVigentes([vigente("2024-03-26")], [barra("2024-03-26", "100", 0)], new Date("2024-03-26T15:00:00Z"), CALENDARIO);
    expect(r).toEqual({ noHabil: [], sinNegociacion: [], sinCalendario: 0, aunNoDefinitivos: 1 });
  });
});

describe("diagnosticar", () => {
  it("cuenta volumen 0 con cierre distinto del anterior y días hábiles con volumen null (los supuestos por verificar)", () => {
    const barras = [
      barra("2024-03-25", "100", 10),
      barra("2024-03-26", "100", 0), // volumen 0 con el cierre repetido: lo esperado
      barra("2024-03-27", "105", 0), // volumen 0 con otro cierre: contradice el supuesto
      barra("2024-03-28", "105", null), // festivo: no cuenta como hábil
      barra("2024-04-01", "106", null), // hábil con volumen null: se guarda sin saber si negoció
    ];
    expect(diagnosticar(barras, DESPUES, CALENDARIO)).toEqual({ barras: 5, sinNegociacionConCierreDistinto: 1, habilesConVolumenNull: 1 });
  });

  it("sin barras, todo en cero", () => {
    expect(diagnosticar([], DESPUES, CALENDARIO)).toEqual({ barras: 0, sinNegociacionConCierreDistinto: 0, habilesConVolumenNull: 0 });
  });
});
