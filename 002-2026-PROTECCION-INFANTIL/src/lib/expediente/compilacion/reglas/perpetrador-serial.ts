/**
 * SPEC-234 (002-PI-134): regla N1 de posible perpetrador serial.
 * Dispara cuando el identificador acumula un número configurado de eventos/reportes.
 */
import type { EventoExpediente } from "@prisma/client";
import type { ResultadoRegla } from "./aceleracion";

export function detectarPerpetradorSerial(
    eventos: EventoExpediente[],
    umbralEventos: number
): ResultadoRegla {
    const detectado = eventos.length >= umbralEventos;
    const severidad: "MEDIA" | "ALTA" = eventos.length >= umbralEventos * 2 ? "ALTA" : "MEDIA";

    return {
        detectado,
        severidad: detectado ? severidad : "BAJA",
        descripcionTexto: detectado
            ? `Posible patrón de perpetrador serial: ${eventos.length} eventos asociados al identificador.`
            : "No se alcanza el umbral de eventos para patrón de perpetrador serial.",
        datosContextoJson: {
            tipoPatron: "PERPETRADOR_SERIAL",
            totalEventos: eventos.length,
            umbralEventos,
        },
    };
}
