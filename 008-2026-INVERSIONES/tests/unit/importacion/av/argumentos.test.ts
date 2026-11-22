/**
 * Argumentos de los CLI de la certificación (PR-B): `importar-certificacion.ts` y `conciliar-certificacion.ts`.
 * La fecha de corte es obligatoria (el PDF no la trae) y nunca se infiere. Como proceso, con argumentos inválidos
 * salen con 2 y su uso ANTES de tocar la base, sin repetir el correo ni el código del fondo. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { ErrorArgumentosAv, leerArgumentosConciliar, leerArgumentosCorregir, leerArgumentosImportar } from "@/importacion/av/argumentos";
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

// Frente certificacion-corte-real: corregir el corte de una certificación ya cargada. Las dos fechas son
// obligatorias (nunca se infieren) y distintas; el PDF es el mismo archivo que se cargó.
describe("leerArgumentosCorregir", () => {
  const base = ["--email", "d@ejemplo.invalid", "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-12"];

  it("lee correo, las dos fechas y un solo PDF, en cualquier orden", () => {
    expect(leerArgumentosCorregir([...base, "cert.ficticio.pdf"])).toEqual({
      email: "d@ejemplo.invalid", fechaCorte: new Date("2027-07-13T00:00:00Z"), nuevaFechaCorte: new Date("2027-07-12T00:00:00Z"), archivo: "cert.ficticio.pdf",
    });
    expect(leerArgumentosCorregir(["c.PDF", ...base.slice(4), ...base.slice(0, 4)])).toMatchObject({ archivo: "c.PDF" });
  });

  it("las dos fechas son obligatorias, válidas y distintas", () => {
    expect(codigo(() => leerArgumentosCorregir([...base.slice(0, 4), "c.pdf"]))).toBe("NUEVA_FECHA_CORTE_OBLIGATORIA");
    expect(codigo(() => leerArgumentosCorregir([...base.slice(0, 2), ...base.slice(4), "c.pdf"]))).toBe("FECHA_CORTE_OBLIGATORIA");
    expect(codigo(() => leerArgumentosCorregir([...base.slice(0, 5), "2027-02-30", "c.pdf"]))).toBe("NUEVA_FECHA_CORTE_INVALIDA");
    expect(codigo(() => leerArgumentosCorregir([...base.slice(0, 5), "2027-07-13", "c.pdf"]))).toBe("MISMA_FECHA");
  });

  it("rechaza correo sin forma, --fondo (el fondo ya está vinculado), opciones repetidas y lo que no es un PDF", () => {
    expect(codigo(() => leerArgumentosCorregir(["--email", "sin-arroba", ...base.slice(2), "c.pdf"]))).toBe("EMAIL_INVALIDO");
    expect(codigo(() => leerArgumentosCorregir([...base, "--fondo", "4613707", "c.pdf"]))).toBe("OPCION_DESCONOCIDA");
    expect(codigo(() => leerArgumentosCorregir([...base, "--fecha-corte", "2027-07-14", "c.pdf"]))).toBe("OPCION_REPETIDA");
    expect(codigo(() => leerArgumentosCorregir([...base, "c.csv"]))).toBe("ARCHIVO_NO_PDF");
    expect(codigo(() => leerArgumentosCorregir(base))).toBe("ARCHIVO_FALTANTE");
  });
});

describe("corregir-corte-certificacion como proceso: argumentos inválidos", { timeout: 3 * POR_CLI_MS }, () => {
  it("sale con 2 y su uso, sin repetir el correo y sin tocar la base", () => {
    const correo = "dueno-37911@ejemplo.invalid";
    const s = correr("corregir-corte-certificacion.ts", ["--email", correo, "--fecha-corte", "2027-07-13", "--nueva-fecha-corte", "2027-07-13", "c.pdf"], entornoMinimo({ DATABASE_URL: "postgresql://nadie@127.0.0.1:1/nada_test" }));
    comprobar(s, 2, "MISMA_FECHA", [correo]);
    expect(s.texto).toContain("Uso: npx tsx scripts/corregir-corte-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD --nueva-fecha-corte AAAA-MM-DD <certificacion.pdf>");
  });
});
