/**
 * Mensaje al padre/madre/cuidador (spec 096-US7).
 * BORRADOR generado por PLANTILLAS DETERMINISTAS ensambladas según las
 * conductas detectadas — PROHIBIDO generarlo con un LLM. Reglas duras:
 * (a) SIN score ni nivel de riesgo (constitución §1.3/§1.5);
 * (b) canales de ayuda desde el parámetro `mensaje.padre.canales`
 *     (editable sin desplegar, revisable por legal);
 * (c) se marca como borrador; no existe botón de enviar/publicar.
 * Tono: tranquilo pero firme, con recomendaciones concretas.
 */

import { getParametroSistema } from "@/lib/parametros";

export interface CanalAyuda {
    nombre: string;
    contacto: string;
    descripcion: string;
}

export interface MensajePadreInput {
    /** Conductas detectadas (categorías presentes). Vacío si ninguna. */
    conductas: string[];
    canales: CanalAyuda[];
}

interface PlantillaConducta {
    hallazgo: string;
    recomendacion: string;
}

const PLANTILLA_GENERICA: PlantillaConducta = {
    hallazgo: "señales de una conducta que requiere atención",
    recomendacion: "Habla con tu hijo o hija sobre lo ocurrido y conserva cualquier registro de la conversación.",
};

const PLANTILLAS_CONDUCTA: Record<string, PlantillaConducta> = {
    COMPARTIMIENTO_SEXUAL: {
        hallazgo: "posibles señales de difusión de contenido sexual",
        recomendacion: "Conserva las capturas o registros disponibles y evita difundir el material, incluso para pedir ayuda.",
    },
    SOLICITUD_MATERIAL: {
        hallazgo: "posibles solicitudes de fotos o videos íntimos dirigidas a un menor",
        recomendacion: "No respondas a la solicitud ni envíes material íntimo, y conserva los mensajes como evidencia.",
    },
    SOLICITUD_ENCUENTRO: {
        hallazgo: "posibles propuestas de encuentro en persona con un desconocido",
        recomendacion: "Evita cualquier encuentro presencial con el contacto y acompaña a tu hijo o hija en el manejo de sus redes.",
    },
    CONTACTO_INSISTENTE: {
        hallazgo: "posible contacto insistente que genera incomodidad",
        recomendacion: "Bloquea el contacto en la plataforma y conserva el registro de los mensajes recibidos.",
    },
    OFRECIMIENTO_REGALOS: {
        hallazgo: "posibles ofrecimientos de regalos, dinero o beneficios a cambio de contacto",
        recomendacion: "Desconfía de ofrecimientos de valor dirigidos a un menor y conversa en casa sobre esta táctica de ganarse la confianza.",
    },
    SUPLANTACION_IDENTIDAD: {
        hallazgo: "posible suplantación de identidad para contactar a un menor",
        recomendacion: "Verifica la identidad del contacto por canales oficiales antes de responder y reporta el perfil en la plataforma.",
    },
    EXTORSION: {
        hallazgo: "posibles señales de extorsión o amenazas",
        recomendacion: "No cedas a las exigencias, conserva todas las evidencias y denuncia de inmediato ante las autoridades.",
    },
    DIFUSION_NO_CONSENTIDA: {
        hallazgo: "posible difusión de imágenes o información sin consentimiento",
        recomendacion: "Solicita el retiro del contenido en la plataforma y conserva las evidencias de la publicación.",
    },
    DOXING: {
        hallazgo: "posible publicación de datos personales (doxing)",
        recomendacion: "Solicita el retiro de los datos en la plataforma y refuerza la privacidad de las cuentas del menor.",
    },
    CONTENIDO_GENERADO_IA: {
        hallazgo: "posible contenido sintético generado con inteligencia artificial",
        recomendacion: "Conserva las evidencias y reporta el contenido en la plataforma donde circula.",
    },
    OTRO: PLANTILLA_GENERICA,
    SPAM: PLANTILLA_GENERICA,
};

export function construirMensajePadre(input: MensajePadreInput): string {    const plantillas = input.conductas.map((c) => PLANTILLAS_CONDUCTA[c] ?? PLANTILLA_GENERICA);
    // Dedup por texto de hallazgo (varias conductas pueden mapear a la genérica).
    const unicas = plantillas.filter((p, i) => plantillas.findIndex((q) => q.hallazgo === p.hallazgo) === i);

    const lineas: string[] = [];
    lineas.push("[BORRADOR — mensaje de referencia para el acompañamiento a la familia. No se envía automáticamente.]");
    lineas.push("");
    lineas.push("Gracias por reportar esta situación. Tu reporte ayuda a proteger a niños, niñas y adolescentes.");

    if (unicas.length === 0) {
        lineas.push("Revisamos el caso y no encontramos conductas concretas que describir en este momento.");
    } else {
        const hallazgos = unicas.map((p) => p.hallazgo);
        const lista = hallazgos.length === 1 ? hallazgos[0] : `${hallazgos.slice(0, -1).join(", ")} y ${hallazgos[hallazgos.length - 1]}`;
        lineas.push(`Revisamos el caso y encontramos ${lista}.`);
        lineas.push("");
        lineas.push("Te recomendamos:");
        for (const p of unicas) {
            lineas.push(`- ${p.recomendacion}`);
        }
    }

    if (input.canales.length > 0) {
        lineas.push("");
        lineas.push("Si necesitas ayuda adicional, estos canales oficiales están disponibles:");
        for (const canal of input.canales) {
            lineas.push(`- ${canal.nombre} (${canal.contacto}): ${canal.descripcion}`);
        }
    }

    lineas.push("");
    lineas.push("Este mensaje es un borrador orientativo: la revisión final del caso corresponde al equipo de validación.");

    return lineas.join("\n");
}

/**
 * Lee los canales del parámetro `mensaje.padre.canales` (editable sin desplegar).
 * Devuelve [] si el parámetro falta o es inválido (el mensaje sale sin canales).
 */
export async function cargarCanalesPadre(): Promise<CanalAyuda[]> {
    const param = await getParametroSistema("mensaje.padre.canales");
    if (!param) return [];
    try {
        const parsed: unknown = JSON.parse(param.valor);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (c): c is CanalAyuda =>
                typeof c === "object" && c !== null &&
                typeof (c as CanalAyuda).nombre === "string" &&
                typeof (c as CanalAyuda).contacto === "string" &&
                typeof (c as CanalAyuda).descripcion === "string"
        );
    } catch {
        return [];
    }
}
