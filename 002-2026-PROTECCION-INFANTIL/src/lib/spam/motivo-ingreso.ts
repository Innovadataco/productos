/**
 * SPEC-262 (002-PI-164): derivación del motivo de ingreso real de un POSIBLE_SPAM.
 *
 * Replica la lógica de evaluación de guardas-decision.ts:124-157 sobre datos ya
 * almacenados, sin ejecutar el motor de IA. CERO cambios en src/lib/ai/**.
 *
 * Orden de evaluación idéntico al motor original:
 *   1. SPAM con confianza >= umbralSpam          → spam_confianza_alta
 *   2. Regla determinística (links + señales)    → spam_publicitario_deterministico
 *   3. Dominancia SPAM en categorías secundarias → spam_dominancia
 *   4. Sin datos suficientes                     → desconocido
 */
import type { CategoriaConducta } from "@prisma/client";
import { detectarSpamPublicitarioDeterministico } from "@/lib/ai/guardas-decision";

export type MotivoIngresoSpam =
    | "spam_confianza_alta"
    | "spam_publicitario_deterministico"
    | "spam_dominancia"
    | "desconocido";

export interface DerivarMotivoInput {
    categoria?: CategoriaConducta | null;
    confianza?: number | null;
    categoriasSecundarias?: { categoria: string; score: number }[] | null;
    texto: string;
    umbralSpam: number;
    umbralDominancia: number;
    dominiosAcortadores: string[];
}

export interface DerivarMotivoResult {
    motivo: MotivoIngresoSpam;
    confianzaSpam: number | null;
}

export function derivarMotivoIngreso(input: DerivarMotivoInput): DerivarMotivoResult {
    const { categoria, confianza, categoriasSecundarias, texto, umbralSpam, umbralDominancia, dominiosAcortadores } =
        input;

    // 1. SPAM con confianza suficiente (ruta principal)
    if (categoria === "SPAM" && confianza != null && confianza >= umbralSpam) {
        return { motivo: "spam_confianza_alta", confianzaSpam: confianza };
    }

    // 2. Regla determinística (actúa antes de dominancia, igual que en el motor)
    const spamDet = detectarSpamPublicitarioDeterministico(texto, dominiosAcortadores);
    if (spamDet.esSpam) {
        return { motivo: "spam_publicitario_deterministico", confianzaSpam: confianza ?? null };
    }

    // 3. Dominancia SPAM en categorías secundarias
    const secundarias = categoriasSecundarias ?? [];
    const spamSecundario = secundarias.find((c) => c.categoria === "SPAM");
    if (spamSecundario && spamSecundario.score >= umbralDominancia) {
        return { motivo: "spam_dominancia", confianzaSpam: spamSecundario.score };
    }

    return { motivo: "desconocido", confianzaSpam: confianza ?? null };
}
