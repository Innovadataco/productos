import type { SetsRubrica } from "@/lib/ai/rubrica-semilla";

/**
 * Análisis interno objetivo del expediente (spec 096-US6).
 * Builder DETERMINISTA puro (sin LLM, sin tono, sin recomendaciones): síntesis
 * factual para uso interno del operador. La gravedad interna está permitida por
 * ser de uso interno (D-13); nunca sale a la consulta pública. La conclusión es
 * neutral: NO afirma la responsabilidad de ninguna persona.
 */

export interface VotoInterno {
    modelo: string;
    categoria: string;
    cumple: boolean;
    preguntasCumplidas: string[];
}

export interface AnalisisInternoInput {
    estado: string;
    esRafaga: boolean;
    prioridadAlta: boolean;
    processingError: string | null;
    clasificacion: { categoria: string; confianza: number; categorias: string[] } | null;
    /** Votos de ClasificacionRubricaVoto (única fuente). */
    votos: VotoInterno[];
    /** Rúbrica viva (ia.rubrica.preguntas): de aquí salen las preguntas decisivas. */
    preguntas: SetsRubrica;
    /** Severidades scoring.severity.* (0-100) por categoría. */
    severidades: Record<string, number>;
    pesoFuente: number | null;
}

/** Gravedad interna (D-13): umbrales deterministas sobre la severidad 0-100. */
function gravedadInterna(severidad: number | undefined): string {
    const s = severidad ?? 50;
    if (s >= 70) return "alta";
    if (s >= 40) return "media";
    return "baja";
}

function consensoDe(votos: VotoInterno[], categoria: string): { x: number; n: number } {
    const deCategoria = votos.filter((v) => v.categoria === categoria);
    return { x: deCategoria.filter((v) => v.cumple).length, n: deCategoria.length };
}

/** Preguntas decisivas de la rúbrica que al menos un modelo que cumplió marcó como cumplidas. */
function senalesDecisivas(input: AnalisisInternoInput, categoria: string): string[] {
    const decisivas = (input.preguntas[categoria] ?? [])
        .filter((p) => p.activo && p.tipo === "decisiva")
        .map((p) => p.texto);
    if (decisivas.length === 0) return [];
    const cumplidas = new Set(
        input.votos
            .filter((v) => v.categoria === categoria && v.cumple)
            .flatMap((v) => v.preguntasCumplidas)
    );
    return decisivas.filter((texto) => cumplidas.has(texto));
}

function disparadorRevision(input: AnalisisInternoInput): string {
    switch (input.estado) {
        case "REVISION_MANUAL":
            if (input.processingError) return "error de procesamiento del pipeline";
            if (input.esRafaga) return "ráfaga de reportes contra el mismo identificador";
            return "desacuerdo entre modelos o confianza insuficiente";
        case "POSIBLE_SPAM":
            return "guardas deterministas de spam";
        case "REQUIERE_ANONIMIZACION":
            return "PII detectada pendiente de validación humana";
        case "DUPLICADO":
            return "duplicado de un reporte anterior por similitud";
        case "CORREGIDO":
            return "corrección humana de la clasificación";
        default:
            return "clasificación automática dentro de umbral (sin revisión requerida)";
    }
}

export function construirAnalisisInterno(input: AnalisisInternoInput): string {
    const partes: string[] = [];

    const conductas = input.clasificacion?.categorias ?? [];
    if (conductas.length === 0) {
        partes.push("Sin conductas detectadas por el modelo.");
    } else {
        const consensos = conductas.map((cat) => {
            const { x, n } = consensoDe(input.votos, cat);
            const consenso = n > 0 ? `Consenso ${x}/${n}` : "Sin votos de rúbrica";
            return `${consenso} en ${cat} (gravedad interna: ${gravedadInterna(input.severidades[cat])})`;
        });
        partes.push(`${consensos.join("; ")}.`);

        const senales = conductas.flatMap((cat) =>
            senalesDecisivas(input, cat).map((texto) => `${cat}: «${texto}»`)
        );
        partes.push(senales.length > 0 ? `Señales: ${senales.join("; ")}.` : "Señales: ninguna pregunta decisiva cumplida.");
    }

    partes.push(`Disparador: ${disparadorRevision(input)}.`);

    const confianza = input.clasificacion ? input.clasificacion.confianza.toFixed(2) : "n/d";
    const peso = input.pesoFuente !== null ? String(input.pesoFuente) : "n/d";
    partes.push(`Confianza ${confianza} · peso de fuente ${peso}.`);

    partes.push(
        "Conclusión: las señales anteriores describen el contenido del texto reportado; este análisis no determina la responsabilidad de ninguna persona."
    );

    return partes.join(" ");
}
