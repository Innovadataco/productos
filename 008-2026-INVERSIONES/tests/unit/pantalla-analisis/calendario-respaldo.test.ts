// El calendario de la BVC de las pantallas que avisan el dato viejo (frente fuente-retraso): si no se puede leer, no se
// apaga el aviso; se usa el respaldo (sin festivos ni años cubiertos, así que el aviso sale aproximado) y se registra solo
// el nombre del error. Inventado.
import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarioConRespaldo } from "@/app/_comun/calendario-con-respaldo";
import { CALENDARIO_DE_RESPALDO } from "@/precios/atraso";
import { leerCalendario } from "@/precios/negociacion";

afterEach(() => vi.restoreAllMocks());
const baseCon = (findMany: () => Promise<unknown>) => ({ calendarioBvc: { findMany } }) as never;

describe("calendarioConRespaldo", () => {
  it("lee calendario_bvc: los festivos y los años cubiertos", async () => {
    const c = await calendarioConRespaldo(baseCon(async () => [{ dia: new Date("2027-03-22T00:00:00Z"), esHabil: false }, { dia: new Date("2027-04-01T00:00:00Z"), esHabil: true }]), "analisis");
    expect([...c.noHabiles]).toEqual(["2027-03-22"]);
    expect([...c.aniosCubiertos]).toEqual([2027]);
  });

  it("si la lectura falla: el respaldo, y registra solo el nombre del error con la pantalla", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c = await calendarioConRespaldo(baseCon(async () => { throw new TypeError("postgresql://u:clave-secreta@h"); }), "analisis");
    expect(c).toBe(CALENDARIO_DE_RESPALDO);
    expect(registro).toHaveBeenCalledWith("[analisis] no se pudo leer el calendario de la BVC (TypeError)");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("el respaldo se reconoce como tal (lectura fallida), distinto de un calendario que solo no cubre el año", () => {
    expect(CALENDARIO_DE_RESPALDO.respaldo).toBe(true);
    expect(leerCalendario([]).respaldo).toBeUndefined();
  });

  it("el respaldo no tiene festivos ni años cubiertos (todo sale aproximado)", () => {
    expect(CALENDARIO_DE_RESPALDO.noHabiles.size).toBe(0);
    expect(CALENDARIO_DE_RESPALDO.aniosCubiertos.size).toBe(0);
  });
});
