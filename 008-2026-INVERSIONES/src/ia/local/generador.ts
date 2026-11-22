/**
 * La puerta local: el generador que le pide al Ollama del Mac (por la tailnet) un resumen de la vista ciega. Implementa
 * `Generador` del contrato con `puerta: "local"`. Su única entrada es `generarConPuertas`, que ya pasó el pedido por la
 * guarda contra el paquete; aquí, además, una segunda barrera sin el paquete (`barreraLocal`).
 *
 * `generar`, en orden y cerrando en fallo (nunca rechaza):
 * 1. una señal ya abortada → TIEMPO_AGOTADO, sin red;
 * 2. la barrera → ERROR_PROVEEDOR PEDIDO_INVALIDO o PEDIDO_NO_CIEGO, sin red;
 * 3. el digest del modelo por verificar → MODELO_NO_DISPONIBLE DIGEST_POR_VERIFICAR, sin red;
 * 4. el plazo: `limiteMs` del pedido desde la llamada (incluye la espera del turno), más la señal del orquestador;
 * 5. el turno: un pedido a la vez por instancia (el servicio crea UNA);
 * 6. GET /api/tags: el modelo está con el digest aprobado, si no MODELO_NO_DISPONIBLE, sin generar;
 * 7. POST /api/generate (`cuerpoGenerar`) y su lectura: el mismo modelo, terminada, sin cortar por largo y con una
 *    salida de hasta MAX_SALIDA_CRUDA (de `response` o, si viene vacía, de `thinking`).
 * La latencia va desde que se toma el turno (tags y generate, sin la espera en la cola). Los tokens, de
 * `prompt_eval_count` y `eval_count`. El digest devuelto es el aprobado, no el que diga el servidor.
 */
import { MAX_SALIDA_CRUDA, type ExitoGeneracion, type Generador, type PedidoGeneracion, type ResultadoGeneracion } from "../generador";
import { barreraLocal } from "./barrera";
import { consultarModelo, crearContexto, pedirGeneracion, tomarTurno, type ConfigLocal, type ContextoLocal, type DependenciasLocal } from "./contexto";
import { falloLocal } from "./errores";
import { cuerpoGenerar } from "./ollama";
import { abrirPlazo } from "./plazo";
import type { Liberar } from "./semaforo";
import { sondear, type OpcionesSonda, type ResultadoSondaLocal } from "./sonda";

export type { ConfigLocal, DependenciasLocal } from "./contexto";
export type { EtapaSonda, OpcionesSonda, ResultadoSondaLocal } from "./sonda";

export interface GeneradorLocal extends Generador {
  readonly puerta: "local";
  /** El ping y, si se pide, el smoke. El ping no espera el turno; el smoke sí. */
  sondaLocal(opciones: OpcionesSonda, senal?: AbortSignal): Promise<ResultadoSondaLocal>;
}

async function generarLocal(contexto: ContextoLocal, pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion> {
  if (senal.aborted) return falloLocal("TIEMPO_AGOTADO", "SENAL_ABORTADA");
  const barrera = barreraLocal(pedido);
  if (!barrera.ok) return barrera;
  const { digest } = contexto;
  if (digest === null) return falloLocal("MODELO_NO_DISPONIBLE", "DIGEST_POR_VERIFICAR");
  const plazo = abrirPlazo(senal, barrera.pedido.limiteMs);
  let liberar: Liberar | null = null;
  try {
    const turno = await tomarTurno(contexto, plazo);
    if (typeof turno !== "function") return turno;
    liberar = turno;
    const inicio = contexto.ahora();
    const modelo = await consultarModelo(contexto, digest, plazo);
    if (!modelo.ok) return modelo;
    const respuesta = await pedirGeneracion(contexto, cuerpoGenerar(contexto.nombre, barrera.pedido), plazo);
    if (!respuesta.ok) return respuesta;
    const { salida, tokensEntrada, tokensSalida, cortada } = respuesta.generacion;
    if (cortada) return falloLocal("ERROR_PROVEEDOR", "SALIDA_CORTADA");
    if (salida.length > MAX_SALIDA_CRUDA) return falloLocal("ERROR_PROVEEDOR", "SALIDA_DEMASIADO_LARGA");
    const exito: ExitoGeneracion = {
      ok: true,
      puerta: "local",
      salidaCruda: salida,
      modelo: contexto.nombre,
      modeloDigest: digest,
      latenciaMs: Math.max(0, contexto.ahora() - inicio),
      tokensEntrada,
      tokensSalida,
    };
    return Object.freeze(exito);
  } finally {
    liberar?.();
    plazo.cerrar();
  }
}

/** Crea la puerta local. Valida la configuración al crear: lanza `ErrorLocal` (sin repetir valores). */
export function crearGeneradorLocal(config: ConfigLocal, dependencias: DependenciasLocal): GeneradorLocal {
  const contexto = crearContexto(config, dependencias);
  return Object.freeze({
    puerta: "local",
    async generar(pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion> {
      try {
        return await generarLocal(contexto, pedido, senal);
      } catch {
        return falloLocal("ERROR_PROVEEDOR", "EXCEPCION_INTERNA");
      }
    },
    sondaLocal: (opciones: OpcionesSonda, senal?: AbortSignal): Promise<ResultadoSondaLocal> => sondear(contexto, opciones, senal),
  });
}
