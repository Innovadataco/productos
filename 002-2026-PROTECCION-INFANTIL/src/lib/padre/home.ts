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
// SPEC-663 (I-396): el latido del MOTOR de clasificación — la MISMA señal honesta
// que el rector (SPEC-670). Acá solo se EXPONE el dato; la forma de la cara del
// padre (ocultar reloj en degradado, sin jerga) la decide el render (Dev 1, SPEC-660).
import { leerLatidoMotor, type LatidoMotor } from "@/lib/monitoreo/latido-motor";

export type { ColorSemaforo, SemaforoHomeItem, TimelineHomeItem, SugerenciaHome, LatidoMotor };
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
    /**
     * SPEC-663 (I-396): estado del motor de clasificación, tal cual lo da
     * `leerLatidoMotor` — `motorVivo` + `ultimaVerificacionEn` (último éxito REAL o
     * null, jamás «ahora» ni el latido del worker). Contrato con SPEC-660 (Dev 1),
     * que lo consume para la línea de calma y el gráfico. Este orquestador NO
     * inventa la frescura: solo la pasa.
     */
    estadoClasificador: LatidoMotor;
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
    const [resumen, semaforo, timeline, estadoClasificador] = await Promise.all([
        obtenerResumenCirculo(usuarioId),
        calcularSemaforoHome(usuarioId),
        obtenerTimelineHome(usuarioId),
        // SPEC-663 (I-396): la señal honesta de vida del motor. Se pasa tal cual;
        // la frescura JAMÁS se inventa acá (sale del último ollama_smoke verde o null).
        leerLatidoMotor(),
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
        estadoClasificador,
    };
}
