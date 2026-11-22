/**
 * Lecturas ficticias del plan y del diario para las pruebas de pantalla (fase B, corte 3). Datos inventados (FICT…).
 * Los resultados se arman con el cálculo puro real (`calcularResultados`), no a mano.
 */
import { Prisma } from "@prisma/client";
import type { ContextoEspecie } from "@/plan/dividendos";
import type { DecisionLeida, DetalleLeido, DiarioLeido, ReglaLeida, VersionLeida } from "@/plan/lectura";
import { calcularResultados, type Cierre, type EntradaResultado } from "@/plan/resultado";
import type { ResultadoDecision } from "@/plan/resultados-lote";
import { leerCalendario } from "@/precios/negociacion";

export const D = (v: string) => new Prisma.Decimal(v);
export const dia = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Lunes 25-nov-2024 a las 10:00 en Colombia: la referencia del 22 (viernes) está al día. */
export const AHORA = new Date("2024-11-25T15:00:00.000Z");

export const CALENDARIO = leerCalendario([
  { dia: dia("2024-01-01"), esHabil: false },
  { dia: dia("2024-11-04"), esHabil: false },
  { dia: dia("2024-11-11"), esHabil: false },
  { dia: dia("2024-12-25"), esHabil: false },
  { dia: dia("2025-01-01"), esHabil: false },
]);

export const VERSIONES: readonly VersionLeida[] = [
  { id: "v2", version: 2, vigenteDesde: dia("2025-01-10"), motivo: "Versión ficticia programada", creadaEn: new Date("2024-11-20T20:00:00Z"), reglas: 1 },
  { id: "v1", version: 1, vigenteDesde: dia("2024-07-01"), motivo: "Plan ficticio inicial", creadaEn: new Date("2024-06-28T22:30:00Z"), reglas: 6 },
];

const regla = (r: Partial<ReglaLeida> & Pick<ReglaLeida, "id">): ReglaLeida => ({
  instrumentoId: null, nemotecnico: null, conLotes: false, condicion: "NINGUNA", nivel: null, accion: "NO_ACTUAR", cantidad: null, plazoHasta: null, detalle: "Regla ficticia", decisiones: 0, ...r,
});

export const REGLAS_V1: readonly ReglaLeida[] = [
  regla({ id: "r-port", condicion: "MONTO_ORDEN_BAJO", nivel: D("1234000"), detalle: "No operar con menos de ese monto por orden (ficticia)" }),
  regla({ id: "r-c", instrumentoId: "c", nemotecnico: "FICTC", conLotes: true, condicion: "CIERRE_BAJO", nivel: D("480"), accion: "COMPRAR", cantidad: 10n, detalle: "Si cierra bajo el nivel, comprar 10 (ficticia)" }),
  regla({ id: "r-a", instrumentoId: "a", nemotecnico: "FICTA", conLotes: true, condicion: "CIERRE_SOBRE", nivel: D("1200"), accion: "VENDER", cantidad: 50n, detalle: "Si cierra sobre el nivel, vender 50 (ficticia)", decisiones: 2 }),
  regla({ id: "r-b", instrumentoId: "b", nemotecnico: "FICTB", conLotes: true, condicion: "CIERRE_BAJO", nivel: D("2000"), accion: "VENDER", plazoHasta: dia("2024-10-31"), detalle: "Vender si cae bajo el nivel (ficticia)" }),
  regla({ id: "r-p", instrumentoId: "p", nemotecnico: "FICTP", detalle: "Mantener sin condición (ficticia)" }),
  regla({ id: "r-libre", condicion: "LIBRE", detalle: "Siempre orden límite (ficticia)" }),
];

/** Con cuándo los trajo 008 y de qué fuente (frente fecha-hora-datos). Las horas son inventadas, de 2027 (fuera de la historia real). */
export const CIERRES = new Map([
  ["a", { fecha: dia("2024-11-22"), precio: D("1100"), estado: "NO_VERIFICADO" as const, traidoEn: new Date("2027-01-13T23:41:00Z"), fuente: "yahoo" }],
  ["b", { fecha: dia("2024-11-22"), precio: D("1913"), estado: "VERIFICADO" as const, traidoEn: new Date("2027-01-14T12:07:00Z"), fuente: "yahoo" }],
  ["c", { fecha: dia("2024-11-01"), precio: D("505"), estado: "NO_VERIFICADO" as const, traidoEn: new Date("2027-01-13T23:41:00Z"), fuente: "bvc-ficticia" }],
]);

export const REFERENCIA = dia("2024-11-22");

// ─── Diario ───
const HOY = dia("2024-11-25");
let k = 0;
const cierre = (iso: string, precio: string): Cierre => ({ id: `c${(k += 1)}`, fecha: dia(iso), precio: D(precio), estado: "NO_VERIFICADO", fuente: "yahoo" });
const especie = (c: Partial<ContextoEspecie> = {}): ContextoEspecie => ({ dividendos: [], movimientos: [{ fecha: dia("2024-04-08"), cantidad: 100n }], cubiertoHasta: HOY, destinoSinLote: false, escisiones: [], ...c });
const resultado = (id: string, e: Omit<EntradaResultado, "hoy">): ResultadoDecision => ({ decisionId: id, ...calcularResultados({ ...e, hoy: HOY }) });

const decision = (d: Partial<DecisionLeida> & Pick<DecisionLeida, "id" | "fechaDecision" | "accion">): DecisionLeida => ({
  registradaEn: new Date(d.fechaDecision.getTime() + 20 * 3_600_000), cantidad: null, excepcion: false, motivo: "Motivo ficticio", nemotecnico: "FICTA",
  version: { numero: 1, vigenteDesde: dia("2024-07-01"), motivo: "Plan ficticio inicial" }, regla: null, ordenes: 0, reemplaza: null, reemplazadaPor: null, ...d,
});

const REGLA_A = { id: "r-a", condicion: "CIERRE_SOBRE" as const, nivel: D("1200"), accion: "VENDER" as const, nemotecnico: "FICTA" };

export const DECISIONES: readonly DecisionLeida[] = [
  decision({ id: "d-pend", fechaDecision: dia("2024-11-22"), accion: "NO_ACTUAR", cantidad: 10n, nemotecnico: "FICTB", motivo: "Esperar el dividendo (ficticio)" }),
  decision({ id: "d-corr", fechaDecision: dia("2024-10-02"), accion: "COMPRAR", reemplaza: { id: "d-vieja", fechaDecision: dia("2024-10-01") }, motivo: "Corrige la fecha (ficticio)" }),
  decision({ id: "d-vieja", fechaDecision: dia("2024-10-01"), accion: "COMPRAR", reemplazadaPor: { id: "d-corr", fechaDecision: dia("2024-10-02") } }),
  decision({ id: "d-vende", fechaDecision: dia("2024-09-12"), accion: "VENDER", nemotecnico: "FICTB", ordenes: 1 }),
  decision({ id: "d-tenencia", fechaDecision: dia("2024-08-01"), accion: "VENDER", ordenes: 1, regla: REGLA_A, excepcion: false }),
  decision({ id: "d-escision", fechaDecision: dia("2024-07-29"), accion: "NO_ACTUAR", cantidad: 50n, nemotecnico: "FICTC" }),
  decision({ id: "d-noact", fechaDecision: dia("2024-07-22"), accion: "NO_ACTUAR", cantidad: 43n, regla: REGLA_A, excepcion: true, motivo: "Mantener hasta el dividendo de octubre (ficticio)" }),
];

const DIVIDENDO_A = { id: "div-a", fechaPago: dia("2024-10-17"), montoNeto: D("1200"), tipo: "ORDINARIO" as const };
const CIERRES_A = [cierre("2024-07-22", "953"), cierre("2024-08-21", "989"), cierre("2024-10-18", "1063")];

export const RESULTADOS: ReadonlyMap<string, ResultadoDecision> = new Map([
  ["d-noact", resultado("d-noact", { accion: "NO_ACTUAR", fechaDecision: dia("2024-07-22"), cantidad: 43n, ordenes: [], cierres: CIERRES_A, especie: especie({ dividendos: [DIVIDENDO_A] }) })],
  ["d-pend", resultado("d-pend", { accion: "NO_ACTUAR", fechaDecision: dia("2024-11-22"), cantidad: 10n, ordenes: [], cierres: [], especie: especie() })],
  ["d-vende", resultado("d-vende", { accion: "VENDER", fechaDecision: dia("2024-09-12"), cantidad: null, ordenes: [{ id: "o-b", fechaOperacion: dia("2024-09-13"), cantidadCompletada: 20n, totalEstimado: D("50440") }], cierres: [], especie: especie() })],
  ["d-corr", resultado("d-corr", { accion: "COMPRAR", fechaDecision: dia("2024-10-02"), cantidad: null, ordenes: [], cierres: [], especie: especie() })],
  ["d-tenencia", resultado("d-tenencia", {
    accion: "VENDER", fechaDecision: dia("2024-08-01"), cantidad: null, ordenes: [{ id: "o-a", fechaOperacion: dia("2024-08-02"), cantidadCompletada: 100n, totalEstimado: D("93000") }],
    cierres: [cierre("2024-08-30", "935"), cierre("2024-10-31", "1000")], especie: especie({ movimientos: [{ fecha: dia("2024-04-08"), cantidad: 100n }, { fecha: dia("2024-08-02"), cantidad: -100n }] }),
  })],
  ["d-escision", resultado("d-escision", { accion: "NO_ACTUAR", fechaDecision: dia("2024-07-29"), cantidad: 50n, ordenes: [], cierres: [cierre("2024-07-29", "10"), cierre("2024-08-28", "8"), cierre("2024-10-25", "8")], especie: especie({ escisiones: [dia("2024-08-15")] }) })],
]);

export const DIARIO: DiarioLeido = {
  decisiones: DECISIONES,
  truncado: false,
  resultados: RESULTADOS,
  sinDecision: {
    inicioPlan: dia("2024-07-01"),
    sinDecision: [{ id: "o-i", filaFuenteId: "f6", instrumentoId: "i", nemotecnico: "FICTI", fechaOperacion: dia("2024-11-14"), lado: "VENTA", cantidadCompletada: 20n, filaNo: 6, cargadaEn: new Date("2026-11-21T19:00:00Z") }],
    anterioresAlPlan: ([["FICTA", "2024-04-08"], ["FICTB", "2024-04-09"], ["FICTI", "2024-04-10"], ["FICTC", "2024-04-11"]] as const).map(([nemo, fecha], i) => ({
      id: `o-ant-${i}`, filaFuenteId: `f${i + 1}`, instrumentoId: nemo.toLowerCase(), nemotecnico: nemo, fechaOperacion: dia(fecha),
      lado: "COMPRA" as const, cantidadCompletada: 100n, filaNo: i + 1, cargadaEn: new Date("2026-11-21T19:00:00Z"),
    })),
  },
};

export const DETALLE: DetalleLeido = {
  decision: DECISIONES.find((d) => d.id === "d-noact")!,
  ordenes: [],
  enlaces: [],
  resultado: RESULTADOS.get("d-noact")!,
};

export const DETALLE_VENTA: DetalleLeido = {
  decision: DECISIONES.find((d) => d.id === "d-vende")!,
  ordenes: [{ id: "o-b", fechaOperacion: dia("2024-09-13"), lado: "VENTA", cantidadCompletada: 20n, totalEstimado: D("50440"), filaNo: 5, cargadaEn: new Date("2026-11-21T19:00:00Z") }],
  enlaces: [
    { id: "e0", creadoEn: new Date("2026-11-21T19:30:00Z"), motivo: null, vigente: false, ordenFecha: dia("2024-09-13"), ordenLado: "VENTA" },
    { id: "e1", creadoEn: new Date("2026-11-21T20:00:00Z"), motivo: "Se enlazó primero a otra decisión (ficticio)", vigente: true, ordenFecha: dia("2024-09-13"), ordenLado: "VENTA" },
  ],
  resultado: RESULTADOS.get("d-vende")!,
};

export const DETALLE_VIEJA: DetalleLeido = { decision: DECISIONES.find((d) => d.id === "d-vieja")!, ordenes: [], enlaces: [], resultado: null };
