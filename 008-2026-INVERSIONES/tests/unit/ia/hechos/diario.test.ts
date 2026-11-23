/**
 * Armador DIARIO: del tablero (calcularTablero), del movimiento del día, del último corte de la conciliación, de las
 * series oficiales y del fondo, un PaqueteHechos armado con construirPaquete. Puro: `hoy` entra como parámetro.
 * Cada valor es la forma canónica de su cifra fuente y cada presentación, la de `presentar`.
 */
import { describe, expect, it } from "vitest";
import type { Hecho } from "@/ia/contrato";
import { armarDiario, type EntradaArmadoDiario } from "@/ia/hechos";
import { ErrorArmado } from "@/ia/hechos/errores";
import { esPaqueteConstruido } from "@/ia/paquete";
import { presentar } from "@/ia/presentar";
import { vistaCiega } from "@/ia/vista-ciega";
import { FUENTE_SFC } from "@/fondo/sfc";
import { FUENTES } from "@/ia/hechos";
import { ALFA, BETA, D, HOY, dia, entradaDiarioFicticia, filasTablero, fuenteDe } from "./apoyo.ficticio";

type Fila = readonly [string, string, string | null, string, string, string, string, boolean];
/** [clave, valor, especie del sujeto, fecha, calidad, dirección, frescura, obligatorio] */
function filas(hechos: readonly Hecho[]): Fila[] {
  const nombreDe = (id: string | undefined): string | null => (id === undefined ? null : (hechos.find((h) => h.id === id)?.valor ?? "?"));
  return hechos.map((h) => [h.clave, h.valor, nombreDe(h.sujeto), h.fecha, h.calidad, h.direccion, h.frescura, h.obligatorio]);
}

describe("armarDiario · el paquete del tablero", () => {
  it("arma los hechos del portafolio, la conciliación, las series, el fondo y cada especie, en ese orden", () => {
    const paquete = armarDiario(entradaDiarioFicticia());
    expect(esPaqueteConstruido(paquete)).toBe(true);
    expect(paquete.tipo).toBe("DIARIO");
    expect(paquete.hoy).toBe(HOY);
    expect(paquete.versionesCalculo).toEqual({ hechos: "armadores-v1" });
    expect(paquete.avisos).toEqual([]);
    expect(filas(paquete.hechos)).toEqual([
      ["VALOR_ACCIONES", "37911.47", null, "2027-03-16", "CALCULADO", "BAJA", "RECIENTE", true],
      ["GANANCIA_SIN_VENDER", "1237.53", null, "2027-03-16", "CALCULADO", "SUBE", "RECIENTE", false],
      ["GANANCIA_POR_VENTAS", "-417.29", null, "2027-03-16", "CALCULADO", "BAJA", "RECIENTE", false],
      ["DIVIDENDOS_RECIBIDOS", "613.71", null, "2027-03-16", "CALCULADO", "NO_APLICA", "RECIENTE", false],
      ["COMISIONES_PAGADAS", "97.13", null, "2027-03-16", "CALCULADO", "NO_APLICA", "RECIENTE", false],
      ["GANANCIA_TOTAL", "1336.82", null, "2027-03-16", "CALCULADO", "SUBE", "RECIENTE", true],
      ["VARIACION_DIA_VALOR", "-211.37", null, "2027-03-16", "CALCULADO", "BAJA", "RECIENTE", true],
      ["ESPECIES_ATRASADAS", "1", null, "2027-03-16", "CALCULADO", "NO_APLICA", "RECIENTE", false],
      ["FECHA_CIERRE_RECIENTE", "2027-03-16", null, "2027-03-16", "CALCULADO", "NO_APLICA", "RECIENTE", false],
      ["FECHA_CIERRE_MAS_ANTIGUO", "2027-03-15", null, "2027-03-15", "ATRASADO", "NO_APLICA", "ATRASADO", false],
      ["CONCILIACION_PARCIAL", "2027-02-26", null, "2027-02-26", "ATRASADO", "NO_APLICA", "ATRASADO", false],
      ["TASA_TRM", "4137.19", null, "2027-03-17", "VERIFICADO", "SUBE", "HOY", false],
      ["TASA_TPM", "9.13", null, "2027-03-16", "VERIFICADO", "NO_APLICA", "RECIENTE", false],
      ["VARIACION_ANUAL_IPC", "4.3", null, "2027-02-28", "ATRASADO", "SUBE", "ATRASADO", false],
      ["FONDO_VALOR_UNIDAD", "13711.293847", null, "2027-03-15", "VERIFICADO", "SUBE", "RECIENTE", false],
      ["FONDO_FECHA_VALOR", "2027-03-15", null, "2027-03-15", "VERIFICADO", "NO_APLICA", "RECIENTE", false],
      ["ESPECIE_NOMBRE", ALFA, null, HOY, "VERIFICADO", "NO_APLICA", "HOY", false],
      ["VALOR_ESPECIE", "23417.83", ALFA, "2027-03-16", "CALCULADO", "BAJA", "RECIENTE", false],
      ["PESO_ESPECIE", "61.7731", ALFA, "2027-03-16", "CALCULADO", "NO_APLICA", "RECIENTE", false],
      ["RENTABILIDAD_ESPECIE", "8.4127", ALFA, "2027-03-16", "CALCULADO", "SUBE", "RECIENTE", false],
      ["CIERRE_ESPECIE", "4613.27", ALFA, "2027-03-16", "VERIFICADO", "BAJA", "RECIENTE", false],
      ["VARIACION_DIA_ESPECIE", "-0.8931", ALFA, "2027-03-16", "CALCULADO", "BAJA", "RECIENTE", false],
      ["ESPECIE_NOMBRE", BETA, null, HOY, "VERIFICADO", "NO_APLICA", "HOY", false],
      ["VALOR_ESPECIE", "14493.64", BETA, "2027-03-15", "ATRASADO", "NO_APLICA", "ATRASADO", false],
      ["PESO_ESPECIE", "38.2269", BETA, "2027-03-15", "ATRASADO", "NO_APLICA", "ATRASADO", false],
      ["RENTABILIDAD_ESPECIE", "-3.1907", BETA, "2027-03-15", "ATRASADO", "BAJA", "ATRASADO", false],
      ["CIERRE_ESPECIE", "2713.9", BETA, "2027-03-15", "ATRASADO", "NO_APLICA", "ATRASADO", false],
      ["FECHA_CIERRE_ESPECIE", "2027-03-15", BETA, "2027-03-15", "ATRASADO", "NO_APLICA", "ATRASADO", false],
    ]);
  });

  it("cada presentación es la de presentar y cada fuente es la del dato", () => {
    const paquete = armarDiario(entradaDiarioFicticia());
    for (const h of paquete.hechos) expect(h.presentacion, h.id).toBe(presentar(h.valor, h.unidad));
    const fuentes = new Map(paquete.hechos.map((h) => [h.clave, h.fuente]));
    expect(fuentes.get("TASA_TRM")).toBe(fuenteDe("TRM"));
    expect(fuentes.get("VARIACION_ANUAL_IPC")).toBe(fuenteDe("IPC_INDICE"));
    expect(fuentes.get("FONDO_VALOR_UNIDAD")).toBe(FUENTE_SFC);
    expect(fuentes.get("CIERRE_ESPECIE")).toBe("cierres de la BVC");
    expect(fuentes.get("VALOR_ACCIONES")).toBe("cálculo de 008 sobre los cierres");
  });

  it("la fuente del fondo es la constante de la SFC, no un texto de quien llama", () => {
    expect(FUENTES.FONDO).toBe(FUENTE_SFC);
  });

  it("la vista ciega del paquete pasa la guarda", () => {
    expect(() => vistaCiega(armarDiario(entradaDiarioFicticia()))).not.toThrow();
  });

  it("la misma entrada da el mismo paquete (mismo hash)", () => {
    expect(armarDiario(entradaDiarioFicticia()).hash).toBe(armarDiario(entradaDiarioFicticia()).hash);
  });

  it("no toca la entrada", () => {
    const entrada = entradaDiarioFicticia();
    const antes = JSON.stringify(entrada, (_k, v: unknown) => (typeof v === "bigint" ? `${v}n` : v));
    armarDiario(entrada);
    expect(JSON.stringify(entrada, (_k, v: unknown) => (typeof v === "bigint" ? `${v}n` : v))).toBe(antes);
  });
});

describe("armarDiario · lo que falta se dice en los avisos, sin inventar", () => {
  const con = (cambio: (e: EntradaArmadoDiario) => EntradaArmadoDiario) => armarDiario(cambio(entradaDiarioFicticia()));
  const claves = (p: { readonly hechos: readonly Hecho[] }) => p.hechos.map((h) => h.clave);

  it("sin comparación del día: el valor de las acciones va sin dirección, no hay variación y el aviso dice por qué", () => {
    const paquete = con((e) => ({ ...e, movimiento: { neto: null, motivo: "SIN_RUEDA_PREVIA", especies: [] } }));
    expect(paquete.avisos).toEqual(["MOVIMIENTO_SIN_RUEDA_PREVIA"]);
    expect(claves(paquete)).not.toContain("VARIACION_DIA_VALOR");
    expect(claves(paquete)).not.toContain("VARIACION_DIA_ESPECIE");
    expect(paquete.hechos.find((h) => h.clave === "VALOR_ACCIONES")?.direccion).toBe("NO_APLICA");
    expect(paquete.hechos.find((h) => h.clave === "CIERRE_ESPECIE")?.direccion).toBe("NO_APLICA");
  });

  it("sin cierres no hay hechos del portafolio ni de especies, y el aviso lo dice", () => {
    const paquete = con((e) => ({ ...e, tablero: { ...e.tablero, filas: [], fechaReferencia: null, cierreMasViejo: null }, movimiento: { neto: null, motivo: "SIN_CIERRES", especies: [] } }));
    expect(paquete.avisos).toEqual(["SIN_CIERRES", "MOVIMIENTO_SIN_CIERRES"]);
    expect(claves(paquete)).toEqual(["CONCILIACION_PARCIAL", "TASA_TRM", "TASA_TPM", "VARIACION_ANUAL_IPC", "FONDO_VALOR_UNIDAD", "FONDO_FECHA_VALOR"]);
  });

  it("la conciliación todavía sin calcular, o sin ningún corte, es un aviso y no un hecho", () => {
    expect(con((e) => ({ ...e, conciliacion: { fechaCorte: dia("2027-02-26"), resultado: null } })).avisos).toEqual(["CONCILIACION_PENDIENTE"]);
    const sinCorte = con((e) => ({ ...e, conciliacion: null }));
    expect(sinCorte.avisos).toEqual(["CONCILIACION_SIN_CORTE"]);
    expect(claves(sinCorte).some((c) => c.startsWith("CONCILIACION_"))).toBe(false);
  });

  it("un corte que no cuadra es obligatorio", () => {
    const paquete = con((e) => ({ ...e, conciliacion: { fechaCorte: dia("2027-02-26"), resultado: "NO_CUADRA" } }));
    expect(paquete.hechos.find((h) => h.clave === "CONCILIACION_NO_CUADRA")?.obligatorio).toBe(true);
  });

  it("una serie sin datos no da hecho; el fondo atrasado es ATRASADO; sin fondo, nada del fondo", () => {
    const paquete = con((e) => ({
      ...e,
      series: e.series.map((s) => (s.cifra.serie === "TPM" ? { ...s, frescura: { estado: "SIN_DATOS", cubreHoy: false } } : s)),
      fondo: e.fondo === null ? null : { ...e.fondo, atrasado: true },
    }));
    expect(claves(paquete)).not.toContain("TASA_TPM");
    expect(paquete.hechos.find((h) => h.clave === "FONDO_VALOR_UNIDAD")).toMatchObject({ frescura: "ATRASADO", calidad: "ATRASADO" });
    expect(claves(con((e) => ({ ...e, fondo: null }))).some((c) => c.startsWith("FONDO_"))).toBe(false);
  });

  it("el valor del fondo entra solo si quien llama lo calculó", () => {
    const paquete = con((e) => ({ ...e, fondo: e.fondo === null ? null : { ...e.fondo, valor: D("10356.4517") } }));
    expect(paquete.hechos.find((h) => h.clave === "FONDO_VALOR")).toMatchObject({ valor: "10356.4517", calidad: "CALCULADO", direccion: "NO_APLICA" });
  });

  it("las especies sin precio cuentan (ya no son obligatorias: OBLIGATORIOS_DIARIO); una especie sin cierre no tiene hechos propios", () => {
    const [alfa] = filasTablero();
    const sinCierre = { ...alfa, nemotecnico: "FICTICIA-SIN-CIERRE", instrumentoId: "inst-ficticio-sin-cierre", valor: null, pesoPct: null, rentabilidadPct: null, cierre: null };
    const paquete = con((e) => ({ ...e, tablero: { ...e.tablero, filas: [...e.tablero.filas, sinCierre], especiesSinPrecio: 1 } }));
    expect(paquete.hechos.find((h) => h.clave === "ESPECIES_SIN_PRECIO")).toMatchObject({ valor: "1", obligatorio: false });
    expect(paquete.hechos.some((h) => h.valor === "FICTICIA-SIN-CIERRE")).toBe(false);
  });

  it("sin el valor de unidad anterior, el fondo va sin dirección; una especie sin costo, sin rentabilidad; sin el más viejo, sin su fecha", () => {
    const [alfa] = filasTablero();
    const paquete = con((e) => ({
      ...e,
      fondo: e.fondo === null ? null : { ...e.fondo, valorUnidadAnterior: null },
      tablero: { ...e.tablero, filas: [{ ...alfa!, pesoPct: null, rentabilidadPct: null }], cierreMasViejo: null },
    }));
    expect(paquete.hechos.find((h) => h.clave === "FONDO_VALOR_UNIDAD")?.direccion).toBe("NO_APLICA");
    const claves = paquete.hechos.map((h) => h.clave);
    for (const clave of ["PESO_ESPECIE", "RENTABILIDAD_ESPECIE", "FECHA_CIERRE_MAS_ANTIGUO"]) expect(claves).not.toContain(clave);
    expect(claves).toContain("VALOR_ESPECIE");
  });

  it("un valor del fondo posterior a hoy cierra en fallo (FECHA_FUTURA)", () => {
    expect(() => con((e) => ({ ...e, fondo: e.fondo === null ? null : { ...e.fondo, fecha: dia("2027-03-18") } }))).toThrow(/FECHA_FUTURA/);
  });

  it("todos los cierres del mismo día: no hay fecha del cierre más antiguo", () => {
    const paquete = con((e) => ({ ...e, tablero: { ...e.tablero, cierreMasViejo: e.tablero.fechaReferencia } }));
    expect(claves(paquete)).not.toContain("FECHA_CIERRE_MAS_ANTIGUO");
  });

  it("con veinte especies, entran las de mayor valor (el orden del tablero) y el aviso dice que se recortó", () => {
    const [alfa] = filasTablero();
    const muchas = Array.from({ length: 20 }, (_, i) => ({ ...alfa, instrumentoId: `inst-ficticio-${i}`, nemotecnico: `FICTICIA-${String.fromCharCode(65 + i)}Q` }));
    const paquete = con((e) => ({ ...e, tablero: { ...e.tablero, filas: muchas } }));
    expect(paquete.hechos.length).toBeLessThanOrEqual(99);
    expect(paquete.avisos).toContain("HECHOS_RECORTADOS");
    const nombres = paquete.hechos.filter((h) => h.clave === "ESPECIE_NOMBRE").map((h) => h.valor);
    expect(nombres.length).toBeGreaterThan(5);
    expect(nombres).toEqual(muchas.slice(0, nombres.length).map((f) => f.nemotecnico));
  });

  it("si el calendario no cubre el año de un dato, su frescura es ATRASADO y el aviso lo dice", () => {
    const paquete = con((e) => ({ ...e, calendario: { noHabiles: new Set(), aniosCubiertos: new Set([2026]) } }));
    expect(paquete.avisos).toContain("CALENDARIO_NO_CUBRE");
    expect(paquete.hechos.find((h) => h.clave === "FECHA_CIERRE_MAS_ANTIGUO")?.frescura).toBe("ATRASADO");
    // Entre el dato y hoy no hay ningún día que mirar: no hace falta el calendario.
    expect(paquete.hechos.find((h) => h.clave === "VALOR_ACCIONES")?.frescura).toBe("RECIENTE");
  });

  it.each<readonly [string, (e: EntradaArmadoDiario) => EntradaArmadoDiario, string]>([
    ["un hoy que no es un día", (e) => ({ ...e, hoy: "2027-02-30" }), "HOY_INVALIDO"],
    ["una serie que el catálogo de hechos no conoce", (e) => ({ ...e, series: [{ ...e.series[0]!, cifra: { ...e.series[0]!.cifra, serie: "UVR" } }] }), "SERIE_DESCONOCIDA"],
    ["la TRM como cifra calculada", (e) => ({ ...e, series: [{ ...e.series[0]!, cifra: { ...e.series[0]!.cifra, origen: "CALCULADA" } }] }), "SERIE_DESCONOCIDA"],
    ["la misma serie dos veces", (e) => ({ ...e, series: [e.series[0]!, e.series[0]!] }), "SERIE_REPETIDA"],
    ["una serie con otra fuente que la de su catálogo", (e) => ({ ...e, series: [{ ...e.series[0]!, cifra: { ...e.series[0]!.cifra, fuente: "sfc:otra-fuente" } }] }), "FUENTE_DESCONOCIDA"],
    ["una fecha que no es medianoche UTC", (e) => ({ ...e, tablero: { ...e.tablero, fechaReferencia: new Date("2027-03-16T13:00:00.000Z") } }), "FECHA_INVALIDA"],
    ["un cierre posterior a hoy", (e) => ({ ...e, tablero: { ...e.tablero, fechaReferencia: dia("2027-03-18") } }), "FECHA_FUTURA"],
  ])("cierra en fallo con %s (%s)", (_caso, cambio, codigo) => {
    try {
      con(cambio);
      throw new Error("no lanzó");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorArmado);
      expect((e as ErrorArmado).codigo).toBe(codigo);
      expect((e as Error).message).not.toMatch(/\p{N}/u);
    }
  });
});
