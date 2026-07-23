/// Ejecución de una operación de la consola (spec 013). ÚNICO camino: `getClienteSupertransporte()`
/// (stub por el gate apagado en Fase 1; cero red). Valida contra el catálogo, cronometra, redacta
/// y REGISTRA en `ApiLlamada` — SIEMPRE, en éxito o error (nunca lanza sin registrar). En Fase 2 el
/// mismo camino ejecuta real al encender el gate, sin tocar este código.
import { prisma } from "@/lib/prisma";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { modoIntegracion } from "@/lib/integracion/modo";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { SolicitudIntegradora } from "@/lib/integracion/integradora-tipos";
import { buscarOperacion, type OperacionCatalogo } from "./catalogo";
import { redactarYTruncar } from "./redactar";

export interface UsuarioConsola {
  id: number;
  rolId: number | null;
  identificacion: string | null;
  nitEfectivo?: string | null;
}

export interface ResultadoEjecucion {
  respuesta: unknown;
  duracionMs: number;
  logId: number;
  modo: string;
  status: number;
  error: string | null;
}

/// Despacha al método del cliente según el `ejecutor` declarado en el catálogo (tabla, no switch
/// disperso). Usa el payload de forma tolerante. `body` opcional envuelve el cuerpo transaccional.
async function despachar(op: OperacionCatalogo, payload: Record<string, unknown>, u: UsuarioConsola): Promise<unknown> {
  const cli = getClienteSupertransporte();
  const ident = u.identificacion ?? "";
  const rol = u.rolId ?? 0;
  const body = (payload["body"] as unknown) ?? payload;
  switch (op.ejecutor) {
    case "postTransaccional":
      return cli.postTransaccional(op.pathExterno, body, ident, rol);
    case "consultarIntegradora":
      return cli.consultarIntegradora(body as SolicitudIntegradora, ident, rol);
    case "consultarRutasActivas":
      return cli.consultarRutasActivas(String(payload["nit"] ?? u.nitEfectivo ?? ident));
    case "consultarAutorizaciones":
      return cli.consultarAutorizaciones(
        String(payload["nit"] ?? u.nitEfectivo ?? ident),
        String(payload["placa"] ?? ""),
        String(payload["fecha"] ?? ""),
      );
    case "postMantenimiento":
      return cli.postMantenimiento(op.pathExterno, body, ident, rol, op.opciones);
    case "getMantenimiento":
      return cli.getMantenimiento(op.pathExterno, (payload as Record<string, string>) ?? {}, ident, rol);
  }
}

export async function ejecutarOperacion(
  clave: string,
  payload: Record<string, unknown>,
  usuario: UsuarioConsola,
): Promise<ResultadoEjecucion> {
  const op = buscarOperacion(clave);
  if (!op || op.pendiente) {
    // Operación inexistente o no ejecutable: 400. No se registra basura de una clave inválida.
    throw new AppError("Operación no válida o no ejecutable en Fase 1", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  const modo = modoIntegracion();
  const t0 = Date.now();
  let respuesta: unknown = null;
  let status = 200;
  let error: string | null = null;
  try {
    respuesta = await despachar(op, payload, usuario);
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Error desconocido";
    status = 502; // upstream (stub) falló
  }
  const duracionMs = Date.now() - t0;

  // Registro SIEMPRE (éxito o error), con redacción recursiva y truncado antes de persistir.
  const log = await prisma.apiLlamada.create({
    data: {
      usuarioId: usuario.id,
      rolId: usuario.rolId ?? null,
      nitEfectivo: usuario.nitEfectivo ?? usuario.identificacion ?? null,
      operacion: clave,
      modo,
      metodo: op.metodo,
      endpoint: op.pathExterno,
      request: redactarYTruncar(payload) as object,
      respuesta: redactarYTruncar(respuesta) as object,
      status,
      duracionMs,
      error,
    },
  });

  return { respuesta, duracionMs, logId: log.id, modo, status, error };
}
