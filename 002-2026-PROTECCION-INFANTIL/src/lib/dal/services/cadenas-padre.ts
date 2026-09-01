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
import type { Prisma } from "@prisma/client";

export interface EventoCadenaDto {
    id: string;
    fechaIncidente: Date;
    creadoEn: Date;
    estado: string;
    categoriaLabel: string | null;
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
    include: { plataforma: { select: { nombre: true; clave: true } }; clasificacion: { select: { categoria: true } } };
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

export async function listarCadenasPadre(usuarioId: string): Promise<CadenaDto[]> {
    const reportes = await prisma.reporte.findMany({
        where: whereReporteVigente({ usuarioId }),
        include: {
            plataforma: { select: { nombre: true, clave: true } },
            clasificacion: { select: { categoria: true } },
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
