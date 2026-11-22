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
 * 7. POST /api/generate (`cuerpoGenerar`) y su lectura: el mismo modelo, terminada con «stop» (o sin `done_reason`),
 *    con una salida de hasta MAX_SALIDA_CRUDA de `response` o, si viene vacía, de `thinking`; esta última solo si es
 *    un objeto JSON (el esquema obliga a `response`, no al razonamiento).
 * La latencia va desde que se toma el turno (tags y generate, sin la espera en la cola). Los tokens, de
 * `prompt_eval_count` y `eval_count`. El digest devuelto es el aprobado, no el que diga el servidor.
 */
import { MAX_SALIDA_CRUDA, type ExitoGeneracion, type Generador, type PedidoGeneracion, type ResultadoGeneracion } from "../generador";
import { barreraLocal } from "./barrera";
import { consultarModelo, crearContexto, pedirGeneracion, tomarTurno, type ConfigLocal, type ContextoLocal, type DependenciasLocal } from "./contexto";
import { falloLocal } from "./errores";
import { cuerpoGenerar, type Generacion } from "./ollama";
import { abrirPlazo } from "./plazo";
import type { Liberar } from "./semaforo";
import { sondear, type OpcionesSonda, type ResultadoSondaLocal } from "./sonda";

export type { ConfigLocal, DependenciasLocal } from "./contexto";
export type { EtapaSonda, OpcionesSonda, ResultadoSondaLocal } from "./sonda";

export interface GeneradorLocal extends Generador {
  readonly puerta: "local";
  /**
   * El ping y, si se pide, el smoke. El ping no espera el turno; el smoke sí. Con opciones inválidas (un defecto del
   * código) rechaza con `ErrorLocal`; con lo demás nunca rechaza.
   */
  sondaLocal(opciones: OpcionesSonda, senal?: AbortSignal): Promise<ResultadoSondaLocal>;
}

function esObjetoJson(texto: string): boolean {
  try {
    const valor: unknown = JSON.parse(texto);
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
  } catch {
    return false;
  }
}

/** La generación leída, como resultado: rechaza lo cortado, lo que termina raro, lo largo y el razonamiento suelto. */
function resultadoDe(contexto: ContextoLocal, digest: string, generacion: Generacion, latenciaMs: number): ResultadoGeneracion {
  const { salida, origen, tokensEntrada, tokensSalida, finalizacion } = generacion;
  if (finalizacion === "POR_LARGO") return falloLocal("ERROR_PROVEEDOR", "SALIDA_CORTADA");
  if (finalizacion === "OTRA") return falloLocal("ERROR_PROVEEDOR", "FINALIZACION_INESPERADA");
  if (salida.length > MAX_SALIDA_CRUDA) return falloLocal("ERROR_PROVEEDOR", "SALIDA_DEMASIADO_LARGA");
  if (origen === "THINKING" && !esObjetoJson(salida)) return falloLocal("ERROR_PROVEEDOR", "PENSAMIENTO_SIN_JSON");
  const exito: ExitoGeneracion = { ok: true, puerta: "local", salidaCruda: salida, modelo: contexto.nombre, modeloDigest: digest, latenciaMs, tokensEntrada, tokensSalida };
  return Object.freeze(exito);
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
    const respuesta = await pedirGeneracion(contexto, cuerpoGenerar(contexto.nombre, barrera.pedido, contexto.temperaturaCentesimas), plazo);
    return respuesta.ok ? resultadoDe(contexto, digest, respuesta.generacion, Math.max(0, contexto.ahora() - inicio)) : respuesta;
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
