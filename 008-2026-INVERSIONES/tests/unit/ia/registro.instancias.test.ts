/**
 * Hallazgo de la re-revisión de tipos (MEDIO): el registro de paquetes construidos no puede depender de la instancia
 * del módulo. Si el empaquetador carga `paquete.ts` dos veces (la app y un servicio, o un worker), un paquete armado
 * en una instancia tiene que valer en la otra. Se simulan dos instancias con `vi.resetModules()`.
 */
import { describe, expect, it, vi } from "vitest";
import { entradaDiario } from "./apoyo/hechos.ficticio";

describe("registro de paquetes construidos · entre instancias del módulo", () => {
  it("un paquete de una instancia vale en otra (vistaCiega y la guarda lo aceptan)", async () => {
    vi.resetModules();
    const primera = await import("@/ia/paquete");
    const paquete = primera.construirPaquete(entradaDiario());
    vi.resetModules();
    const segunda = await import("@/ia/paquete");
    const vistaDeLaSegunda = await import("@/ia/vista-ciega");
    expect(segunda).not.toBe(primera);
    expect(segunda.esPaqueteConstruido(paquete)).toBe(true);
    expect(vistaDeLaSegunda.fugasDeVistaCiega(vistaDeLaSegunda.vistaCiega(paquete), paquete)).toEqual([]);
  });

  it("una copia sigue sin valer en ninguna instancia", async () => {
    vi.resetModules();
    const primera = await import("@/ia/paquete");
    const paquete = primera.construirPaquete(entradaDiario());
    vi.resetModules();
    const segunda = await import("@/ia/paquete");
    expect(segunda.esPaqueteConstruido({ ...paquete })).toBe(false);
    expect(primera.esPaqueteConstruido({ ...paquete })).toBe(false);
  });
});
