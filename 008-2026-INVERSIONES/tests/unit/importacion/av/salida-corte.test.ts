/**
 * Lo que dice el CLI cuando la fecha de corte no coincide con el corte real de la certificación (frente
 * certificacion-corte-real): el día que sugiere y el comando exacto para repetir, en local y en producción (vía B).
 * Si el mismo PDF ya está cargado con otro corte, no manda a reimportar (daría ARCHIVO_YA_CARGADO): manda al camino
 * de corrección. Nunca reimporta ni corrige por su cuenta; nunca imprime cifras, especies ni el correo.
 * Fechas inventadas de 2027 (y 2021, sin sembrar).
 */
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ArchivoCertificacion, PistaCorte, ResultadoImportacionAv } from "@/importacion/av/importar";
import { cargarYConciliar, type Pasos } from "@/importacion/av/salida";

const db = {} as PrismaClient;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const cot = (s: string, hhmm: string) => new Date(`${s}T${hhmm}:00-05:00`);
const entrada = (corte: string): ArchivoCertificacion => ({ contenido: new Uint8Array([37, 80, 68, 70]), usuarioId: "u", fechaCorte: dia(corte), fondoCodigo: "4613707", hoy: dia("2027-08-20") });

function rechazo(codigo: string, pistaCorte: PistaCorte | null, yaCargadaEn: string | null = null): ResultadoImportacionAv {
  return {
    cargaId: "c1", estado: "RECHAZADO", repetida: false, certificacionId: null, filasTotal: 6, filasNuevas: 0, filasRepetidas: 0, instrumentosCreados: 0, fondoVinculado: false,
    errores: [{ pagina: 0, fila: 0, columna: null, codigo }], pistaCorte, yaCargadaEn,
  };
}

/** Pasos falsos: importar devuelve el rechazo; conciliar y el calendario no se deben llamar. */
function pasos(r: ResultadoImportacionAv) {
  const llamadas = { conciliar: 0, calendario: 0 };
  const p: Pasos = {
    importar: async () => r,
    conciliar: async () => ((llamadas.conciliar += 1), Promise.reject(new Error("no debía conciliar"))),
    calendario: async () => ((llamadas.calendario += 1), Promise.reject(new Error("no debía leer el calendario"))),
  };
  return { p, llamadas };
}

const PDF_ANTES = { tipo: "PDF", generadoEn: cot("2027-08-04", "14:35"), sugerido: { ok: true, dia: "2027-08-03" } } as const;

describe("cargarYConciliar · el PDF se generó antes del cierre definitivo del día pedido", () => {
  it("1, dice la hora de creación, el día que sugiere y el comando local para repetir; no concilia ni lee el calendario", async () => {
    const { p, llamadas } = pasos(rechazo("FECHA_CORTE_ANTES_DEL_CIERRE", PDF_ANTES));
    const r = await cargarYConciliar(db, entrada("2027-08-04"), p);
    const texto = r.lineas.join("\n");
    expect(r.codigo).toBe(1);
    expect(texto).toContain("página 0 · fila 0 · FECHA_CORTE_ANTES_DEL_CIERRE");
    expect(texto).toContain("El PDF se generó el 2027-08-04 a las 14:35 (hora de Colombia), antes de que el cierre de ese día fuera definitivo (17:00)");
    expect(texto).toContain("Según calendario_bvc, el último día hábil con el cierre ya definitivo a esa hora es 2027-08-03.");
    expect(texto).toContain("`npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte 2027-08-03 [--fondo <codigoFic>] <certificacion.pdf>`");
    expect(texto).not.toContain("corregir-corte-certificacion");
    expect(texto, "el código del fondo no se repite").not.toContain("4613707");
    expect(llamadas).toEqual({ conciliar: 0, calendario: 0 });
  });

  it("en producción: por cargar-prod.sh importar-certificacion con la fecha en la cabecera; nunca npx tsx", async () => {
    const { p } = pasos(rechazo("FECHA_CORTE_ANTES_DEL_CIERRE", PDF_ANTES));
    const texto = (await cargarYConciliar(db, entrada("2027-08-04"), p, { produccion: true })).lineas.join("\n");
    expect(texto).toContain("`cargar-prod.sh importar-certificacion` con el mismo PDF y, en la cabecera, `--fecha-corte 2027-08-03`");
    expect(texto).not.toContain("npx tsx");
  });

  it("si el mismo PDF ya está cargado con otro corte: no manda a reimportar, manda a corregir el corte (local)", async () => {
    const { p } = pasos(rechazo("FECHA_CORTE_ANTES_DEL_CIERRE", PDF_ANTES, "2027-08-04"));
    const texto = (await cargarYConciliar(db, entrada("2027-08-04"), p)).lineas.join("\n");
    expect(texto).toContain("Ese PDF ya está cargado con el corte 2027-08-04");
    expect(texto).toContain("`npx tsx scripts/corregir-corte-certificacion.ts --email <correo-del-dueño> --fecha-corte 2027-08-04 --nueva-fecha-corte 2027-08-03 <certificacion.pdf>`");
    expect(texto).not.toContain("scripts/importar-certificacion.ts --email");
  });

  it("si el mismo PDF ya está cargado, en producción: cargar-prod.sh corregir-corte-certificacion con las dos fechas en la cabecera", async () => {
    const { p } = pasos(rechazo("FECHA_CORTE_ANTES_DEL_CIERRE", PDF_ANTES, "2027-08-04"));
    const texto = (await cargarYConciliar(db, entrada("2027-08-04"), p, { produccion: true })).lineas.join("\n");
    expect(texto).toContain("`cargar-prod.sh corregir-corte-certificacion` con el mismo PDF y, en la cabecera, `--fecha-corte 2027-08-04` y `--nueva-fecha-corte 2027-08-03`");
    expect(texto).not.toContain("npx tsx");
  });
});

describe("cargarYConciliar · la fecha pedida es posterior al día de creación del PDF", () => {
  it("lo dice con la fecha y la hora de creación y sugiere el día con cierre definitivo a esa hora", async () => {
    const pista = { tipo: "PDF", generadoEn: cot("2027-08-04", "18:02"), sugerido: { ok: true, dia: "2027-08-04" } } as const;
    const { p } = pasos(rechazo("FECHA_CORTE_POSTERIOR_AL_PDF", pista));
    const r = await cargarYConciliar(db, entrada("2027-08-05"), p);
    const texto = r.lineas.join("\n");
    expect(r.codigo).toBe(1);
    expect(texto).toContain("La fecha de corte 2027-08-05 es posterior al día en que se generó el PDF (2027-08-04 a las 18:02, hora de Colombia)");
    expect(texto).toContain("el último día hábil con el cierre ya definitivo a esa hora es 2027-08-04.");
    expect(texto).toContain("--fecha-corte 2027-08-04 [--fondo <codigoFic>] <certificacion.pdf>");
  });

  it("si el día que toca es de un año sin calendario: lo dice y no da fecha ni comando", async () => {
    const pista = { tipo: "PDF", generadoEn: cot("2021-06-14", "11:23"), sugerido: { ok: false, anioSinCalendario: 2021 } } as const;
    const { p } = pasos(rechazo("FECHA_CORTE_POSTERIOR_AL_PDF", pista));
    const texto = (await cargarYConciliar(db, entrada("2021-06-15"), p)).lineas.join("\n");
    expect(texto).toContain("calendario_bvc no cubre 2021: no se puede indicar el día; hay que sembrar ese año.");
    expect(texto).not.toContain("--fecha-corte 2021");
  });

  it("sin pista (un resultado que no la trae) no inventa día ni comando", async () => {
    const { p } = pasos(rechazo("FECHA_CORTE_POSTERIOR_AL_PDF", null));
    const texto = (await cargarYConciliar(db, entrada("2027-08-05"), p)).lineas.join("\n");
    expect([texto.includes("📅"), texto.includes("--fecha-corte")]).toEqual([false, false]);
  });
});
