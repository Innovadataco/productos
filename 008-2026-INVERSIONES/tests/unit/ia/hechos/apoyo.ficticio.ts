/**
 * Entradas INVENTADAS de los armadores de hechos (E1b): especies FICTICIA-*, cifras no redondas, días de 2027 (y, en la
 * ventana de la proyección, de antes de 2022). Las de «forma real» traen además los campos que el armador NUNCA debe
 * pasar al paquete (acción, cantidad, tenencia, texto libre, encargo, cuentas, ids), con marcas que el candado busca.
 * Nada sale de una base ni de datos reales.
 */
import { Prisma } from "@prisma/client";
import type { EntradaArmadoDiario, EntradaArmadoEscenarios, EntradaArmadoReglas } from "@/ia/hechos";
import type { CalendarioBvc } from "@/precios/negociacion";

export const D = (v: string): Prisma.Decimal => new Prisma.Decimal(v);
export const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const HOY = "2027-03-17";
/** San José de 2027 se corre al lunes 22 de marzo: festivo del calendario BVC sembrado. */
export const FESTIVO_2027 = "2027-03-22";
export const CALENDARIO: CalendarioBvc = { noHabiles: new Set([FESTIVO_2027]), aniosCubiertos: new Set([2027]) };

export const ALFA = "FICTICIA-ALFA";
export const BETA = "FICTICIA-BETA";
export const GAMMA = "FICTICIA-GAMMA";
export const DELTA = "FICTICIA-DELTA";

/** Las marcas de lo que nunca entra al paquete: si alguna aparece en él, el candado se pone rojo. */
export const MARCAS = Object.freeze({
  cantidad: "739153",
  tenencia: "829317",
  unidades: "917353",
  detalle: "TEXTO-LIBRE-FICTICIO-QZ",
  motivo: "MOTIVO-LIBRE-FICTICIO-QZ",
  encargo: "ENCARGO-FICTICIO-QZ",
  cuenta: "CUENTA-FICTICIA-QZ",
  correo: "persona-ficticia-qz@ejemplo.invalid",
  referencia: "REFERENCIA-OFICIAL-FICTICIA-QZ",
  instrumento: "inst-ficticio-qz",
  regla: "regla-ficticia-qz",
  texto: "TEXTO-DE-AVISO-FICTICIO-QZ",
});
/** La acción de una regla: la del plan inventado es «vender»; se busca en los campos de texto libre del paquete. */
export const ACCION_PLANTADA = "VENDER";

const inst = (nombre: string): string => `${MARCAS.instrumento}-${nombre.toLowerCase()}`;

// ───────────── DIARIO ─────────────

/** Las filas con la forma real de FilaTablero: con cantidad, costo e id del instrumento (no deben pasar). */
export function filasTablero() {
  return [
    {
      instrumentoId: inst(ALFA), nemotecnico: ALFA, cantidad: BigInt(MARCAS.cantidad), costoVivo: D("21599.71"),
      valor: D("23417.83"), sinVender: D("1818.12"), rentabilidadPct: D("8.4127"), pesoPct: D("61.7731"),
      realizada: D("-417.29"), dividendos: D("613.71"), comisiones: D("61.37"),
      cierre: { precio: D("4613.27"), fecha: dia("2027-03-16"), verificado: true }, cierreAtrasado: false, lotesVivos: 3, serie: [],
    },
    {
      instrumentoId: inst(BETA), nemotecnico: BETA, cantidad: 5341n, costoVivo: D("15074.23"),
      valor: D("14493.64"), sinVender: D("-580.59"), rentabilidadPct: D("-3.1907"), pesoPct: D("38.2269"),
      realizada: D("0"), dividendos: D("0"), comisiones: D("35.76"),
      cierre: { precio: D("2713.9"), fecha: dia("2027-03-15"), verificado: false }, cierreAtrasado: true, lotesVivos: 1, serie: [],
    },
  ];
}

export function entradaDiarioFicticia(): EntradaArmadoDiario {
  return {
    hoy: HOY,
    calendario: CALENDARIO,
    tablero: {
      filas: filasTablero(),
      valorAcciones: D("37911.47"), sinVender: D("1237.53"), porVentas: D("-417.29"), dividendos: D("613.71"), comisiones: D("97.13"),
      gananciaTotal: D("1336.82"), especiesSinPrecio: 0, especiesAtrasadas: 1, fechaReferencia: dia("2027-03-16"), cierreMasViejo: dia("2027-03-15"),
    },
    movimiento: { neto: D("-211.37"), motivo: null, especies: [{ instrumentoId: inst(ALFA), aporte: D("-211.37"), variacionPct: D("-0.8931") }] },
    conciliacion: { fechaCorte: dia("2027-02-26"), resultado: "PARCIAL" },
    series: [
      { cifra: { serie: "TRM", valor: "4137.19", hasta: dia("2027-03-17"), fuente: "sfc:ficticia-trm", origen: "OFICIAL" }, frescura: { estado: "AL_DIA", cubreHoy: true }, anterior: "4129.53" },
      { cifra: { serie: "TPM", valor: "9.13", hasta: dia("2027-03-16"), fuente: "banrep:ficticia-tpm", origen: "OFICIAL" }, frescura: { estado: "AL_DIA", cubreHoy: false }, anterior: null },
      { cifra: { serie: "IPC_INDICE", valor: "4.30", hasta: dia("2027-02-28"), fuente: "dane:ficticia-ipc", origen: "CALCULADA" }, frescura: { estado: "ATRASADA", cubreHoy: false }, anterior: null },
    ],
    fondo: { valorUnidad: D("13711.293847"), valorUnidadAnterior: D("13709.117"), fecha: dia("2027-03-15"), atrasado: false, fuente: "sfc:ficticia-fondo", valor: null },
  };
}

// ───────────── REGLAS ─────────────

const regla = (id: string, nombre: string | null, condicion: string, nivel: string | null, plazo: string | null) => ({
  id: `${MARCAS.regla}-${id}`,
  instrumentoId: nombre === null ? null : inst(nombre),
  nemotecnico: nombre,
  conLotes: nombre !== null,
  condicion,
  nivel: nivel === null ? null : D(nivel),
  accion: ACCION_PLANTADA,
  cantidad: BigInt(MARCAS.cantidad),
  plazoHasta: plazo === null ? null : dia(plazo),
  detalle: MARCAS.detalle,
  decisiones: 3,
});

/** Las reglas con la forma real de ReglaLeida (con acción, cantidad, texto libre e ids). */
export function reglasLeidas() {
  return [
    regla("uno", ALFA, "CIERRE_SOBRE", "4591.37", null),
    regla("dos", ALFA, "CIERRE_BAJO", "4497.11", "2027-09-23"),
    regla("tres", BETA, "CIERRE_BAJO", "2491.73", null),
    regla("cuatro", null, "MONTO_ORDEN_BAJO", "613.29", "2027-06-30"),
    regla("cinco", GAMMA, "LIBRE", null, null),
    regla("seis", ALFA, "CIERRE_SOBRE", "4791.53", "2027-01-29"),
  ];
}

const proximo = (nombre: string | null, ex: string, pago: string, porAccion: string, bruto: string | null) => ({
  id: `decreto-ficticio-${ex}`,
  instrumentoId: inst(nombre ?? "sin-nombre"),
  nemotecnico: nombre,
  tipo: "ORDINARIO",
  cuota: 1,
  valorPorAccion: D(porAccion),
  fechaAnuncio: dia("2027-03-02"),
  fechaEx: dia(ex),
  fechaPago: dia(pago),
  referenciaOficial: MARCAS.referencia,
  version: 1,
  tenencia: BigInt(MARCAS.tenencia),
  brutoEstimado: bruto === null ? null : D(bruto),
});

/** Los próximos con la forma real de Proximo (con la tenencia y la referencia oficial), ordenados por fecha ex. */
export function proximosLeidos() {
  return [
    proximo(ALFA, "2027-04-07", "2027-04-21", "41.37", "30578.79"),
    proximo(null, "2027-04-14", "2027-04-28", "13.71", "4119.37"),
    proximo(DELTA, "2027-05-12", "2027-05-26", "97.31", null),
    proximo(ALFA, "2027-06-09", "2027-06-23", "43.19", "31923.17"),
  ];
}

export function entradaReglasFicticia(): EntradaArmadoReglas {
  return {
    hoy: HOY,
    calendario: CALENDARIO,
    vigenteDesde: dia("2027-02-03"),
    reglas: reglasLeidas() as unknown as EntradaArmadoReglas["reglas"],
    cierres: new Map([
      [inst(ALFA), { fecha: dia("2027-03-16"), precio: D("4613.27"), estado: "VERIFICADO" as const }],
      [inst(BETA), { fecha: dia("2027-03-15"), precio: D("2713.9"), estado: "NO_VERIFICADO" as const }],
    ]),
    referencia: dia("2027-03-16"),
    proximos: proximosLeidos() as unknown as EntradaArmadoReglas["proximos"],
  };
}

// ───────────── ESCENARIOS ─────────────

const punto = (mes: number, p5: number, p50: number, p95: number, aportado: number) =>
  ({ mes, p5, p25: (p5 + p50) / 2, p50, p75: (p50 + p95) / 2, p95, aportado, dividendosP50: 61.379 });

/** Un ResultadoProyeccion inventado con la forma real (textos, avisos con nombre y texto, pesos por posición). */
export function resultadoProyeccion() {
  return {
    aviso: "Escenario ilustrativo, no es recomendación ni promesa.",
    versionMetodo: "bootstrap-circular-v2",
    parametros: { horizonteMeses: 12, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 1237, semilla: 4613 },
    hoy: HOY,
    valorHoy: 37911.4713,
    puntos: [
      punto(0, 37911.4713, 37911.4713, 37911.4713, 37911.4713),
      punto(3, 33917.2918371, 38411.7391, 43177.0193, 37911.4713),
      punto(6, 31719.13, 38917.3719, 46931.7713, 37911.4713),
      punto(12, 28713.4197, 39731.1931, 53119.3719, 37911.4713),
    ],
    probabilidadBajoAportado: 0.17346,
    caidaMaximaMediana: 0.09213,
    supuestos: {
      ventana: { desde: "2019-06-14", hasta: "2027-03-16", ruedas: 1237, limitadaPor: GAMMA },
      ruedasPorMes: 21, bloque: 21, minimoDias: 60,
      fraccionProyectada: 0.8731, rendimientoAnualVentana: 0.0713, volatilidadAnualVentana: 0.2317, decretosFuturos: 2,
      posiciones: [
        { instrumentoId: inst(GAMMA), nombre: GAMMA, tipo: "ACCION", estado: "FIJA_HISTORIA_CORTA", valorHoy: 4137.19, peso: 0.1091, diasEnVentana: 41, diasTotales: 41, ultimoDia: "2027-03-16", dividendosUsados: 0, primerDividendo: null },
        { instrumentoId: inst(ALFA), nombre: ALFA, tipo: "ACCION", estado: "PROYECTADA", valorHoy: 23417.83, peso: 0.6177, diasEnVentana: 1237, diasTotales: 1531, ultimoDia: "2027-03-16", dividendosUsados: 3, primerDividendo: "2019-07-17" },
        { instrumentoId: inst("fondo"), nombre: "Fondo ficticio (FIC), con coma", tipo: "FONDO", estado: "PROYECTADA", valorHoy: 10356.45, peso: 0.2732, diasEnVentana: 1237, diasTotales: 1531, ultimoDia: "2027-03-15", dividendosUsados: 0, primerDividendo: null },
      ],
      avisos: [
        { codigo: "HISTORIA_CORTA", instrumentoId: inst(GAMMA), nombre: GAMMA, dia: null, dato: 41, texto: MARCAS.texto },
        { codigo: "HISTORIA_CORTA", instrumentoId: inst(DELTA), nombre: DELTA, dia: null, dato: 17, texto: MARCAS.texto },
        { codigo: "ANIO_SIN_CALENDARIO", instrumentoId: null, nombre: null, dia: null, dato: 2028, texto: MARCAS.texto },
      ],
      textos: [MARCAS.texto, `${MARCAS.detalle} ${MARCAS.cantidad}`],
    },
  };
}

export function entradaEscenariosFicticia(): EntradaArmadoEscenarios {
  return { hoy: HOY, resultado: resultadoProyeccion() as unknown as EntradaArmadoEscenarios["resultado"] };
}

/** El corte y el fondo con lo que nunca entra (encargo, cuenta, correo y unidades), como propiedades de más. */
export function entradaDiarioConPlantados(): EntradaArmadoDiario {
  const base = entradaDiarioFicticia();
  const conciliacion = { ...base.conciliacion, encargo: MARCAS.encargo, cuenta: MARCAS.cuenta, correo: MARCAS.correo };
  const fondo = { ...base.fondo, unidades: Number(MARCAS.unidades), encargo: MARCAS.encargo, cuenta: MARCAS.cuenta };
  return { ...base, conciliacion, fondo } as EntradaArmadoDiario;
}
