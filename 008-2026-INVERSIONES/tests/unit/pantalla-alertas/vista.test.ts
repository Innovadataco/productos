// De la fila guardada a lo que se muestra (puro): el texto se reescribe con textoDeAlerta desde la evidencia y sale IGUAL al que
// escribió el motor (ida y vuelta por cada tipo); la procedencia (FechaDato) sale de la hora, la fuente y la hora de traída; las
// alertas se agrupan por día (el más reciente primero) y se cuentan las sin marcar. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { aAlertaDelMotor, construirVista, procedenciaDeAlerta, type FilaAlerta } from "@/app/alertas/vista";
import { filaDeAlerta } from "@/alertas/guardar";
import { textoDeAlerta } from "@/alertas/texto";
import { claveDeAlerta, type Alerta } from "@/alertas/tipos";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const D = (v: string) => new Prisma.Decimal(v);
const BARRA = new Date("2026-11-25T16:10:00.000Z");
const TRAIDO_BARRA = new Date("2026-11-25T16:31:00.000Z");
const TRAIDO_CIERRE = new Date("2026-11-25T23:20:00.000Z");
const ctx = {
  umbrales: UMBRALES_OMISION, umbralVersionId: null,
  procedencia: new Map([["e-1", { cierre: { traidoEn: TRAIDO_CIERRE, fuente: "yahoo" }, intradia: { instante: BARRA, traidoEn: TRAIDO_BARRA, fuente: "yahoo" } }]]),
};
const alerta = (a: Partial<Alerta> & Pick<Alerta, "tipo">): Alerta => ({
  clave: claveDeAlerta("2026-11-25", a.tipo, a.instrumentoId ?? "e-1", a.reglaId ?? null, a.sentido ?? null),
  dia: "2026-11-25", instrumentoId: "e-1", reglaId: null, sentido: null, base: null, datos: {}, ...a,
});

const MOTOR: Alerta[] = [
  alerta({ tipo: "NIVEL_CRUZADO", reglaId: "r-1", sentido: "BAJO", base: "CIERRE", datos: { nivel: D("1000"), precio: D("990.25") } }),
  alerta({ tipo: "NIVEL_CRUZADO", reglaId: "r-1", sentido: "SOBRE", base: "INTRADIA", datos: { nivel: D("1000"), precio: D("1010.5"), instante: BARRA, conRetraso: true } }),
  alerta({ tipo: "NIVEL_CERCA", reglaId: "r-1", sentido: "BAJO", base: "CIERRE", datos: { nivel: D("1000"), precio: D("1020"), distanciaPct: D("2") } }),
  alerta({ tipo: "NIVEL_CERCA", reglaId: "r-1", sentido: "SOBRE", base: "INTRADIA", datos: { nivel: D("1000"), precio: D("1000"), instante: BARRA, conRetraso: false } }),
  alerta({ tipo: "MOVIMIENTO_DIA", sentido: "BAJO", base: "CIERRE", datos: { precio: D("90"), variacionPct: D("-10"), esFechaEx: true } }),
  alerta({ tipo: "MOVIMIENTO_DIA", sentido: "SOBRE", base: "INTRADIA", datos: { precio: D("105"), variacionPct: D("5"), instante: BARRA, conRetraso: true, esFechaEx: false } }),
  alerta({ tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, sentido: "BAJO", base: "CIERRE", datos: { variacionPct: D("-2.4") } }),
  alerta({ tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, sentido: "BAJO", base: "INTRADIA", datos: { variacionPct: D("-2.4") } }),
  alerta({ tipo: "DATO_VIEJO", sentido: "CIERRE_FALTANTE", base: "CIERRE", datos: {} }),
  alerta({ tipo: "DATO_VIEJO", sentido: "RUEDA", base: "INTRADIA", datos: { instante: BARRA, minutosDeEdad: 75, umbralMin: 30 } }),
  alerta({ tipo: "DATO_VIEJO", sentido: "RUEDA", base: "INTRADIA", datos: { minutosDeEdad: 190, umbralMin: 30 } }),
  alerta({ tipo: "FECHA_EX", reglaId: "d-1", datos: { fechaEx: new Date("2026-11-26T00:00:00Z"), fechaPago: new Date("2026-12-03T00:00:00Z"), esFechaEx: false } }),
  alerta({ tipo: "FECHA_EX", reglaId: "d-1", datos: { fechaEx: new Date("2026-11-25T00:00:00Z"), fechaPago: new Date("2026-12-03T00:00:00Z"), esFechaEx: true } }),
];

/** La fila que devolvería la base para lo que guardó filaDeAlerta (más la especie y el decreto que trae el join). */
function fila(a: Alerta, extra: Partial<FilaAlerta> = {}): FilaAlerta {
  const f = filaDeAlerta(a, ctx);
  return {
    id: `id-${a.clave}`, dia: f.dia as Date, tipo: f.tipo, nemotecnico: a.instrumentoId === null ? null : "FICTICIA-A", fechaExDecreto: a.datos.fechaEx ?? null, fechaPagoDecreto: a.datos.fechaPago ?? null,
    sentido: f.sentido ?? null, base: f.base ?? null, precio: (f.precio as Prisma.Decimal | null) ?? null, referencia: (f.referencia as Prisma.Decimal | null) ?? null,
    variacionPct: (f.variacionPct as Prisma.Decimal | null) ?? null, umbral: f.umbral === null || f.umbral === undefined ? null : D(String(f.umbral)), instanteDato: (f.instanteDato as Date | null) ?? null,
    traidoEn: (f.traidoEn as Date | null) ?? null, fuente: f.fuente ?? null, conRetraso: f.conRetraso ?? null, minutosDeEdad: f.minutosDeEdad ?? null, esFechaEx: f.esFechaEx ?? null,
    vistaEn: null, ...extra,
  };
}

describe("aAlertaDelMotor · el texto sale igual desde la evidencia guardada", () => {
  it.each(MOTOR.map((a, i) => [`${i} ${a.tipo}/${a.sentido}/${a.base}`, a] as const))("%s", (_n, a) => {
    const f = fila(a);
    expect(textoDeAlerta(aAlertaDelMotor(f), f.nemotecnico ?? "")).toBe(textoDeAlerta(a, a.instrumentoId === null ? "" : "FICTICIA-A"));
  });
});

describe("procedenciaDeAlerta", () => {
  it("un cierre: el día de la alerta, la hora de traída y la fuente, como cierre", () => {
    expect(procedenciaDeAlerta(fila(MOTOR[0]!))).toEqual({ dia: "2026-11-25", traidoEn: "2026-11-25 18:20", fuente: "yahoo", tipo: "CIERRE" });
  });

  it("una barra del intradía: precio de la rueda con la hora de la barra (hora de Colombia) y la de traída", () => {
    expect(procedenciaDeAlerta(fila(MOTOR[1]!))).toEqual({ dia: "2026-11-25", traidoEn: "2026-11-25 11:31", fuente: "yahoo", tipo: "RUEDA", horaDato: "11:10" });
  });

  it("sin fuente o sin hora de traída (la caída del portafolio, la fecha ex, el dato viejo sin barra) no hay procedencia que inventar", () => {
    expect(procedenciaDeAlerta(fila(MOTOR[6]!))).toBeNull();
    expect(procedenciaDeAlerta(fila(MOTOR[11]!))).toBeNull();
    expect(procedenciaDeAlerta(fila(MOTOR[10]!))).toBeNull();
  });
});

describe("construirVista", () => {
  const uno = (id: string, dia: string, vistaEn: Date | null, hora = "12:00") =>
    fila(MOTOR[0]!, { id, dia: new Date(`${dia}T00:00:00.000Z`), vistaEn, traidoEn: new Date(`${dia}T${hora}:00.000Z`) });

  it("agrupa por día, el más reciente primero, y respeta el orden de entrada dentro del día", () => {
    const v = construirVista([uno("a", "2026-11-25", null), uno("b", "2026-11-25", null), uno("c", "2026-11-24", null), uno("d", "2026-11-20", null)]);
    expect(v.dias.map((d) => d.dia)).toEqual(["2026-11-25", "2026-11-24", "2026-11-20"]);
    expect(v.dias[0]!.alertas.map((a) => a.id)).toEqual(["a", "b"]);
    expect(v.dias[0]!.titulo).toBe("25-nov-2026");
    expect(v.total).toBe(4);
  });

  it("cuenta las sin marcar y dice cuándo se marcó cada vista (hora de Colombia)", () => {
    const v = construirVista([uno("a", "2026-11-25", null), uno("b", "2026-11-25", new Date("2026-11-25T23:45:00.000Z"))]);
    expect(v.sinVer).toBe(1);
    expect(v.dias[0]!.alertas.map((a) => a.vista)).toEqual([null, "25-nov-2026 18:45"]);
  });

  it("sin filas, una vista vacía", () => {
    expect(construirVista([])).toEqual({ dias: [], sinVer: 0, total: 0 });
  });

  it("cada alerta lleva su texto, su tipo y su procedencia", () => {
    const v = construirVista([fila(MOTOR[4]!)]);
    expect(v.dias[0]!.alertas[0]).toMatchObject({ tipo: "MOVIMIENTO_DIA", procedencia: { tipo: "CIERRE", fuente: "yahoo" } });
    expect(v.dias[0]!.alertas[0]!.texto).toMatch(/^«FICTICIA-A»: cierre del día \(90\) está 10 % por debajo del cierre anterior/);
  });
});
