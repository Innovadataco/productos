// Lectura del CSV del registro del dueño (fase C, C4a: src/datos-oficiales/registro/archivo.ts): todo o nada, antes de
// abrir la base. Encabezado exacto, UTF-8 estricto, RFC 4180 con el lector de Trii, topes en N (pasa) y N+1 (no pasa),
// sin caracteres de control ni invisibles, y hallazgos con línea, columna y código, nunca el valor. Datos inventados.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { leerArchivoRegistro, type LecturaArchivo } from "@/datos-oficiales/registro/archivo";
import { MAX_HALLAZGOS, enTodoElArchivo, ordenar, recortar } from "@/datos-oficiales/registro/hallazgos";

const ENCABEZADO = ["alfa", "beta", "gama"];
const REGLAS = { encabezado: ENCABEZADO, maxBytes: 200, maxFilas: 3 };
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
const leer = (t: string, reglas = REGLAS): LecturaArchivo => leerArchivoRegistro(bytes(t), reglas);
const hallazgos = (r: LecturaArchivo) => (r.ok ? [] : r.hallazgos);

describe("registro · lectura del CSV del dueño", () => {
  it("lee las filas con su número (el encabezado es el 1, una línea vacía cuenta), su crudo y el sha256 de los bytes", () => {
    const texto = 'alfa,beta,gama\nx1,y1,z1\n\n"x ""3""",y3,"z,3"\n';
    const r = leer(texto);
    expect(r).toEqual({
      ok: true,
      sha256: createHash("sha256").update(bytes(texto)).digest("hex"),
      filas: [
        { numero: 2, celdas: ["x1", "y1", "z1"], crudo: { alfa: "x1", beta: "y1", gama: "z1" } },
        { numero: 4, celdas: ['x "3"', "y3", "z,3"], crudo: { alfa: 'x "3"', beta: "y3", gama: "z,3" } },
      ],
    });
  });

  it("quita el BOM y acepta CRLF", () => {
    const r = leer("﻿alfa,beta,gama\r\nx1,y1,z1\r\n");
    expect(r.ok && r.filas.map((f) => f.celdas)).toEqual([["x1", "y1", "z1"]]);
  });

  it("tope de bytes: N pasa, N+1 no (antes de decodificar)", () => {
    const base = "alfa,beta,gama\nx1,y1,z1\n";
    const justo = { ...REGLAS, maxBytes: bytes(base).byteLength };
    expect(leer(base, justo).ok).toBe(true);
    expect(hallazgos(leer(`${base}\n`, justo))).toEqual([enTodoElArchivo("ARCHIVO_DEMASIADO_GRANDE")]);
  });

  it("UTF-8 estricto y comillas cerradas", () => {
    const malo = new Uint8Array([...bytes("alfa,beta,gama\nx"), 0xff, ...bytes(",y,z\n")]);
    expect(hallazgos(leerArchivoRegistro(malo, REGLAS))).toEqual([enTodoElArchivo("CODIFICACION_NO_UTF8")]);
    expect(hallazgos(leer('alfa,beta,gama\n"x1,y1,z1\n'))).toEqual([enTodoElArchivo("COMILLA_SIN_CERRAR")]);
  });

  it("encabezado exacto: otro orden, una columna de más o de menos, espacios o mayúsculas lo rechazan", () => {
    for (const encabezado of ["beta,alfa,gama", "alfa,beta,gama,delta", "alfa,beta", "alfa, beta,gama", "Alfa,beta,gama"]) {
      expect(hallazgos(leer(`${encabezado}\nx1,y1,z1\n`)), encabezado).toEqual([{ linea: 1, columna: null, codigo: "ENCABEZADO_DISTINTO" }]);
    }
  });

  it("sin filas de datos, o con más filas que el tope (N pasa, N+1 no)", () => {
    expect(hallazgos(leer("alfa,beta,gama\n"))).toEqual([enTodoElArchivo("ARCHIVO_SIN_FILAS")]);
    const filas = (n: number) => `alfa,beta,gama\n${Array.from({ length: n }, (_, i) => `x${i},y,z`).join("\n")}\n`;
    expect(leer(filas(3)).ok).toBe(true);
    expect(hallazgos(leer(filas(4)))).toEqual([enTodoElArchivo("DEMASIADAS_FILAS")]);
  });

  it("cada fila con tantas celdas como el encabezado", () => {
    expect(hallazgos(leer("alfa,beta,gama\nx1,y1\nx2,y2,z2,w2\nx3,y3,z3\n"))).toEqual([
      { linea: 2, columna: null, codigo: "COLUMNAS_DISTINTAS" },
      { linea: 3, columna: null, codigo: "COLUMNAS_DISTINTAS" },
    ]);
  });

  it("ninguna celda con controles, invisibles o dirección de texto (tampoco un salto dentro de comillas), por columna", () => {
    const malas = ["x\ty", "x\u0085y", "x​y", "x‮y", "x⁦y", "x­y", "x\u007fy", "x﻿y"];
    for (const mala of malas) {
      expect(hallazgos(leer(`alfa,beta,gama\nx1,${mala},z1\n`)), JSON.stringify(mala)).toEqual([{ linea: 2, columna: "beta", codigo: "CARACTER_NO_PERMITIDO" }]);
    }
    // El salto dentro de comillas no suma a la numeración (el número es el del registro): la fila siguiente es la 3.
    expect(hallazgos(leer('alfa,beta,gama\n"x\ny",y1,z1\nx3,y3,z3\u0001\n'))).toEqual([
      { linea: 2, columna: "alfa", codigo: "CARACTER_NO_PERMITIDO" },
      { linea: 3, columna: "gama", codigo: "CARACTER_NO_PERMITIDO" },
    ]);
    expect(leer("alfa,beta,gama\nÁrbol ñandú,y1,z1\n").ok).toBe(true);
  });

  it("los hallazgos nunca llevan el valor de la celda", () => {
    const r = leer("alfa,beta,gama\nFICTA-4613\u0007,y1\n");
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("FICTA");
  });
});

describe("registro · hallazgos", () => {
  it("ordena por línea (estable dentro de la línea) y recorta a MAX_HALLAZGOS con el total", () => {
    const de = (linea: number, codigo: string) => ({ linea, columna: null, codigo });
    expect(ordenar([de(3, "C"), de(1, "A"), de(3, "B"), de(0, "Z")]).map((h) => h.codigo)).toEqual(["Z", "A", "C", "B"]);
    const muchos = Array.from({ length: MAX_HALLAZGOS + 7 }, (_, i) => de(MAX_HALLAZGOS + 7 - i, `C${i}`));
    const r = recortar(muchos);
    expect(r.total).toBe(MAX_HALLAZGOS + 7);
    expect(r.hallazgos).toHaveLength(MAX_HALLAZGOS);
    expect(r.hallazgos[0]!.linea).toBe(1);
  });
});
