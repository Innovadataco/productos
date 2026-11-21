/**
 * Lo que imprime y devuelve el CLI de importación (code-reviewer MEDIO): si la certificación quedó cargada y lo que
 * falla es la conciliación, el mensaje lo dice (no «la importación falló») y señala conciliar-certificacion.
 * Nunca imprime cifras, especies, cuentas ni el correo. Datos inventados.
 */
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ResumenConciliacion } from "@/conciliacion/conciliar";
import type { ResultadoImportacionAv } from "@/importacion/av/importar";
import { cargarYConciliar } from "@/importacion/av/salida";

const db = {} as PrismaClient;
const FECHA = new Date("2024-01-04T00:00:00Z");
const cargado: ResultadoImportacionAv = {
  cargaId: "c1", estado: "CARGADO", repetida: false, certificacionId: "x", filasTotal: 6, filasNuevas: 6, filasRepetidas: 0, instrumentosCreados: 3, fondoVinculado: true, errores: [],
};
const resumen: ResumenConciliacion = { conciliacionId: "k", fechaCorte: "2024-01-04", versionCalculo: "conciliacion-v1", resultado: "NO_CUADRA", cuentas: { CUADRA: 8, NO_CUADRA: 2, PENDIENTE_LIQUIDACION: 0 }, motivos: ["fondo_sin_unidades"] };
const entrada = { contenido: new Uint8Array(), usuarioId: "u", fechaCorte: FECHA, fondoCodigo: null };

describe("cargarYConciliar", () => {
  it("cargada y conciliada: 0, con el resumen y el siguiente paso de precios", async () => {
    const r = await cargarYConciliar(db, entrada, { importar: async () => cargado, conciliar: async () => resumen });
    expect(r.codigo).toBe(0);
    expect(r.lineas.join("\n")).toContain("✅ CARGADO · 6 filas");
    expect(r.lineas.join("\n")).toContain("Conciliación al 2024-01-04: NO_CUADRA · 8 cuadran, 2 no cuadran");
    expect(r.lineas.join("\n")).toContain("npm run precios:actualizar -- --desde 2024-01-04");
  });

  it("cargada pero la conciliación falla: 1, dice que quedó cargada y que corra conciliar-certificacion", async () => {
    const falla = Object.assign(new Error("detalle interno con cifras 123456"), { name: "ErrorFicticio" });
    const r = await cargarYConciliar(db, entrada, { importar: async () => cargado, conciliar: async () => Promise.reject(falla) });
    expect(r.codigo).toBe(1);
    const texto = r.lineas.join("\n");
    expect(texto).toContain("✅ CARGADO");
    expect(texto).toContain("la conciliación falló (ErrorFicticio)");
    expect(texto).toContain("npx tsx scripts/conciliar-certificacion.ts --fecha-corte 2024-01-04");
    expect(texto).not.toContain("123456");
    expect(texto).not.toContain("La importación falló");
  });

  it("rechazada: 1, con página, fila, columna y código, y sin conciliar", async () => {
    let concilio = false;
    const rechazada: ResultadoImportacionAv = { ...cargado, estado: "RECHAZADO", certificacionId: null, filasNuevas: 0, errores: [{ pagina: 1, fila: 2, columna: "VALOR DE MERCADO", codigo: "VALOR_INCOHERENTE" }] };
    const r = await cargarYConciliar(db, entrada, { importar: async () => rechazada, conciliar: async () => ((concilio = true), resumen) });
    expect([r.codigo, concilio]).toEqual([1, false]);
    expect(r.lineas.join("\n")).toContain("página 1 · fila 2 · VALOR DE MERCADO · VALOR_INCOHERENTE");
  });
});
