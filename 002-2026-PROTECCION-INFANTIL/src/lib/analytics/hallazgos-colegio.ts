/**
 * SPEC-194 (002-PI-088): hallazgos automáticos y semáforo de salud de un colegio.
 * Reglas simples if/else con umbrales configurables — nada de IA.
 * No toca BD; recibe métricas y umbrales ya resueltos.
 */

export interface UmbralesHallazgos {
    inactividadAlertaDias: number;
    spamAlertaPct: number;
    resolucionComiteOkPct: number;
    periodoDefaultDias: number;
}

export interface MetricasHallazgos {
    reportesTotal: number;
    reportesPeriodo: number;
    diasDesdeUltimoReporte: number | null;
    spamTotal: number;
    spamPct: number;
    comiteIntegrantesActivos: number;
    comiteCasosEscalados: number;
    comiteCasosResueltos: number;
    comiteTasaResolucion: number;
    alertasSinOperador: number;
}

export interface Hallazgo {
    tipo: "positivo" | "negativo" | "neutro";
    mensaje: string;
}

export type SemaphoreColor = "verde" | "amarillo" | "rojo";

export function calcularHallazgos(
    umbrales: UmbralesHallazgos,
    metricas: MetricasHallazgos
): { hallazgos: Hallazgo[]; semaforo: SemaphoreColor; positivos: number; negativos: number } {
    const hallazgos: Hallazgo[] = [];
    let positivos = 0;
    let negativos = 0;

    // Positivos
    if (metricas.diasDesdeUltimoReporte !== null && metricas.diasDesdeUltimoReporte <= umbrales.periodoDefaultDias) {
        hallazgos.push({ tipo: "positivo", mensaje: `Actividad reciente: reportes en los últimos ${umbrales.periodoDefaultDias} días.` });
        positivos++;
    }

    if (metricas.comiteTasaResolucion >= umbrales.resolucionComiteOkPct) {
        hallazgos.push({ tipo: "positivo", mensaje: `Tasa de resolución del comité ≥ ${Math.round(umbrales.resolucionComiteOkPct * 100)}%.` });
        positivos++;
    }

    if (metricas.comiteIntegrantesActivos > 0) {
        hallazgos.push({ tipo: "positivo", mensaje: `Comité de Convivencia con ${metricas.comiteIntegrantesActivos} integrante(s) activo(s).` });
        positivos++;
    }

    // Negativos
    if (metricas.diasDesdeUltimoReporte !== null && metricas.diasDesdeUltimoReporte > umbrales.inactividadAlertaDias) {
        hallazgos.push({ tipo: "negativo", mensaje: `Sin reportes hace ${metricas.diasDesdeUltimoReporte} días (umbral: ${umbrales.inactividadAlertaDias}).` });
        negativos++;
    }

    if (metricas.spamPct > umbrales.spamAlertaPct) {
        hallazgos.push({ tipo: "negativo", mensaje: `${Math.round(metricas.spamPct * 100)}% de reportes clasificados como SPAM (umbral: ${Math.round(umbrales.spamAlertaPct * 100)}%).` });
        negativos++;
    }

    if (metricas.comiteIntegrantesActivos === 0) {
        hallazgos.push({ tipo: "negativo", mensaje: "Comité de Convivencia sin integrantes activos." });
        negativos++;
    }

    if (metricas.alertasSinOperador > 0) {
        hallazgos.push({ tipo: "negativo", mensaje: `${metricas.alertasSinOperador} alerta(s) sin operador asignado.` });
        negativos++;
    }

    if (metricas.comiteCasosEscalados > 0 && metricas.comiteTasaResolucion < umbrales.resolucionComiteOkPct) {
        hallazgos.push({ tipo: "negativo", mensaje: `Tasa de resolución del comité (${Math.round(metricas.comiteTasaResolucion * 100)}%) por debajo del umbral.` });
        negativos++;
    }

    if (hallazgos.length === 0) {
        hallazgos.push({ tipo: "neutro", mensaje: "Sin hallazgos destacados para el periodo analizado." });
    }

    // Semáforo: > 1 negativo crítico = rojo; mixto = amarillo; predominan positivos = verde.
    let semaforo: SemaphoreColor;
    if (negativos > 1) {
        semaforo = "rojo";
    } else if (negativos === 1) {
        semaforo = positivos >= 1 ? "amarillo" : "rojo";
    } else {
        semaforo = positivos >= 1 ? "verde" : "amarillo";
    }

    return { hallazgos, semaforo, positivos, negativos };
}
