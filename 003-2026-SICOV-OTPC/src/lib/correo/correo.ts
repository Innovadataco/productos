/// Interfaz única de correo (D-048). Un solo contrato para credenciales (alta empresa/usuario,
/// reenviar, recuperar clave). La factory resuelve el adaptador según el entorno:
///   - con RESEND_API_KEY  → AdaptadorResend (API HTTP; cero deps, vía fetch)
///   - sin la key          → AdaptadorStub (log, comportamiento actual)
/// El envío NUNCA participa de la transacción de alta: un fallo de Resend jamás revierte datos.
import { crearAdaptadorStub } from "./stub";
import { crearAdaptadorResend } from "./resend";

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
}

export interface ResultadoEnvio {
  ok: boolean;
  /// id del proveedor (Resend) cuando aplica; "stub" en modo stub.
  id?: string;
  /// motivo del fallo (nunca incluye la clave temporal ni secretos).
  error?: string;
  modo: "resend" | "stub";
}

export interface Correo {
  enviarCorreo(mensaje: MensajeCorreo): Promise<ResultadoEnvio>;
}

/// Factory de correo. Lee el entorno en cada llamada (permite tests con/sin key sin recargar).
export function getCorreo(): Correo {
  const key = process.env.RESEND_API_KEY?.trim();
  if (key) return crearAdaptadorResend(key, process.env.CORREO_REMITENTE?.trim());
  return crearAdaptadorStub();
}
