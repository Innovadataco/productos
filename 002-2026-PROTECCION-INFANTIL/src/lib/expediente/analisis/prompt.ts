/**
 * SPEC-341 (T014) — resuelve el prompt sistema según el alcance del análisis.
 * El texto vive en ParametroSistema (sembrado, admin edita).
 */
import { createHash } from "node:crypto";
import type { AlcanceAnalisis } from "@prisma/client";
import { getParametroSistemaValor } from "../../parametros";

const CLAVES: Record<AlcanceAnalisis, string> = {
    PADRE_COMPLETO: "padre.analisis.prompt_sistema",
    COLEGIO_BLINDADO: "colegio.analisis.prompt_sistema",
};

export interface PromptResuelto {
    texto: string;
    hash: string;
}

export async function resolverPromptSistema(alcance: AlcanceAnalisis): Promise<PromptResuelto> {
    const clave = CLAVES[alcance];
    const texto = await getParametroSistemaValor(clave);
    if (!texto) {
        throw new Error(`[analisis] Parámetro ${clave} vacío en BD — sembrar antes de generar análisis`);
    }
    return {
        texto,
        hash: createHash("sha256").update(texto).digest("hex"),
    };
}
