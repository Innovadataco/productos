import { origenRechazado, leerCuerpoJson } from "@/plan/edicion/http";
import { respuestaJson } from "@/auth/respuestas";
import { exigirSesionApi } from "@/auth/sesion";
import { db } from "@/lib/db";
import { leerPedidoSimulacion } from "@/operar/pantalla/entrada";
import { permitidoSimular } from "@/operar/pantalla/frecuencia";
import { leerEntradasSimulador } from "@/operar/pantalla/leer";
import { simularOperacion } from "@/operar/simulador/simular";
import { fechaEnBogota } from "@/precios/horario";
import { aRespuestaSimulacion } from "@/app/operar/serializar-simulacion";

export const dynamic = "force-dynamic";

/** Cinco campos cortos en JSON caben de sobra en 1 KB. */
const CUERPO_MAX_BYTES = 1024;
const PEDIDO_INVALIDO = "Solicitud inválida.";
const NO_SE_PUDO = "No se pudo simular la operación. Intente de nuevo.";
const DEMASIADAS = "Demasiadas simulaciones seguidas. Intente de nuevo en un momento.";

/**
 * POST /api/operar/simular · el simulador «¿Y si…?» de /operar (O2 con la tarifa de O5): Origin de la lista (CSRF) →
 * sesión revalidada contra la base (el dueño y la familia: no escribe nada) → límite por usuario (429 con Retry-After) →
 * cuerpo JSON de 1 KB con EXACTAMENTE seis claves (especie, lado, cantidad, precio límite, comisionista y el saldo en el comisionista, que puede ir vacío; «hoy» lo
 * pone el servidor) → lectura de su portafolio, su plan, su historia y la tarifa vigente → el motor. Los errores de lo
 * escrito vuelven como texto con 200 y `ok: false`; un cuerpo ilegible, 400. Nada se guarda. Siempre `no-store`. Ante
 * un error, un mensaje genérico; al registro, solo el nombre del error (los RangeError del motor traen ids, nunca montos).
 */
export async function POST(pedido: Request): Promise<Response> {
  const rechazo = origenRechazado(pedido);
  if (rechazo) return rechazo;
  try {
    const sesion = await exigirSesionApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const frecuencia = permitidoSimular(sesion.usuario.id, Date.now());
    if (!frecuencia.permitido) return respuestaJson({ error: DEMASIADAS }, 429, { "Retry-After": String(frecuencia.reintentarEnS) });
    const cuerpo = await leerCuerpoJson(pedido, CUERPO_MAX_BYTES);
    const leido = cuerpo.ok ? leerPedidoSimulacion(cuerpo.valor) : null;
    if (leido === null) return respuestaJson({ error: PEDIDO_INVALIDO }, 400);
    if (!leido.ok) return respuestaJson({ error: PEDIDO_INVALIDO, campos: leido.campos }, 400);
    const { operacion, comisionista, saldo } = leido.valor;
    const entradas = await leerEntradasSimulador(db, fechaEnBogota(new Date()), comisionista);
    // Con el saldo escrito por el dueño, la caja es ese valor (no se guarda); si no, la certificada de A&V.
    const estado = saldo === null ? entradas.estado : { ...entradas.estado, caja: saldo };
    const resultado = simularOperacion(estado, operacion, entradas.contexto);
    return respuestaJson(aRespuestaSimulacion(resultado, operacion.instrumentoId, estado.posiciones, saldo === null ? entradas.caja.fechaCorte : "ESCRITA"), 200);
  } catch (error) {
    console.error(`[operar:simular] no se pudo simular (${error instanceof Error ? error.name : "desconocido"})`);
    return respuestaJson({ error: NO_SE_PUDO }, 500);
  }
}
