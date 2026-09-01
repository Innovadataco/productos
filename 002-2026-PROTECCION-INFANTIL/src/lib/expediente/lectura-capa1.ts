/**
 * SPEC-340 (A-68 §4.4 · capa 1) — la lectura DETERMINISTA del expediente.
 *
 * REGLA DE JELKIN (01-09): los HECHOS son de reglas, la INTERPRETACIÓN es de
 * la IA. Este módulo produce SOLO cifras calculadas — jamás una frase con
 * significado ni un adjetivo (los ejemplos prohibidos viven en el brief §4.4;
 * citarlos acá haría fallar el test anti-plantilla, y con razón). Las
 * frases las escribe el modelo en el Análisis detallado (SPEC-341), que
 * recibe EXACTAMENTE esta salida como entrada (no inventa hechos).
 *
 * Módulo PURO: sin Prisma, sin reloj propio — se prueba con tablas de casos y
 * SPEC-341 lo reusa tal cual. Zona horaria: America/Bogota = UTC-5 fijo (sin
 * DST); toda franja se calcula sobre la hora local Bogotá.
 */

export interface HechoCapa1 {
    fecha: Date;
    ciudad: string | null;
    pais: string | null;
    clasificacion: string | null;
    esPropio: boolean;
    esAnonimo: boolean;
    edadReportada: number | null;
}

export interface BloqueFranja {
    /** "21:00" */ inicio: string;
    /** "23:59" */ fin: string;
    conteo: number;
}

export interface LecturaCapa1 {
    total: number;
    propios: number;
    ajenos: number;
    anonimos: number;
    franjas: {
        bloques: BloqueFranja[];
        /** El bloque con conteo máximo ÚNICO; empate → null (no se inventa dominancia). */
        dominante: (BloqueFranja & { total: number }) | null;
    };
    /** Solo si la primera clasificación difiere de la del hecho más reciente. */
    escalada: { primera: string; ultima: string } | null;
    /** Solo si hay un "antes" (previos7 >= 1) y lo reciente supera lo anterior. */
    aceleracion: { ultimos7: number; previos7: number } | null;
    alcance: { reporteros: number };
    perfil: { edadMin: number; edadMax: number } | null;
    ciudades: {
        lista: { ciudad: string; conteo: number }[];
        masReciente: { ciudad: string | null; fecha: Date } | null;
    };
}

const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000; // UTC-5 fijo, sin DST
const H = 60 * 60 * 1000;

function bloqueDe(fecha: Date): number {
    const local = new Date(fecha.getTime() - OFFSET_BOGOTA_MS);
    return Math.floor(local.getUTCHours() / 3); // 0..7
}

function etiquetaBloque(n: number): { inicio: string; fin: string } {
    const h0 = n * 3;
    const pad = (x: number) => String(x).padStart(2, "0");
    return { inicio: `${pad(h0)}:00`, fin: `${pad(h0 + 2)}:59` };
}

export function lecturaCapa1(hechos: HechoCapa1[]): LecturaCapa1 {
    const orden = [...hechos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    // ── Franjas (bloques de 3 h, hora Bogotá) ──────────────────────────────
    const porBloque = new Map<number, number>();
    for (const h of orden) {
        const b = bloqueDe(h.fecha);
        porBloque.set(b, (porBloque.get(b) ?? 0) + 1);
    }
    const bloques: BloqueFranja[] = [...porBloque.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, conteo]) => ({ ...etiquetaBloque(n), conteo }));
    let dominante: (BloqueFranja & { total: number }) | null = null;
    if (bloques.length > 0) {
        const max = Math.max(...bloques.map((b) => b.conteo));
        const enMax = bloques.filter((b) => b.conteo === max);
        // Empate en el máximo → sin dominante: no se inventa dominancia (D1).
        dominante = enMax.length === 1 ? { ...enMax[0], total: orden.length } : null;
    }

    // ── Escalada (primera vs última clasificación presente) ────────────────
    const clasificados = orden.filter((h) => h.clasificacion !== null);
    const escalada =
        clasificados.length >= 2 &&
        clasificados[0].clasificacion !== clasificados[clasificados.length - 1].clasificacion
            ? {
                primera: clasificados[0].clasificacion as string,
                ultima: clasificados[clasificados.length - 1].clasificacion as string,
            }
            : null;

    // ── Aceleración: (ancla-7d, ancla] vs (ancla-14d, ancla-7d] ────────────
    let aceleracion: { ultimos7: number; previos7: number } | null = null;
    if (orden.length > 0) {
        const ancla = orden[orden.length - 1].fecha.getTime();
        const ultimos7 = orden.filter((h) => h.fecha.getTime() > ancla - 168 * H && h.fecha.getTime() <= ancla).length;
        const previos7 = orden.filter(
            (h) => h.fecha.getTime() > ancla - 336 * H && h.fecha.getTime() <= ancla - 168 * H
        ).length;
        // Sin un "antes" no existe aceleración que afirmar (previos7 >= 1):
        // "3 hechos en 4 días" con historia; {1,0} sería ruido (D3 ajustada).
        aceleracion = previos7 >= 1 && ultimos7 > previos7 ? { ultimos7, previos7 } : null;
    }

    // ── Alcance: el propio cuenta 1; cada ajeno, 1 (anónimo o no) ──────────
    const propios = orden.filter((h) => h.esPropio).length;
    const ajenos = orden.filter((h) => !h.esPropio).length;
    const anonimos = orden.filter((h) => h.esAnonimo).length;
    const reporteros = (propios > 0 ? 1 : 0) + ajenos;

    // ── Perfil de edades ───────────────────────────────────────────────────
    const edades = orden.map((h) => h.edadReportada).filter((e): e is number => e !== null);
    const perfil = edades.length > 0 ? { edadMin: Math.min(...edades), edadMax: Math.max(...edades) } : null;

    // ── Ciudades: conteo desc, empate alfabético; el más reciente aparte ───
    const porCiudad = new Map<string, number>();
    for (const h of orden) {
        if (h.ciudad) porCiudad.set(h.ciudad, (porCiudad.get(h.ciudad) ?? 0) + 1);
    }
    const lista = [...porCiudad.entries()]
        .map(([ciudad, conteo]) => ({ ciudad, conteo }))
        .sort((a, b) => b.conteo - a.conteo || (a.ciudad < b.ciudad ? -1 : 1));
    const ultimo = orden[orden.length - 1];
    const masReciente = ultimo ? { ciudad: ultimo.ciudad, fecha: ultimo.fecha } : null;

    return {
        total: orden.length,
        propios,
        ajenos,
        anonimos,
        franjas: { bloques, dominante },
        escalada,
        aceleracion,
        alcance: { reporteros },
        perfil,
        ciudades: { lista, masReciente },
    };
}
