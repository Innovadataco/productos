// Fuzz del lector del SDMX de BanRep (determinista, con semilla fija): con bytes mutados al azar de los mensajes
// ficticios de la TPM y de la IBR, solo lee o falla con un código del conjunto cerrado. Nunca lanza, nunca sale
// BANREP_ERROR_INTERNO (escondería un defecto) y nada de la entrada llega al código ni al detalle.
import { describe, expect, it } from "vitest";
import { serieBanrep } from "@/datos-oficiales/fuentes/banrep-series";
import { leerSdmxBanrep } from "@/datos-oficiales/fuentes/banrep-sdmx";
import { azar, entero } from "../lib/fixtures/azar";
import { MARCA, MENSAJE_IBR, MENSAJE_TPM, bytesDe, utf8 } from "./banrep.ficticio";

const CODIGOS = new Set([
  "BANREP_BLOQUEADO", "BANREP_XML", "BANREP_ERROR_SDMX", "BANREP_NO_SDMX", "BANREP_OTRO_DATAFLOW", "BANREP_TRUNCADO", "BANREP_SERIE_AUSENTE",
  "BANREP_SERIE_REPETIDA", "BANREP_SERIE_DISTINTA", "BANREP_UNIDAD_DUDOSA", "BANREP_OBS_INVALIDA", "BANREP_AMBIGUO",
]);
const DETALLE = /^(HTML|XML_[A-Z0-9_]+|[0-9]{1,4})$/;
const DESDE = new Date(Date.UTC(2027, 2, 1));
const HASTA = new Date(Date.UTC(2027, 2, 31));

type Mutacion = (b: Uint8Array, r: () => number) => Uint8Array;
const pos = (b: Uint8Array, r: () => number) => entero(r, b.length + 1);
const MUTACIONES: readonly Mutacion[] = [
  (b, r) => b.map((v) => (r() < 0.003 ? v ^ (1 << entero(r, 8)) : v)),
  (b, r) => b.subarray(0, pos(b, r)),
  (b, r) => {
    const i = pos(b, r);
    return Uint8Array.from([...b.subarray(0, i), ...Array.from({ length: 1 + entero(r, 12) }, () => entero(r, 256)), ...b.subarray(i)]);
  },
  (b, r) => {
    const [i, j] = [pos(b, r), pos(b, r)].sort((x, y) => x - y) as [number, number];
    return Uint8Array.from([...b.subarray(0, j), ...b.subarray(i, j), ...b.subarray(j)]);
  },
  (b, r) => {
    const piezas = utf8(`<>&;"'=/!?:-# 0123456789.${MARCA}`);
    const copia = b.slice();
    for (let k = 0; k < 4; k += 1) copia[entero(r, b.length)] = piezas[entero(r, piezas.length)]!;
    return copia;
  },
];

describe("fuzz del lector del SDMX de BanRep", () => {
  for (const [nombre, mensaje, codigo, semilla] of [["TPM", MENSAJE_TPM, "TPM", 4613], ["IBR", MENSAJE_IBR, "IBR_3M_EA", 3779]] as const) {
    it(`${nombre}: mutaciones al azar solo leen o fallan con un código propio`, { timeout: 60_000 }, () => {
      const serie = serieBanrep(codigo)!;
      const base = bytesDe(mensaje);
      const r = azar(semilla);
      const vistos = { leido: 0, rechazado: 0 };
      for (let k = 0; k < 1237; k += 1) {
        const resultado = leerSdmxBanrep(MUTACIONES[k % MUTACIONES.length]!(base, r), serie, DESDE, HASTA);
        if (resultado.ok) {
          vistos.leido += 1;
          continue;
        }
        vistos.rechazado += 1;
        expect(CODIGOS.has(resultado.codigo), resultado.codigo).toBe(true);
        if (resultado.detalle !== null) expect(resultado.detalle).toMatch(DETALLE);
        expect(JSON.stringify(resultado)).not.toContain(MARCA);
      }
      expect(vistos.leido).toBeGreaterThan(0);
      expect(vistos.rechazado).toBeGreaterThan(0);
    });
  }
});
