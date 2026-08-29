/**
 * SPEC-305 (A-50): cálculo del semáforo de riesgo por contacto del círculo de
 * confianza. Toda la lógica es query-based (sin LLM) y determinista.
 */
import { obtenerGruposCategoria } from "@/lib/categoria-grupos";
import { getParametroSistemaValor } from "@/lib/parametros";
import { SemaforoRepository } from "@/lib/dal/repositories/semaforo-repository";
import type { Prisma } from "@prisma/client";
import type { DatosReporte } from "@/lib/dal/services/circulo-confianza/tipos";

export type ColorSemaforo = "VERDE" | "AMBAR" | "ROJO";

export type SemaforoContacto = {
    id: string;
    etiqueta: string | null;
    activo: boolean;
    color: ColorSemaforo;
    totalReportes: number;
    reportes30Dias: number;
    categoriaDominante: string | null;
    grupoDominante: string | null;
    tieneExpedienteRojo: boolean;
};

const ESTADOS_CLASIFICADOS = ["CLASIFICADO", "CORREGIDO"] as const;
const ESTADOS_REVISION = ["REVISION_MANUAL", "REQUIERE_ANONIMIZACION"] as const;

export function peorColor(a: ColorSemaforo, b: ColorSemaforo): ColorSemaforo {
    const orden = { ROJO: 3, AMBAR: 2, VERDE: 1 } as const;
    return orden[a] >= orden[b] ? a : b;
}

function enUltimosDias(fecha: Date, dias: number): boolean {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
    return fecha.getTime() >= limite.getTime();
}

export async function obtenerGruposAltoRiesgo(client?: Prisma.TransactionClient): Promise<string[]> {
    const valor = await getParametroSistemaValor("padre.semaforo.grupos_alto_riesgo", client);
    if (valor) {
        try {
            const parsed = JSON.parse(valor) as unknown;
            if (Array.isArray(parsed) && parsed.every((c) => typeof c === "string")) {
                return parsed as string[];
            }
        } catch {
            // caer al default
        }
    }
    return ["contacto_sexual", "amenazas_extorsion"];
}

function contarCategorias(reportes: DatosReporte[]) {
    const categorias = new Map<string, number>();
    for (const r of reportes) {
        const cat = r.clasificacion?.categoria;
        if (!cat) continue;
        categorias.set(cat, (categorias.get(cat) ?? 0) + 1);
    }
    return categorias;
}

function categoriaDominante(categorias: Map<string, number>): string | null {
    let dominante: string | null = null;
    let max = 0;
    for (const [cat, total] of categorias.entries()) {
        if (total > max) {
            max = total;
            dominante = cat;
        }
    }
    return dominante;
}

function evaluarAltoRiesgo(
    categoriaDominante: string | null,
    grupos: Awaited<ReturnType<typeof obtenerGruposCategoria>>,
    gruposAltoRiesgo: string[]
): boolean {
    if (!categoriaDominante) return false;
    return grupos.some(
        (g) => gruposAltoRiesgo.includes(g.clave) && g.categorias.includes(categoriaDominante)
    );
}

export async function calcularSemaforoContacto(
    reportes: DatosReporte[],
    expedientes: { identificadorReportado: string; scoreGravedadActual: string }[],
    gruposAltoRiesgo?: string[]
): Promise<Omit<SemaforoContacto, "id" | "etiqueta" | "activo"> & { categorias: Map<string, number> }> {
    const totalReportes = reportes.length;
    const reportes30Dias = totalReportes > 0
        ? reportes.filter((r) => enUltimosDias(new Date(r.creadoEn), 30)).length
        : 0;
    const tieneExpedienteRojo = expedientes.some((e) => e.scoreGravedadActual === "ROJO");

    if (totalReportes === 0 && !tieneExpedienteRojo) {
        return {
            color: "VERDE",
            totalReportes: 0,
            reportes30Dias: 0,
            categoriaDominante: null,
            grupoDominante: null,
            tieneExpedienteRojo: false,
            categorias: new Map(),
        };
    }

    const categorias = contarCategorias(reportes);
    const dominante = categoriaDominante(categorias);

    const grupos = await obtenerGruposCategoria();
    const gruposAlto = gruposAltoRiesgo ?? (await obtenerGruposAltoRiesgo());
    const grupoDominante = dominante
        ? (grupos.find((g) => g.categorias.includes(dominante))?.clave ?? null)
        : null;

    const tieneAltoRiesgo = evaluarAltoRiesgo(dominante, grupos, gruposAlto);

    const tieneRevision = reportes.some((r) => ESTADOS_REVISION.includes(r.estado as (typeof ESTADOS_REVISION)[number]));
    const tieneClasificado = reportes.some((r) =>
        ESTADOS_CLASIFICADOS.includes(r.estado as (typeof ESTADOS_CLASIFICADOS)[number])
    );

    let color: ColorSemaforo = "VERDE";
    if (tieneExpedienteRojo || (tieneClasificado && (tieneAltoRiesgo || reportes30Dias >= 3))) {
        color = "ROJO";
    } else if (tieneRevision || tieneClasificado) {
        color = "AMBAR";
    }

    return {
        color,
        totalReportes,
        reportes30Dias,
        categoriaDominante: dominante,
        grupoDominante,
        tieneExpedienteRojo,
        categorias,
    };
}

export async function listarSemaforosPorPadre(usuarioId: string): Promise<SemaforoContacto[]> {
    const repo = new SemaforoRepository();

    const contactos = await repo.listarContactosConIdentificadores(usuarioId);
    if (contactos.length === 0) return [];

    const todosLosValores = new Set<string>();
    for (const contacto of contactos) {
        for (const v of contacto.valores) todosLosValores.add(v);
    }
    const valoresArray = Array.from(todosLosValores);

    const [reportes, expedientes, gruposAltoRiesgo] = await Promise.all([
        repo.buscarReportesVisiblesPorIdentificadores(valoresArray),
        repo.buscarExpedientesAbiertosPorIdentificadores(usuarioId, valoresArray),
        obtenerGruposAltoRiesgo(),
    ]);

    const reportesPorValor = new Map<string, DatosReporte[]>();
    for (const r of reportes) {
        const lista = reportesPorValor.get(r.identificador) ?? [];
        lista.push(r);
        reportesPorValor.set(r.identificador, lista);
    }

    const expedientesPorValor = new Map<string, typeof expedientes>();
    for (const e of expedientes) {
        const lista = expedientesPorValor.get(e.identificadorReportado) ?? [];
        lista.push(e);
        expedientesPorValor.set(e.identificadorReportado, lista);
    }

    const resultado: SemaforoContacto[] = [];
    for (const contacto of contactos) {
        const reportesDelContacto = contacto.valores.flatMap((v) => reportesPorValor.get(v) ?? []);
        const expedientesDelContacto = contacto.valores.flatMap((v) => expedientesPorValor.get(v) ?? []);

        const calculo = await calcularSemaforoContacto(reportesDelContacto, expedientesDelContacto, gruposAltoRiesgo);

        resultado.push({
            id: contacto.id,
            etiqueta: contacto.etiqueta,
            activo: contacto.activo,
            ...calculo,
        });
    }

    return resultado;
}
