import type { LlegadaSolicitud } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { extraerIdLlegadaExterno, extraerMensajeError } from "@/lib/normalizar";
import { envOr } from "@/lib/env";
import { colaMaxReintentos, colaBackoffMs } from "@/lib/cola-config";

export const LOTE = 20;

function urlLlegadas(): string {
  const base = envOr("URL_DESPACHOS", "https://stub.local/despachoback/api/v1");
  return `${base}/llegadasempresas`;
}

/// Reporta una llegada a la Super (vía cliente stub/real) y persiste el resultado.
export async function enviarLlegada(solicitud: LlegadaSolicitud): Promise<void> {
  const cliente = getClienteSupertransporte();
  const resp = await cliente.postTransaccional(
    urlLlegadas(),
    solicitud.payload,
    solicitud.usuarioId,
    Number(solicitud.rolId ?? 0),
  );
  const idExterno = extraerIdLlegadaExterno(resp);
  await prisma.llegadaSolicitud.update({
    where: { id: solicitud.id },
    data: {
      procesado: true,
      estado: "procesado",
      idLlegadaExterno: idExterno,
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

/// Procesa un lote de la cola de llegadas (mismo patrón table-driven que despachos).
export async function procesarLoteLlegadas(
  opts: { limite?: number; maxReintentos?: number } = {},
): Promise<ResultadoLote> {
  const limite = opts.limite ?? LOTE;
  // D-019b: parametrizable por env (default 3), compartido por las 3 colas.
  const maxReintentos = opts.maxReintentos ?? colaMaxReintentos();
  const ahora = new Date();

  const solicitudes = await prisma.llegadaSolicitud.findMany({
    where: { estado: "pendiente", procesado: false, siguienteIntento: { lte: ahora } },
    orderBy: { id: "asc" },
    take: limite,
  });

  let procesados = 0;
  let reprogramados = 0;
  let fallidos = 0;

  for (const solicitud of solicitudes) {
    await prisma.llegadaSolicitud.update({
      where: { id: solicitud.id },
      data: { estado: "procesando", fechaActualizacion: new Date() },
    });
    try {
      await enviarLlegada(solicitud);
      procesados += 1;
    } catch (error) {
      const mensaje = extraerMensajeError(error);
      const reintentos = (solicitud.reintentos ?? 0) + 1;
      if (reintentos >= maxReintentos) {
        await prisma.llegadaSolicitud.update({
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
        await prisma.llegadaSolicitud.update({
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

/// Reintento manual: reencola y RESETEA el contador (mismo antipatrón corregido que despachos).
export async function reintentarLlegada(id: number): Promise<LlegadaSolicitud> {
  return prisma.llegadaSolicitud.update({
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
