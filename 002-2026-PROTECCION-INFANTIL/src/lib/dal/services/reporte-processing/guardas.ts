import { decidirGuardasSeguridad, normalizarCategoriasSecundarias } from "@/lib/ai/guardas-decision";
import { registrarPaso } from "@/lib/expediente/pasos";
import { prisma } from "@/lib/prisma";
import type { EstadoReporte } from "@prisma/client";
import type { ClasificacionResult } from "./clasificacion";

/**
 * Guardas de seguridad del pipeline de procesamiento (spec 026, spec 096, F7).
 *
 * Wrapper PRODUCTIVO de la fuente única de la decisión
 * (`decidirGuardasSeguridad` en `@/lib/ai/guardas-decision`): la decisión
 * (orden de ramas, cortocircuitos, prioridades) vive SOLO allí; este helper
 * añade el side-effect `registrarPaso` (trazabilidad de expediente, que solo
 * tiene sentido con un reporte persistido). E-4: dejó de ser una réplica.
 */
export async function aplicarGuardasSeguridad({
    reporteId,
    texto,
    clasificacion,
    estadoInicial,
    esRafaga,
    umbralSpam,
}: {
    reporteId: string;
    texto: string;
    clasificacion: ClasificacionResult;
    estadoInicial: EstadoReporte;
    esRafaga: boolean;
    umbralSpam: number;
}): Promise<{
    estadoFinal: EstadoReporte;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
}> {
    const [umbralSpamDominanciaRaw, severidadMinGraveRaw, severidadesRows, dominiosAcortadoresRaw] = await Promise.all([
        prisma.parametroSistema.findUnique({ where: { clave: "spam.dominancia_umbral" } }),
        prisma.parametroSistema.findUnique({ where: { clave: "spam.dominancia_categoria_grave_severidad_min" } }),
        prisma.parametroSistema.findMany({ where: { clave: { startsWith: "scoring.severity." } } }),
        prisma.parametroSistema.findUnique({ where: { clave: "spam.dominios_acortadores" } }),
    ]);

    const umbralSpamDominancia = parseFloat(umbralSpamDominanciaRaw?.valor ?? "0.33");
    const severidadMinGrave = parseInt(severidadMinGraveRaw?.valor ?? "75", 10);
    const dominiosAcortadores: string[] = (() => {
        try {
            return dominiosAcortadoresRaw?.valor ? (JSON.parse(dominiosAcortadoresRaw.valor) as string[]) : [];
        } catch {
            return [];
        }
    })();

    const severidades: Record<string, number> = {};
    for (const row of severidadesRows) {
        const categoria = row.clave.replace("scoring.severity.", "");
        severidades[categoria] = parseInt(row.valor, 10);
    }

    const decision = decidirGuardasSeguridad({
        texto,
        clasificacion,
        categoriasSecundarias: normalizarCategoriasSecundarias(clasificacion.categoriasSecundarias),
        estadoInicial,
        esRafaga,
        umbralSpam,
        umbralSpamDominancia,
        severidadMinGrave,
        severidades,
        dominiosAcortadores,
    });

    // Spec 096-US3: razón explícita de la regla de decisión (best-effort).
    void registrarPaso(reporteId, "decision", {
        veredicto: decision.estadoFinal,
        detalle: {
            estadoInicial,
            reglas: decision.reglasAplicadas,
            prioridadAlta: decision.prioridadAlta,
            keywordsDetectadas: decision.keywordsDetectadas,
            categoria: clasificacion.categoria,
            confianza: clasificacion.confianza,
        },
    });

    return {
        estadoFinal: decision.estadoFinal,
        prioridadAlta: decision.prioridadAlta,
        keywordsDetectadas: decision.keywordsDetectadas,
    };
}
