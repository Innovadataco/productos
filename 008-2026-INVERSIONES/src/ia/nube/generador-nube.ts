import "server-only";
/**
 * La puerta nube: un `Generador` con `puerta: "nube"` que pide el resumen a la API de Claude, con el modelo y el
 * esfuerzo de la configuración (E8; sin ellos, `claude-opus-5-5` y esfuerzo bajo). El tope usa el precio de ESE modelo.
 * Construida y APAGADA: sin la llave o sin el tope de la configuración, cada pedido da PUERTA_APAGADA sin intentar
 * nada (ni el gasto, ni el cliente, ni la red). Se enciende solo con el sí de Jelk, cargando las dos variables.
 *
 * Cada pedido, en su turno (una llamada a la vez por instancia; la espera se puede abortar) y sin lanzar nunca:
 * 1. la señal ya abortada (en la espera o antes del gasto) → TIEMPO_AGOTADO;
 * 2. el cuerpo (`armarCuerpoNube`): si el pedido no debe salir a internet, ERROR_PROVEEDOR con su código, sin gastar;
 * 3. el gasto del mes (inyectado), en carrera con la señal: si falla o no tiene forma, TOPE_MENSUAL sin llamar;
 * 4. el tope: lo gastado + lo reservado en ese mes + el costo máximo de esta llamada ≤ tope, o TOPE_MENSUAL sin llamar;
 * 5. la llamada, con la señal del orquestador, el límite del pedido y ningún reintento;
 * 6. la respuesta o el error, traducidos. Si la llamada pudo cobrarse sin saberse cuánto (un aborto en vuelo, un corte,
 *    un 408 o un 5xx, un 200 ilegible), su costo máximo queda RESERVADO en ese mes para esta instancia; si llegó bien
 *    pero con la señal ya abortada (el orquestador la descarta y nadie la registra), se reserva su costo real. El tope
 *    solo se vuelve más estricto. La reserva no sobrevive a un reinicio (persistirla le toca al registro y al servicio).
 *
 * Lo que este cliente NO cubre y queda para el servicio (E6): registrar cada corrida antes de pedir la siguiente (el
 * turno cubre gasto, tope y llamada, no el guardado del registro) y usar una sola instancia por proceso.
 */
import type { Generador, PedidoGeneracion, ResultadoGeneracion } from "../generador";
import { esDe } from "../formas";
import { CODIGOS_APAGADO_NUBE, LlaveNube, codigoDelTope, type CodigoApagadoNube, type ConfigNube } from "./config";
import { AJUSTES_NUBE_POR_OMISION, MAX_TOKENS_NUBE, armarCuerpoNube, revisarAjustesNube, type AjustesNube, type ClienteMensajes } from "./peticion";
import { falloNube, hayPosibleCobro, leerRespuesta, traducirError } from "./respuesta";
import { cabeEnElTope, costoMaximoMicroUsd, costoMicroUsd, costoTokensMicroUsd, esGastoDelMes, type LeerGastoDelMes } from "./tope";
import { crearClienteAnthropic, type OpcionesClienteNube } from "./transporte";

export interface DependenciasNube {
  /** Lo gastado por la puerta nube en el mes en curso (lo implementa el registro, E3). */
  readonly gastoDelMes: LeerGastoDelMes;
  /** El `fetch` de abajo; por omisión, el global. En el servicio (E6), el que sale por el proxy de salida. */
  readonly fetch?: typeof fetch;
  /** Reloj en milisegundos para la latencia; por omisión, `performance.now`. */
  readonly ahora?: () => number;
  /** La fábrica del cliente del SDK; por omisión, el SDK oficial con sus opciones cerradas. Las pruebas inyectan un doble. */
  readonly crearCliente?: (opciones: OpcionesClienteNube) => ClienteMensajes;
}

interface Lista {
  readonly cliente: ClienteMensajes;
  readonly topeMicroUsd: bigint;
  readonly ajustes: AjustesNube;
}

/** Los ajustes de la configuración: los de omisión si no vino ninguno; null si vino alguno que no es de la lista. */
function ajustesDe(modelo: unknown, esfuerzo: unknown): AjustesNube | null {
  if (modelo === undefined && esfuerzo === undefined) return AJUSTES_NUBE_POR_OMISION;
  return revisarAjustesNube({ modelo, esfuerzo });
}

type Carrera<T> = { readonly tipo: "valor"; readonly valor: T } | { readonly tipo: "error" } | { readonly tipo: "abortado" };

/** La promesa contra la señal; nunca rechaza y no deja oyentes colgados. Un rechazo tardío queda atrapado. */
function contraLaSenal<T>(promesa: Promise<T>, senal: AbortSignal): Promise<Carrera<T>> {
  if (senal.aborted) {
    promesa.catch(() => undefined);
    return Promise.resolve({ tipo: "abortado" });
  }
  return new Promise((resolver) => {
    const alAbortar = (): void => resolver({ tipo: "abortado" });
    senal.addEventListener("abort", alAbortar, { once: true });
    promesa.then(
      (valor) => resolver({ tipo: "valor", valor }),
      () => resolver({ tipo: "error" }),
    ).finally(() => senal.removeEventListener("abort", alAbortar));
  });
}

/** La configuración lista (con el cliente construido) o el código de apagado. */
function prepararConfig(config: unknown, dependencias: DependenciasNube): Lista | CodigoApagadoNube {
  if (typeof config !== "object" || config === null) return "SIN_LLAVE";
  const { lista, llave, topeMicroUsd, detalle, modelo, esfuerzo } = config as Record<string, unknown>;
  if (lista !== true) return esDe(CODIGOS_APAGADO_NUBE, detalle) ? detalle : "SIN_LLAVE";
  if (!LlaveNube.es(llave)) return "LLAVE_INVALIDA";
  const codigoTope = codigoDelTope(topeMicroUsd);
  if (codigoTope !== null) return codigoTope;
  const ajustes = ajustesDe(modelo, esfuerzo);
  if (ajustes === null) return "AJUSTES_INVALIDOS";
  try {
    const crear = dependencias.crearCliente ?? crearClienteAnthropic;
    return { cliente: crear({ llave, fetchBase: dependencias.fetch ?? globalThis.fetch }), topeMicroUsd: topeMicroUsd as bigint, ajustes };
  } catch {
    return "CLIENTE_NO_CONSTRUIDO";
  }
}

export function crearGeneradorNube(config: ConfigNube, dependencias: DependenciasNube): Generador {
  const preparada = prepararConfig(config, dependencias);
  const ahora = dependencias.ahora ?? (() => performance.now());
  let cola: Promise<void> = Promise.resolve();
  let reserva: { readonly mes: string; readonly microUsd: bigint } = { mes: "", microUsd: 0n };

  const reservar = (mes: string, microUsd: bigint): void => {
    reserva = { mes, microUsd: (reserva.mes === mes ? reserva.microUsd : 0n) + microUsd };
  };

  /** Un pedido, ya en su turno. */
  async function intentar(lista: Lista, pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion> {
    const { modelo } = lista.ajustes;
    const armado = armarCuerpoNube(pedido, lista.ajustes);
    if (!armado.ok) return falloNube("ERROR_PROVEEDOR", armado.detalle);
    const maximo = costoMaximoMicroUsd(armado.json, MAX_TOKENS_NUBE, modelo);
    const gasto = await contraLaSenal(Promise.resolve().then(() => dependencias.gastoDelMes()), senal);
    if (gasto.tipo === "abortado") return falloNube("TIEMPO_AGOTADO", "ABORTADO");
    if (gasto.tipo === "error" || !esGastoDelMes(gasto.valor)) return falloNube("TOPE_MENSUAL", "GASTO_NO_VERIFICABLE");
    const { mes } = gasto.valor;
    const reservado = reserva.mes === mes ? reserva.microUsd : 0n;
    if (!cabeEnElTope(costoMicroUsd(gasto.valor) + reservado, maximo, lista.topeMicroUsd)) return falloNube("TOPE_MENSUAL", "TOPE_DEL_MES");
    if (senal.aborted) return falloNube("TIEMPO_AGOTADO", "ABORTADO");
    const inicio = ahora();
    try {
      const crudo = await lista.cliente.messages.create(armado.cuerpo, { signal: senal, timeout: armado.limiteMs, maxRetries: 0 });
      const resultado = leerRespuesta(crudo, ahora() - inicio, modelo);
      // Un 200 ilegible pudo cobrarse; un éxito con la señal ya abortada lo descarta el orquestador y no lo registra nadie.
      if (!resultado.ok) reservar(mes, maximo);
      else if (senal.aborted) reservar(mes, costoTokensMicroUsd(modelo, resultado.tokensEntrada, resultado.tokensSalida));
      return resultado;
    } catch (error) {
      if (hayPosibleCobro(error)) reservar(mes, maximo);
      return traducirError(error, senal);
    }
  }

  /** En la fila: espera su turno (abortable), corre y libera el turno pase lo que pase. */
  async function enFila(lista: Lista, pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion> {
    const anterior = cola;
    let terminar!: () => void;
    const fin = new Promise<void>((resolver) => {
      terminar = resolver;
    });
    cola = anterior.then(() => fin);
    const enSuTurno = async (): Promise<ResultadoGeneracion> => {
      const turno = await contraLaSenal(anterior, senal);
      return turno.tipo === "valor" ? intentar(lista, pedido, senal) : falloNube("TIEMPO_AGOTADO", "ABORTADO");
    };
    const resultado = await enSuTurno().catch(() => falloNube("ERROR_PROVEEDOR", "EXCEPCION_INTERNA"));
    terminar();
    return resultado;
  }

  return Object.freeze({
    puerta: "nube" as const,
    generar(pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion> {
      if (typeof preparada === "string") return Promise.resolve(falloNube("PUERTA_APAGADA", preparada));
      return enFila(preparada, pedido, senal);
    },
  });
}
