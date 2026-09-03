/**
 * SPEC-151 (FR-003/FR-004): cálculo del informe mensual determinístico del
 * colegio. Solo agregados; cero PII. El rango del mes se fija en hora local de
 * Colombia (America/Bogota) para que el informe sea reproducible día a día.
 */
import { AlertaColegioMensualRepository } from "@/lib/dal/repositories/alerta-colegio-mensual";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";

export interface CursoInformeMensual {
    cursoId: string;
    nombre: string;
    reportesDistintos: number;
    alertasTotales: number;
}

export interface CategoriaInformeMensual {
    categoria: string;
    reportesDistintos: number;
    alertasTotales: number;
}

export interface InformeMensualColegio {
    colegioId: string;
    colegioNombre: string;
    // SPEC-379 (D1): membrete institucional del informe mensual (rector lo
    // lleva al consejo directivo / Secretaría, necesita autoría clara).
    colegioNit: string;
    escudoAssetKey: string | null;
    mes: string; // YYYY-MM
    reportesDistintos: number;
    alertasTotales: number;
    cursosAfectados: number;
    porCurso: CursoInformeMensual[];
    porCategoria: CategoriaInformeMensual[];
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Convierte "YYYY-MM" a fecha de inicio del mes en zona Bogotá (UTC a medianoche). */
export function parseMesBogota(mes: string): { inicio: Date; fin: Date; etiqueta: string } {
    const [anioStr, mesStr] = mes.split("-");
    const anio = Number(anioStr);
    const mesIdx = Number(mesStr) - 1;
    if (!Number.isFinite(anio) || mesIdx < 0 || mesIdx > 11) {
        throw new Error("Formato de mes inválido");
    }
    // Fechas en UTC que representan medianoche en Bogotá (UTC-5 sin DST).
    const inicio = new Date(Date.UTC(anio, mesIdx, 1, 5, 0, 0, 0));
    const fin = new Date(Date.UTC(anio, mesIdx + 1, 1, 5, 0, 0, 0));
    const etiqueta = `${MESES[mesIdx]} ${anio}`;
    return { inicio, fin, etiqueta };
}

/** Calcula el informe mensual del colegio. Los datos son agregados y determinísticos
 * para el par (colegioId, mes) dado el estado actual de la BD. */
export async function calcularInformeMensual(colegioId: string, mes: string): Promise<InformeMensualColegio> {
    const colegio = await new ColegioRepository().obtenerResumen(colegioId);
    if (!colegio) {
        throw new Error("Colegio no encontrado");
    }

    const { inicio, fin } = parseMesBogota(mes);
    const alertas = new AlertaColegioMensualRepository();

    const [resumen, porCurso, porCategoria] = await Promise.all([
        alertas.resumenMensual(colegioId, inicio, fin),
        alertas.porCursoMensual(colegioId, inicio, fin),
        alertas.porCategoriaMensual(colegioId, inicio, fin),
    ]);

    return {
        colegioId,
        colegioNombre: colegio.nombre,
        colegioNit: colegio.nit,
        escudoAssetKey: colegio.escudoAssetKey,
        mes,
        reportesDistintos: resumen.reportesDistintos,
        alertasTotales: resumen.alertasTotales,
        cursosAfectados: resumen.cursosAfectados,
        porCurso,
        porCategoria,
    };
}

export function etiquetaMes(mes: string): string {
    return parseMesBogota(mes).etiqueta;
}
