/**
 * SPEC-309 (A-50): cálculo propio del semáforo resumido para el home del padre.
 * No importa servicios de SPEC-305; replica solo la lógica mínima necesaria.
 * Las consultas viven en src/lib/dal/services/padre-home.ts (Q-3).
 */
import {
    obtenerContactosActivos,
    obtenerReportesVisiblesPorIdentificadores,
} from "@/lib/dal/services/padre-home";

export type ColorSemaforo = "VERDE" | "AMBAR" | "ROJO";

export type SemaforoHomeItem = {
    id: string;
    etiqueta: string | null;
    color: ColorSemaforo;
    totalReportes: number;
};

const ESTADOS_CLASIFICADOS = ["CLASIFICADO", "CORREGIDO"] as const;
const ESTADOS_REVISION = ["REVISION_MANUAL", "REQUIERE_ANONIMIZACION"] as const;

function enUltimosDias(fecha: Date, dias: number): boolean {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
    return fecha.getTime() >= limite.getTime();
}

export function colorSemaforo(reportes: { estado: string; creadoEn: Date }[]): ColorSemaforo {
    const total = reportes.length;
    if (total === 0) return "VERDE";

    const reportes30Dias = reportes.filter((r) => enUltimosDias(r.creadoEn, 30)).length;
    const tieneRevision = reportes.some((r) => ESTADOS_REVISION.includes(r.estado as (typeof ESTADOS_REVISION)[number]));
    const tieneClasificado = reportes.some((r) =>
        ESTADOS_CLASIFICADOS.includes(r.estado as (typeof ESTADOS_CLASIFICADOS)[number])
    );

    // Alta frecuencia (>2 en 30 días) o solo clasificados con datos suficientes → rojo.
    if (tieneClasificado && (reportes30Dias >= 3 || total >= 3)) return "ROJO";
    if (tieneRevision || tieneClasificado) return "AMBAR";
    return "VERDE";
}

export async function calcularSemaforoHome(usuarioId: string): Promise<SemaforoHomeItem[]> {
    const contactos = await obtenerContactosActivos(usuarioId);

    if (contactos.length === 0) return [];

    const valores = new Set<string>();
    for (const c of contactos) {
        for (const i of c.identificadores) valores.add(i.valor);
    }

    const reportes = await obtenerReportesVisiblesPorIdentificadores(Array.from(valores));

    const reportesPorValor = new Map<string, { estado: string; creadoEn: Date }[]>();
    for (const r of reportes) {
        const lista = reportesPorValor.get(r.identificador) ?? [];
        lista.push({ estado: r.estado, creadoEn: r.creadoEn });
        reportesPorValor.set(r.identificador, lista);
    }

    const resultado: SemaforoHomeItem[] = [];
    for (const contacto of contactos) {
        const reportesDelContacto = contacto.identificadores.flatMap(
            (i) => reportesPorValor.get(i.valor) ?? []
        );
        resultado.push({
            id: contacto.id,
            etiqueta: contacto.etiqueta,
            color: colorSemaforo(reportesDelContacto),
            totalReportes: reportesDelContacto.length,
        });
    }

    return resultado.sort((a, b) => {
        const peso = { ROJO: 3, AMBAR: 2, VERDE: 1 } as const;
        const diff = peso[b.color] - peso[a.color];
        if (diff !== 0) return diff;
        return b.totalReportes - a.totalReportes;
    });
}
