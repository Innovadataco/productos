/**
 * Argumentos de los CLI de la certificación (PR-B): `importar-certificacion.ts` y `conciliar-certificacion.ts`.
 * La fecha de corte es obligatoria (el PDF no la trae) y nunca se infiere. Como proceso, con argumentos inválidos
 * salen con 2 y su uso ANTES de tocar la base, sin repetir el correo ni el código del fondo. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { ErrorArgumentosAv, leerArgumentosConciliar, leerArgumentosImportar } from "@/importacion/av/argumentos";
import { POR_CLI_MS, comprobar, correr, entornoMinimo } from "../../../ayudas/cli";

const codigo = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorArgumentosAv) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
};

describe("leerArgumentosImportar", () => {
  it("lee correo, fecha de corte, fondo opcional y un solo PDF, en cualquier orden", () => {
    expect(leerArgumentosImportar(["--email", "dueno@ejemplo.invalid", "--fecha-corte", "2024-01-04", "cert.ficticio.pdf"])).toEqual({
      email: "dueno@ejemplo.invalid", fechaCorte: new Date("2024-01-04T00:00:00Z"), fondo: null, archivo: "cert.ficticio.pdf",
    });
    expect(leerArgumentosImportar(["c.PDF", "--fondo", "123456", "--fecha-corte", "2024-01-04", "--email", "d@ejemplo.invalid"])).toMatchObject({ fondo: "123456", archivo: "c.PDF" });
  });

  it("sin fecha de corte no se importa (nunca se infiere)", () => {
    expect(codigo(() => leerArgumentosImportar(["--email", "d@ejemplo.invalid", "c.pdf"]))).toBe("FECHA_CORTE_OBLIGATORIA");
  });

  it("rechaza fechas imposibles, fondos que no son un código de la SFC, correos sin forma, opciones repetidas o desconocidas y archivos que no son PDF", () => {
    const base = ["--email", "d@ejemplo.invalid", "--fecha-corte", "2024-01-04"];
    expect(codigo(() => leerArgumentosImportar([...base.slice(0, 3), "2024-02-30", "c.pdf"]))).toBe("FECHA_CORTE_INVALIDA");
    expect(codigo(() => leerArgumentosImportar([...base, "--fondo", "FIC-1", "c.pdf"]))).toBe("FONDO_INVALIDO");
    expect(codigo(() => leerArgumentosImportar(["--email", "sin-arroba", "--fecha-corte", "2024-01-04", "c.pdf"]))).toBe("EMAIL_INVALIDO");
    expect(codigo(() => leerArgumentosImportar([...base, "--email", "otro@ejemplo.invalid", "c.pdf"]))).toBe("OPCION_REPETIDA");
    expect(codigo(() => leerArgumentosImportar([...base, "--ayuda", "c.pdf"]))).toBe("OPCION_DESCONOCIDA");
    expect(codigo(() => leerArgumentosImportar([...base, "c.csv"]))).toBe("ARCHIVO_NO_PDF");
    expect(codigo(() => leerArgumentosImportar([...base, "a.pdf", "b.pdf"]))).toBe("UN_SOLO_ARCHIVO");
    expect(codigo(() => leerArgumentosImportar([...base, "--fondo"]))).toBe("VALOR_FALTANTE");
  });
});

describe("leerArgumentosConciliar", () => {
  it("lee la fecha de corte; sin ella o con otra opción, rechaza", () => {
    expect(leerArgumentosConciliar(["--fecha-corte", "2024-01-04"])).toEqual({ fechaCorte: new Date("2024-01-04T00:00:00Z") });
    expect(codigo(() => leerArgumentosConciliar([]))).toBe("FECHA_CORTE_OBLIGATORIA");
    expect(codigo(() => leerArgumentosConciliar(["--fecha-corte", "2024-01-04", "x"]))).toBe("ARGUMENTO_DESCONOCIDO");
  });
});

const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test"];
const ENTORNO = entornoMinimo({ DATABASE_URL: INALCANZABLE });

describe("CLI de la certificación como proceso (sin base)", { timeout: 4 * POR_CLI_MS }, () => {
  it("importar-certificacion: --ayuda, sin fecha de corte o con un fondo inválido → 2 con su uso, sin repetir correo ni fondo", () => {
    const uso = "Uso: npx tsx scripts/importar-certificacion.ts --email";
    const s = (args: string[]) => correr("importar-certificacion.ts", args, ENTORNO);
    comprobar(s(["--ayuda"]), 2, uso, NUNCA);
    comprobar(s(["--email", "dueno-cli@ejemplo.invalid", "cert.ficticio.pdf"]), 2, "FECHA_CORTE_OBLIGATORIA", [...NUNCA, "dueno-cli@ejemplo.invalid"]);
    comprobar(s(["--email", "dueno-cli@ejemplo.invalid", "--fecha-corte", "2024-01-04", "--fondo", "FICT-99", "c.pdf"]), 2, "FONDO_INVALIDO", [...NUNCA, "FICT-99", "dueno-cli@ejemplo.invalid"]);
  });

  it("importar-certificacion: un PDF que no existe → 1, sin la ruta completa ni tocar la base", () => {
    const r = correr("importar-certificacion.ts", ["--email", "d@ejemplo.invalid", "--fecha-corte", "2024-01-04", "/no/existe/cert.ficticio.pdf"], ENTORNO);
    comprobar(r, 1, "ARCHIVO_ILEGIBLE", [...NUNCA, "/no/existe"]);
    expect(r.texto).not.toContain("PrismaClient");
  });

  it("conciliar-certificacion: --ayuda o sin fecha → 2 con su uso", () => {
    const uso = "Uso: npx tsx scripts/conciliar-certificacion.ts --fecha-corte";
    comprobar(correr("conciliar-certificacion.ts", ["--ayuda"], ENTORNO), 2, uso, NUNCA);
    comprobar(correr("conciliar-certificacion.ts", [], ENTORNO), 2, "FECHA_CORTE_OBLIGATORIA", NUNCA);
  });
});
