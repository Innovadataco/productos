/**
 * Lo que dice el CLI de corrección del corte (frente certificacion-corte-real): qué se retiró y qué quedó, cuántos
 * cierres re-verificó en cada día y el siguiente paso (conciliar el corte nuevo), en local o en producción (vía B).
 * Si se rechaza, el código y por qué, y que nada cambió. Nunca cifras, especies ni el correo. Fechas de 2027.
 */
import { describe, expect, it } from "vitest";
import type { ResultadoCorreccion } from "@/importacion/av/corregir";
import { lineasDeCorreccion } from "@/importacion/av/salida";

const D = "2027-07-13";
const NUEVA = "2027-07-12";
const corregida: ResultadoCorreccion = {
  estado: "CORREGIDO", codigo: null, pistaCorte: null, retiradaId: "r1", nuevaId: "n1", cargaId: "c9", filas: 6, cargasRevertidas: 2,
  reverificados: { anterior: 7, nuevo: 9 },
};
const rechazo = (codigo: string, extra: Partial<ResultadoCorreccion> = {}): ResultadoCorreccion => ({
  estado: "RECHAZADO", codigo, pistaCorte: null, retiradaId: null, nuevaId: null, cargaId: "c7", filas: 0, cargasRevertidas: 0, reverificados: { anterior: 0, nuevo: 0 }, ...extra,
});

describe("lineasDeCorreccion", () => {
  it("corregida: qué se retiró, qué quedó, los cierres re-verificados de cada día y el siguiente paso (local)", () => {
    const texto = lineasDeCorreccion(corregida, D, NUEVA, false).join("\n");
    expect(texto).toContain(`✅ CORREGIDO · la certificación del ${D} se retiró y quedó cargada con el corte ${NUEVA} (6 filas; 2 carga(s) del ${D} en REVERTIDO)`);
    expect(texto).toContain(`7 del ${D} (quedan sin referencia) y 9 del ${NUEVA} (contra la certificación)`);
    expect(texto).toContain(`\`npx tsx scripts/conciliar-certificacion.ts --fecha-corte ${NUEVA}\``);
  });

  it("corregida en producción: el siguiente paso por cargar-prod.sh conciliar-certificacion", () => {
    const texto = lineasDeCorreccion(corregida, D, NUEVA, true).join("\n");
    expect(texto).toContain(`\`cargar-prod.sh conciliar-certificacion\` con la cabecera \`--fecha-corte ${NUEVA}\``);
    expect(texto).not.toContain("npx tsx");
  });

  it("rechazada: el código, por qué y que nada cambió", () => {
    const casos: Array<[string, string]> = [
      ["SIN_CERTIFICACION", `No hay certificación con el corte ${D}`],
      ["CORTE_RETIRADO", `La certificación del ${D} ya se retiró`],
      ["ARCHIVO_DISTINTO", `no es el mismo archivo que se cargó con el corte ${D}`],
      ["CORTE_OCUPADO", `Ya hay una certificación con el corte ${NUEVA}`],
    ];
    for (const [codigo, frase] of casos) {
      const texto = lineasDeCorreccion(rechazo(codigo), D, NUEVA, false).join("\n");
      expect(texto, codigo).toContain(`❌ RECHAZADO (nada cambió) · ${codigo}`);
      expect(texto, codigo).toContain(frase);
    }
  });

  it("rechazada porque el corte nuevo tampoco es el real: sugiere el día y el comando de corrección con ese día", () => {
    const texto = lineasDeCorreccion(rechazo("CORTE_NO_COINCIDE", { pistaCorte: { tipo: "PRECIOS", sugerido: "2027-07-09", especies: 3, distintas: 2 } }), D, NUEVA, false).join("\n");
    expect(texto).toContain("cuadran (±1 %) con los cierres del 2027-07-09");
    expect(texto).toContain(`--fecha-corte ${D} --nueva-fecha-corte 2027-07-09`);
  });
});
