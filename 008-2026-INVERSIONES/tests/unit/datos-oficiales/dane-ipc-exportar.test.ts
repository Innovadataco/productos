// La exportación del IPC (src/datos-oficiales/fuentes/dane-ipc.ts, C2d) sin proceso: el CSV canónico exacto que
// importar-series vuelve a leer, el resumen y los mensajes (nunca un valor), los argumentos (solo --archivo) y las
// salidas del CLI (scripts/exportar-ipc.ts) como funciones puras. Valores inventados (anexo-ipc.ficticio.ts).
import { describe, expect, it, vi } from "vitest";
import { anexoIpc, celdaNumero, csvEsperado, valorCanonico } from "./anexo-ipc.ficticio";
import { CATALOGO } from "@/datos-oficiales/catalogo";
import {
  MAX_BYTES_ANEXO_IPC, SALIDA_CERRADA_IPC, SALIDA_TERMINAL_IPC, SERIE_IPC, USO_EXPORTAR_IPC, emitirIpc, exportarIpc, leerArgumentosExportarIpc,
  mensajeFalloIpc, salidaArchivoIpc, salidaUsoIpc,
} from "@/datos-oficiales/fuentes/dane-ipc";
import { leerCsvSeries } from "@/datos-oficiales/series/csv-series";
import { ErrorArgumentosCarga } from "@/precios/argumentos-carga";

const HOY = new Date(Date.UTC(2027, 2, 17));
const VALORES = Array.from({ length: 31 }, (_v, k) => valorCanonico(k));

describe("exportarIpc", () => {
  it("anexo válido: 0, el CSV canónico exacto (que importar-series vuelve a leer) y un resumen sin valores", () => {
    const s = exportarIpc(anexoIpc(), HOY);
    expect(s.codigoSalida).toBe(0);
    expect(s.csv).toBe(csvEsperado());
    expect(leerCsvSeries(new TextEncoder().encode(s.csv ?? ""), HOY)).toMatchObject({ ok: true, filas: 31, series: [{ codigo: SERIE_IPC }] });
    const texto = s.lineas.join("\n");
    expect(texto).toContain("IPC_INDICE · 31 meses · del 1997-01 al 1999-07 · dane:anex-IPC-Indices");
    expect(texto).toContain("la variación no se importa");
    expect(texto).toContain("importar-series");
    for (const v of VALORES) expect(texto, v).not.toContain(v);
  });

  it("anexo rechazado: 1, sin CSV y una sola línea con el código, la celda y el aviso; nunca el valor", () => {
    const s = exportarIpc(anexoIpc({ valor: (k, r) => (k === 4 ? celdaNumero(r, "414.775") : undefined) }), HOY);
    expect(s).toEqual({ codigoSalida: 1, csv: null, lineas: [expect.stringContaining("❌ DANE_VALOR · celda B14 · ")] });
    expect(s.lineas[0]).toContain("No se escribió el CSV");
    expect(s.lineas[0]).not.toContain("414.775");
  });

  it("los fallos del contenedor y de la forma llevan su detalle", () => {
    expect(exportarIpc(new TextEncoder().encode("FICT no es un xlsx"), HOY).lineas[0]).toMatch(/^❌ ANEXO_ZIP · ZIP_[A-Z_]+ · /);
    expect(exportarIpc(anexoIpc({ partes: { "xl/workbook.xml": null } }), HOY).lineas[0]).toMatch(/^❌ DANE_FORMATO · PARTES · /);
  });

  it("si el catálogo cambiara la forma de la vigencia, no entrega un CSV que el importador rechazaría: 1 CSV_FILA_INVALIDA", () => {
    const catalogo = CATALOGO.map((s) => (s.codigo === SERIE_IPC ? { ...s, vigencia: { tipo: "DIA" as const } } : s));
    const s = exportarIpc(anexoIpc(), HOY, catalogo);
    expect(s).toEqual({ codigoSalida: 1, csv: null, lineas: [expect.stringContaining("❌ CSV_FILA_INVALIDA")] });
  });

  it("sin IPC_INDICE en el catálogo: 1 ERROR_INTERNO", () => {
    const s = exportarIpc(anexoIpc(), HOY, CATALOGO.filter((c) => c.codigo !== SERIE_IPC));
    expect(s).toEqual({ codigoSalida: 1, csv: null, lineas: [expect.stringContaining("❌ ERROR_INTERNO")] });
  });
});

describe("mensajeFalloIpc · un mensaje fijo por código, con detalle y celda si los hay", () => {
  it("con detalle, con celda, con los dos y sin ninguno", () => {
    expect(mensajeFalloIpc({ ok: false, codigo: "DANE_FORMATO", detalle: "REL" })).toMatch(/^❌ DANE_FORMATO · REL · \S/);
    expect(mensajeFalloIpc({ ok: false, codigo: "DANE_HUECO", celda: "B15" })).toMatch(/^❌ DANE_HUECO · celda B15 · \S/);
    expect(mensajeFalloIpc({ ok: false, codigo: "DANE_FORMATO", detalle: "SST", celda: "Z9" })).toMatch(/^❌ DANE_FORMATO · SST · celda Z9 · \S/);
    expect(mensajeFalloIpc({ ok: false, codigo: "SIN_VALORES" })).toMatch(/^❌ SIN_VALORES · \S/);
  });

  it("MES_ABIERTO dice que el IPC de un mes abierto no entra; DANE_BASE_DISTINTA, que el catálogo cambia antes", () => {
    expect(mensajeFalloIpc({ ok: false, codigo: "MES_ABIERTO", celda: "D16" })).toContain("no ha terminado");
    expect(mensajeFalloIpc({ ok: false, codigo: "DANE_BASE_DISTINTA" })).toContain("catálogo");
  });
});

describe("leerArgumentosExportarIpc · solo --archivo <anexo.xlsx>, una vez", () => {
  const sinNpm = {};
  it("lo válido", () => {
    expect(leerArgumentosExportarIpc(["--archivo", "anex-IPC-Indices.ficticio.xlsx"], sinNpm)).toEqual({ archivo: "anex-IPC-Indices.ficticio.xlsx" });
  });

  it.each([
    [[], "Falta --archivo <anexo.xlsx>."],
    [["--archivo"], "--archivo necesita una ruta"],
    [["--archivo", "-x"], "--archivo necesita una ruta"],
    [["anexo.xlsx"], "Argumento suelto"],
    [["--archivo", "a.xlsx", "--archivo", "b.xlsx"], "--archivo está repetida."],
    [["--hasta", "2027-03-17"], "Opción desconocida: «--hasta»."],
    [["--archivo=a.xlsx"], "Opción desconocida: «--archivo»."],
  ])("%j: %s", (argv, mensaje) => {
    expect(() => leerArgumentosExportarIpc(argv, sinNpm)).toThrow(ErrorArgumentosCarga);
    expect(() => leerArgumentosExportarIpc(argv, sinNpm)).toThrow(mensaje);
  });

  it("la trampa de npm: sin «--», npm se queda con --archivo (también sin ningún argumento)", () => {
    expect(() => leerArgumentosExportarIpc([], { npm_config_archivo: "a.xlsx" })).toThrow("npm se quedó con --archivo");
  });
});

describe("salidas del CLI", () => {
  it("archivo: demasiado grande es 1; ilegible o no regular, 2; ninguna repite la ruta", () => {
    expect(salidaArchivoIpc("ARCHIVO_DEMASIADO_GRANDE")).toEqual({ codigoSalida: 1, csv: null, lineas: [expect.stringContaining(`❌ ANEXO_DEMASIADO_GRANDE · el anexo pasa de ${MAX_BYTES_ANEXO_IPC} bytes`)] });
    expect(salidaArchivoIpc("ARCHIVO_ILEGIBLE")).toEqual({ codigoSalida: 2, csv: null, lineas: [expect.stringContaining("❌ ANEXO_ILEGIBLE · ")] });
    expect(salidaArchivoIpc("ARCHIVO_NO_REGULAR")).toEqual({ codigoSalida: 2, csv: null, lineas: [expect.stringContaining("❌ ANEXO_NO_REGULAR · ")] });
  });

  it("uso: 2 con el mensaje y el uso; terminal: 2; salida cerrada: 1", () => {
    expect(salidaUsoIpc("Falta algo.")).toEqual({ codigoSalida: 2, csv: null, lineas: ["❌ Falta algo.", USO_EXPORTAR_IPC] });
    expect(USO_EXPORTAR_IPC).toContain("Uso: npx tsx scripts/exportar-ipc.ts --archivo <anex-IPC-Indices.xlsx> > <ipc.csv.parcial>");
    expect(USO_EXPORTAR_IPC).toContain(String(MAX_BYTES_ANEXO_IPC));
    expect(SALIDA_TERMINAL_IPC).toEqual({ codigoSalida: 2, csv: null, lineas: [expect.stringContaining("❌ SALIDA_TERMINAL · ")] });
    expect(SALIDA_CERRADA_IPC).toEqual({ codigoSalida: 1, csv: null, lineas: [expect.stringContaining("❌ SALIDA_CERRADA · ")] });
    expect(Object.isFrozen(SALIDA_TERMINAL_IPC)).toBe(true);
  });

  it("emitirIpc escribe todo por stderr (stdout es solo del CSV) y devuelve el código", () => {
    const consola = { error: vi.fn<(linea: string) => void>() };
    expect(emitirIpc({ codigoSalida: 2, csv: null, lineas: ["uno", "dos"] }, consola)).toBe(2);
    expect(consola.error.mock.calls).toEqual([["uno"], ["dos"]]);
  });
});
