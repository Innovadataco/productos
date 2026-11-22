/**
 * RENDER_CIFRA aislado: con el render cambiado por un doble (como si un defecto metiera la cifra que escribió el
 * modelo, cambiara un dígito, se saltara la presentación o usara la de otro hecho), `validarSalida` rechaza con
 * RENDER_CIFRA aunque el texto del modelo pase los demás controles. El cotejo no confía en el render.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { validarSalida } from "@/ia/validador/validar";
import { FRASES_VALIDAS, idDe, paqueteFicticio, presentacionDe, salidaDe } from "./apoyo/salidas.ficticio";

const estado = vi.hoisted(() => ({ render: null as ((texto: string) => string) | null }));

vi.mock("@/ia/validador/render", async (original) => {
  const real = await original<typeof import("@/ia/validador/render")>();
  return { ...real, renderizarFrase: (texto: string, paquete: Parameters<typeof real.renderizarFrase>[1]) => (estado.render === null ? real.renderizarFrase(texto, paquete) : estado.render(texto)) };
});

afterEach(() => {
  estado.render = null;
});

const p = paqueteFicticio("DIARIO");
const va = idDe(p, "VALOR_ACCIONES");
const pVa = presentacionDe(p, "VALOR_ACCIONES");
const pGt = presentacionDe(p, "GANANCIA_TOTAL");
const cruda = salidaDe(p, ...FRASES_VALIDAS.DIARIO);

describe("RENDER_CIFRA con el render cambiado", () => {
  it("control positivo: con el render real, la salida válida pasa", () => {
    expect(validarSalida(cruda, p).ok).toBe(true);
  });

  it.each([
    ["mete una cifra que no es del paquete", (t: string) => t.replace(`{${va}}`, "7391")],
    ["cambia un dígito de la presentación", (t: string) => t.replace(`{${va}}`, pVa.replace(/[0-9]/u, (d) => String((Number(d) + 1) % 10)))],
    ["se salta la presentación", (t: string) => t.replace(`{${va}}`, "")],
    ["usa la presentación de otro hecho", (t: string) => t.replace(`{${va}}`, pGt)],
    ["agrega un signo", (t: string) => t.replace(`{${va}}`, `−${pVa}`)],
  ])("%s: RENDER_CIFRA", (_caso, defectuoso) => {
    const real = (texto: string): string => texto;
    estado.render = (texto: string) => {
      const conDefecto = defectuoso(texto);
      // Las demás citas, como el render real: con la presentación del paquete.
      return p.hechos.reduce((acc, h) => acc.split(`{${h.id}}`).join(h.presentacion), real(conDefecto));
    };
    const r = validarSalida(cruda, p);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.motivos).toEqual(["RENDER_CIFRA"]);
  });
});
