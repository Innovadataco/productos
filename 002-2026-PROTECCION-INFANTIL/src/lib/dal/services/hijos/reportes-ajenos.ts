/**
 * SPEC-716 · «A quién protejo» · Sus cuentas — el DATO (sin texto, sin autor).
 *
 * Por cada hijo del padre autenticado: sus identificadores ACTIVOS y, por cada uno, los
 * reportes que hicieron OTROS sobre esa cuenta. Del reporte se ve TODO menos el texto:
 * cantidad, clasificación, fecha, país y ciudad — nunca el relato, nunca quién reportó.
 *
 * Tres invariantes (radicado SPEC-716):
 *  1. El DTO por reporte NO lleva texto ni autor. Misma forma blindada que
 *     `OtroReporteCadenaDto` (cadenas-padre.ts): { id, creadoEn, pais, ciudad, categoriaLabel,
 *     esAnonimo }. El candado estructural lo custodia.
 *  2. UNA sola verdad de visibilidad: la MISMA que `tieneReportes` en `listarHijos`
 *     (`estado ∈ ESTADOS_VISIBLES ∧ eliminado: false`). Divergir daría dos conteos del mismo
 *     hecho — el pozo que advierte el comentario de hijos.ts.
 *  3. Reportes de OTROS, no los del padre (usuarioId ≠ este padre; incluye anónimos
 *     usuarioId=null). Los del padre viven en la OTRA población («Cuentas que reportaste por
 *     ella»), que no se funde con esta.
 */
import { prisma } from "@/lib/prisma";
import { formatCategoria } from "@/lib/labels";
import { ESTADOS_VISIBLES } from "@/lib/dal/services/circulo-confianza/tipos";

/** Un reporte que hizo OTRO sobre la cuenta. BLINDADO: sin texto ni autor. */
export interface ReporteAjenoDto {
    id: string;
    creadoEn: Date;
    pais: string | null;
    ciudad: string | null;
    categoriaLabel: string | null;
    esAnonimo: boolean;
}

/** Un identificador ACTIVO del hijo + los reportes que le hicieron OTROS. */
export interface CuentaReportadaDto {
    valor: string;
    plataforma: string | null;
    total: number;
    reportes: ReporteAjenoDto[];
}

/** Un hijo del padre + sus cuentas activas (con sus reportes ajenos, si los hay). */
export interface HijoConCuentasDto {
    hijoId: string;
    nombre: string;
    cuentas: CuentaReportadaDto[];
}

/**
 * Devuelve, por hijo del padre autenticado, sus cuentas activas y los reportes que hicieron
 * OTROS sobre cada una. Read-only. El texto del reporte JAMÁS entra en la proyección.
 */
export async function listarCuentasReportadasPorOtros(usuarioId: string): Promise<HijoConCuentasDto[]> {
    const hijos = await prisma.hijo.findMany({
        where: { usuarioId },
        select: {
            id: true,
            nombre: true,
            identificadores: {
                where: { activo: true },
                select: { valor: true, plataforma: { select: { nombre: true } } },
                orderBy: { creadoEn: "asc" },
            },
        },
        orderBy: { creadoEn: "desc" },
    });

    const valores = [...new Set(hijos.flatMap((h) => h.identificadores.map((i) => i.valor)))];

    // Reportes de OTROS sobre esas cuentas. Visibilidad = la de `tieneReportes` (una sola verdad);
    // OTROS = no atribuibles a este padre (incluye anónimos usuarioId=null). El `select` no toca
    // el texto ni el autor: solo la forma blindada.
    const reportes =
        valores.length === 0
            ? []
            : await prisma.reporte.findMany({
                where: {
                    identificador: { in: valores },
                    estado: { in: ESTADOS_VISIBLES },
                    eliminado: false,
                    OR: [{ usuarioId: null }, { usuarioId: { not: usuarioId } }],
                },
                select: {
                    id: true,
                    identificador: true,
                    creadoEn: true,
                    pais: true,
                    ciudad: true,
                    ciudadRel: { select: { nombre: true } },
                    esAnonimo: true,
                    clasificacion: { select: { categoria: true } },
                },
                orderBy: { creadoEn: "desc" },
            });

    const porIdentificador = new Map<string, ReporteAjenoDto[]>();
    for (const r of reportes) {
        const dto: ReporteAjenoDto = {
            id: r.id,
            creadoEn: r.creadoEn,
            pais: r.pais,
            ciudad: r.ciudadRel?.nombre ?? r.ciudad,
            categoriaLabel: r.clasificacion ? formatCategoria(r.clasificacion.categoria) : null,
            esAnonimo: r.esAnonimo,
        };
        const lista = porIdentificador.get(r.identificador) ?? [];
        lista.push(dto);
        porIdentificador.set(r.identificador, lista);
    }

    return hijos.map((h) => ({
        hijoId: h.id,
        nombre: h.nombre,
        cuentas: h.identificadores.map((i) => {
            const reportesAjenos = porIdentificador.get(i.valor) ?? [];
            return {
                valor: i.valor,
                plataforma: i.plataforma?.nombre ?? null,
                total: reportesAjenos.length,
                reportes: reportesAjenos,
            };
        }),
    }));
}
