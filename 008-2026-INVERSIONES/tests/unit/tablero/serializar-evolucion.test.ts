// La evolución y la composición cruzan al cliente como texto decimal (frente graficas-tablero): el cliente solo da
// formato. Datos inventados.
import { describe, expect, it } from "vitest";
import { aEvolucionVista, aVista } from "@/app/tablero/serializar";
import { calcularEvolucion } from "@/tablero/evolucion";
import { D, dia, especie, resumenDe } from "./ficticio";

const A = { id: "iA", nemo: "FICTA" };

describe("aEvolucionVista", () => {
  const e = calcularEvolucion({
    especies: [A, { id: "iZ", nemo: "FICTZ" }],
    lotes: [{ id: "L1", instrumentoId: A.id, fecha: dia("2027-03-01"), cantidad: 100n, costoTotal: D(123700), flujo: D("123791.37") }],
    ventas: [], dividendos: [], referencia: dia("2027-03-02"),
    cierres: [{ instrumentoId: A.id, fecha: dia("2027-03-01"), precio: D(1237) }, { instrumentoId: A.id, fecha: dia("2027-03-02"), precio: D("1250.37") }],
  });

  it("puntos con el día, el valor y el costo exactos y la TWR en porcentaje con 4 decimales", () => {
    const v = aEvolucionVista(e);
    expect(v.puntos).toEqual([
      { fecha: "2027-03-01", valor: "123700", costo: "123700", twrPct: "0.0000", atrasadas: 0 },
      { fecha: "2027-03-02", valor: "125037", costo: "123700", twrPct: D(125037).div(123700).sub(1).mul(100).toFixed(4), atrasadas: 0 },
    ]);
    expect(v.metodo).toBe("twr-acciones-v1");
    expect(v.sinCierre).toEqual(["FICTZ"]);
    expect(v.omitidos).toBe(0);
  });

  it("rangos con su primer día, su índice, si la historia los cubre y su TWR con 2 decimales", () => {
    const todo = aEvolucionVista(e).rangos.find((r) => r.clave === "TODO")!;
    expect(todo).toEqual({ clave: "TODO", desde: "2027-03-01", inicio: 0, cubre: true, twrPct: D(125037).div(123700).sub(1).mul(100).toFixed(2) });
  });
});

describe("aEvolucionVista · rango sin TWR", () => {
  it("una TWR de rango que no se pudo calcular cruza como null", () => {
    const sinBase = { ...e, rangos: [{ ...e.rangos[0]!, twr: null }] };
    expect(aEvolucionVista(sinBase).rangos[0]!.twrPct).toBeNull();
  });
});

describe("aVista · composición", () => {
  it("las tajadas cruzan con el valor exacto y el peso con 2 decimales", () => {
    const v = aVista(resumenDe([especie({ nemotecnico: "FICTA", cantidad: 13n, costoVivo: D(4613), cierre: { precio: D("317.41"), fecha: dia("2027-03-05"), verificado: true } })]));
    expect(v.composicion).toEqual([{ id: "FICTA", nemo: "FICTA", valor: "4126.33", pesoPct: "100.00", miembros: [] }]);
  });
});
