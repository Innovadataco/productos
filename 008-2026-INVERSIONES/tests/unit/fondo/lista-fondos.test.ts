// La lista de fondos que lee `fondo:exportar` (privada: la escribe el dueño, o la Fábrica con orden del CEO):
// `<codigo>` o `<codigo>,<participacion>` por línea. Errores con línea y código, nunca el código del fondo.
// Códigos y clases inventados.
import { describe, expect, it } from "vitest";
import { MAX_FONDOS_CSV } from "@/fondo/csv-valores";
import { MAX_BYTES_LISTA_FONDOS, MAX_FONDOS_LISTA, leerListaFondos } from "@/fondo/lista-fondos";

const leer = (texto: string) => leerListaFondos(Buffer.from(texto, "latin1"));

describe("leerListaFondos", () => {
  it("código solo o con su clase; salta comentarios y líneas vacías; tolera CR y la última sin LF", () => {
    expect(leer("# fondos ficticios\n9990001,800\r\n\n9990002")).toEqual({
      ok: true,
      fondos: [{ codigo: "9990001", participacion: "800", linea: 2 }, { codigo: "9990002", participacion: null, linea: 4 }],
    });
  });

  it.each([
    ["un código con letras", "99A0001\n", [[1, "FONDO_FORMATO"]]],
    ["un código de 13 dígitos", "1234567890123\n", [[1, "FONDO_FORMATO"]]],
    ["una clase con letras o vacía", "9990001,80a\n9990002,\n", [[1, "FONDO_FORMATO"], [2, "FONDO_FORMATO"]]],
    ["espacios o columnas de más", "9990001, 800\n9990002,800,1\n", [[1, "FONDO_FORMATO"], [2, "FONDO_FORMATO"]]],
    ["el mismo código dos veces (aunque cambie la clase)", "9990001,800\n9990001,801\n", [[2, "FONDO_REPETIDO"]]],
    ["un carácter fuera de ASCII imprimible", "9990001\t\n", [[1, "NO_ASCII"]]],
    ["sin fondos", "# nada\n\n", [[1, "SIN_FONDOS"]]],
  ] as const)("rechaza %s", (_nombre, texto, esperado) => {
    const r = leer(texto);
    expect(r.ok ? [] : r.errores.map((e) => [e.linea, e.codigo])).toEqual(esperado);
  });

  it(`a lo sumo ${MAX_FONDOS_LISTA} fondos (los que caben en el CSV)`, () => {
    expect(MAX_FONDOS_LISTA).toBe(MAX_FONDOS_CSV);
    const texto = Array.from({ length: MAX_FONDOS_LISTA + 1 }, (_, i) => `99900${String(i).padStart(2, "0")}`).join("\n");
    const r = leer(texto);
    expect(r.ok ? [] : r.errores.map((e) => [e.linea, e.codigo])).toEqual([[MAX_FONDOS_LISTA + 1, "DEMASIADOS_FONDOS"]]);
  });

  it("el tope de bytes de la lista cabe para los fondos permitidos", () => {
    expect(MAX_FONDOS_LISTA * "123456789012,123456\n".length).toBeLessThanOrEqual(MAX_BYTES_LISTA_FONDOS);
  });

  it("los errores no traen el código del fondo", () => {
    expect(JSON.stringify(leer("9990001,800\n9990001,800\n"))).not.toMatch(/9990001|800/);
  });
});
