// El CSV de los rendimientos del fondo que escribe el dueño (frente fondo-rendimientos, T2:
// src/fondo/rendimientos/csv.ts): encabezado exacto `fecha,tipo,valor`, todo o nada, y los hallazgos con línea, columna
// y código, nunca el valor. Datos inventados (2027, cifras raras).
import { describe, expect, it } from "vitest";
import {
  ENCABEZADO_RENDIMIENTOS, MAX_BYTES_RENDIMIENTOS, MAX_FILAS_RENDIMIENTOS, leerCsvRendimientos, type LecturaRendimientos,
} from "@/fondo/rendimientos/csv";

const HOY = new Date("2027-11-19T00:00:00Z");
const bytes = (texto: string) => new TextEncoder().encode(texto);
const csv = (...filas: string[]) => bytes(["fecha,tipo,valor", ...filas].join("\n"));
const leer = (b: Uint8Array): LecturaRendimientos => leerCsvRendimientos(b, HOY);

function hallazgos(r: LecturaRendimientos) {
  if (r.ok) throw new Error("se esperaba un rechazo");
  return r.hallazgos;
}

describe("rendimientos · CSV del dueño", () => {
  it("el contrato: tres columnas en este orden y los topes", () => {
    expect(ENCABEZADO_RENDIMIENTOS).toEqual(["fecha", "tipo", "valor"]);
    expect([MAX_BYTES_RENDIMIENTOS, MAX_FILAS_RENDIMIENTOS]).toEqual([262144, 2000]);
  });

  it("lee rendimientos y retenciones, con el valor canónico y la fila cruda tal cual", () => {
    const r = leer(csv("2027-03-17,RENDIMIENTO,48213.3700", "2027-03-17,RETENCION,1748.6233", "2027-04-19,RENDIMIENTO,0048211.9"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.filas.map((f) => [f.linea, f.fecha.toISOString().slice(0, 10), f.tipo, f.valor])).toEqual([
      [2, "2027-03-17", "RENDIMIENTO", "48213.37"],
      [3, "2027-03-17", "RETENCION", "1748.6233"],
      [4, "2027-04-19", "RENDIMIENTO", "48211.9"],
    ]);
    expect(r.filas[0]!.crudo).toEqual({ fecha: "2027-03-17", tipo: "RENDIMIENTO", valor: "48213.3700" });
  });

  it("acepta el BOM inicial y los finales de línea CRLF", () => {
    const r = leer(bytes("﻿fecha,tipo,valor\r\n2027-03-17,RENDIMIENTO,48213.37\r\n"));
    expect(r.ok).toBe(true);
  });

  it("hoy mismo vale; un día después de hoy (Bogotá) no", () => {
    expect(leer(csv("2027-11-19,RENDIMIENTO,48213.37")).ok).toBe(true);
    expect(hallazgos(leer(csv("2027-11-20,RENDIMIENTO,48213.37")))).toEqual([{ linea: 2, columna: "fecha", codigo: "FECHA_FUTURA" }]);
  });

  it("cada fecha o tipo malos dan su código, por línea y columna; una fila con otra cantidad de celdas, COLUMNAS_DISTINTAS", () => {
    const r = leer(csv("17/03/2027,RENDIMIENTO,48213.37", "2027-02-30,RETENCION,1748.6233", "2027-03-17,rendimiento,48213.37", "2027-03-18,RETENCIÓN,48213.37", "2027-03-19,X,48.213,37"));
    expect(hallazgos(r)).toEqual([{ linea: 6, columna: null, codigo: "COLUMNAS_DISTINTAS" }]);
    const s = leer(csv("17/03/2027,RENDIMIENTO,48213.37", "2027-02-30,RETENCION,1748.6233", "2027-03-17,rendimiento,48213.37", "2027-03-18,RETENCIÓN,48213.37"));
    expect(hallazgos(s)).toEqual([
      { linea: 2, columna: "fecha", codigo: "FECHA_FORMATO" },
      { linea: 3, columna: "fecha", codigo: "FECHA_INVALIDA" },
      { linea: 4, columna: "tipo", codigo: "TIPO_DESCONOCIDO" },
      { linea: 5, columna: "tipo", codigo: "TIPO_DESCONOCIDO" },
    ]);
  });

  it("los valores: formato, precisión, rango y signo", () => {
    const r = leer(
      csv(
        "2027-04-19,RENDIMIENTO,4.8213e4",
        "2027-04-20,RETENCION,1748.62331",
        "2027-05-21,RENDIMIENTO,0",
        "2027-05-24,RETENCION,-1748.6233",
        "2027-06-23,RENDIMIENTO,$48213.37",
        "2027-06-24,RETENCION,1234567890123456789",
      ),
    );
    expect(hallazgos(r)).toEqual([
      { linea: 2, columna: "valor", codigo: "NUMERO_FORMATO" },
      { linea: 3, columna: "valor", codigo: "NUMERO_PRECISION" },
      { linea: 4, columna: "valor", codigo: "VALOR_NO_POSITIVO" },
      { linea: 5, columna: "valor", codigo: "VALOR_NO_POSITIVO" },
      { linea: 6, columna: "valor", codigo: "NUMERO_FORMATO" },
      { linea: 7, columna: "valor", codigo: "NUMERO_RANGO" },
    ]);
  });

  it("la misma fecha y tipo dos veces: FILA_REPETIDA en la segunda (aunque cambie el valor); otro tipo el mismo día, no", () => {
    const r = leer(csv("2027-03-17,RENDIMIENTO,48213.37", "2027-03-17,RETENCION,1748.6233", "2027-03-17,RENDIMIENTO,48213.38"));
    expect(hallazgos(r)).toEqual([{ linea: 4, columna: null, codigo: "FILA_REPETIDA" }]);
  });

  it("el archivo: encabezado exacto, con filas, dentro de los topes y en UTF-8", () => {
    expect(hallazgos(leer(bytes("fecha,tipo,valor,nota\n2027-03-17,RENDIMIENTO,48213.37,x")))).toEqual([{ linea: 1, columna: null, codigo: "ENCABEZADO_DISTINTO" }]);
    expect(hallazgos(leer(bytes("tipo,fecha,valor\nRENDIMIENTO,2027-03-17,48213.37")))).toEqual([{ linea: 1, columna: null, codigo: "ENCABEZADO_DISTINTO" }]);
    expect(hallazgos(leer(bytes("fecha,tipo,valor\n")))).toEqual([{ linea: 0, columna: null, codigo: "ARCHIVO_SIN_FILAS" }]);
    expect(hallazgos(leer(new Uint8Array([0x66, 0xff, 0x0a])))).toEqual([{ linea: 0, columna: null, codigo: "CODIFICACION_NO_UTF8" }]);
    expect(hallazgos(leer(new Uint8Array(MAX_BYTES_RENDIMIENTOS + 1)))).toEqual([{ linea: 0, columna: null, codigo: "ARCHIVO_DEMASIADO_GRANDE" }]);
    const muchas = Array.from({ length: MAX_FILAS_RENDIMIENTOS + 1 }, (_, i) => `2027-01-01,RENDIMIENTO,${4613 + i}.17`);
    expect(hallazgos(leer(csv(...muchas)))).toEqual([{ linea: 0, columna: null, codigo: "DEMASIADAS_FILAS" }]);
    expect(hallazgos(leer(csv("2027-03-17,RENDIMIENTO,48213.37​")))).toEqual([{ linea: 2, columna: "valor", codigo: "CARACTER_NO_PERMITIDO" }]);
  });

  it("ningún hallazgo repite el valor de una celda", () => {
    const r = leer(csv("2027-03-17,RENDIMIENTO,48213.37981", "17/03/2027,RENTA,-4613.27"));
    expect(JSON.stringify(hallazgos(r))).not.toMatch(/48213|4613|RENTA|17\/03/);
  });
});
