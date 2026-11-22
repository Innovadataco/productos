/**
 * Una corrida del arnés (E7): un caso, un modelo, una pasada. El camino es el de producción:
 * 1. `armarPedido` con el prompt versionado del tipo (`promptDe`) y `ESQUEMA_SALIDA` (adentro, `vistaCiega` con su
 *    guarda: al modelo solo va la vista ciega);
 * 2. `generarConPuertas` por la puerta local (modo «local», un solo generador);
 * 3. `validarSalida` sobre la salida cruda; el texto lo renderiza el código.
 * Con la señal del operador (PARA) la corrida queda CORTADA en el acto, aunque el generador no la escuche: el pedido
 * en vuelo recibe la señal y la corrida no espera su límite. VISTA_NO_CIEGA o APAGADO son defectos del arnés: lanza.
 */
import type { PaqueteHechos } from "../contrato";
import { armarPedido, type Generador, type PedidoGeneracion } from "../generador";
import { jsonCanonico, sha256Hex } from "../hash";
import { ESQUEMA_SALIDA } from "../prompts/esquema";
import { promptDe } from "../prompts/prompts";
import { generarConPuertas, type ResultadoPuertas } from "../puertas";
import { VERSION_VALIDADOR } from "../validador/codigos";
import { validarSalida } from "../validador/validar";
import type { CasoEvaluacion, Pasada, RegistroCorrida } from "./tipos";

/** El límite por pedido de la evaluación: el de PI (y el criterio de p95). */
export const LIMITE_EVALUACION_MS = 120_000;

export const CODIGOS_ERROR_EVALUACION = Object.freeze(["DEFECTO_DEL_ARNES", "PUERTA_NO_LOCAL"] as const);
export type CodigoErrorEvaluacion = (typeof CODIGOS_ERROR_EVALUACION)[number];

export class ErrorEvaluacion extends Error {
  override readonly name = "ErrorEvaluacion";
  constructor(readonly codigo: CodigoErrorEvaluacion) {
    super(`Evaluación de la IA: ${codigo}.`);
  }
}

export interface EntradaCorrida {
  readonly caso: CasoEvaluacion;
  readonly modelo: string;
  readonly pasada: Pasada;
  readonly orden: number;
  readonly generador: Generador;
  readonly limiteMs: number;
  /** La señal del operador (PARA). */
  readonly senal: AbortSignal;
  /** Reloj monótono en milisegundos (se lee dos veces: al empezar y al terminar). */
  readonly reloj: () => number;
  readonly ahoraIso: () => string;
}

export type ResultadoInterpretado = Pick<RegistroCorrida,
  "estado" | "motivos" | "detalle" | "hallazgos" | "latenciaMs" | "agotado" | "tokensEntrada" | "tokensSalida" | "modeloDigest" | "salidaCruda" | "salidaHash" | "texto" | "citados">;

const SIN_SALIDA = Object.freeze({
  hallazgos: Object.freeze([]), latenciaMs: null, tokensEntrada: null, tokensSalida: null, modeloDigest: null, salidaCruda: null, salidaHash: null, texto: null, citados: 0,
});

const cortada = (): ResultadoInterpretado => Object.freeze({ ...SIN_SALIDA, estado: "CORTADO", motivos: Object.freeze(["SENAL_DEL_OPERADOR"]), detalle: null, agotado: false });

/** El resultado de las puertas (y del validador) como registro. `cortado`: la señal del operador llegó. */
export function interpretarResultado(r: ResultadoPuertas, paquete: PaqueteHechos, cortado: boolean): ResultadoInterpretado {
  if (r.estado === "VISTA_NO_CIEGA" || r.estado === "APAGADO") throw new ErrorEvaluacion("DEFECTO_DEL_ARNES");
  if (r.estado === "FALLO") {
    if (cortado) return cortada();
    const fallo = r.fallos[r.fallos.length - 1] as (typeof r.fallos)[number];
    return Object.freeze({ ...SIN_SALIDA, estado: "FALLIDO", motivos: Object.freeze([fallo.motivo]), detalle: fallo.detalle, agotado: fallo.motivo === "TIEMPO_AGOTADO" });
  }
  const { exito } = r;
  const v = validarSalida(exito.salidaCruda, paquete);
  const comun = {
    latenciaMs: exito.latenciaMs, agotado: false, tokensEntrada: exito.tokensEntrada, tokensSalida: exito.tokensSalida, modeloDigest: exito.modeloDigest,
    salidaCruda: exito.salidaCruda, salidaHash: sha256Hex(exito.salidaCruda), detalle: null,
  };
  if (!v.ok) return Object.freeze({ ...comun, estado: "RECHAZADO", motivos: v.motivos, hallazgos: v.hallazgos, texto: null, citados: 0 });
  return Object.freeze({ ...comun, estado: "PUBLICADO", motivos: Object.freeze([]), hallazgos: Object.freeze([]), texto: v.resumen.texto, citados: v.resumen.cifrasUsadas.length });
}

/** El generador con la señal del operador sumada a la del orquestador (con la misma puerta). */
function conSenal(generador: Generador, externa: AbortSignal): Generador {
  return Object.freeze({ puerta: generador.puerta, generar: (pedido: PedidoGeneracion, senal: AbortSignal) => generador.generar(pedido, AbortSignal.any([senal, externa])) });
}

/** La promesa, o null en cuanto la señal se aborte (sin esperar a la promesa). */
function hastaLaSenal<T>(promesa: Promise<T>, senal: AbortSignal): Promise<T | null> {
  if (senal.aborted) return Promise.resolve(null);
  return new Promise<T | null>((resolver, rechazar) => {
    const alAbortar = (): void => resolver(null);
    senal.addEventListener("abort", alAbortar, { once: true });
    promesa.then(resolver, rechazar).finally(() => senal.removeEventListener("abort", alAbortar));
  });
}

export async function correrCaso(e: EntradaCorrida): Promise<RegistroCorrida> {
  if (e.generador.puerta !== "local") throw new ErrorEvaluacion("PUERTA_NO_LOCAL");
  const { paquete } = e.caso;
  const prompt = promptDe(e.caso.tipo);
  const pedido = armarPedido({ paquete, prompt, esquemaSalida: ESQUEMA_SALIDA, limiteMs: e.limiteMs });
  const inicio = e.ahoraIso();
  const t0 = e.reloj();
  const resultado = await hastaLaSenal(generarConPuertas([conSenal(e.generador, e.senal)], "local", pedido, paquete), e.senal);
  const duracionMs = Math.max(0, Math.round(e.reloj() - t0));
  const interpretado = resultado === null ? cortada() : interpretarResultado(resultado, paquete, e.senal.aborted);
  return Object.freeze({
    caso: e.caso.id, tipo: e.caso.tipo, modelo: e.modelo, pasada: e.pasada, orden: e.orden, inicio, ...interpretado, duracionMs,
    caracteresPedido: prompt.texto.length + jsonCanonico(pedido.vista).length,
    hechos: paquete.hechos.filter((h) => h.clave !== "ESPECIE_NOMBRE").length,
    hechosHash: paquete.hash, promptVersion: prompt.version, promptHash: prompt.hash, validadorVersion: VERSION_VALIDADOR,
  });
}
