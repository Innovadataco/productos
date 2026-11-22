// Lo que imprime importar-decretos (fase C, C4a: salidaDecretos y salidaArchivo de src/datos-oficiales/decretos/importar.ts):
// el modo, conteos, códigos con su línea y qué revisar, y el id de la carga; 0 bien y 3 rechazado; en producción, la
// frase de parar la carga solo si no es 0 y el siguiente paso por la vía B. Nunca recomienda comprar ni vender.
import { describe, expect, it } from "vitest";
import { PARE_VIA_B } from "@/cli/via-b";
import { salidaArchivo, salidaDecretos, type ResultadoDecretos } from "@/datos-oficiales/decretos/importar";

const LOCAL = { produccion: false };
const PROD = { produccion: true };
const CONTEOS = { filas: 7, nuevos: 3, versiones: 2, anulaciones: 1, sinCambios: 1 };
const ok = (r: Partial<Extract<ResultadoDecretos, { conteos: unknown }>>): ResultadoDecretos =>
  ({ modo: "ENSAYO", estado: "LISTO", conteos: CONTEOS, cargaId: null, ...r }) as ResultadoDecretos;
const texto = (r: ResultadoDecretos, o = LOCAL) => {
  const s = salidaDecretos(r, o);
  return { codigo: s.codigoSalida, todo: [...s.lineas, ...s.errores].join("\n"), s };
};

describe("decretos · salida del CLI", () => {
  it("ensayo listo: 0, el modo, los conteos y que no escribió; en producción, repetir por la vía B con --aplicar", () => {
    const { codigo, todo, s } = texto(ok({}));
    expect(codigo).toBe(0);
    expect(s.errores).toEqual([]);
    expect(todo).toContain("ENSAYO (no escribe nada)");
    expect(todo).toContain("Filas: 7 · por registrar: nuevas 3, versiones 2, anulaciones 1 · sin cambios: 1");
    expect(todo).toContain("listo para --aplicar; no se escribió nada");
    const prod = texto(ok({}), PROD);
    expect(prod.codigo).toBe(0);
    expect(prod.todo).toContain("vía B con --aplicar");
    expect(prod.todo).not.toContain(PARE_VIA_B);
  });

  it("el ensayo ya no habla de una guarda del cruce (C5b la retiró): ni CRUCE_PENDIENTE, ni C5b, ni «bloqueado»", () => {
    for (const o of [LOCAL, PROD]) {
      const { codigo, todo } = texto(ok({}), o);
      expect(codigo).toBe(0);
      expect(todo).not.toMatch(/CRUCE_PENDIENTE|C5b|bloquead|dos veces/);
    }
  });

  it("aplicado: 0 con el id de la carga; sin cambios: 0 y que no escribió", () => {
    const aplicado = texto(ok({ modo: "APLICAR", estado: "APLICADO", cargaId: "cqx1237carga" }));
    expect(aplicado.codigo).toBe(0);
    expect(aplicado.todo).toContain("APLICAR (escribe en la base)");
    expect(aplicado.todo).toContain("Filas: 7 · registradas: nuevas 3");
    expect(aplicado.todo).toContain("aplicado · carga cqx1237carga");
    const igual = texto(ok({ modo: "APLICAR", estado: "SIN_CAMBIOS", conteos: { ...CONTEOS, nuevos: 0, versiones: 0, anulaciones: 0, sinCambios: 7 } }));
    expect(igual.codigo).toBe(0);
    expect(igual.todo).toContain("ya estaba todo registrado; no se escribió nada");
  });

  it("rechazado: 3, que no escribió, cada hallazgo con su línea y qué revisar una vez por código; en producción, parar", () => {
    const r: ResultadoDecretos = {
      modo: "APLICAR", estado: "RECHAZADO", total: 4,
      hallazgos: [
        { linea: 3, columna: "especie", codigo: "ESPECIE_NO_REGISTRADA" }, { linea: 5, columna: "especie", codigo: "ESPECIE_NO_REGISTRADA" },
        { linea: 6, columna: "moneda", codigo: "MONEDA_NO_ADMITIDA" }, { linea: 0, columna: null, codigo: "USUARIO_NO_AUTORIZADO" },
      ],
    };
    const { codigo, todo, s } = texto(r);
    expect(codigo).toBe(3);
    expect(todo).toContain("Rechazado, no se escribió nada · 4 hallazgo(s)");
    expect(todo).toContain("línea 3 · especie · ESPECIE_NO_REGISTRADA");
    expect(todo).toContain("todo el archivo · USUARIO_NO_AUTORIZADO");
    expect(todo.match(/ESPECIE_NO_REGISTRADA: /g)).toHaveLength(1);
    expect(todo).toMatch(/MONEDA_NO_ADMITIDA: .*P11/);
    expect(todo).toMatch(/USUARIO_NO_AUTORIZADO: .*dueño activo/);
    expect(s.errores.at(-1)).not.toBe(PARE_VIA_B);
    expect(salidaDecretos(r, PROD).errores.at(-1)).toBe(PARE_VIA_B);
  });

  it("ESPECIE_AMBIGUA dice qué revisar: el texto es el nemotécnico de una acción y el símbolo de Trii de otra", () => {
    const { codigo, todo } = texto({ modo: "ENSAYO", estado: "RECHAZADO", total: 1, hallazgos: [{ linea: 4, columna: "especie", codigo: "ESPECIE_AMBIGUA" }] });
    expect(codigo).toBe(3);
    expect(todo).toMatch(/ESPECIE_AMBIGUA: .*nemotécnico de una acción y el símbolo de Trii de otra/);
  });

  it("nunca recomienda comprar ni vender", () => {
    const todos = [
      texto(ok({})).todo, texto(ok({}), PROD).todo,
      texto({ modo: "ENSAYO", estado: "RECHAZADO", total: 1, hallazgos: [{ linea: 0, columna: null, codigo: "CADENA_ROTA" }] }).todo,
    ].join("\n");
    expect(todos).not.toMatch(/\b(compr[ae]|vend[ae]|recomendamos)\b/i);
  });

  it("el archivo que no se pudo leer: 3 si pasa del tope, 2 si no es un archivo regular o no se pudo leer", () => {
    expect(salidaArchivo("ARCHIVO_DEMASIADO_GRANDE", LOCAL).codigoSalida).toBe(3);
    expect(salidaArchivo("ARCHIVO_NO_REGULAR", LOCAL).codigoSalida).toBe(2);
    expect(salidaArchivo("ARCHIVO_ILEGIBLE", PROD)).toMatchObject({ codigoSalida: 2, errores: [expect.stringContaining("ARCHIVO_ILEGIBLE"), PARE_VIA_B] });
  });
});
