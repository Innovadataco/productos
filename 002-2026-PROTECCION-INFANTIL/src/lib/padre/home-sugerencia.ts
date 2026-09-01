/**
 * SPEC-309 (A-50): sugerencia proactiva del home del padre basada en reglas
 * simples (sin LLM). No importa servicios de SPEC-307.
 */
import type { ColorSemaforo } from "./home-semaforo";

export type SugerenciaHome = {
    texto: string;
    accionHref: string | null;
    accionTexto: string | null;
    prioridad: "baja" | "media" | "alta";
};

export interface DatosSugerenciaInput {
    totalContactos: number;
    contactosRojo: number;
    contactosAmbar: number;
    enPeriodoGracia: boolean;
    nombrePadre: string | null;
}

export function calcularSugerenciaHome(input: DatosSugerenciaInput): SugerenciaHome {
    const { totalContactos, contactosRojo, contactosAmbar, enPeriodoGracia } = input;

    if (enPeriodoGracia) {
        return {
            texto: "Tu suscripción está en período de gracia. Renueva para seguir recibiendo alertas del círculo.",
            accionHref: "/dashboard/padre/suscripcion",
            accionTexto: "Renovar plan",
            prioridad: "alta",
        };
    }

    if (contactosRojo > 0) {
        const plural = contactosRojo === 1 ? "contacto" : "contactos";
        return {
            texto: `Tienes ${contactosRojo} ${plural} con nivel de atención alto. Entra a Mis reportes y míralo con calma.`,
            accionHref: "/mis-reportes",
            accionTexto: "Ver mis reportes",
            prioridad: "alta",
        };
    }

    if (contactosAmbar > 0) {
        const plural = contactosAmbar === 1 ? "contacto" : "contactos";
        return {
            texto: `Tienes ${contactosAmbar} ${plural} en seguimiento. Mantente atento a las actualizaciones.`,
            accionHref: "/dashboard/padre/circulo-confianza",
            accionTexto: "Ver círculo",
            prioridad: "media",
        };
    }

    if (totalContactos === 0) {
        return {
            texto: "Aún no tienes contactos en tu círculo. Agrega el primer número o nick para empezar a monitorear.",
            accionHref: "/dashboard/padre/circulo-confianza",
            accionTexto: "Agregar contacto",
            prioridad: "baja",
        };
    }

    return {
        texto: "Tu círculo está tranquilo. No hay alertas que requieran atención inmediata.",
        accionHref: "/dashboard/padre/reportar",
        accionTexto: "Reportar incidente",
        prioridad: "baja",
    };
}

export function contarPorColor(semaforo: { color: ColorSemaforo }[]): { rojo: number; ambar: number; verde: number } {
    return semaforo.reduce(
        (acc, s) => {
            if (s.color === "ROJO") acc.rojo++;
            else if (s.color === "AMBAR") acc.ambar++;
            else acc.verde++;
            return acc;
        },
        { rojo: 0, ambar: 0, verde: 0 }
    );
}
