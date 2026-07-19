import { getParametroSistema } from "./parametros";
import type { Prisma, CategoriaConducta } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type NivelRiesgoConsulta = "BAJO" | "MEDIO" | "ALTO";

export interface RiesgoConsultaResult {
    score: number;
    nivelRiesgo: NivelRiesgoConsulta;
    confianzaPromedio: number;
    categoriaPrincipal: CategoriaConducta | null;
}

export interface RiesgoConsultaParams {
    umbralMedio: number;
    umbralAlto: number;
    minReportesAlto: number;
    pesoConfianza: number;
    pesoCantidad: number;
    pesoGravedad: number;
}

const SEVERIDAD_CATEGORIA: Record<CategoriaConducta, number> = {
    CONTACTO_INSISTENTE: 30,
    SOLICITUD_MATERIAL: 80,
    OFRECIMIENTO_REGALOS: 60,
    SUPLANTACION_IDENTIDAD: 70,
    SOLICITUD_ENCUENTRO: 90,
    COMPARTIMIENTO_SEXUAL: 95,
    EXTORSION: 85,
    CONTENIDO_GENERADO_IA: 75,
    DIFUSION_NO_CONSENTIDA: 90,
    DOXING: 85,
    SPAM: 0,
    OTRO: 20,
};

function factorCantidad(total: number): number {
    if (total <= 0) return 0;
    if (total === 1) return 0.3;
    if (total === 2) return 0.55;
    if (total === 3) return 0.75;
    if (total === 4) return 0.9;
    return 1.0;
}

export async function getRiesgoConsultaParams(
    tx?: PrismaClient | Prisma.TransactionClient
): Promise<RiesgoConsultaParams> {
    const get = async (clave: string, fallback: string) => {
        const p = await getParametroSistema(clave, tx);
        return p?.valor ?? fallback;
    };

    return {
        umbralMedio: parseInt(await get("risk.umbral_medio", "50"), 10),
        umbralAlto: parseInt(await get("risk.umbral_alto", "75"), 10),
        minReportesAlto: parseInt(await get("risk.min_reportes_alto", "3"), 10),
        pesoConfianza: parseInt(await get("risk.peso_confianza", "50"), 10),
        pesoCantidad: parseInt(await get("risk.peso_cantidad", "30"), 10),
        pesoGravedad: parseInt(await get("risk.peso_gravedad", "20"), 10),
    };
}

export function calcularRiesgoConsulta(
    reportes: { clasificacion?: { categoria: CategoriaConducta; confianza: number } | null }[],
    params: Partial<RiesgoConsultaParams> = {}
): RiesgoConsultaResult {
    const total = reportes.length;
    const conClasificacion = reportes.filter((r) => r.clasificacion);
    const confianzaPromedio =
        conClasificacion.length > 0
            ? conClasificacion.reduce((sum, r) => sum + (r.clasificacion?.confianza ?? 0), 0) / conClasificacion.length
            : 0;

    const conteoCategorias = new Map<CategoriaConducta, number>();
    let sumaSeveridad = 0;
    for (const r of conClasificacion) {
        const cat = r.clasificacion!.categoria;
        conteoCategorias.set(cat, (conteoCategorias.get(cat) || 0) + 1);
        sumaSeveridad += SEVERIDAD_CATEGORIA[cat] ?? 50;
    }

    const categoriaPrincipal = [...conteoCategorias.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const severidadPromedio = conClasificacion.length > 0 ? sumaSeveridad / conClasificacion.length : 0;

    const pesoConfianza = params.pesoConfianza ?? 50;
    const pesoCantidad = params.pesoCantidad ?? 30;
    const pesoGravedad = params.pesoGravedad ?? 20;
    const totalPesos = pesoConfianza + pesoCantidad + pesoGravedad;

    const scoreRaw =
        totalPesos > 0
            ? Math.round(
                  ((confianzaPromedio * pesoConfianza +
                      factorCantidad(total) * pesoCantidad +
                      (severidadPromedio / 100) * pesoGravedad) /
                      totalPesos) *
                      100
              )
            : 0;

    const umbralMedio = params.umbralMedio ?? 50;
    const umbralAlto = params.umbralAlto ?? 75;
    const minReportesAlto = params.minReportesAlto ?? 3;

    let nivel: NivelRiesgoConsulta = "BAJO";
    if (scoreRaw >= umbralAlto && total >= minReportesAlto) {
        nivel = "ALTO";
    } else if (scoreRaw >= umbralMedio) {
        nivel = "MEDIO";
    }

    return {
        score: scoreRaw,
        nivelRiesgo: nivel,
        confianzaPromedio,
        categoriaPrincipal,
    };
}
