/**
 * Las dos puertas: el modo (configuración, no código) dice cuáles se prueban y en qué orden. `generarConPuertas`
 * prueba la siguiente solo si la anterior falló y devuelve el primer éxito o todos los fallos.
 *
 * Cierra en fallo, siempre ANTES de llamar a un generador:
 * - revisa el pedido (prompt con su hash, esquema y límite): si está mal formado, lanza `ErrorPedido`;
 * - pasa la vista por la guarda contra el paquete completo: si no es ciega, no llama a nadie y devuelve un fallo
 *   VISTA_NO_CIEGA por cada puerta del orden;
 * - cada generador recibe una copia congelada de la vista revisada, nunca el objeto del llamador.
 * Y mientras corre: una puerta sin generador es PUERTA_APAGADA; una excepción es ERROR_PROVEEDOR sin su mensaje; el
 * límite lo impone también el orquestador (aborta la señal y da TIEMPO_AGOTADO); un resultado con otra forma se
 * descarta (ERROR_PROVEEDOR) y la puerta del resultado es siempre la del generador registrado.
 */
import type { PaqueteHechos } from "./contrato";
import { esObjetoPlano, type Registro } from "./formas";
import { MAX_LARGO_DETALLE, MAX_SALIDA_CRUDA, MOTIVOS_FALLO, PATRON_DETALLE, PATRON_MODELO, PUERTAS, revisarPedido,
  type ExitoGeneracion, type FalloGeneracion, type Generador, type MotivoFallo, type PedidoGeneracion, type Puerta,
  type ResultadoGeneracion } from "./generador";
import { clonCongelado } from "./hash";
import { fugasDeVistaCiega } from "./vista-ciega";

export const MODOS_PUERTAS = Object.freeze(["apagado", "local", "nube", "local-luego-nube"] as const);
export type ModoPuertas = (typeof MODOS_PUERTAS)[number];

const ORDEN: Readonly<Record<ModoPuertas, readonly Puerta[]>> = Object.freeze({
  apagado: Object.freeze([]),
  local: Object.freeze(["local"] as const),
  nube: Object.freeze(["nube"] as const),
  "local-luego-nube": Object.freeze(["local", "nube"] as const),
});

export const CODIGOS_ERROR_PUERTAS = Object.freeze(["MODO_PUERTAS_INVALIDO", "PUERTA_INVALIDA", "GENERADOR_DUPLICADO"] as const);
export type CodigoErrorPuertas = (typeof CODIGOS_ERROR_PUERTAS)[number];

/** Configuración o registro inválidos: lanza, sin repetir el valor recibido. */
export class ErrorPuertas extends Error {
  override readonly name = "ErrorPuertas";
  constructor(readonly codigo: CodigoErrorPuertas) {
    super(`Puertas de IA: ${codigo}.`);
  }
}

export type ResultadoPuertas =
  | { readonly ok: true; readonly exito: ExitoGeneracion; readonly fallosPrevios: readonly FalloGeneracion[] }
  /** Invariante: un fallo por cada puerta del orden (vacío con el modo apagado). */
  | { readonly ok: false; readonly fallos: readonly FalloGeneracion[] };

const esDe = <T extends string>(lista: readonly T[], valor: unknown): valor is T => typeof valor === "string" && (lista as readonly string[]).includes(valor);

/** El modo de la configuración. Si falta (o viene vacío), apagado; si no es de la lista, ErrorPuertas. Puro. */
export function leerModoPuertas(valor: string | undefined): ModoPuertas {
  if (valor === undefined || valor === "") return "apagado";
  if (esDe(MODOS_PUERTAS, valor)) return valor;
  throw new ErrorPuertas("MODO_PUERTAS_INVALIDO");
}

export function ordenDePuertas(modo: ModoPuertas): readonly Puerta[] {
  if (!esDe(MODOS_PUERTAS, modo)) throw new ErrorPuertas("MODO_PUERTAS_INVALIDO");
  return ORDEN[modo];
}

const fallo = (puerta: Puerta, motivo: MotivoFallo, detalle: string): FalloGeneracion => Object.freeze({ ok: false, puerta, motivo, detalle });

function registrar(generadores: readonly Generador[]): ReadonlyMap<Puerta, Generador> {
  const registro = new Map<Puerta, Generador>();
  for (const generador of generadores) {
    if (!esDe(PUERTAS, generador.puerta)) throw new ErrorPuertas("PUERTA_INVALIDA");
    if (registro.has(generador.puerta)) throw new ErrorPuertas("GENERADOR_DUPLICADO");
    registro.set(generador.puerta, generador);
  }
  return registro;
}

const esConteo = (valor: unknown): valor is number => typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;
const esConteoONulo = (valor: unknown): valor is number | null => valor === null || esConteo(valor);

function normalizarExito(r: Registro, puerta: Puerta): ResultadoGeneracion {
  const { salidaCruda, modelo, modeloDigest, latenciaMs, tokensEntrada, tokensSalida } = r;
  if (typeof salidaCruda === "string" && salidaCruda.length > MAX_SALIDA_CRUDA) return fallo(puerta, "ERROR_PROVEEDOR", "SALIDA_DEMASIADO_LARGA");
  const valido = typeof salidaCruda === "string" && typeof modelo === "string" && PATRON_MODELO.test(modelo)
    && typeof modeloDigest === "string" && PATRON_MODELO.test(modeloDigest) && esConteo(latenciaMs)
    && esConteoONulo(tokensEntrada) && esConteoONulo(tokensSalida);
  if (!valido) return fallo(puerta, "ERROR_PROVEEDOR", "RESULTADO_INVALIDO");
  return Object.freeze({ ok: true, puerta, salidaCruda, modelo, modeloDigest, latenciaMs, tokensEntrada, tokensSalida });
}

/** No se confía en lo que devuelve un generador: se copian solo los campos del contrato, ya revisados. */
function normalizar(resultado: unknown, puerta: Puerta): ResultadoGeneracion {
  if (!esObjetoPlano(resultado)) return fallo(puerta, "ERROR_PROVEEDOR", "RESULTADO_INVALIDO");
  if (resultado.ok === true) return normalizarExito(resultado, puerta);
  if (resultado.ok !== false) return fallo(puerta, "ERROR_PROVEEDOR", "RESULTADO_INVALIDO");
  if (!esDe(MOTIVOS_FALLO, resultado.motivo)) return fallo(puerta, "ERROR_PROVEEDOR", "MOTIVO_DESCONOCIDO");
  const { detalle } = resultado;
  const detalleValido = typeof detalle === "string" && detalle.length <= MAX_LARGO_DETALLE && PATRON_DETALLE.test(detalle);
  return fallo(puerta, resultado.motivo, detalleValido ? detalle : "DETALLE_NO_VALIDO");
}

/** Una puerta: el generador contra el límite del orquestador. Nunca lanza ni deja temporizadores vivos. */
async function intentar(generador: Generador, pedido: PedidoGeneracion): Promise<ResultadoGeneracion> {
  const { puerta } = generador;
  const control = new AbortController();
  let llamada: Promise<unknown>;
  try {
    llamada = Promise.resolve(generador.generar(pedido, control.signal));
  } catch {
    return fallo(puerta, "ERROR_PROVEEDOR", "EXCEPCION");
  }
  const respuesta = llamada.then((resultado) => normalizar(resultado, puerta), () => fallo(puerta, "ERROR_PROVEEDOR", "EXCEPCION"));
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<FalloGeneracion>((resolver) => {
    temporizador = setTimeout(() => {
      control.abort();
      resolver(fallo(puerta, "TIEMPO_AGOTADO", "LIMITE_DEL_ORQUESTADOR"));
    }, pedido.limiteMs);
  });
  try {
    return await Promise.race([respuesta, tope]);
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Prueba las puertas del modo en orden con el pedido; `paquete` es el paquete completo del que salió la vista, para
 * la guarda (nunca se le pasa a un generador). Devuelve el primer éxito, con los fallos previos, o todos los fallos.
 */
export async function generarConPuertas(generadores: readonly Generador[], modo: ModoPuertas, pedido: PedidoGeneracion, paquete: PaqueteHechos): Promise<ResultadoPuertas> {
  const orden = ordenDePuertas(modo);
  const registro = registrar(generadores);
  const contrato = revisarPedido(pedido);
  const fugas = fugasDeVistaCiega(contrato.vista, paquete);
  if (fugas.length > 0) return Object.freeze({ ok: false, fallos: Object.freeze(orden.map((puerta) => fallo(puerta, "VISTA_NO_CIEGA", fugas[0] as string))) });
  const revisado: PedidoGeneracion = clonCongelado(contrato);
  const fallos: FalloGeneracion[] = [];
  for (const puerta of orden) {
    const generador = registro.get(puerta);
    const resultado = generador === undefined ? fallo(puerta, "PUERTA_APAGADA", "SIN_GENERADOR") : await intentar(generador, revisado);
    if (resultado.ok) return Object.freeze({ ok: true, exito: resultado, fallosPrevios: Object.freeze([...fallos]) });
    fallos.push(resultado);
  }
  return Object.freeze({ ok: false, fallos: Object.freeze(fallos) });
}
