/**
 * SPEC-341 (A-68 §4.4 capa 2 · T012) — orquestador reutilizable del payload.
 *
 * Dos armadores según el alcance:
 *  · PADRE_COMPLETO: lista de hechos con fecha/ciudad/país/plataforma/categoría/
 *    edadReportada + agregados de contexto (categoría dominante, franja horaria,
 *    ciudad dominante) + cruce con el hijo (solo edad/sexo, jamás nombre).
 *  · COLEGIO_BLINDADO: SOLO agregados (categoría, franja horaria, curso, plataforma).
 *    CERO identificadores. CERO texto crudo. CERO nombre/apellido/documento/edad
 *    por hecho individual. Verificado con grep en el test T013.
 *
 * El módulo colegio (C3) importa `armarPayloadColegio` y llama al mismo ejecutor;
 * cero código nuevo de motor cuando llegue.
 */
import type { AlcanceAnalisis, CategoriaConducta } from "@prisma/client";

export interface HechoPadre {
    fecha: Date;
    ciudad: string | null;
    pais: string | null;
    plataforma: string | null;
    categoria: CategoriaConducta | null;
    edadReportada: number | null;
}

export interface HijoCruzado {
    edad: number | null;
    sexo: string | null;
}

export interface AgregadoColegio {
    curso: string;
    plataforma: string | null;
    franjaHoraria: string; // "0-6" | "6-12" | "12-18" | "18-24"
    categoria: CategoriaConducta;
    cantidad: number;
}

export interface PayloadPadre {
    alcance: "PADRE_COMPLETO";
    numHechos: number;
    hechos: HechoPadre[];
    categoriaDominante: CategoriaConducta | null;
    franjaHorariaDominante: string | null;
    ciudadDominante: string | null;
    hijoCruzado: HijoCruzado | null;
}

export interface PayloadColegio {
    alcance: "COLEGIO_BLINDADO";
    numHechos: number;
    agregadosPorCategoria: Array<{ categoria: CategoriaConducta; cantidad: number }>;
    agregadosPorFranja: Array<{ franjaHoraria: string; cantidad: number }>;
    agregadosPorCurso: Array<{ curso: string; cantidad: number }>;
    agregadosPorPlataforma: Array<{ plataforma: string; cantidad: number }>;
}

export type PayloadAnalisis = PayloadPadre | PayloadColegio;

/**
 * SPEC-431 (I-247 b) · America/Bogota = UTC-5 fijo, sin horario de verano.
 * Mismo criterio que `lectura-capa1.ts` — no se calcula franja sobre UTC.
 */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

/**
 * Franja horaria en 4 bloques de 6 h, **en hora de Bogotá**; 0-6 = madrugada,
 * 18-24 = noche.
 *
 * Antes de SPEC-431 esto usaba `getUTCHours()` a secas, y como Colombia va cinco
 * horas atrás, **la noche entera se le presentaba al modelo como madrugada**: un
 * hecho de las 21:00 en Bogotá es 02:00 UTC del día siguiente. La franja horaria
 * es una de las señales que el modelo pesa para leer un patrón; darle la noche
 * cambiada de bloque le cambia la lectura sin que nadie lo note.
 */
function franjaDe(fecha: Date): string {
    const h = new Date(fecha.getTime() - OFFSET_BOGOTA_MS).getUTCHours();
    if (h < 6) return "0-6";
    if (h < 12) return "6-12";
    if (h < 18) return "12-18";
    return "18-24";
}

/** El primero de una serie ordenada `[valor, cantidad]` DESC por cantidad. null si empate en 0. */
function dominante<T>(pares: Array<[T, number]>): T | null {
    if (!pares.length) return null;
    const orden = [...pares].sort((a, b) => b[1] - a[1]);
    return orden[0][1] > 0 ? orden[0][0] : null;
}

export function armarPayloadPadre(input: {
    hechos: HechoPadre[];
    hijoCruzado: HijoCruzado | null;
}): PayloadPadre {
    const { hechos, hijoCruzado } = input;

    const catCount = new Map<CategoriaConducta, number>();
    const franjaCount = new Map<string, number>();
    const ciudadCount = new Map<string, number>();

    for (const h of hechos) {
        if (h.categoria) catCount.set(h.categoria, (catCount.get(h.categoria) ?? 0) + 1);
        franjaCount.set(franjaDe(h.fecha), (franjaCount.get(franjaDe(h.fecha)) ?? 0) + 1);
        if (h.ciudad) ciudadCount.set(h.ciudad, (ciudadCount.get(h.ciudad) ?? 0) + 1);
    }

    return {
        alcance: "PADRE_COMPLETO",
        numHechos: hechos.length,
        hechos,
        categoriaDominante: dominante([...catCount]),
        franjaHorariaDominante: dominante([...franjaCount]),
        ciudadDominante: dominante([...ciudadCount]),
        hijoCruzado,
    };
}

export function armarPayloadColegio(input: {
    agregados: AgregadoColegio[];
}): PayloadColegio {
    const { agregados } = input;

    const porCategoria = new Map<CategoriaConducta, number>();
    const porFranja = new Map<string, number>();
    const porCurso = new Map<string, number>();
    const porPlataforma = new Map<string, number>();

    for (const a of agregados) {
        porCategoria.set(a.categoria, (porCategoria.get(a.categoria) ?? 0) + a.cantidad);
        porFranja.set(a.franjaHoraria, (porFranja.get(a.franjaHoraria) ?? 0) + a.cantidad);
        porCurso.set(a.curso, (porCurso.get(a.curso) ?? 0) + a.cantidad);
        if (a.plataforma) porPlataforma.set(a.plataforma, (porPlataforma.get(a.plataforma) ?? 0) + a.cantidad);
    }

    return {
        alcance: "COLEGIO_BLINDADO",
        numHechos: agregados.reduce((s, a) => s + a.cantidad, 0),
        agregadosPorCategoria: [...porCategoria].map(([categoria, cantidad]) => ({ categoria, cantidad })),
        agregadosPorFranja: [...porFranja].map(([franjaHoraria, cantidad]) => ({ franjaHoraria, cantidad })),
        agregadosPorCurso: [...porCurso].map(([curso, cantidad]) => ({ curso, cantidad })),
        agregadosPorPlataforma: [...porPlataforma].map(([plataforma, cantidad]) => ({ plataforma, cantidad })),
    };
}

/** Punto único de entrada para el ejecutor — recibe el alcance decidido antes. */
export function armarPayload(args:
    | { alcance: "PADRE_COMPLETO"; hechos: HechoPadre[]; hijoCruzado: HijoCruzado | null }
    | { alcance: "COLEGIO_BLINDADO"; agregados: AgregadoColegio[] }
): PayloadAnalisis {
    if (args.alcance === "PADRE_COMPLETO") {
        return armarPayloadPadre({ hechos: args.hechos, hijoCruzado: args.hijoCruzado });
    }
    return armarPayloadColegio({ agregados: args.agregados });
}

// Alias de conveniencia con el enum de Prisma.
export type Alcance = AlcanceAnalisis;
