/**
 * SPEC-234 (002-PI-134): regla N1 de multiplataforma.
 * Dispara cuando los eventos abarcan varias plataformas distintas.
 */
import type { EventoExpediente } from "@prisma/client";
import type { ResultadoRegla } from "./aceleracion";

export function detectarMultiplataforma(
    eventos: EventoExpediente[],
    minPlataformas: number
): ResultadoRegla {
    const plataformas = new Set(eventos.map((e) => e.plataforma).filter((p): p is string => !!p));
    const detectado = plataformas.size >= minPlataformas;
    const severidad: "MEDIA" | "ALTA" = plataformas.size >= minPlataformas * 2 ? "ALTA" : "MEDIA";

    return {
        detectado,
        severidad: detectado ? severidad : "BAJA",
        descripcionTexto: detectado
            ? `Actividad multiplataforma detectada: ${plataformas.size} plataformas distintas.`
            : "No se detecta actividad multiplataforma significativa.",
        datosContextoJson: {
            tipoPatron: "MULTIPLATAFORMA",
            plataformasUnicas: plataformas.size,
            plataformas: Array.from(plataformas).sort(),
            minPlataformas,
        },
    };
}
