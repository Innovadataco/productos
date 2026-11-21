/**
 * Arranque del servidor (Next llama a `register()` al iniciar; no lo hace en `next build`).
 * Login de Inversiones (D-014): sin un secreto de sesión válido, o en producción sin APP_ORIGEN, la app
 * no arranca. Next solo registra un error de `register()` y deja el servidor escuchando (verificado con
 * el standalone: respondía 500 a todo), así que aquí se termina el proceso con código 1. El mensaje dice
 * qué falta, nunca el valor del secreto.
 */
const NO_ARRANCA = 1;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { verificarArranque } = await import("./auth/arranque");
  try {
    verificarArranque(process.env);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : "configuración inválida";
    console.error(`[arranque] ${motivo} La app no arranca.`);
    // La condición repetida deja fuera `process.exit` del paquete de Edge (Next avisa si lo ve).
    if (process.env.NEXT_RUNTIME === "nodejs") process.exit(NO_ARRANCA);
  }
}
