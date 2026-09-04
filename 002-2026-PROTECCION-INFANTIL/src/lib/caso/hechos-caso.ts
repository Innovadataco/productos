/**
 * SPEC-350 (A-69 · C3 · T010) — los hechos que el COLEGIO puede ver de un caso.
 *
 * Cadena: SeguimientoCaso → AlertaColegio → identificador del sujeto (uno de
 * los 3 tipos) → todos los reportes APROBADOS de ese identificador.
 *
 * CANDADO (brief §0.4): del reporte ajeno solo fecha, país, ciudad y
 * clasificación. JAMÁS texto ni autor. El SELECT de acá es la valla — no
 * pide `texto`, `usuarioId` ni ningún dato del denunciante.
 *
 * Las franjas horarias se calculan en HORA BOGOTÁ (no UTC): un contacto de
 * las 21:15 COT es nocturno aunque el reloj UTC diga 02:15 del día siguiente.
 */
import { prisma } from "../prisma";
import { whereReporteAprobado } from "../reportes-acceso";
import type { AgregadoColegio } from "../expediente/analisis/armar-payload";
import type { CategoriaConducta } from "@prisma/client";

export interface HechoCaso {
    fecha: Date;
    ciudad: string | null;
    pais: string | null;
    plataforma: string | null;
    categoria: CategoriaConducta | null;
    /** Coordenadas de la ciudad (catálogo) para el mapa — null si no hay. */
    lat: number | null;
    lng: number | null;
}

export interface CasoConHechos {
    caso: {
        id: string;
        colegioId: string;
        estado: string;
        tipoSujeto: string;
        curso: string | null;
    };
    identificadorValor: string;
    hechos: HechoCaso[];
    agregados: AgregadoColegio[];
}

/** Hora local Bogotá (0-23) de una fecha — para franjas nocturnas correctas. */
function horaBogota(fecha: Date): number {
    return Number.parseInt(
        new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Bogota" }).format(fecha),
        10
    ) % 24;
}

/**
 * Exportada desde SPEC-431 (I-247 b) para poder CONTRASTARLA: el armador del
 * payload al modelo tenía su propia copia y calculaba sobre UTC. Dos funciones
 * que responden lo mismo tienen que responder igual, y eso hay que poder
 * probarlo. Función pura, sin estado.
 */
export function franjaBogota(fecha: Date): string {
    const h = horaBogota(fecha);
    if (h < 6) return "0-6";
    if (h < 12) return "6-12";
    if (h < 18) return "12-18";
    return "18-24";
}

/**
 * Carga el caso con sus hechos visibles para el colegio, o null si no existe.
 * NO hace boundary de rol — eso es del DAL/route que llama.
 */
export async function cargarCasoConHechos(casoId: string): Promise<CasoConHechos | null> {
    const caso = await prisma.seguimientoCaso.findUnique({
        where: { id: casoId },
        select: {
            id: true,
            colegioId: true,
            estado: true,
            alerta: {
                select: {
                    tipoSujeto: true,
                    identificadorEstudiante: {
                        select: {
                            valor: true,
                            estudiante: { select: { curso: { select: { nombre: true } } } },
                        },
                    },
                    identificadorProfesor: { select: { valor: true } },
                    identificadorAcudiente: { select: { valor: true } },
                },
            },
        },
    });
    if (!caso) return null;

    const { alerta } = caso;
    const identificadorValor =
        alerta.identificadorEstudiante?.valor ??
        alerta.identificadorProfesor?.valor ??
        alerta.identificadorAcudiente?.valor ??
        null;
    if (!identificadorValor) return null;

    const curso = alerta.identificadorEstudiante?.estudiante.curso.nombre ?? null;

    // Todos los reportes APROBADOS del identificador — solo los 4 campos del candado.
    const reportes = await prisma.reporte.findMany({
        where: whereReporteAprobado({ identificador: identificadorValor }),
        orderBy: { fechaIncidente: "asc" },
        select: {
            fechaIncidente: true,
            ciudad: true,
            pais: true,
            plataforma: { select: { clave: true } },
            clasificacion: { select: { categoria: true } },
            ciudadRel: { select: { nombre: true, lat: true, lng: true } },
        },
    });

    const hechos: HechoCaso[] = reportes.map((r) => ({
        fecha: r.fechaIncidente,
        ciudad: r.ciudadRel?.nombre ?? r.ciudad,
        pais: r.pais,
        plataforma: r.plataforma.clave,
        categoria: r.clasificacion?.categoria ?? null,
        lat: r.ciudadRel?.lat ?? null,
        lng: r.ciudadRel?.lng ?? null,
    }));

    // Agregados anónimos para el modelo (alcance COLEGIO_BLINDADO): por
    // (curso, plataforma, franja Bogotá, categoría) con conteos.
    const conteo = new Map<string, AgregadoColegio>();
    const cursoAgregado = curso ?? alerta.tipoSujeto; // sin curso (profesor/acudiente): el tipo de sujeto agrupa
    for (const h of hechos) {
        if (!h.categoria) continue; // sin clasificación no aporta al agregado
        const franja = franjaBogota(h.fecha);
        const clave = `${cursoAgregado}|${h.plataforma ?? "?"}|${franja}|${h.categoria}`;
        const previo = conteo.get(clave);
        if (previo) {
            previo.cantidad += 1;
        } else {
            conteo.set(clave, {
                curso: cursoAgregado,
                plataforma: h.plataforma,
                franjaHoraria: franja,
                categoria: h.categoria,
                cantidad: 1,
            });
        }
    }

    return {
        caso: {
            id: caso.id,
            colegioId: caso.colegioId,
            estado: caso.estado,
            tipoSujeto: alerta.tipoSujeto,
            curso,
        },
        identificadorValor,
        hechos,
        agregados: [...conteo.values()],
    };
}
