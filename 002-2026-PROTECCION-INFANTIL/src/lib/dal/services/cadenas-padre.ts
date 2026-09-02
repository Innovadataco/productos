/**
 * SPEC-340 (A-68 §3.1) — Mis reportes: UNA tarjeta por CADENA.
 *
 * La cadena vive en `Reporte.reportePrincipalId` (self-FK, SPEC-340). Cada
 * tarjeta: el principal + sus eventos en orden cronológico, la clasificación
 * dominante (la más repetida entre las finales; empate = la más reciente),
 * contadores, el expediente si existe, y los «otros reportes» blindados.
 *
 * EL TEXTO JAMÁS VIAJA EN EL LISTADO (research R-4): solo `textoDisponible`.
 * El texto se entrega únicamente por la ruta de detalle con step-up.
 */
import { prisma } from "../../prisma";
import { formatCategoria } from "../../labels";
import { formatPlataforma } from "../../plataforma";
import { whereReporteAprobado, whereReporteVigente } from "../../reportes-acceso";
import { getParametroSistemaValor } from "../../parametros";
import type { Prisma } from "@prisma/client";

export interface EventoCadenaDto {
    id: string;
    fechaIncidente: Date;
    creadoEn: Date;
    estado: string;
    categoriaLabel: string | null;
    /**
     * SPEC-340 §3.3: la explicación parametrizada por categoría.
     * A-70 · F11: DEJA de ser "el análisis" — baja a una línea rotulada
     * "Qué significa". El análisis es el resultado real del motor (abajo).
     */
    explicacion: string | null;
    /**
     * A-70 · F11 — el resultado REAL de la clasificación IA, lo que Jelkin
     * pidió ver: "el resultado de la clasificación, como en el anónimo".
     * `null` mientras el motor no terminó (el UI muestra estado honesto,
     * nunca una plantilla haciéndose pasar por análisis).
     */
    analisisIa: {
        categoriaLabel: string;
        confianza: number;
        secundarias: Array<{ categoriaLabel: string; confianza: number }>;
        modeloUsado: string;
        /** true cuando la clasificó una persona (SPEC-359 · B2), no el motor. */
        esManual: boolean;
    } | null;
    /** A-70 · F11 · la ficha bajo el análisis. */
    ficha: {
        pais: string | null;
        ciudad: string | null;
        edadVictima: number | null;
        origen: "anonimo" | "padre";
    };
    textoDisponible: boolean;
    esPrincipal: boolean;
}

export interface OtroReporteCadenaDto {
    id: string;
    creadoEn: Date;
    pais: string | null;
    ciudad: string | null;
    categoriaLabel: string | null;
    esAnonimo: boolean;
}

export interface CadenaDto {
    reportePrincipalId: string;
    identificador: string;
    plataforma: string;
    clasificacionDominante: string | null;
    cantidadEventos: number;
    ultimoEventoEn: Date;
    expedienteId: string | null;
    eventos: EventoCadenaDto[];
    otrosReportes: OtroReporteCadenaDto[];
}

const ESTADOS_FINALES = ["CLASIFICADO", "CORREGIDO"];

type ReporteConDetalle = Prisma.ReporteGetPayload<{
    include: {
        plataforma: { select: { nombre: true; clave: true } };
        // A-70 · F11: el resultado REAL del motor, no solo la categoría.
        clasificacion: {
            select: {
                categoria: true;
                confianza: true;
                categoriasSecundarias: true;
                modeloUsado: true;
            };
        };
    };
}>;

function dominante(reportes: ReporteConDetalle[]): string | null {
    const conteo = new Map<string, { n: number; ultima: Date }>();
    for (const r of reportes) {
        if (!r.clasificacion || !ESTADOS_FINALES.includes(r.estado)) continue;
        const prev = conteo.get(r.clasificacion.categoria);
        const fecha = r.creadoEn;
        conteo.set(r.clasificacion.categoria, {
            n: (prev?.n ?? 0) + 1,
            ultima: prev && prev.ultima > fecha ? prev.ultima : fecha,
        });
    }
    let mejor: { cat: string; n: number; ultima: Date } | null = null;
    for (const [cat, v] of conteo) {
        if (!mejor || v.n > mejor.n || (v.n === mejor.n && v.ultima > mejor.ultima)) {
            mejor = { cat, n: v.n, ultima: v.ultima };
        }
    }
    return mejor ? formatCategoria(mejor.cat) : null;
}

/**
 * A-70 · F11 — `categoriasSecundarias` es Json libre en BD. Aceptamos la forma
 * `[{categoria, confianza}]` y descartamos en silencio lo que no encaje: una
 * fila vieja con otro shape no puede tumbar la pantalla del padre.
 */
function leerSecundarias(valor: unknown): Array<{ categoriaLabel: string; confianza: number }> {
    if (!Array.isArray(valor)) return [];
    const salida: Array<{ categoriaLabel: string; confianza: number }> = [];
    for (const item of valor) {
        if (!item || typeof item !== "object") continue;
        const cat = (item as { categoria?: unknown }).categoria;
        const conf = (item as { confianza?: unknown }).confianza;
        if (typeof cat !== "string" || typeof conf !== "number") continue;
        salida.push({ categoriaLabel: formatCategoria(cat as never), confianza: conf });
    }
    return salida;
}

export async function listarCadenasPadre(usuarioId: string): Promise<CadenaDto[]> {
    const reportes = await prisma.reporte.findMany({
        where: whereReporteVigente({ usuarioId }),
        include: {
            plataforma: { select: { nombre: true, clave: true } },
            clasificacion: {
                select: {
                    categoria: true,
                    confianza: true,
                    categoriasSecundarias: true,
                    modeloUsado: true,
                },
            },
        },
        orderBy: { creadoEn: "asc" },
    });

    // Agrupar por principal (los sueltos son cadenas de 1).
    const porPrincipal = new Map<string, ReporteConDetalle[]>();
    for (const r of reportes) {
        const clave = r.reportePrincipalId ?? r.id;
        const lista = porPrincipal.get(clave) ?? [];
        lista.push(r);
        porPrincipal.set(clave, lista);
    }

    // Explicaciones por categoría (§3.3), UNA consulta por categoría presente.
    const categoriasPresentes = new Set<string>();
    for (const r of reportes) {
        if (r.clasificacion && ESTADOS_FINALES.includes(r.estado)) categoriasPresentes.add(r.clasificacion.categoria);
    }
    const explicaciones = new Map<string, string | null>();
    for (const cat of categoriasPresentes) {
        explicaciones.set(cat, await getParametroSistemaValor(`padre.analisis.explicacion.${cat}`));
    }

    // Expedientes activos del padre, por identificador (para Crear/Ver).
    const expedientes = await prisma.expediente.findMany({
        where: { padreUsuarioId: usuarioId, estado: "ACTIVO" },
        select: { id: true, identificadorReportado: true },
    });
    const expedientePorIdentificador = new Map(expedientes.map((e) => [e.identificadorReportado, e.id]));

    const cadenas: CadenaDto[] = [];
    for (const [principalId, grupo] of porPrincipal) {
        // El principal puede haber caído por disputa (SetNull): el grupo queda
        // encabezado por su primer miembro — «se muestra lo que queda».
        const cabeza = grupo.find((r) => r.id === principalId) ?? grupo[0];

        const otros = await prisma.reporte.findMany({
            where: whereReporteAprobado({
                identificador: cabeza.identificador,
                plataformaId: cabeza.plataformaId,
                id: { notIn: grupo.map((g) => g.id) },
            }),
            select: {
                id: true,
                creadoEn: true,
                pais: true,
                ciudad: true,
                esAnonimo: true,
                ciudadRel: { select: { nombre: true } },
                clasificacion: { select: { categoria: true } },
            },
            orderBy: { creadoEn: "desc" },
            take: 20,
        });

        cadenas.push({
            reportePrincipalId: principalId,
            identificador: cabeza.identificador,
            plataforma: formatPlataforma(cabeza.plataforma.nombre, cabeza.otraPlataforma, cabeza.plataforma.clave),
            clasificacionDominante: dominante(grupo),
            cantidadEventos: grupo.length,
            ultimoEventoEn: grupo[grupo.length - 1].creadoEn,
            expedienteId: expedientePorIdentificador.get(cabeza.identificador) ?? null,
            eventos: grupo.map((r) => ({
                id: r.id,
                fechaIncidente: r.fechaIncidente,
                creadoEn: r.creadoEn,
                estado: r.estado,
                categoriaLabel:
                    r.clasificacion && ESTADOS_FINALES.includes(r.estado)
                        ? formatCategoria(r.clasificacion.categoria)
                        : null,
                explicacion:
                    r.clasificacion && ESTADOS_FINALES.includes(r.estado)
                        ? (explicaciones.get(r.clasificacion.categoria) ?? null)
                        : null,
                // A-70 · F11: el resultado del motor solo cuando el proceso
                // TERMINÓ. En REVISION_MANUAL u otro estado intermedio va null
                // y el UI dice la verdad ("en revisión"), sin plantilla.
                analisisIa:
                    r.clasificacion && ESTADOS_FINALES.includes(r.estado)
                        ? {
                            categoriaLabel: formatCategoria(r.clasificacion.categoria),
                            confianza: r.clasificacion.confianza,
                            secundarias: leerSecundarias(r.clasificacion.categoriasSecundarias),
                            modeloUsado: r.clasificacion.modeloUsado,
                            // SPEC-359 · B2 dejó esta huella al clasificar a mano.
                            esManual: r.clasificacion.modeloUsado.startsWith("manual"),
                        }
                        : null,
                ficha: {
                    pais: r.pais,
                    ciudad: r.ciudad,
                    edadVictima: r.edadVictima,
                    origen: r.esAnonimo ? "anonimo" : "padre",
                },
                textoDisponible: true,
                esPrincipal: r.id === principalId,
            })),
            otrosReportes: otros.map((o) => ({
                id: o.id,
                creadoEn: o.creadoEn,
                pais: o.pais,
                ciudad: o.ciudadRel?.nombre ?? o.ciudad,
                categoriaLabel: o.clasificacion ? formatCategoria(o.clasificacion.categoria) : null,
                esAnonimo: o.esAnonimo,
            })),
        });
    }

    // Tarjetas por actividad reciente.
    cadenas.sort((a, b) => b.ultimoEventoEn.getTime() - a.ultimoEventoEn.getTime());
    return cadenas;
}
