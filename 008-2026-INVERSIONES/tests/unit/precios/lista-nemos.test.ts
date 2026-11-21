// La lista de nemotécnicos que lee `precios:exportar` (la escribe el dueño a mano en su carpeta privada): uno por
// línea, con líneas vacías y comentarios «#» permitidos, un CR final tolerado y topes. Errores con línea y código,
// nunca el nemotécnico. Especies FICT inventadas.
import { describe, expect, it } from "vitest";
import { MAX_NEMOS_LISTA, leerListaNemos } from "@/precios/lista-nemos";

const leer = (texto: string) => leerListaNemos(new TextEncoder().encode(texto));

describe("leerListaNemos", () => {
  it("un nemotécnico por línea, con su número de línea; vacías y comentarios se saltan; CR final y sin LF al final valen", () => {
    expect(leer("# mis especies\nFICTA\n\nFICTB\r\nFICTC")).toEqual({
      ok: true, nemos: [{ nemotecnico: "FICTA", linea: 2 }, { nemotecnico: "FICTB", linea: 4 }, { nemotecnico: "FICTC", linea: 5 }],
    });
  });

  it.each([
    ["minúsculas", "FICTA\nficta\n", 2, "NEMOTECNICO_FORMATO"],
    ["con espacio", "FICTA \n", 1, "NEMOTECNICO_FORMATO"],
    ["con sufijo de Yahoo", "FICTA.CL\n", 1, "NEMOTECNICO_FORMATO"],
    ["no ASCII", "FICTÑ\n", 1, "NO_ASCII"],
    ["tabulador", "FICTA\t\n", 1, "NO_ASCII"],
    ["repetido", "FICTA\nFICTB\nFICTA\n", 3, "NEMO_REPETIDO"],
    ["solo comentarios", "# nada\n\n", 1, "SIN_NEMOS"],
    ["vacía", "", 1, "SIN_NEMOS"],
  ])("%s → línea %i, %s", (_n, texto, linea, codigo) => {
    const r = leer(texto);
    expect(r).toEqual({ ok: false, errores: [{ linea, codigo }], totalErrores: 1 });
    expect(JSON.stringify(r)).not.toMatch(/FICT/i);
  });

  it(`${MAX_NEMOS_LISTA} nemotécnicos pasan; el siguiente es DEMASIADOS_NEMOS en su línea`, () => {
    const nemos = Array.from({ length: MAX_NEMOS_LISTA + 1 }, (_, i) => `FICT${i}`);
    expect(leer(`${nemos.slice(0, -1).join("\n")}\n`).ok).toBe(true);
    expect(leer(`${nemos.join("\n")}\n`)).toEqual({ ok: false, errores: [{ linea: MAX_NEMOS_LISTA + 1, codigo: "DEMASIADOS_NEMOS" }], totalErrores: 1 });
  });
});
