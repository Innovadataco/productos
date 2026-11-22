// Frescura de una serie oficial (fase C, C5a; src/datos-oficiales/series/frescura.ts), pura: AL_DIA, ATRASADA o
// SIN_DATOS con el umbral del catálogo (`umbralFrescuraDias`: «a partir de» esos días desde el `hasta` del último
// vigente, ATRASADA). `cubreHoy` dice si el último vale HOY (desde ≤ hoy ≤ hasta): una serie al día cuyo último valor es
// de ayer no es «la de hoy» (nunca se muestra un dato viejo como si fuera de hoy). Fechas de 2027; cifras inventadas.
import { describe, expect, it } from "vitest";
import { CATALOGO, serieDelCatalogo, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import { ErrorLecturaSeries, type CifraOficial } from "@/datos-oficiales/series/consulta";
import { frescura } from "@/datos-oficiales/series/frescura";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

const cifra = (serie: string, desde: string, hasta: string, o: Partial<CifraOficial> = {}): CifraOficial => ({
  serie, valor: "4613.27", unidad: serieDelCatalogo(serie)?.unidad ?? "unidad ficticia", desde: dia(desde), hasta: dia(hasta),
  fuente: serieDelCatalogo(serie)?.fuente ?? "sfc:ficticia", traidoEn: new Date("2027-03-04T15:13:07Z"), origen: "OFICIAL", ...o,
});

const codigoDe = (f: () => unknown): string | null => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof ErrorLecturaSeries ? e.codigo : `otro: ${String(e)}`;
  }
};

describe("frescura · umbrales del catálogo", () => {
  it("sin datos: SIN_DATOS, sin días y sin cubrir hoy, con el umbral de la serie", () => {
    expect(frescura("TRM", null, dia("2027-03-09"))).toEqual({ estado: "SIN_DATOS", dias: null, umbralDias: 3, cubreHoy: false });
    expect(frescura("IPC_INDICE", null, dia("2027-03-09")).umbralDias).toBe(45);
  });

  it("el umbral de cada serie es el del catálogo (TRM 3, TPM e IBR 7, IPC 45)", () => {
    for (const s of CATALOGO) expect(frescura(s.codigo, null, dia("2027-03-09")).umbralDias, s.codigo).toBe(s.umbralFrescuraDias);
    expect(CATALOGO.map((s) => [s.codigo, s.umbralFrescuraDias])).toEqual([["TRM", 3], ["TPM", 7], ["IBR_3M_EA", 7], ["IPC_INDICE", 45]]);
  });

  it("TRM: un día antes del umbral AL_DIA; en el umbral, ATRASADA (a partir de); el de ayer no cubre hoy", () => {
    expect(frescura("TRM", cifra("TRM", "2027-03-06", "2027-03-06"), dia("2027-03-08"))).toEqual({ estado: "AL_DIA", dias: 2, umbralDias: 3, cubreHoy: false });
    expect(frescura("TRM", cifra("TRM", "2027-03-05", "2027-03-05"), dia("2027-03-08"))).toEqual({ estado: "ATRASADA", dias: 3, umbralDias: 3, cubreHoy: false });
    expect(frescura("TRM", cifra("TRM", "2027-03-07", "2027-03-07"), dia("2027-03-08"))).toEqual({ estado: "AL_DIA", dias: 1, umbralDias: 3, cubreHoy: false });
  });

  it("TRM de fin de semana (TRAMO): mientras su vigencia corre, AL_DIA con 0 días y cubre hoy; el día después, no", () => {
    const finDeSemana = cifra("TRM", "2027-03-06", "2027-03-08");
    for (const hoy of ["2027-03-06", "2027-03-07", "2027-03-08"]) expect(frescura("TRM", finDeSemana, dia(hoy)), hoy).toEqual({ estado: "AL_DIA", dias: 0, umbralDias: 3, cubreHoy: true });
    expect(frescura("TRM", finDeSemana, dia("2027-03-09"))).toEqual({ estado: "AL_DIA", dias: 1, umbralDias: 3, cubreHoy: false });
    expect(frescura("TRM", finDeSemana, dia("2027-03-11")).estado).toBe("ATRASADA");
  });

  it("TPM e IBR: 6 días AL_DIA, 7 ATRASADA", () => {
    for (const codigo of ["TPM", "IBR_3M_EA"]) {
      expect(frescura(codigo, cifra(codigo, "2027-03-02", "2027-03-02"), dia("2027-03-08")).estado, codigo).toBe("AL_DIA");
      expect(frescura(codigo, cifra(codigo, "2027-03-01", "2027-03-01"), dia("2027-03-08")), codigo).toEqual({ estado: "ATRASADA", dias: 7, umbralDias: 7, cubreHoy: false });
    }
  });

  it("IPC: 44 días después del fin del mes AL_DIA, 45 ATRASADA; el mes nunca cubre hoy (se publica cerrado)", () => {
    const marzo = cifra("IPC_INDICE", "2027-03-01", "2027-03-31");
    expect(frescura("IPC_INDICE", marzo, dia("2027-05-14"))).toEqual({ estado: "AL_DIA", dias: 44, umbralDias: 45, cubreHoy: false });
    expect(frescura("IPC_INDICE", marzo, dia("2027-05-15"))).toEqual({ estado: "ATRASADA", dias: 45, umbralDias: 45, cubreHoy: false });
  });

  it("un catálogo inyectado manda su umbral (las pruebas de integración usan series ficticias)", () => {
    const ficticia: SerieCatalogo = { ...serieDelCatalogo("TPM")!, codigo: "FICTA", umbralFrescuraDias: 11 };
    expect(frescura("FICTA", cifra("FICTA", "2027-03-01", "2027-03-01"), dia("2027-03-11"), [ficticia]).estado).toBe("AL_DIA");
    expect(frescura("FICTA", cifra("FICTA", "2027-03-01", "2027-03-01"), dia("2027-03-12"), [ficticia])).toEqual({ estado: "ATRASADA", dias: 11, umbralDias: 11, cubreHoy: false });
    expect(codigoDe(() => frescura("TRM", null, dia("2027-03-12"), [ficticia]))).toBe("SERIE_DESCONOCIDA");
  });

  it("queda congelada", () => {
    expect(Object.isFrozen(frescura("TRM", null, dia("2027-03-09")))).toBe(true);
    expect(Object.isFrozen(frescura("TRM", cifra("TRM", "2027-03-06", "2027-03-06"), dia("2027-03-09")))).toBe(true);
  });
});

describe("frescura · errores tipados (nunca adivina)", () => {
  it("serie fuera del catálogo, hoy que no es un día (medianoche UTC) o inválido", () => {
    expect(codigoDe(() => frescura("UVR", null, dia("2027-03-09")))).toBe("SERIE_DESCONOCIDA");
    expect(codigoDe(() => frescura("TRM", null, new Date("2027-03-09T05:00:00Z")))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => frescura("TRM", null, new Date("x")))).toBe("FECHA_INVALIDA");
  });

  it("el último de otra serie, uno CALCULADO, uno con fechas inválidas o uno que todavía no empieza (la TRM de mañana no es la de hoy)", () => {
    expect(codigoDe(() => frescura("TRM", cifra("TPM", "2027-03-06", "2027-03-06"), dia("2027-03-08")))).toBe("OTRA_SERIE");
    expect(codigoDe(() => frescura("IPC_INDICE", cifra("IPC_INDICE", "2027-01-01", "2027-03-31", { origen: "CALCULADA" }), dia("2027-04-12")))).toBe("NO_ES_OFICIAL");
    expect(codigoDe(() => frescura("TRM", cifra("TRM", "2027-03-06", "2027-03-06", { hasta: new Date("x") }), dia("2027-03-08")))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => frescura("TRM", cifra("TRM", "2027-03-06", "2027-03-06", { desde: new Date("2027-03-06T12:00:00Z") }), dia("2027-03-08")))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => frescura("TRM", cifra("TRM", "2027-03-09", "2027-03-11"), dia("2027-03-08")))).toBe("VIGENCIA_FUTURA");
  });
});
