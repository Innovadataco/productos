// El techo de inflado del lector zip: `inflateRawSync` se llama con `maxOutputLength` igual al tamaño declarado de la
// entrada (nunca más), así una entrada que miente sobre su tamaño no llega a ocupar más memoria que lo declarado.
// Se espía node:zlib en este archivo aparte (vi.mock se aplica a todo el archivo). Datos inventados.
import { describe, expect, it, vi } from "vitest";

const llamadas = vi.hoisted(() => [] as { maxOutputLength?: number }[]);

vi.mock("node:zlib", async (original) => {
  const zlib = await original<typeof import("node:zlib")>();
  return {
    ...zlib,
    inflateRawSync: (datos: Uint8Array, opciones: { maxOutputLength?: number }) => {
      llamadas.push({ maxOutputLength: opciones.maxOutputLength });
      return zlib.inflateRawSync(datos, opciones);
    },
  };
});

const { abrirZipAcotado } = await import("@/lib/zip-acotado");
const { armarZip, ascii } = await import("./fixtures/xlsx.ficticio");

describe("zip-acotado · techo de inflado", () => {
  it("maxOutputLength es el tamaño declarado (y 1 para una entrada vacía, el mínimo que acepta zlib)", () => {
    const datos = ascii("FICT 4613,27 ".repeat(17));
    const archivo = abrirZipAcotado(armarZip([{ nombre: "a.xml", datos }, { nombre: "vacio.xml", datos: new Uint8Array() }]));
    llamadas.length = 0;
    archivo.leer("a.xml");
    archivo.leer("vacio.xml");
    expect(llamadas).toEqual([{ maxOutputLength: datos.length }, { maxOutputLength: 1 }]);
  });

  it("una entrada que declara 4613 bytes y trae 1 MiB de ceros se corta en lo declarado", () => {
    const archivo = abrirZipAcotado(armarZip([{ nombre: "a.xml", datos: new Uint8Array(1024 * 1024), real: 4613 }]));
    llamadas.length = 0;
    expect(() => archivo.leer("a.xml")).toThrow(expect.objectContaining({ codigo: "ZIP_INFLADO_EXCESIVO" }));
    expect(llamadas).toEqual([{ maxOutputLength: 4613 }]);
  });
});
