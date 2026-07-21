/// Gate del guardarraíl. El modo REAL (que consume las APIs productivas de Supertransporte)
/// SOLO se activa con AMBAS condiciones. Cualquier otra combinación => stub.
export type ModoIntegracion = "stub" | "real";

export function modoIntegracion(): ModoIntegracion {
  const modo = process.env.INTEGRACIONES_MODO;
  const habilitado = process.env.SUPERTRANSPORTE_HABILITADO === "true";
  if (modo === "real" && habilitado) return "real";
  return "stub";
}

export function integracionRealActiva(): boolean {
  return modoIntegracion() === "real";
}
