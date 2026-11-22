/**
 * Lo que imprime scripts/registrar-movimiento-fondo.ts (frente fondo-movimientos, T5): ids internos y códigos, nunca las
 * cifras, el correo ni el código del fondo. Si el contraste falla, dice el código y qué revisar en el extracto (el día y
 * el valor de unidad). Nunca recomienda comprar ni vender.
 */
import { describe, expect, it } from "vitest";
import type { CodigoRechazo } from "@/fondo/movimiento";
import { PARE_VIA_B } from "@/cli/via-b";
import { emitir, salidaDatosInvalidos, salidaErrorBase, salidaInesperada, salidaRechazo, salidaResultado, textoRechazo, textoResultado } from "@/fondo/salida-movimiento";

const CODIGOS: readonly CodigoRechazo[] = [
  "USUARIO_NO_AUTORIZADO", "FONDO_NO_REGISTRADO", "FONDO_INACTIVO", "CONSTITUCION_DISTINTA", "MOVIMIENTO_ANTES_DE_LA_CONSTITUCION",
  "SIN_VALOR_UNIDAD_DEL_DIA", "MONTO_NO_CUADRA_CON_VALOR_UNIDAD", "REGISTRO_EN_CONFLICTO",
];

describe("textoResultado", () => {
  it("ensayo: no escribió nada y dice cómo registrarla", () => {
    const t = textoResultado({ estado: "ENSAYO", fondoId: "cfondo", movimientoId: null, ajusteId: null });
    expect(t).toContain("Ensayo");
    expect(t).toContain("No se escribió nada");
    expect(t).toContain("--aplicar");
  });

  it("registrada: los ids internos del fondo, del movimiento y del ajuste, y el siguiente paso", () => {
    const t = textoResultado({ estado: "REGISTRADA", fondoId: "cfondo", movimientoId: "cmov", ajusteId: "cajuste" });
    for (const id of ["cfondo", "cmov", "cajuste", "conciliar-certificacion"]) expect(t).toContain(id);
  });

  it("ya existía: no escribió nada", () => {
    const t = textoResultado({ estado: "YA_EXISTIA", fondoId: "cfondo", movimientoId: "cmov", ajusteId: "cajuste" });
    expect(t).toContain("ya estaba registrada");
    expect(t).toContain("no se escribió nada");
  });
});

describe("textoRechazo", () => {
  it("cada código dice su nombre y qué revisar", () => {
    for (const codigo of CODIGOS) {
      const t = textoRechazo(codigo);
      expect(t).toContain(`No se registró: ${codigo}`);
      expect(t.length).toBeGreaterThan(`No se registró: ${codigo}`.length + 20);
      expect(t).not.toMatch(/\b(compr|vend)/i);
    }
  });

  it("si el monto no cuadra o falta el valor de unidad, manda a revisar en el extracto el día y el valor de unidad", () => {
    for (const codigo of ["MONTO_NO_CUADRA_CON_VALOR_UNIDAD", "SIN_VALOR_UNIDAD_DEL_DIA"] as const) {
      expect(textoRechazo(codigo)).toMatch(/extracto/);
      expect(textoRechazo(codigo)).toMatch(/día/);
      expect(textoRechazo(codigo)).toMatch(/valor de unidad/);
    }
  });
});

// ───────────── Vía B (frente fondo-movimientos-via-b) ─────────────
// En producción (NODE_ENV=production, la imagen del migrador) el CLI corre por `cargar-prod.sh registrar-movimiento-fondo`:
// toda salida distinta de 0 termina con «Vía B: pare la carga y avise al CEO de 008» y las pistas nombran los comandos
// de la vía B, nunca `npx tsx`. En local, los textos de antes. Los fallos van por stderr; lo bueno, por stdout.

const LOCAL = { produccion: false } as const;
const PROD = { produccion: true } as const;
const REGISTRADA = { estado: "REGISTRADA", fondoId: "cfondo", movimientoId: "cmov", ajusteId: "cajuste" } as const;
const ENSAYO = { estado: "ENSAYO", fondoId: "cfondo", movimientoId: null, ajusteId: null } as const;
const todo = (s: { lineas: readonly string[]; errores: readonly string[] }) => [...s.lineas, ...s.errores].join("\n");

describe("salidas del CLI · códigos y canales", () => {
  it("0 por stdout (ensayo, registrada y ya existía), sin la frase de parar", () => {
    for (const r of [ENSAYO, REGISTRADA, { ...REGISTRADA, estado: "YA_EXISTIA" } as const]) {
      for (const o of [LOCAL, PROD]) {
        const s = salidaResultado(r, o);
        expect([s.codigoSalida, s.errores, s.lineas.length]).toEqual([0, [], 1]);
        expect(todo(s)).not.toContain(PARE_VIA_B);
      }
    }
  });

  it("2 por stderr: campo y código de cada error y el uso; 3 por stderr: el rechazo; 1 por stderr: la base", () => {
    const datos = salidaDatosInvalidos([{ campo: "monto", codigo: "NUMERO_FORMATO" }], LOCAL);
    expect([datos.codigoSalida, datos.lineas]).toEqual([2, []]);
    expect(datos.errores).toContain("   monto · NUMERO_FORMATO");
    expect(todo(datos)).toContain("npx tsx scripts/registrar-movimiento-fondo.ts");
    const rechazo = salidaRechazo("MONTO_NO_CUADRA_CON_VALOR_UNIDAD", LOCAL);
    expect([rechazo.codigoSalida, rechazo.lineas, rechazo.errores]).toEqual([3, [], [textoRechazo("MONTO_NO_CUADRA_CON_VALOR_UNIDAD")]]);
    const base = salidaErrorBase(Object.assign(new Error("host:5438 clave"), { name: "PrismaClientKnownRequestError", code: "P2028" }), LOCAL);
    expect([base.codigoSalida, base.lineas]).toEqual([1, []]);
    expect(todo(base)).toContain("ERROR_BASE (PrismaClientKnownRequestError P2028)");
    // Un fallo al confirmar pudo dejarla registrada: no se promete «no se registró».
    expect(todo(base)).toContain("No se pudo confirmar");
    expect(todo(base)).not.toMatch(/host|5438|clave|No se registró/);
  });

  it("un fallo inesperado (fuera de la base) es 1 y tampoco promete nada", () => {
    const s = salidaInesperada(new TypeError("detalle interno 1237.48215"), LOCAL);
    expect(s.codigoSalida).toBe(1);
    expect(todo(s)).toContain("TypeError");
    expect(todo(s)).toContain("No se pudo confirmar");
    expect(todo(s)).not.toContain("1237.48215");
  });

  it("emitir escribe stdout y stderr en orden y devuelve el código", () => {
    const visto: string[] = [];
    const consola = { log: (l: string) => visto.push(`out ${l}`), error: (l: string) => visto.push(`err ${l}`) };
    expect(emitir({ codigoSalida: 3, lineas: ["a"], errores: ["b", "c"] }, consola)).toBe(3);
    expect(visto).toEqual(["out a", "err b", "err c"]);
  });
});

describe("salidas del CLI · en producción (vía B)", () => {
  const fallos = () => [
    salidaDatosInvalidos([{ campo: "fecha", codigo: "FECHA_FUTURA" }], PROD),
    ...CODIGOS.map((c) => salidaRechazo(c, PROD)),
    salidaErrorBase(new Error("x"), PROD),
    salidaInesperada(new Error("x"), PROD),
  ];

  it("toda salida distinta de 0 termina con «pare la carga y avise al CEO de 008»", () => {
    for (const s of fallos()) {
      expect(s.codigoSalida).not.toBe(0);
      expect(s.errores.at(-1)).toBe(PARE_VIA_B);
    }
  });

  it("en local, ningún fallo lleva esa frase", () => {
    for (const s of [salidaDatosInvalidos([], LOCAL), ...CODIGOS.map((c) => salidaRechazo(c, LOCAL)), salidaErrorBase(new Error("x"), LOCAL)]) {
      expect(todo(s)).not.toContain(PARE_VIA_B);
    }
  });

  it("las pistas nombran los comandos de la vía B y nunca `npx tsx` ni «vuelva a intentarlo» (eso lo decide el CEO)", () => {
    for (const s of fallos()) {
      expect(todo(s)).not.toContain("npx tsx");
      expect(todo(s)).not.toMatch(/vuelva a intentarlo|revíselo antes de repetir/i);
    }
    expect(todo(salidaRechazo("FONDO_NO_REGISTRADO", PROD))).toContain("cargar-prod.sh registrar-fondo");
    expect(todo(salidaRechazo("SIN_VALOR_UNIDAD_DEL_DIA", PROD))).toContain("cargar-prod.sh importar-valores-fondo");
    expect(todo(salidaRechazo("SIN_VALOR_UNIDAD_DEL_DIA", PROD))).toContain("fondo:exportar");
  });

  it("el uso explica la cabecera del sobre y el comando de la vía B", () => {
    const t = todo(salidaDatosInvalidos([{ campo: "monto", codigo: "NUMERO_FORMATO" }], PROD));
    for (const parte of ["cabecera", "armar-sobre.sh", "cargar-prod.sh registrar-movimiento-fondo", "--aplicar", "   monto · NUMERO_FORMATO"]) expect(t).toContain(parte);
  });

  it("el ensayo pide repetir el comando de la vía B con --aplicar en la cabecera; la registrada, conciliar por la vía B", () => {
    expect(todo(salidaResultado(ENSAYO, PROD))).toMatch(/cargar-prod\.sh registrar-movimiento-fondo.*--aplicar/);
    expect(todo(salidaResultado(REGISTRADA, PROD))).toContain("cargar-prod.sh conciliar-certificacion");
    expect(todo(salidaResultado(REGISTRADA, PROD))).not.toContain("npx tsx");
  });

  it("en local, la registrada dice cómo conciliar en el Mac y el conflicto invita a repetir", () => {
    expect(todo(salidaResultado(REGISTRADA, LOCAL))).toContain("npx tsx scripts/conciliar-certificacion.ts");
    expect(textoRechazo("REGISTRO_EN_CONFLICTO")).toContain("vuelva a intentarlo");
  });
});
