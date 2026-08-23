/**
 * SPEC-234 (002-PI-134): utilidades de test para el servicio de compilación.
 */
import type { EventoExpediente } from "@prisma/client";

export function crearEvento(
    overrides: Partial<EventoExpediente> & { fechaEvento: Date }
): EventoExpediente {
    return {
        id: `evt-${Math.random().toString(36).slice(2)}`,
        expedienteId: "exp-test",
        ordenSecuencial: 1,
        reporteId: null,
        texto: "Texto de evento de prueba (no se incluye en salidas)",
        categoriaDetectada: null,
        confianzaClasificacion: null,
        plataforma: null,
        adjuntosMetaJson: null,
        createdAt: new Date(),
        ...overrides,
    } as EventoExpediente;
}
