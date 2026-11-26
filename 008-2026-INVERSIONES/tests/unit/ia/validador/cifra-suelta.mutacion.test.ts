/**
 * Defensa en profundidad (condición 2 de PI): con el control de caracteres apagado por un doble (la mutación de
 * CIFRA_SUELTA), una cifra que escribe el modelo, incluso la presentación EXACTA de un hecho del paquete, sigue
 * rechazada por RENDER_CIFRA: el cotejo es contra el valor fuente del paquete, nunca contra lo que repitió el modelo.
 */
import { describe, expect, it, vi } from "vitest";
import { validarSalida } from "@/ia/validador/validar";
import { paqueteFicticio, presentacionDe, salidaDe } from "./apoyo/salidas.ficticio";

vi.mock("@/ia/validador/caracteres", async (original) => {
  const real = await original<typeof import("@/ia/validador/caracteres")>();
  return { ...real, revisarCaracteres: () => [] };
});

const p = paqueteFicticio("DIARIO");

describe("CIFRA_SUELTA apagada: RENDER_CIFRA sigue mordiendo", () => {
  it("control positivo: la salida válida pasa", () => {
    expect(validarSalida(salidaDe(p, "El valor de las acciones subió a {VALOR_ACCIONES}."), p).ok).toBe(true);
  });

  it("una cifra suelta inventada", () => {
    const r = validarSalida(salidaDe(p, "El valor de las acciones subió a {VALOR_ACCIONES} en el corte 7391."), p);
    expect(r.ok ? [] : r.motivos).toEqual(["RENDER_CIFRA"]);
  });

  it("la presentación exacta del paquete escrita por el modelo, sin la cita", () => {
    const escrita = presentacionDe(p, "GANANCIA_TOTAL");
    const r = validarSalida(salidaDe(p, `El valor de las acciones subió a {VALOR_ACCIONES} y la ganancia total es ${escrita}.`), p);
    // Además de la cifra suelta, la etiqueta «ganancia total» va sin su cita (ETIQUETA.SIN_CITA).
    expect(r.ok ? [] : r.motivos).toEqual(["ETIQUETA_NO_COINCIDE", "RENDER_CIFRA"]);
  });

  it("la presentación exacta repetida junto a su propia cita", () => {
    const escrita = presentacionDe(p, "VALOR_ACCIONES");
    const r = validarSalida(salidaDe(p, `El valor de las acciones subió a {VALOR_ACCIONES} y no a ${escrita}.`), p);
    expect(r.ok ? [] : r.motivos).toEqual(["RENDER_CIFRA"]);
  });
});
