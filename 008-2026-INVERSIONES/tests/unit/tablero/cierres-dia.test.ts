// Un cierre por especie y día (frente graficas-tablero): la regla de `ultimosCierres` (src/plan/lectura.ts) para
// toda la serie. Si dos fuentes dejaron un cierre vigente el mismo día, gana el traído más recientemente y, con el
// mismo `traidoEn`, el id mayor. Así el tablero y la evolución nunca eligen al azar. Datos inventados.
import { describe, expect, it } from "vitest";
import { unCierrePorDia } from "@/tablero/cierres";
import { D, dia } from "./ficticio";

const t = (iso: string) => new Date(`${iso}Z`);
const fila = (id: string, instrumentoId: string, fecha: string, precio: string, traidoEn: string) => ({ id, instrumentoId, fecha: dia(fecha), precio: D(precio), traidoEn: t(traidoEn) });

describe("unCierrePorDia", () => {
  it("de dos cierres del mismo día gana el traído más recientemente", () => {
    const r = unCierrePorDia([fila("a", "iA", "2027-03-02", "1250.37", "2027-03-02T21:07:13"), fila("b", "iA", "2027-03-02", "1251.11", "2027-03-03T08:41:29")]);
    expect(r.map((f) => [f.id, f.precio.toString()])).toEqual([["b", "1251.11"]]);
  });

  it("con el mismo traidoEn, gana el id mayor (orden total, nunca el de la base)", () => {
    const r = unCierrePorDia([fila("k2", "iA", "2027-03-02", "1250.37", "2027-03-02T21:07:13"), fila("k9", "iA", "2027-03-02", "1249.83", "2027-03-02T21:07:13")]);
    expect(r.map((f) => f.id)).toEqual(["k9"]);
  });

  it("deja uno por especie y día, ordenado por especie y fecha ascendente, sin tocar la entrada", () => {
    const entrada = [
      fila("c", "iB", "2027-03-01", "4613.07", "2027-03-01T21:00:00"),
      fila("a", "iA", "2027-03-03", "1199.13", "2027-03-03T21:00:00"),
      fila("b", "iA", "2027-03-01", "1237", "2027-03-01T21:00:00"),
    ];
    const copia = [...entrada];
    expect(unCierrePorDia(entrada).map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(entrada).toEqual(copia);
  });
});
