// El cruce de los decretos con los pagos de Trii (fase C, C5b: src/datos-oficiales/decretos/cruce.ts). Puro.
// - Bruto esperado = valor por acción × tenencia al cierre del día anterior a la ex (src/plan/tenencia.ts, por operación),
//   en millonésimas exactas; neto = lo que pagó Trii en la ventana (sin las fracciones de escisión); la diferencia se
//   llama «diferencia bruto − neto».
// - Asignación: decretos de una especie con la misma fecha de pago son un grupo; cada pago va a un solo grupo (el de
//   fecha más cercana; en empate, el anterior) o queda SIN_DECRETO; si dos grupos comparten el pago, los dos REVISAR.
// - Estados RECIBIDO, PENDIENTE, NO_RECIBIDO, SIN_DECRETO y REVISAR (con sus motivos); `sinTenencia` aparte.
// - Leer acotado (limitesDeLectura) y filtrar (desdeEn) da lo mismo que cruzar toda la historia (propiedad con semilla).
// Datos inventados: especies ins-*, números raros, fechas de 2027.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ESTADOS_CRUCE, agruparDecretos, asignarPagos, brutoDe, cruzar, desdeEn, limitesDeLectura,
  type DecretoCruce, type EntradaCruce, type FilaCruce, type PagoTrii, type ResultadoCruce,
} from "@/datos-oficiales/decretos/cruce";
import type { MovimientoTenencia } from "@/plan/tenencia";
import { azarDePrueba } from "../../proyecciones/ficticio";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (v: string) => new Prisma.Decimal(v);
const DIA_MS = 86_400_000;
const sumar = (d: Date, n: number) => new Date(d.getTime() + n * DIA_MS);

const decreto = (c: Partial<DecretoCruce> = {}): DecretoCruce => ({
  id: "dec-1", instrumentoId: "ins-a", tipo: "ORDINARIO", cuota: 1, valorPorAccion: D("4.291731"), fechaEx: dia("2027-03-10"), fechaPago: dia("2027-03-17"), ...c,
});
const pago = (c: Partial<PagoTrii> = {}): PagoTrii => ({
  id: "pag-1", instrumentoId: "ins-a", fechaPago: dia("2027-03-19"), montoNeto: D("4613.27"), tipo: "ORDINARIO", ...c,
});
const COMPRA: MovimientoTenencia = { fecha: dia("2027-02-03"), cantidad: 1237n };
const movs = (...m: MovimientoTenencia[]) => new Map([["ins-a", [COMPRA, ...m]]]);
const HOY = dia("2027-06-09");
const entrada = (c: Partial<EntradaCruce> = {}): EntradaCruce => ({
  decretos: [decreto()], pagos: [pago()], movimientos: movs(), cubiertoHasta: HOY, hoy: HOY, ...c,
});
/** La única fila (o la de esa fecha de pago y especie). */
const fila = (r: ResultadoCruce, fecha = "2027-03-17", especie = "ins-a"): FilaCruce => {
  const f = r.filas.filter((x) => iso(x.fechaPago) === fecha && x.instrumentoId === especie && x.estado !== "SIN_DECRETO");
  if (f.length !== 1) throw new Error(`se esperaba una fila del ${fecha}, hay ${f.length}`);
  return f[0]!;
};
const texto = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed(6));

describe("decretos · cruce · bruto, neto y diferencia", () => {
  it("RECIBIDO: bruto = valor × tenencia antes de la ex, neto = lo pagado y la diferencia bruto − neto, exactos", () => {
    const f = fila(cruzar(entrada()));
    expect(f.estado).toBe("RECIBIDO");
    expect(f.motivos).toEqual([]);
    expect(f.decretos).toHaveLength(1);
    expect(f.decretos[0]).toMatchObject({ decretoId: "dec-1", tenenciaAntesDeLaEx: 1237n });
    expect([texto(f.decretos[0]!.bruto), texto(f.brutoEsperado), texto(f.netoRecibido), texto(f.diferenciaBrutoNeto)])
      .toEqual(["5308.871247", "5308.871247", "4613.270000", "695.601247"]);
    expect(f.pagos.map((p) => p.id)).toEqual(["pag-1"]);
  });

  it("neto igual al bruto: RECIBIDO con diferencia 0; la diferencia se llama así (nunca «retención»)", () => {
    const f = fila(cruzar(entrada({ pagos: [pago({ montoNeto: D("5308.871247") })] })));
    expect(f.estado).toBe("RECIBIDO");
    expect(texto(f.diferenciaBrutoNeto)).toBe("0.000000");
    expect(Object.keys(f)).toContain("diferenciaBrutoNeto");
    expect(Object.keys(f).filter((k) => /retenc/i.test(k))).toEqual([]);
  });

  it("tenencia antes de la ex: la compra del día anterior cuenta, la del mismo día de la ex no, y la venta del día anterior resta", () => {
    const m = movs({ fecha: dia("2027-03-09"), cantidad: 311n }, { fecha: dia("2027-03-09"), cantidad: -113n }, { fecha: dia("2027-03-10"), cantidad: 97n });
    const f = fila(cruzar(entrada({ movimientos: m, pagos: [pago({ montoNeto: D("4613.27") })] })));
    expect(f.decretos[0]!.tenenciaAntesDeLaEx).toBe(1435n);
    expect(texto(f.brutoEsperado)).toBe(brutoDe(D("4.291731"), 1435n).toFixed(6));
  });

  it("el bruto es exacto aun con una tenencia que no cabe en un número ni en 20 dígitos de Decimal", () => {
    expect(brutoDe(D("1873.204517"), 9_007_199_254_740_993n).toFixed(6)).toBe("16872326329499861752.665381");
    expect(brutoDe(D("99999999999999.999999"), 3n).toFixed(6)).toBe("299999999999999.999997");
    expect(() => brutoDe(D("0.0000001"), 1n)).toThrow(RangeError);
  });

  it("ordinario y extraordinario con la misma fecha de pago son un grupo: un solo pago de Trii cubre los dos", () => {
    const r = cruzar(entrada({
      decretos: [decreto(), decreto({ id: "dec-2", tipo: "EXTRAORDINARIO", valorPorAccion: D("1.937113"), fechaEx: dia("2027-03-11") })],
      pagos: [pago({ montoNeto: D("7329.43") })],
    }));
    const f = fila(r);
    expect(f.decretos.map((d) => d.decretoId)).toEqual(["dec-1", "dec-2"]);
    expect(texto(f.brutoEsperado)).toBe(D("5308.871247").add(D("2396.208781")).toFixed(6));
    expect(f.estado).toBe("RECIBIDO");
    expect(r.filas.filter((x) => x.estado === "SIN_DECRETO")).toEqual([]);
  });
});

describe("decretos · cruce · asignación de pagos por ventana", () => {
  it("el mismo día, 3 antes y 10 después cruzan; 4 antes y 11 después quedan SIN_DECRETO", () => {
    for (const [d, cruza] of [["2027-03-17", true], ["2027-03-14", true], ["2027-03-27", true], ["2027-03-13", false], ["2027-03-28", false]] as const) {
      const r = cruzar(entrada({ pagos: [pago({ fechaPago: dia(d), montoNeto: D("4613.27") })], movimientos: movs() }));
      const sin = r.filas.filter((x) => x.estado === "SIN_DECRETO");
      expect(sin.length, d).toBe(cruza ? 0 : 1);
      expect(fila(r).pagos.length, d).toBe(cruza ? 1 : 0);
    }
  });

  it("dos filas de Trii en la ventana van al mismo grupo y se suman", () => {
    const f = fila(cruzar(entrada({ pagos: [pago({ montoNeto: D("3011.13") }), pago({ id: "pag-2", fechaPago: dia("2027-03-22"), montoNeto: D("1602.14") })] })));
    expect(f.pagos.map((p) => p.id)).toEqual(["pag-1", "pag-2"]);
    expect(texto(f.netoRecibido)).toBe("4613.270000");
  });

  it("un pago de otra especie no cruza; las fracciones de escisión y los pagos posteriores a hoy no entran", () => {
    const r = cruzar(entrada({
      pagos: [
        pago({ id: "pag-b", instrumentoId: "ins-b" }),
        pago({ id: "pag-f", tipo: "FRACCION_ESCISION", montoNeto: D("41.37") }),
        pago({ id: "pag-futuro", fechaPago: dia("2027-06-10") }),
      ],
    }));
    expect(fila(r).pagos).toEqual([]);
    expect(r.filas.filter((x) => x.estado === "SIN_DECRETO").map((x) => x.pagos[0]!.id)).toEqual(["pag-b"]);
  });

  it("dos ventanas que se tocan: cada pago va al grupo más cercano (en empate, al anterior) y los dos grupos quedan REVISAR", () => {
    const decretos = [decreto({ id: "dec-a", fechaEx: dia("2027-01-06"), fechaPago: dia("2027-01-10") }), decreto({ id: "dec-b", cuota: 2, fechaEx: dia("2027-01-13"), fechaPago: dia("2027-01-17") })];
    const m = new Map([["ins-a", [{ fecha: dia("2026-12-02"), cantidad: 1237n }]]]);
    const r = cruzar(entrada({ decretos, movimientos: m, pagos: [pago({ id: "p15", fechaPago: dia("2027-01-15") }), pago({ id: "p20", fechaPago: dia("2027-01-20") })] }));
    const a = fila(r, "2027-01-10");
    const b = fila(r, "2027-01-17");
    expect(a.pagos).toEqual([]);
    expect(b.pagos.map((p) => p.id)).toEqual(["p15", "p20"]);
    expect([a.estado, b.estado]).toEqual(["REVISAR", "REVISAR"]);
    expect(a.motivos).toContain("PAGO_EN_DISPUTA");
    expect(b.motivos).toContain("PAGO_EN_DISPUTA");
    // Empate exacto (13 de enero: 3 días de los dos): va al anterior.
    const empate = asignarPagos(agruparDecretos([decretos[0]!, decreto({ id: "dec-c", cuota: 2, fechaEx: dia("2027-01-12"), fechaPago: dia("2027-01-16") })]), [pago({ id: "p13", fechaPago: dia("2027-01-13") })]);
    expect([...empate.porGrupo.entries()].map(([k, v]) => [k, v.map((p) => p.id)])).toEqual([["ins-a|2027-01-10", ["p13"]]]);
    expect([...empate.enDisputa].sort()).toEqual(["ins-a|2027-01-10", "ins-a|2027-01-16"]);
  });

  it("propiedad (semilla): cada pago elegible aparece exactamente una vez, en un grupo o como SIN_DECRETO", () => {
    const azar = azarDePrueba(4613);
    for (let caso = 0; caso < 300; caso += 1) {
      const e = entradaAzar(azar);
      const r = cruzar(e);
      const vistos = r.filas.flatMap((f) => f.pagos.map((p) => p.id)).sort();
      const elegibles = e.pagos.filter((p) => p.tipo !== "FRACCION_ESCISION" && p.fechaPago <= e.hoy).map((p) => p.id).sort();
      expect(vistos, `caso ${caso}`).toEqual(elegibles);
      for (const f of r.filas) expect(ESTADOS_CRUCE, `caso ${caso}`).toContain(f.estado);
    }
  });
});

describe("decretos · cruce · REVISAR y sus motivos", () => {
  it("un pago sin tenencia antes de la ex: PAGO_SIN_TENENCIA", () => {
    const f = fila(cruzar(entrada({ movimientos: new Map([["ins-a", [{ fecha: dia("2027-03-10"), cantidad: 1237n }]]]) })));
    expect(f.estado).toBe("REVISAR");
    expect(f.motivos).toContain("PAGO_SIN_TENENCIA");
    expect(texto(f.brutoEsperado)).toBe("0.000000");
  });

  it("neto mayor que el bruto: 1 peso por fila de Trii se tolera (redondeo); un poco más, NETO_MAYOR_QUE_BRUTO", () => {
    expect(fila(cruzar(entrada({ pagos: [pago({ montoNeto: D("5309.8712") })] }))).estado).toBe("RECIBIDO");
    const dos = [pago({ montoNeto: D("2654.4356") }), pago({ id: "pag-2", fechaPago: dia("2027-03-20"), montoNeto: D("2656.4356") })];
    expect(fila(cruzar(entrada({ pagos: dos }))).estado).toBe("RECIBIDO");
    const f = fila(cruzar(entrada({ pagos: [pago({ montoNeto: D("5309.8713") })] })));
    expect(f).toMatchObject({ estado: "REVISAR", motivos: ["NETO_MAYOR_QUE_BRUTO"] });
    expect(texto(f.diferenciaBrutoNeto)).toBe("-1.000053");
  });

  it("un pago anterior a la fecha ex: PAGO_ANTES_DE_LA_EX (también si la ex aún no llega)", () => {
    const d = decreto({ fechaEx: dia("2027-03-17"), fechaPago: dia("2027-03-17") });
    expect(fila(cruzar(entrada({ decretos: [d], pagos: [pago({ fechaPago: dia("2027-03-15") })] }))).motivos).toContain("PAGO_ANTES_DE_LA_EX");
    const futuro = decreto({ fechaEx: dia("2027-06-11"), fechaPago: dia("2027-06-11") });
    const f = fila(cruzar(entrada({ decretos: [futuro], pagos: [pago({ fechaPago: dia("2027-06-09") })] })), "2027-06-11");
    // La carga de hoy no llega a esa ex: también CARGA_NO_CUBRE_LA_EX (los motivos salen en un orden fijo).
    expect(f).toMatchObject({ estado: "REVISAR", motivos: ["PAGO_ANTES_DE_LA_EX", "CARGA_NO_CUBRE_LA_EX"] });
  });

  it("tenencia negativa (ventas sin sus compras cargadas): TENENCIA_NEGATIVA, no se recorta a 0", () => {
    const f = fila(cruzar(entrada({ movimientos: movs({ fecha: dia("2027-03-01"), cantidad: -1311n }) })));
    expect(f.estado).toBe("REVISAR");
    expect(f.motivos).toContain("TENENCIA_NEGATIVA");
    expect(f.decretos[0]!.tenenciaAntesDeLaEx).toBe(-74n);
    const sinPago = fila(cruzar(entrada({ pagos: [], movimientos: movs({ fecha: dia("2027-03-01"), cantidad: -1311n }) })));
    expect(sinPago).toMatchObject({ estado: "REVISAR", motivos: ["TENENCIA_NEGATIVA"] });
  });

  it("las cargas de Trii no llegan a la fecha ex (o no hay): CARGA_NO_CUBRE_LA_EX", () => {
    for (const cubiertoHasta of [dia("2027-03-09"), null]) {
      expect(fila(cruzar(entrada({ cubiertoHasta }))).motivos, String(cubiertoHasta)).toEqual(["CARGA_NO_CUBRE_LA_EX"]);
    }
    expect(fila(cruzar(entrada({ cubiertoHasta: dia("2027-03-10") }))).estado).toBe("RECIBIDO");
  });
});

describe("decretos · cruce · sin pagos", () => {
  const sinPagos = (c: Partial<EntradaCruce> = {}) => cruzar(entrada({ pagos: [], ...c }));

  it("PENDIENTE mientras la ventana no pasa, o mientras las cargas de Trii no la cubren; NO_RECIBIDO cuando las dos pasan", () => {
    const fin = dia("2027-03-27");
    expect(fila(sinPagos({ hoy: fin, cubiertoHasta: fin })).estado).toBe("PENDIENTE");
    expect(fila(sinPagos({ hoy: sumar(fin, 1), cubiertoHasta: fin })).estado).toBe("PENDIENTE");
    expect(fila(sinPagos({ hoy: sumar(fin, 1), cubiertoHasta: null })).estado).toBe("PENDIENTE");
    const no = fila(sinPagos({ hoy: sumar(fin, 1), cubiertoHasta: sumar(fin, 1) }));
    expect(no).toMatchObject({ estado: "NO_RECIBIDO", motivos: [], pagos: [], netoRecibido: null, diferenciaBrutoNeto: null });
    expect(texto(no.brutoEsperado)).toBe("5308.871247");
  });

  it("sin tenencia antes de la ex y con las órdenes cargadas hasta la ex: no se esperaba nada (sinTenencia, sin estado)", () => {
    const sinTenencia = new Map([["ins-a", [{ fecha: dia("2027-03-10"), cantidad: 1237n }]]]);
    const r = sinPagos({ movimientos: sinTenencia });
    expect(r.filas).toEqual([]);
    expect(r.sinTenencia).toEqual([{ instrumentoId: "ins-a", fechaPago: dia("2027-03-17"), decretoIds: ["dec-1"] }]);
    expect(fila(sinPagos({ movimientos: sinTenencia, cubiertoHasta: dia("2027-03-09") })).estado).toBe("PENDIENTE");
  });

  it("un decreto cuya ex aún no llega y sin pagos no entra al cruce (es un próximo)", () => {
    const r = sinPagos({ decretos: [decreto({ fechaEx: dia("2027-06-10"), fechaPago: dia("2027-06-16") })] });
    expect(r).toEqual({ filas: [], sinTenencia: [] });
    expect(sinPagos({ decretos: [decreto({ fechaEx: HOY, fechaPago: dia("2027-06-16") })] }).filas).toHaveLength(1);
  });
});

describe("decretos · cruce · orden, límites de lectura y filtro", () => {
  it("las filas salen por fecha de pago y especie (un pago suelto, en su propia fecha)", () => {
    const r = cruzar(entrada({
      decretos: [decreto({ id: "dec-b", instrumentoId: "ins-b" }), decreto({ id: "dec-z", fechaEx: dia("2027-02-10"), fechaPago: dia("2027-02-17") }), decreto()],
      pagos: [pago({ id: "suelto", instrumentoId: "ins-a", fechaPago: dia("2027-03-31") }), pago({ id: "pb", instrumentoId: "ins-b", fechaPago: dia("2027-03-17") })],
      movimientos: new Map([["ins-a", [COMPRA]], ["ins-b", [COMPRA]]]),
    }));
    expect(r.filas.map((f) => `${iso(f.fechaPago)} ${f.instrumentoId} ${f.estado}`)).toEqual([
      "2027-02-17 ins-a NO_RECIBIDO", "2027-03-17 ins-a NO_RECIBIDO", "2027-03-17 ins-b RECIBIDO", "2027-03-31 ins-a SIN_DECRETO",
    ]);
  });

  it("límites: decretos con pago desde `desde` − 13 días y pagos desde `desde` − 3; desdeEn deja lo de `desde` en adelante", () => {
    expect(limitesDeLectura(dia("2027-03-17"))).toEqual({ decretosDesde: dia("2027-03-04"), pagosDesde: dia("2027-03-14") });
    const r = cruzar(entrada({ decretos: [decreto({ id: "dec-z", fechaEx: dia("2027-02-10"), fechaPago: dia("2027-02-17") }), decreto()] }));
    expect(desdeEn(r, dia("2027-03-17")).filas.map((f) => iso(f.fechaPago))).toEqual(["2027-03-17"]);
    expect(desdeEn(r, dia("2027-03-18")).filas).toEqual([]);
  });

  it("propiedad (semilla): leer acotado y filtrar da lo mismo que cruzar toda la historia y filtrar", () => {
    const azar = azarDePrueba(37911);
    for (let caso = 0; caso < 300; caso += 1) {
      const e = entradaAzar(azar);
      const desde = sumar(dia("2027-01-01"), Math.floor(azar() * 150));
      const { decretosDesde, pagosDesde } = limitesDeLectura(desde);
      const acotada = { ...e, decretos: e.decretos.filter((d) => d.fechaPago >= decretosDesde), pagos: e.pagos.filter((p) => p.fechaPago >= pagosDesde) };
      expect(desdeEn(cruzar(acotada), desde), `caso ${caso}`).toEqual(desdeEn(cruzar(e), desde));
    }
  });
});

/** Una entrada al azar: dos especies, decretos y pagos apretados (para que las ventanas se toquen a veces). */
function entradaAzar(azar: () => number): EntradaCruce {
  const especies = ["ins-a", "ins-b"];
  const fecha = () => sumar(dia("2026-12-20"), Math.floor(azar() * 190));
  const decretos: DecretoCruce[] = Array.from({ length: 1 + Math.floor(azar() * 7) }, (_, i) => {
    const fechaPago = fecha();
    return decreto({
      id: `d${i}`, instrumentoId: especies[Math.floor(azar() * 2)]!, cuota: 1 + i, tipo: azar() < 0.2 ? "EXTRAORDINARIO" : "ORDINARIO",
      valorPorAccion: D((1 + azar() * 9).toFixed(6)), fechaEx: sumar(fechaPago, -Math.floor(azar() * 9)), fechaPago,
    });
  });
  const pagos: PagoTrii[] = Array.from({ length: Math.floor(azar() * 9) }, (_, i) => pago({
    id: `p${i}`, instrumentoId: especies[Math.floor(azar() * 2)]!, fechaPago: fecha(), montoNeto: D((azar() * 9000).toFixed(4)),
    tipo: azar() < 0.1 ? "FRACCION_ESCISION" : "ORDINARIO",
  }));
  const movimientos = new Map(especies.map((s) => [s, [{ fecha: dia("2026-12-03"), cantidad: 1237n }, { fecha: fecha(), cantidad: azar() < 0.5 ? 311n : -97n }]]));
  const hoy = sumar(dia("2027-01-15"), Math.floor(azar() * 200));
  return { decretos, pagos, movimientos, cubiertoHasta: azar() < 0.15 ? null : sumar(hoy, -Math.floor(azar() * 30)), hoy };
}
