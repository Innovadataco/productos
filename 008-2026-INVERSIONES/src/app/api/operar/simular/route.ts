import { origenRechazado, leerCuerpoJson } from "@/plan/edicion/http";
import { respuestaJson } from "@/auth/respuestas";
import { exigirSesionApi } from "@/auth/sesion";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { leerPedidoSimulacion } from "@/operar/pantalla/entrada";
import { permitidoSimular } from "@/operar/pantalla/frecuencia";
import { leerEntradasSimulador } from "@/operar/pantalla/leer";
import { conPrecioActual } from "@/operar/pantalla/precio-actual";
import { simularOperacion } from "@/operar/simulador/simular";
import { textoRegla } from "@/operar/simulador/textos";
import type { EstadoSimulado, OperacionSimulada, Simulacion } from "@/operar/simulador/tipos";
import type { FuenteCaja } from "@/operar/analisis/tipos";
import { analizarSimulacion } from "@/operar/pantalla/analisis";
import { aVistaAnalisis, type VistaAnalisisSimulacion } from "@/operar/analisis/vista";
import { fechaEnBogota } from "@/precios/horario";
import { aRespuestaSimulacion } from "@/app/operar/serializar-simulacion";

export const dynamic = "force-dynamic";

type Decimal = Prisma.Decimal;

/**
 * El análisis del antes y el después (motores de src/analisis/ y src/proyecciones/, sin cambiar sus cálculos). Si falla,
 * la simulación sale igual, sin análisis; al registro, solo el nombre del error.
 */
async function analisisDe(usuarioId: string, hoy: Date, operacion: OperacionSimulada, s: Simulacion, estado: EstadoSimulado, caja: FuenteCaja, precioActual: Decimal | null): Promise<VistaAnalisisSimulacion | null> {
  const id = operacion.instrumentoId;
  try {
    const cantidadDespues = s.especies.find((e) => e.instrumentoId === id)?.despues.cantidad ?? 0n;
    const a = await analizarSimulacion(db, { hoy, usuarioId, instrumentoId: id, cantidadDespues, reglas: estado.reglas, caja: { antes: s.cajaAntes, despues: s.cajaDespues }, precioActual, precioLimite: operacion.precioLimite });
    const nombre = estado.posiciones.find((p) => p.instrumentoId === id)?.nemotecnico ?? "";
    const regla = estado.reglas.find((r) => r.instrumentoId === id);
    return aVistaAnalisis({ ...a, operadaId: id, lado: operacion.lado, plan: regla === undefined ? null : textoRegla(regla, nombre), caja });
  } catch (error) {
    console.error(`[operar:simular] análisis no calculado (${error instanceof Error ? error.name : "desconocido"})`);
    return null;
  }
}

/** Cinco campos cortos en JSON caben de sobra en 1 KB. */
const CUERPO_MAX_BYTES = 1024;
const PEDIDO_INVALIDO = "Solicitud inválida.";
const NO_SE_PUDO = "No se pudo simular la operación. Intente de nuevo.";
const DEMASIADAS = "Demasiadas simulaciones seguidas. Intente de nuevo en un momento.";

/**
 * POST /api/operar/simular · el simulador «¿Y si…?» de /operar (O2 con la tarifa de O5): Origin de la lista (CSRF) →
 * sesión revalidada contra la base (el dueño y la familia: no escribe nada) → límite por usuario (429 con Retry-After) →
 * cuerpo JSON de 1 KB con EXACTAMENTE siete claves (especie, lado, cantidad, precio límite, comisionista, el saldo en el comisionista y el precio actual de trii Pro, estos dos pueden ir vacíos; «hoy» lo
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
    const { operacion, comisionista, saldo, precioActual } = leido.valor;
    const entradas = await leerEntradasSimulador(db, fechaEnBogota(new Date()), comisionista);
    // Con el saldo escrito por el dueño, la caja es ese valor (no se guarda); si no, la certificada de A&V.
    const conCaja = saldo === null ? entradas.estado : { ...entradas.estado, caja: saldo };
    // Con el precio actual escrito, la especie operada se valora con él y no con su último cierre (no se guarda).
    const estado = precioActual === null ? conCaja : conPrecioActual(conCaja, operacion.instrumentoId, precioActual);
    const precioEscrito = precioActual === null ? null : { precio: precioActual, cierreFecha: entradas.estado.posiciones.find((p) => p.instrumentoId === operacion.instrumentoId)?.cierre?.fecha ?? null };
    const resultado = simularOperacion(estado, operacion, entradas.contexto);
    const fuenteCaja: FuenteCaja = saldo !== null ? "ESCRITA" : entradas.caja.fechaCorte === null ? "SIN_CERTIFICACION" : "AV";
    const analisis = resultado.ok ? await analisisDe(sesion.usuario.id, entradas.contexto.hoy, operacion, resultado.simulacion, estado, fuenteCaja, precioActual) : null;
    return respuestaJson(aRespuestaSimulacion(resultado, operacion.instrumentoId, estado.posiciones, saldo === null ? entradas.caja.fechaCorte : "ESCRITA", analisis, precioEscrito), 200);
  } catch (error) {
    console.error(`[operar:simular] no se pudo simular (${error instanceof Error ? error.name : "desconocido"})`);
    return respuestaJson({ error: NO_SE_PUDO }, 500);
  }
}
