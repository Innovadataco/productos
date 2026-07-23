import type { DespachoSolicitud } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { extraerIdDespachoExterno, extraerMensajeError } from "@/lib/normalizar";
import { envOr } from "@/lib/env";
import { colaMaxReintentos, colaBackoffMs } from "@/lib/cola-config";

export const LOTE = 20;

function urlDespachos(): string {
  const base = envOr("URL_DESPACHOS", "https://stub.local/despachoback/api/v1");
  return `${base}/despachosempresa`;
}

/// Reporta una solicitud a la Super (vía cliente stub/real) y persiste el resultado.
export async function enviarSolicitud(solicitud: DespachoSolicitud): Promise<void> {
  const cliente = getClienteSupertransporte();
  const resp = await cliente.postTransaccional(
    urlDespachos(),
    solicitud.payload,
    solicitud.usuarioId,
    Number(solicitud.rolId ?? 0),
  );
  const idExterno = extraerIdDespachoExterno(resp);
  await prisma.despachoSolicitud.update({
    where: { id: solicitud.id },
    data: {
      procesado: true,
      estado: "procesado",
      idDespachoExterno: idExterno,
      respuestaExterna: resp as object,
      errorExterno: null,
      siguienteIntento: new Date(),
      fechaActualizacion: new Date(),
    },
  });
}

export interface ResultadoLote {
  procesados: number;
  reprogramados: number;
  fallidos: number;
}

/// Procesa un lote de la cola (patrón table-driven del legacy). No usa pg-boss.
export async function procesarLote(
  opts: { limite?: number; maxReintentos?: number } = {},
): Promise<ResultadoLote> {
  const limite = opts.limite ?? LOTE;
  // D-019b: parametrizable por env (default 3), compartido por las 3 colas.
  const maxReintentos = opts.maxReintentos ?? colaMaxReintentos();
  const ahora = new Date();

  const solicitudes = await prisma.despachoSolicitud.findMany({
    where: { estado: "pendiente", procesado: false, siguienteIntento: { lte: ahora } },
    orderBy: { id: "asc" },
    take: limite,
  });

  let procesados = 0;
  let reprogramados = 0;
  let fallidos = 0;

  for (const solicitud of solicitudes) {
    await prisma.despachoSolicitud.update({
      where: { id: solicitud.id },
      data: { estado: "procesando", fechaActualizacion: new Date() },
    });
    try {
      await enviarSolicitud(solicitud);
      procesados += 1;
    } catch (error) {
      const mensaje = extraerMensajeError(error);
      const reintentos = (solicitud.reintentos ?? 0) + 1;
      if (reintentos >= maxReintentos) {
        await prisma.despachoSolicitud.update({
          where: { id: solicitud.id },
          data: {
            estado: "fallido",
            reintentos,
            errorExterno: mensaje,
            siguienteIntento: new Date(),
            fechaActualizacion: new Date(),
          },
        });
        fallidos += 1;
      } else {
        await prisma.despachoSolicitud.update({
          where: { id: solicitud.id },
          data: {
            estado: "pendiente",
            reintentos,
            errorExterno: mensaje,
            siguienteIntento: new Date(Date.now() + colaBackoffMs()),
            fechaActualizacion: new Date(),
          },
        });
        reprogramados += 1;
      }
    }
  }

  return { procesados, reprogramados, fallidos };
}

/// Reintento manual: reencola y RESETEA el contador (corrige bug 1 del demo).
export async function reintentarSolicitud(id: number): Promise<DespachoSolicitud> {
  return prisma.despachoSolicitud.update({
    where: { id },
    data: {
      estado: "pendiente",
      procesado: false,
      reintentos: 0,
      errorExterno: null,
      siguienteIntento: new Date(),
      fechaActualizacion: new Date(),
    },
  });
}
