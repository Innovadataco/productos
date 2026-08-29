/**
 * SPEC-223 (002-PI-124): lógica PURA del contenido del digest semanal al CEO.
 *
 * El Motor de Notificaciones envía email en TEXTO PLANO (`enviarEmailNotificacion`
 * usa solo `text:` de Resend) y sus plantillas solo reemplazan `{{tokens}}`
 * (sin loops): todas las listas y tablas se pre-renderizan aquí como Markdown
 * legible como texto. Cero acceso a BD — las funciones reciben datos ya
 * agregados y devuelven strings/estructuras (testeable sin Postgres).
 *
 * FR-007: el contenido es exclusivamente datos agregados de negocio
 * (suscripciones, pagos, scores); nunca textos de reportes, identificadores
 * reportados ni datos de menores. Los nombres visibles son clientes B2B.
 */

export interface DecisionTop {
    titulo: string;
    descripcion: string;
    accion: string | null;
}

export interface KpisSemana {
    recaudoUSD: number;
    recaudoCOP: number;
    nuevas: number;
    canceladas: number;
    /** canceladas_semana / activas_al_inicio (fracción 0..1); null si el denominador es 0. */
    churnRate: number | null;
    /** Promedio de ScoreCliente.scoreTotal del período; null sin snapshots. */
    scorePromedio: number | null;
}

/** Deltas vs la semana previa, mismas claves que `KpisSemana`; null sin base. */
export type KpisVsPrevia = {
    [K in keyof KpisSemana]: number | null;
};

export interface AnomaliaItem {
    severidad: string;
    descripcion: string;
}

export interface ClienteScore {
    nombre: string;
    scoreTotal: number;
}

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Número con separador de miles estilo es-CO ("12.345"), determinista para tests. */
export function formatearNumero(n: number): string {
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatearPorcentaje(fraccion: number): string {
    return `${(fraccion * 100).toFixed(1).replace(".", ",")}%`;
}

/** Delta con signo y unidad ("+3", "-2,5 pp"); "sin base" cuando no hay comparación. */
function formatearDelta(delta: number | null, sufijo = ""): string {
    if (delta === null) return "sin base";
    const valor = sufijo === " pp" ? (delta * 100).toFixed(1).replace(".", ",") : formatearNumero(delta);
    const signo = delta > 0 ? "+" : "";
    return `${signo}${valor}${sufijo}`;
}

/**
 * Deltas de cada KPI vs la semana previa: absoluto para montos y conteos,
 * puntos porcentuales para `churnRate` (guardado como fracción, ej. 0,02 =
 * +2 pp) y puntos para `scorePromedio`. Null cuando falta la métrica en
 * cualquiera de las dos semanas (data-model §4).
 */
export function calcularDeltas(actual: KpisSemana, previa: KpisSemana): KpisVsPrevia {
    return {
        recaudoUSD: actual.recaudoUSD - previa.recaudoUSD,
        recaudoCOP: actual.recaudoCOP - previa.recaudoCOP,
        nuevas: actual.nuevas - previa.nuevas,
        canceladas: actual.canceladas - previa.canceladas,
        churnRate:
            actual.churnRate === null || previa.churnRate === null
                ? null
                : actual.churnRate - previa.churnRate,
        scorePromedio:
            actual.scorePromedio === null || previa.scorePromedio === null
                ? null
                : actual.scorePromedio - previa.scorePromedio,
    };
}

/**
 * Parsea `analisis.digest.destinatarios_emails` (lista separada por comas).
 * Los correos mal formados se devuelven en `invalidos` para que el llamador
 * los reporte con warn sin romper el envío a los demás (FR-010).
 */
export function parsearDestinatariosEmails(texto: string): { validos: string[]; invalidos: string[] } {
    const validos: string[] = [];
    const invalidos: string[] = [];
    for (const crudo of texto.split(",")) {
        const email = crudo.trim();
        if (email === "") continue;
        if (PATRON_EMAIL.test(email)) validos.push(email);
        else invalidos.push(email);
    }
    return { validos, invalidos };
}

/** Top 5 decisiones como lista numerada Markdown (texto plano). */
export function renderTop5(decisiones: DecisionTop[]): string {
    if (decisiones.length === 0) return "Sin decisiones pendientes esta semana.";
    return decisiones
        .map((d, i) => {
            const lineas = [`${i + 1}. **${d.titulo}** — ${d.descripcion}`];
            if (d.accion) lineas.push(`   Acción sugerida: ${d.accion}`);
            return lineas.join("\n");
        })
        .join("\n");
}

/** Tabla de KPIs con delta vs semana previa (lista Markdown texto plano). */
export function renderTablaKpis(kpis: KpisSemana, deltas: KpisVsPrevia): string {
    const churn = kpis.churnRate === null ? "—" : formatearPorcentaje(kpis.churnRate);
    const score = kpis.scorePromedio === null ? "—" : kpis.scorePromedio.toFixed(1).replace(".", ",");
    return [
        `- Recaudo: US$ ${formatearNumero(kpis.recaudoUSD)} (${formatearDelta(deltas.recaudoUSD)}) · $ ${formatearNumero(kpis.recaudoCOP)} COP (${formatearDelta(deltas.recaudoCOP)})`,
        `- Suscripciones nuevas: ${kpis.nuevas} (${formatearDelta(deltas.nuevas)})`,
        `- Suscripciones canceladas: ${kpis.canceladas} (${formatearDelta(deltas.canceladas)})`,
        `- Churn rate: ${churn} (${formatearDelta(deltas.churnRate, " pp")})`,
        `- Score promedio de valor: ${score} (${formatearDelta(deltas.scorePromedio)})`,
    ].join("\n");
}

/** Sección de anomalías; vacía degrada a mensaje explícito (SPEC-225 opcional). */
export function renderAnomalias(anomalias: AnomaliaItem[]): string {
    if (anomalias.length === 0) return "Sin anomalías esta semana.";
    return anomalias.map((a) => `- [${a.severidad}] ${a.descripcion}`).join("\n");
}

/** Top 3 y bottom 3 de ScoreCliente con nombre del cliente B2B. */
export function renderGanadoresPerdedores(ganadores: ClienteScore[], perdedores: ClienteScore[]): string {
    if (ganadores.length === 0 && perdedores.length === 0) {
        return "Sin snapshots de score del período (el worker de score aún no corrió).";
    }
    const formato = (c: ClienteScore, i: number) =>
        `${i + 1}. ${c.nombre} — ${c.scoreTotal.toFixed(1).replace(".", ",")}`;
    const secciones: string[] = [];
    if (ganadores.length > 0) {
        secciones.push(`Ganadores (top 3):\n${ganadores.map(formato).join("\n")}`);
    }
    if (perdedores.length > 0) {
        secciones.push(`Perdedores (bottom 3):\n${perdedores.map(formato).join("\n")}`);
    }
    return secciones.join("\n\n");
}

/**
 * Recomendaciones del sistema: heurística fija en código (D-75, cero IA)
 * sobre los KPIs de la semana y la previa. `umbralPct` es
 * `analisis.anomalias.crecimiento_pct_umbral` (default 25).
 */
export function generarRecomendacionesSistema(
    kpis: KpisSemana,
    previa: KpisSemana,
    umbralPct: number
): string[] {
    const recomendaciones: string[] = [];

    if (previa.recaudoUSD > 0) {
        const cambioPct = ((kpis.recaudoUSD - previa.recaudoUSD) / previa.recaudoUSD) * 100;
        if (cambioPct >= umbralPct) {
            recomendaciones.push(
                `El recaudo creció ${cambioPct.toFixed(0)}% vs la semana anterior: documentar qué impulsó las renovaciones para replicarlo.`
            );
        } else if (cambioPct <= -umbralPct) {
            recomendaciones.push(
                `El recaudo cayó ${Math.abs(cambioPct).toFixed(0)}% vs la semana anterior: revisar hoy el pipeline de renovaciones.`
            );
        }
    }

    if (kpis.canceladas > kpis.nuevas) {
        recomendaciones.push(
            `Esta semana se cancelaron más suscripciones (${kpis.canceladas}) de las que entraron (${kpis.nuevas}): priorizar retención y contactar a las cuentas canceladas.`
        );
    }

    if (kpis.scorePromedio === null) {
        recomendaciones.push(
            "Sin snapshots de score del período: verificar que el worker de score esté corriendo antes de leer ganadores/perdedores."
        );
    }

    if (recomendaciones.length === 0) {
        recomendaciones.push("Sin alertas operativas: la semana va dentro de los parámetros.");
    }
    return recomendaciones;
}

/** Sección final de recomendaciones como viñetas Markdown. */
export function renderRecomendacionesSistema(recomendaciones: string[]): string {
    return recomendaciones.map((r) => `- ${r}`).join("\n");
}
