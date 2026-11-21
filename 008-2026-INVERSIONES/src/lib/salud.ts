/**
 * Estado de salud de la app: lo que responde GET /api/salud, que es PÚBLICA (sin sesión, D-014).
 * Solo `estado` y `version`: el detalle de un fallo de la base es información de más para quien no
 * inició sesión. El motivo queda en el registro del servidor, sin el mensaje crudo.
 */
export interface Salud {
  readonly estado: "ok" | "degradado";
  readonly version: string;
}

/** Evalúa la salud con una función que prueba la base de datos. */
export async function evaluarSalud(probarBase: () => Promise<void>, version: string): Promise<Salud> {
  try {
    await probarBase();
    return { estado: "ok", version };
  } catch (error) {
    // Registro interno sin el mensaje crudo (puede traer la URL de conexión con la clave).
    const codigo = (error as { code?: unknown; name?: unknown })?.code ?? (error as { name?: unknown })?.name ?? "desconocido";
    console.error(`[salud] la base no respondió (código: ${String(codigo)})`);
    return { estado: "degradado", version };
  }
}
