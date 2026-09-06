/**
 * SPEC-548 (I-337) · ¿El error es porque el navegador no pudo traer un trozo de
 * código que ya no está en el servidor? (típico tras un despliegue: el HTML
 * viejo pide un chunk que el build nuevo ya renombró.) La salida es recargar.
 *
 * Reconoce las formas que usan Next/webpack y los navegadores sin atarse a una
 * sola: el `name` "ChunkLoadError" y los mensajes de fallo de import dinámico
 * de Chrome/Firefox/Safari. NO marca errores de lógica normales — si marcara de
 * más, un bug real se disfrazaría de «recargá» y se escondería.
 */
export function esErrorDeChunk(error: unknown): boolean {
    if (error == null) return false;
    const e = error as { name?: unknown; message?: unknown };
    if (typeof e.name === "string" && e.name === "ChunkLoadError") return true;
    const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
    if (!msg) return false;
    return (
        msg.includes("loading chunk") ||
        msg.includes("loading css chunk") ||
        msg.includes("failed to fetch dynamically imported module") ||
        msg.includes("importing a module script failed") ||
        msg.includes("error loading dynamically imported module")
    );
}
