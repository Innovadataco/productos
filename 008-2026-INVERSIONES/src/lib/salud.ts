/** Estado de salud de la app: lo que responde GET /api/salud. */
export type Salud =
  | { estado: "ok"; base: "ok"; version: string }
  | { estado: "degradado"; base: "caida"; version: string; motivo: string };

/**
 * Evalúa la salud con una función que prueba la base de datos.
 * No expone detalles internos del error (puede traer la URL de conexión): solo un motivo genérico.
 */
export async function evaluarSalud(probarBase: () => Promise<void>, version: string): Promise<Salud> {
  try {
    await probarBase();
    return { estado: "ok", base: "ok", version };
  } catch (error) {
    // Registro interno sin el mensaje crudo (puede traer la URL de conexión con la clave).
    const codigo = (error as { code?: unknown; name?: unknown })?.code ?? (error as { name?: unknown })?.name ?? "desconocido";
    console.error(`[salud] la base no respondió (código: ${String(codigo)})`);
    return { estado: "degradado", base: "caida", version, motivo: "sin conexión a la base de datos" };
  }
}
