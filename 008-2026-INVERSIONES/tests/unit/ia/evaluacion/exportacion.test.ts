/**
 * El archivo de paquetes exportados (E7): `exportar-hechos-ia` (vía B) imprime `{version, paquetes}` y el arnés lo lee
 * con `--paquetes`. Cada paquete vuelve a entrar por `leerPaquete` (el hash tiene que cuadrar) y sale como un caso con
 * id = su tipo. Cierra en fallo con códigos, sin repetir ningún dato del archivo. El archivo de prueba es INVENTADO.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { esPaqueteConstruido } from "@/ia/paquete";
import { casosInventados } from "@/ia/evaluacion/casos";
import { ErrorExportacion, leerExportacion, MAX_BYTES_EXPORTACION, serializarExportacion, VERSION_EXPORTACION } from "@/ia/evaluacion/exportacion";

const FICTICIO = path.join(__dirname, "..", "..", "..", "fixtures", "ia", "evaluacion", "paquetes.ficticio.json");
const bytes = (texto: string): Uint8Array => new TextEncoder().encode(texto);
const ficticio = (): Record<string, unknown> => JSON.parse(readFileSync(FICTICIO, "utf8")) as Record<string, unknown>;

function codigoDe(f: () => unknown): string {
  try {
    f();
    return "SIN_ERROR";
  } catch (e) {
    if (!(e instanceof ErrorExportacion)) return `OTRO:${String(e)}`;
    expect(e.message).not.toContain("FICTICIA");
    return e.codigo;
  }
}

describe("leerExportacion", () => {
  it("el archivo ficticio da tres casos, DIARIO, REGLAS y ESCENARIOS, con paquetes reconstruidos", () => {
    const casos = leerExportacion(readFileSync(FICTICIO));
    expect(casos.map((c) => c.id)).toEqual(["DIARIO", "REGLAS", "ESCENARIOS"]);
    for (const c of casos) {
      expect(c.tipo).toBe(c.id);
      expect(esPaqueteConstruido(c.paquete)).toBe(true);
    }
  });

  it("ida y vuelta: lo que serializa el export lo lee el arnés, con el mismo hash", () => {
    const tres = ["DIARIO-04", "REGLAS-07", "ESCENARIOS-02"].map((id) => casosInventados().find((c) => c.id === id)!);
    const texto = serializarExportacion(tres.map((c) => c.paquete));
    expect(JSON.parse(texto)).toMatchObject({ version: VERSION_EXPORTACION });
    const leidos = leerExportacion(bytes(texto));
    expect(leidos.map((c) => c.paquete.hash)).toEqual(tres.map((c) => c.paquete.hash));
  });

  it("un hecho cambiado (el hash no cuadra) rechaza el archivo entero", () => {
    const f = ficticio();
    const paquetes = f.paquetes as { hechos: { valor: string }[] }[];
    paquetes[0]!.hechos[0]!.valor = "41371.13";
    expect(codigoDe(() => leerExportacion(bytes(JSON.stringify(f))))).toBe("PAQUETE_INVALIDO");
  });

  for (const [nombre, texto, codigo] of [
    ["un JSON roto", "{no es json", "JSON_INVALIDO"],
    ["un arreglo en la raíz", "[]", "FORMA_INVALIDA"],
    ["otra versión", JSON.stringify({ version: "exportacion-hechos-v9", paquetes: [] }), "VERSION_DISTINTA"],
    ["un campo de más", JSON.stringify({ version: VERSION_EXPORTACION, paquetes: [], otro: 1 }), "FORMA_INVALIDA"],
    ["sin paquetes", JSON.stringify({ version: VERSION_EXPORTACION, paquetes: [] }), "SIN_PAQUETES"],
    ["paquetes que no son un arreglo", JSON.stringify({ version: VERSION_EXPORTACION, paquetes: {} }), "FORMA_INVALIDA"],
  ] as const) {
    it(`${nombre}: ${codigo}`, () => {
      expect(codigoDe(() => leerExportacion(bytes(texto)))).toBe(codigo);
    });
  }

  it("dos paquetes del mismo tipo: TIPO_REPETIDO", () => {
    const f = ficticio();
    const paquetes = f.paquetes as unknown[];
    expect(codigoDe(() => leerExportacion(bytes(JSON.stringify({ ...f, paquetes: [paquetes[0], paquetes[0]] }))))).toBe("TIPO_REPETIDO");
  });

  it("UTF-8 inválido y un archivo de más del tope", () => {
    expect(codigoDe(() => leerExportacion(new Uint8Array([0x7b, 0xff, 0x7d])))).toBe("JSON_INVALIDO");
    expect(codigoDe(() => leerExportacion(new Uint8Array(MAX_BYTES_EXPORTACION + 1)))).toBe("DEMASIADO_GRANDE");
  });
});

describe("serializarExportacion", () => {
  it("rechaza un paquete que no salió de construirPaquete y un tipo repetido", () => {
    const [uno] = casosInventados();
    expect(codigoDe(() => serializarExportacion([{ ...uno!.paquete }]))).toBe("PAQUETE_INVALIDO");
    expect(codigoDe(() => serializarExportacion([uno!.paquete, uno!.paquete]))).toBe("TIPO_REPETIDO");
    expect(codigoDe(() => serializarExportacion([]))).toBe("SIN_PAQUETES");
  });
});
