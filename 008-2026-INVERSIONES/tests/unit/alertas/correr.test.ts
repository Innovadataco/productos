// correrAlertas (src/alertas/correr.ts): lee, evalúa, guarda y resume; la salida es 0 y 3; el resumen es solo de conteos.
// Lectura y guardado van con dobles (las pruebas con la base y el rol real están en tests/integracion/alertas-leer.test.ts).
import { describe, expect, it, vi } from "vitest";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const leerEntrada = vi.fn();
const guardarAlertas = vi.fn();
vi.mock("@/alertas/leer-entrada", () => ({ leerEntrada: (...a: unknown[]) => leerEntrada(...a) }));
vi.mock("@/alertas/guardar", () => ({ guardarAlertas: (...a: unknown[]) => guardarAlertas(...a) }));

const { correrAlertas, lineasDeResultado } = await import("@/alertas/correr");

const AHORA = new Date("2026-11-25T23:30:00.000Z");
const entradaVacia = { entrada: { ahora: AHORA, umbrales: UMBRALES_OMISION, intradiaActivo: false, noHabiles: new Set<string>(), especies: [], decretos: [] }, procedencia: new Map(), umbralVersionId: null };

describe("correrAlertas", () => {
  it("sin nada que evaluar sale 0 y pasa el contexto al guardado (la versión de umbrales y la procedencia)", async () => {
    leerEntrada.mockResolvedValueOnce({ ...entradaVacia, umbralVersionId: "u-9" });
    guardarAlertas.mockResolvedValueOnce({ evaluadas: 0, insertadas: 0, duplicadas: 0, fallidas: 0 });
    const r = await correrAlertas({} as never, { ahora: AHORA, intradiaActivo: true });
    expect(r.codigoSalida).toBe(0);
    expect(leerEntrada).toHaveBeenLastCalledWith(expect.anything(), AHORA, true);
    expect(guardarAlertas).toHaveBeenLastCalledWith(expect.anything(), [], expect.objectContaining({ umbralVersionId: "u-9", umbrales: UMBRALES_OMISION }));
  });

  it("sale 3 si alguna alerta no se pudo guardar, y lo dice sin detalles", async () => {
    leerEntrada.mockResolvedValueOnce(entradaVacia);
    guardarAlertas.mockResolvedValueOnce({ evaluadas: 3, insertadas: 2, duplicadas: 0, fallidas: 1 });
    const r = await correrAlertas({} as never, { ahora: AHORA, intradiaActivo: false });
    expect(r.codigoSalida).toBe(3);
    expect(r.lineas.join("\n")).toMatch(/fallidas 1/);
  });

  it("un error de lectura se propaga (el script lo convierte en 1)", async () => {
    leerEntrada.mockRejectedValueOnce(new Error("la base no responde"));
    await expect(correrAlertas({} as never, { ahora: AHORA, intradiaActivo: false })).rejects.toThrow("la base no responde");
  });
});

describe("lineasDeResultado", () => {
  it("solo conteos: nada de letras mayúsculas de especies ni cifras con decimales", () => {
    const texto = lineasDeResultado({ evaluadas: 4, insertadas: 3, duplicadas: 1, fallidas: 0 }).join("\n");
    expect(texto).toBe("alertas: evaluadas 4 · nuevas 3 · ya guardadas 1 · fallidas 0");
    expect(texto).not.toMatch(/\d[.,]\d/);
  });
});
