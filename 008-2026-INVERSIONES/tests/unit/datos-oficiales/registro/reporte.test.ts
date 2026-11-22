// Salida de los CLI del registro del dueño (fase C, C4a: src/datos-oficiales/registro/reporte.ts): códigos 0 a 3,
// stdout y stderr, PARE_VIA_B solo en producción y solo si la salida no es 0, y ningún mensaje de error impreso.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ErrorCifrado } from "@/cifrado/errores";
import { PARE_VIA_B } from "@/cli/via-b";
import { bien, emitir, fallo, lineasHallazgos, salidaError } from "@/datos-oficiales/registro/reporte";

const LOCAL = { produccion: false };
const PROD = { produccion: true };

describe("registro · salida del CLI", () => {
  it("bien: 0, por stdout, sin la frase de parar", () => {
    expect(bien(["a", "b"])).toEqual({ codigoSalida: 0, lineas: ["a", "b"], errores: [] });
  });

  it("fallo: por stderr; en producción termina con PARE_VIA_B, en local no", () => {
    expect(fallo(LOCAL, 3, ["x"])).toEqual({ codigoSalida: 3, lineas: [], errores: ["x"] });
    expect(fallo(PROD, 2, ["x"], ["encabezado"])).toEqual({ codigoSalida: 2, lineas: ["encabezado"], errores: ["x", PARE_VIA_B] });
  });

  it("los hallazgos: línea (o todo el archivo), columna si la hay y código; y cuántos más si se recortaron", () => {
    const hs = [{ linea: 0, columna: null, codigo: "A" }, { linea: 7, columna: "cuota", codigo: "B" }];
    expect(lineasHallazgos(hs, 2)).toEqual(["   todo el archivo · A", "   línea 7 · cuota · B"]);
    expect(lineasHallazgos(hs, 9)).toEqual(["   todo el archivo · A", "   línea 7 · cuota · B", "   … y 7 más"]);
  });

  it("un error: 1, con su clase y su código, nunca su mensaje (puede traer valores o el host de la base)", () => {
    const prisma = new Prisma.PrismaClientKnownRequestError("valor secreto 4613.37 en db.ejemplo.invalid", { code: "P2034", clientVersion: "x" });
    const s = salidaError(prisma, LOCAL);
    expect(s.codigoSalida).toBe(1);
    expect(s.errores.join("\n")).toContain("P2034");
    expect(s.errores.join("\n")).not.toMatch(/4613|ejemplo\.invalid|secreto/);
    expect(salidaError(new Error("FICTA 4613"), PROD).errores.join("\n")).not.toContain("FICTA");
    expect(salidaError(new Error("x"), PROD).errores.at(-1)).toBe(PARE_VIA_B);
  });

  it("un ErrorCifrado: 1, con su código, y dice que no se escribió nada", () => {
    const s = salidaError(new ErrorCifrado("CLAVE_ACTIVA_AUSENTE"), LOCAL);
    expect(s.codigoSalida).toBe(1);
    expect(s.errores.join("\n")).toMatch(/CLAVE_ACTIVA_AUSENTE.*no se escribió nada/);
  });

  it("emitir: stdout y después stderr, y devuelve el código", () => {
    const vistas: string[] = [];
    const codigo = emitir(fallo(LOCAL, 3, ["e1"], ["l1"]), { log: (l) => vistas.push(`log ${l}`), error: (l) => vistas.push(`error ${l}`) });
    expect(codigo).toBe(3);
    expect(vistas).toEqual(["log l1", "error e1"]);
  });
});
