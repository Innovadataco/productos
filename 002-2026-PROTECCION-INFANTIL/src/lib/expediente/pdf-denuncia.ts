/**
 * SPEC-140 (F2, FR-002/FR-007/FR-009): documento de denuncia formal.
 * PLANTILLAS DETERMINISTAS por conducta (D-23) — PROHIBIDO generarlo con un LLM,
 * mismo principio que `mensaje-padre.ts`. Reglas duras:
 * (a) NUNCA incluye el texto (ni el original) del reporte: la evidencia la
 *     aporta quien denuncia; el documento estructura metadatos y conductas;
 * (b) lenguaje descriptivo/estadístico ("se registraron reportes que describen…"),
 *     nunca veredictos (presunción de inocencia, constitución §1.3);
 * (c) canales oficiales visibles, desde el parámetro `mensaje.padre.canales`;
 * (d) la plataforma NO retiene el PDF: se genera en memoria y se descarga;
 * (e) texto base provisional — la revisión legal (CEO) ajusta las plantillas
 *     sin tocar la mecánica (no bloquea el código).
 * Mecánica del PDF: patrón de `src/lib/colegio/pdf-estadisticas.ts` (pdfmake en
 * Node, Buffer en memoria). `info.creationDate` se fija con `fechaGeneracion`
 * para que la salida sea DETERMINISTA (mismos datos → mismo Buffer).
 */
import { renderPdfBuffer } from "@/lib/pdf/pdfmake-node";
import type {
    TDocumentDefinitions,
    Content,
    StyleDictionary,
    Alignment,
} from "pdfmake/interfaces";
import type { CanalAyuda } from "./mensaje-padre";

const COLOR_PRIMARIO = "#1d4ed8"; // blue-700 (formal, distinto del verde colegio)
const COLOR_TEXTO = "#1f2937"; // gray-800
const COLOR_MUTED = "#6b7280"; // gray-500

const estilos: StyleDictionary = {
    titulo: { fontSize: 18, bold: true, color: COLOR_PRIMARIO, margin: [0, 0, 0, 4] },
    subtitulo: { fontSize: 11, color: COLOR_MUTED, margin: [0, 0, 0, 12] },
    seccion: { fontSize: 13, bold: true, color: COLOR_TEXTO, margin: [0, 10, 0, 6] },
    label: { fontSize: 9, color: COLOR_MUTED, margin: [0, 0, 0, 1] },
    valor: { fontSize: 11, color: COLOR_TEXTO, margin: [0, 0, 0, 6] },
    cuerpo: { fontSize: 11, color: COLOR_TEXTO, margin: [0, 0, 0, 6] },
    nota: { fontSize: 9, color: COLOR_MUTED, italics: true, margin: [0, 10, 0, 0] },
};

export interface PlantillaDenuncia {
    /** Descripción formal del hecho para la autoridad (sin veredictos). */
    hecho: string;
    /** Recomendación de actuación para quien presenta la denuncia. */
    recomendacion: string;
}

export const PLANTILLA_DENUNCIA_GENERICA: PlantillaDenuncia = {
    hecho: "una conducta que requiere atención de las autoridades de protección",
    recomendacion: "Conserve los registros disponibles de la comunicación (capturas, mensajes, fechas) como evidencia.",
};

/**
 * Texto base provisional por conducta (revisión legal del CEO; ajustar el texto
 * NO cambia la mecánica). Redacción formal para autoridad, en descriptivo.
 */
export const PLANTILLAS_DENUNCIA: Record<string, PlantillaDenuncia> = {
    COMPARTIMIENTO_SEXUAL: {
        hecho: "la posible difusión de contenido sexual que podría involucrar a un menor de edad",
        recomendacion: "Conserve las capturas o registros disponibles y evita difundir el material, incluso para pedir ayuda.",
    },
    SOLICITUD_MATERIAL: {
        hecho: "posibles solicitudes de fotos o videos íntimos dirigidas a un menor de edad",
        recomendacion: "No responda a la solicitud ni envíe material íntimo, y conserve los mensajes como evidencia.",
    },
    SOLICITUD_ENCUENTRO: {
        hecho: "posibles propuestas de encuentro en persona entre un desconocido y un menor de edad",
        recomendacion: "Evite cualquier encuentro presencial con el contacto y conserve el registro de la conversación.",
    },
    CONTACTO_INSISTENTE: {
        hecho: "un posible contacto insistente hacia un menor de edad que genera incomodidad",
        recomendacion: "Bloquee el contacto en la plataforma y conserve el registro de los mensajes recibidos.",
    },
    OFRECIMIENTO_REGALOS: {
        hecho: "posibles ofrecimientos de regalos, dinero o beneficios a un menor de edad a cambio de contacto",
        recomendacion: "Conserve los mensajes del ofrecimiento como evidencia y evite que el menor continúe el contacto.",
    },
    SUPLANTACION_IDENTIDAD: {
        hecho: "la posible suplantación de identidad para contactar a un menor de edad",
        recomendacion: "No comparta más información con el perfil y conserve las evidencias de la suplantación.",
    },
    EXTORSION: {
        hecho: "posibles señales de extorsión o amenazas contra un menor de edad",
        recomendacion: "No ceda a las exigencias, conserve todas las evidencias y presente la denuncia de inmediato.",
    },
    DIFUSION_NO_CONSENTIDA: {
        hecho: "la posible difusión de imágenes o información de un menor de edad sin consentimiento",
        recomendacion: "Solicite el retiro del contenido en la plataforma y conserve las evidencias de la publicación.",
    },
    DOXING: {
        hecho: "la posible publicación de datos personales de un menor de edad (doxing)",
        recomendacion: "Solicite el retiro de los datos en la plataforma y conserve las evidencias de la publicación.",
    },
    CONTENIDO_GENERADO_IA: {
        hecho: "la posible circulación de contenido sintético generado con inteligencia artificial que involucraría a un menor de edad",
        recomendacion: "Conserve las evidencias y reporte el contenido en la plataforma donde circula.",
    },
    OTRO: PLANTILLA_DENUNCIA_GENERICA,
    SPAM: PLANTILLA_DENUNCIA_GENERICA,
};

/** Datos del documento de denuncia (metadatos del reporte; NUNCA su texto). */
export interface DatosDenuncia {
    canalDestino: CanalAyuda;
    /** Todos los canales oficiales (sección visible; constitución). */
    canales: CanalAyuda[];
    identificador: string;
    plataforma: string;
    fechaIncidente: Date;
    ciudad: string;
    pais: string;
    /** Conductas confirmadas (categorías). Vacío → plantilla genérica. */
    conductas: string[];
    numeroSeguimiento: string | null;
    /** Inyectable: fija la fecha mostrada y `info.creationDate` (determinismo). */
    fechaGeneracion: Date;
}

/** Plantillas de las conductas dadas, deduplicadas por texto de hecho. */
export function plantillasDenunciaUnicas(conductas: string[]): PlantillaDenuncia[] {
    const plantillas = (conductas.length > 0 ? conductas : ["OTRO"]).map(
        (c) => PLANTILLAS_DENUNCIA[c] ?? PLANTILLA_DENUNCIA_GENERICA
    );
    return plantillas.filter((p, i) => plantillas.findIndex((q) => q.hecho === p.hecho) === i);
}

function formatoFechaColombia(fecha: Date): string {
    return fecha.toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatoSoloFecha(fecha: Date): string {
    return fecha.toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" });
}

function campo(label: string, valor: string): Content {
    return {
        columns: [
            { width: 160, text: label, style: "label" },
            { width: "*", text: valor, style: "valor" },
        ],
    };
}

/** Contenido textual del documento (puro; compartido por el PDF y los tests). */
export function armarContenidoDenuncia(datos: DatosDenuncia): {
    hechos: string[];
    recomendaciones: string[];
} {
    const unicas = plantillasDenunciaUnicas(datos.conductas);
    return {
        hechos: unicas.map((p) => `Se registraron reportes que describen ${p.hecho}.`),
        recomendaciones: unicas.map((p) => p.recomendacion),
    };
}

/** Genera el PDF de denuncia formal en memoria. La plataforma NO lo retiene. */
export function generarPdfDenuncia(datos: DatosDenuncia): Promise<Buffer> {
    const { hechos, recomendaciones } = armarContenidoDenuncia(datos);

    const contenido: Content[] = [
        { text: "Documento de denuncia formal", style: "titulo" },
        {
            text: `Borrador para presentar ante: ${datos.canalDestino.nombre} (${datos.canalDestino.contacto}) · Generado el ${formatoFechaColombia(datos.fechaGeneracion)}`,
            style: "subtitulo",
        },
        { text: "Datos del reporte registrado", style: "seccion" },
        campo("Identificador reportado", datos.identificador),
        campo("Plataforma", datos.plataforma),
        campo("Fecha del incidente", formatoSoloFecha(datos.fechaIncidente)),
        campo("Ubicación", `${datos.ciudad}, ${datos.pais}`),
        campo("Referencia interna", datos.numeroSeguimiento ?? "Sin referencia"),
        { text: "Conductas descritas en los reportes", style: "seccion" },
        ...hechos.map((hecho): Content => ({ text: hecho, style: "cuerpo" })),
        { text: "Recomendaciones para quien presenta la denuncia", style: "seccion" },
        {
            ul: recomendaciones,
            style: "cuerpo",
        },
    ];

    if (datos.canales.length > 0) {
        contenido.push(
            { text: "Canales oficiales de denuncia", style: "seccion" },
            {
                ul: datos.canales.map((c) => `${c.nombre} (${c.contacto}): ${c.descripcion}`),
                style: "cuerpo",
            }
        );
    }

    contenido.push(
        {
            text: "Este documento describe reportes registrados por la comunidad en la plataforma. No constituye un veredicto ni una determinación de responsabilidad sobre persona alguna.",
            style: "nota",
        },
        {
            text: "La plataforma no retiene este documento ni incluye el contenido de los reportes: la evidencia disponible la aporta quien presenta la denuncia ante la autoridad.",
            style: "nota",
        },
        {
            text: `Canal destino: ${datos.canalDestino.nombre} — ${datos.canalDestino.descripcion}`,
            style: "nota",
        }
    );

    const docDefinition: TDocumentDefinitions = {
        info: {
            title: "Documento de denuncia formal",
            author: "Plataforma comunitaria de protección infantil",
            subject: `Denuncia ante ${datos.canalDestino.nombre}`,
            creationDate: datos.fechaGeneracion,
        },
        content: contenido,
        styles: estilos,
        defaultStyle: { font: "Roboto", color: COLOR_TEXTO },
        footer: (currentPage: number, pageCount: number) => ({
            text: `Página ${currentPage} de ${pageCount}`,
            alignment: "center" as Alignment,
            fontSize: 8,
            color: COLOR_MUTED,
            margin: [0, 8, 0, 0],
        }),
        pageMargins: [40, 40, 40, 40],
    };

    return renderPdfBuffer(docDefinition);
}
