/**
 * Análisis completo del PDF sin base (lector → tabla → filas → especies → claves): lo que el importador guarda
 * sale de aquí. Errores del lector, de la tabla y de las filas salen como código y ubicación. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { analizarCertificacion, errorDeDocumento } from "@/importacion/av/analisis";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../../../fixtures/av/certificacion.ficticio";

describe("analizarCertificacion", () => {
  it("el PDF ficticio: 4 lotes, 3 especies, 1 fondo, el efectivo y 6 registros con clave, y la fecha de generación", () => {
    const r = analizarCertificacion(generarCertificacionPdf(), "2024-01-04");
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    expect([r.valor.leida.lotes.length, r.valor.posiciones.length, r.valor.leida.fondos.length, r.valor.registros.length]).toEqual([4, 3, 1, 6]);
    expect(r.valor.creadoEn?.toISOString()).toBe("2024-01-05T15:15:00.000Z");
    expect(r.valor.registros.every((x) => /^[0-9a-f]{64}$/.test(x.clave))).toBe(true);
  });

  it("un error del lector, de la tabla, de una fila o de la agregación sale con su código y ubicación", () => {
    expect(analizarCertificacion(new TextEncoder().encode("no es un PDF"), "2024-01-04")).toEqual({ ok: false, errores: [errorDeDocumento("PDF_INVALIDO")] });
    const sinCaja = generarCertificacionPdf({ ...CERTIFICACION_FICTICIA, efectivo: [] });
    expect(analizarCertificacion(sinCaja, "2024-01-04")).toMatchObject({ ok: false, errores: [{ codigo: "EFECTIVO_FALTANTE" }] });
    const malaFila = generarCertificacionPdf({ ...CERTIFICACION_FICTICIA, rentaVariable: [{ nemo: "FICT1", cantidad: "1", precio: "COP 1,00", valor: "COP 9,00" }] });
    expect(analizarCertificacion(malaFila, "2024-01-04")).toEqual({ ok: false, errores: [{ pagina: 1, fila: 2, columna: "VALOR DE MERCADO", codigo: "VALOR_INCOHERENTE" }] });
    const precios = generarCertificacionPdf({ ...CERTIFICACION_FICTICIA, rentaVariable: [{ nemo: "FICT1", cantidad: "1", precio: "COP 1,00", valor: "COP 1,00" }, { nemo: "FICT1", cantidad: "1", precio: "COP 2,00", valor: "COP 2,00" }] });
    expect(analizarCertificacion(precios, "2024-01-04")).toMatchObject({ ok: false, errores: [{ codigo: "PRECIO_INCONSISTENTE" }] });
  });

  it("un error de estructura de la tabla sale con su página y línea", () => {
    const sinAv = Buffer.from(generarCertificacionPdf()).toString("latin1").split("Acciones & Valores").join("Acciones X Valores");
    expect(analizarCertificacion(new Uint8Array(Buffer.from(sinAv, "latin1")), "2024-01-04")).toEqual({ ok: false, errores: [errorDeDocumento("NO_ES_CERTIFICACION_AV")] });
  });
});
