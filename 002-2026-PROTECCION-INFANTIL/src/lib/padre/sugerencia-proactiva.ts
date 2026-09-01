/**
 * SPEC-307 (A-50): motor de sugerencia proactiva para el área del padre.
 * Lógica determinista basada en queries (sin LLM).
 */
import { SugerenciaProactivaRepository } from "@/lib/dal/repositories/sugerencia-proactiva-repository";
import { listarSemaforosPorPadre } from "@/lib/padre/semaforo";
import type { SemaforoContacto } from "@/lib/padre/semaforo";
import type { ExpedienteSugerencia } from "@/lib/dal/repositories/sugerencia-proactiva-repository";

export type TipoSugerencia =
    | "INVITAR_CONTACTOS"
    | "ROJO"
    | "AMBAR"
    | "SIN_NOVEDADES"
    | "TODO_VERDE";

export type AccionSugerencia = {
    etiqueta: string;
    href: string;
};

export type SugerenciaProactiva = {
    tipo: TipoSugerencia;
    titulo: string;
    mensaje: string;
    accion: AccionSugerencia;
    metadata: {
        contactosVerde: number;
        contactosAmbar: number;
        contactosRojo: number;
        expedientesAmbar: number;
        expedientesRojo: number;
        diasDesdeUltimaNovedad: number | null;
    };
};

const ESTADOS_EXPEDIENTE_AMBAR = new Set([
    "EN_ACLARACION",
    "PENDIENTE_COMITE",
    "CONSOLIDANDO",
    "EN_APROBACION_PADRE",
]);

const SIN_NOVEDADES_DIAS = 7;

function haceDias(fecha: Date, referencia = new Date()): number {
    const diffMs = referencia.getTime() - new Date(fecha).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function ultimaNovedad(expedientes: ExpedienteSugerencia[]): Date | null {
    if (expedientes.length === 0) return null;

    return expedientes
        .map((e) => new Date(e.updatedAt))
        .reduce((max, f) => (f.getTime() > max.getTime() ? f : max));
}

function contarContactosPorColor(contactos: SemaforoContacto[]) {
    return {
        verde: contactos.filter((c) => c.color === "VERDE").length,
        ambar: contactos.filter((c) => c.color === "AMBAR").length,
        rojo: contactos.filter((c) => c.color === "ROJO").length,
    };
}

function evaluarExpedientes(expedientes: ExpedienteSugerencia[]) {
    let rojo = 0;
    let ambar = 0;

    for (const expediente of expedientes) {
        if (expediente.scoreGravedadActual === "ROJO") {
            rojo++;
        } else if (
            expediente.scoreGravedadActual === "AMARILLO" ||
            ESTADOS_EXPEDIENTE_AMBAR.has(expediente.estado)
        ) {
            ambar++;
        }
    }

    return { rojo, ambar };
}

export async function construirSugerenciaProactiva(
    usuarioId: string,
    repo: SugerenciaProactivaRepository = new SugerenciaProactivaRepository()
): Promise<SugerenciaProactiva> {
    const [totalContactos, contactos, expedientes, novedadCadena] = await Promise.all([
        repo.contarContactosActivos(usuarioId),
        listarSemaforosPorPadre(usuarioId),
        repo.buscarExpedientesDelPadre(usuarioId),
        // SPEC-340: la novedad viva viene de la CADENA de reportes propios —
        // el expediente nace por el botón y puede no existir todavía.
        repo.ultimaNovedadDeCadena(usuarioId),
    ]);

    const contactosPorColor = contarContactosPorColor(contactos);
    const expedientesPorEstado = evaluarExpedientes(expedientes);

    const metadata = {
        contactosVerde: contactosPorColor.verde,
        contactosAmbar: contactosPorColor.ambar,
        contactosRojo: contactosPorColor.rojo,
        expedientesAmbar: expedientesPorEstado.ambar,
        expedientesRojo: expedientesPorEstado.rojo,
        diasDesdeUltimaNovedad: null as number | null,
    };

    // Regla 1: sin contactos.
    if (totalContactos === 0) {
        return {
            tipo: "INVITAR_CONTACTOS",
            titulo: "Empieza a proteger a tu familia",
            mensaje:
                "Agrega tu primer contacto de confianza para recibir alertas cuando alguien reporte su número, nick o perfil.",
            accion: { etiqueta: "Agregar contacto", href: "/dashboard/padre/circulo-confianza" },
            metadata,
        };
    }

    // Regla 2: rojo (contacto rojo o expediente rojo).
    if (contactosPorColor.rojo > 0 || expedientesPorEstado.rojo > 0) {
        return {
            tipo: "ROJO",
            titulo: "Alerta prioritaria en tu círculo",
            mensaje:
                "Tienes situaciones que requieren atención inmediata. Revisa los expedientes y contactos marcados en rojo.",
            accion: { etiqueta: "Ver expedientes", href: "/dashboard/padre/expedientes" },
            metadata,
        };
    }

    // Regla 3: ámbar (contacto ámbar o expediente en revisión).
    if (contactosPorColor.ambar > 0 || expedientesPorEstado.ambar > 0) {
        return {
            tipo: "AMBAR",
            titulo: "Revisión pendiente",
            mensaje:
                "Hay elementos en revisión en tu círculo. Te recomendamos consultar el estado actual.",
            accion: { etiqueta: "Revisar estado", href: "/dashboard/padre/expedientes" },
            metadata,
        };
    }

    // Regla 4: sin novedades en 7 días. La fecha más reciente entre el
    // expediente (si existe) y la cadena de reportes (SPEC-340).
    const ultimaExp = ultimaNovedad(expedientes);
    const ultima =
        ultimaExp && novedadCadena
            ? (ultimaExp > novedadCadena ? ultimaExp : novedadCadena)
            : (ultimaExp ?? novedadCadena);
    if (ultima) {
        const dias = haceDias(ultima);
        metadata.diasDesdeUltimaNovedad = dias;
        if (dias > SIN_NOVEDADES_DIAS) {
            return {
                tipo: "SIN_NOVEDADES",
                titulo: "Todo tranquilo",
                mensaje:
                    "No hay novedades recientes. Es un buen momento para revisar que tu círculo de confianza esté actualizado.",
                accion: { etiqueta: "Revisar círculo", href: "/dashboard/padre/circulo-confianza" },
                metadata,
            };
        }
    }

    // Regla 5: todo verde.
    return {
        tipo: "TODO_VERDE",
        titulo: "Buenas noticias",
        mensaje: "Tu círculo de confianza está tranquilo. No hay alertas activas en este momento.",
        accion: { etiqueta: "Ver círculo", href: "/dashboard/padre/circulo-confianza" },
        metadata,
    };
}
