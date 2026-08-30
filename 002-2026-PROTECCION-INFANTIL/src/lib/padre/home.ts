/**
 * SPEC-309 (A-50): orquestador del home proactivo del padre.
 * Agrupa saludo, resumen del círculo, semáforo, timeline, sugerencia y accesos.
 * Las consultas a Prisma viven en src/lib/dal/services/padre-home.ts (Q-3).
 */
import {
    obtenerContactosActivos,
    obtenerResumenReportesPorIdentificadores,
} from "@/lib/dal/services/padre-home";
import type { ColorSemaforo, SemaforoHomeItem } from "./home-semaforo";
import { calcularSemaforoHome, colorSemaforo } from "./home-semaforo";
import type { TimelineHomeItem } from "./home-timeline";
import { obtenerTimelineHome } from "./home-timeline";
import type { SugerenciaHome } from "./home-sugerencia";
import { calcularSugerenciaHome, contarPorColor } from "./home-sugerencia";

export type { ColorSemaforo, SemaforoHomeItem, TimelineHomeItem, SugerenciaHome };
export { colorSemaforo, calcularSemaforoHome, obtenerTimelineHome, calcularSugerenciaHome, contarPorColor };

export type ResumenCirculoHome = {
    totalContactos: number;
    sinReportes: number;
    enRevision: number;
    clasificados: number;
};

export type AccesoRapido = {
    label: string;
    href: string;
    externo?: boolean;
};

export type HomePadrePayload = {
    saludo: string;
    fechaHoy: string;
    resumen: ResumenCirculoHome;
    semaforo: SemaforoHomeItem[];
    timeline: TimelineHomeItem[];
    sugerencia: SugerenciaHome;
    accesos: AccesoRapido[];
};

const ESTADOS_CLASIFICADOS = ["CLASIFICADO", "CORREGIDO"] as const;
const ESTADOS_REVISION = ["REVISION_MANUAL", "REQUIERE_ANONIMIZACION"] as const;

function saludoSegunHora(): string {
    const hora = new Date().getHours();
    if (hora < 12) return "Buenos días";
    if (hora < 18) return "Buenas tardes";
    return "Buenas noches";
}

function formatearFechaHoy(): string {
    return new Date().toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

async function obtenerResumenCirculo(usuarioId: string): Promise<ResumenCirculoHome> {
    const contactos = await obtenerContactosActivos(usuarioId);

    if (contactos.length === 0) {
        return { totalContactos: 0, sinReportes: 0, enRevision: 0, clasificados: 0 };
    }

    const valores = new Set<string>();
    for (const c of contactos) {
        for (const i of c.identificadores) valores.add(i.valor);
    }

    const reportes = await obtenerResumenReportesPorIdentificadores(Array.from(valores));

    const reportesPorValor = new Map<string, { estado: string }[]>();
    for (const r of reportes) {
        const lista = reportesPorValor.get(r.identificador) ?? [];
        lista.push({ estado: r.estado });
        reportesPorValor.set(r.identificador, lista);
    }

    let sinReportes = 0;
    let enRevision = 0;
    let clasificados = 0;

    for (const contacto of contactos) {
        const reportesDelContacto = contacto.identificadores.flatMap(
            (i) => reportesPorValor.get(i.valor) ?? []
        );
        if (reportesDelContacto.length === 0) {
            sinReportes++;
            continue;
        }
        const tieneRevision = reportesDelContacto.some((r) =>
            ESTADOS_REVISION.includes(r.estado as (typeof ESTADOS_REVISION)[number])
        );
        const tieneClasificado = reportesDelContacto.some((r) =>
            ESTADOS_CLASIFICADOS.includes(r.estado as (typeof ESTADOS_CLASIFICADOS)[number])
        );
        if (tieneClasificado) clasificados++;
        else if (tieneRevision) enRevision++;
        else sinReportes++;
    }

    return {
        totalContactos: contactos.length,
        sinReportes,
        enRevision,
        clasificados,
    };
}

function accesosRapidos(): AccesoRapido[] {
    return [
        { label: "Reportar", href: "/dashboard/padre/reportar" },
        { label: "Círculo", href: "/dashboard/padre/circulo-confianza" },
        { label: "Expedientes", href: "/dashboard/padre/expedientes" },
        { label: "Línea 141 ICBF", href: "https://www.icbf.gov.co/linea-141", externo: true },
        { label: "CAI Virtual", href: "https://caivirtual.policia.gov.co", externo: true },
        { label: "Te Protejo", href: "https://www.teprotejo.org", externo: true },
    ];
}

export async function obtenerHomePadre(
    usuarioId: string,
    nombre: string | null,
    opciones?: { enPeriodoGracia?: boolean }
): Promise<HomePadrePayload> {
    const [resumen, semaforo, timeline] = await Promise.all([
        obtenerResumenCirculo(usuarioId),
        calcularSemaforoHome(usuarioId),
        obtenerTimelineHome(usuarioId),
    ]);

    const conteo = contarPorColor(semaforo);
    const sugerencia = calcularSugerenciaHome({
        totalContactos: resumen.totalContactos,
        contactosRojo: conteo.rojo,
        contactosAmbar: conteo.ambar,
        enPeriodoGracia: opciones?.enPeriodoGracia ?? false,
        nombrePadre: nombre,
    });

    return {
        saludo: `${saludoSegunHora()}, ${nombre ?? "padre"}`,
        fechaHoy: formatearFechaHoy(),
        resumen,
        semaforo,
        timeline,
        sugerencia,
        accesos: accesosRapidos(),
    };
}
