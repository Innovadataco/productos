/**
 * SPEC-716 (Parte B) · «A quién protejo» · Cuentas que reportaste por {nombre} — el DATO.
 *
 * Por cada hijo del padre autenticado, las cuentas que ÉL MISMO reportó como que le escribieron
 * (sus propios `Reporte` con `hijoId` = ese hijo · SPEC-591). Es la población OPUESTA a «Sus
 * cuentas» (reportes de OTROS sobre las cuentas del hijo): acá son los reportes del PADRE. Los dos
 * grupos NO se funden (radicado SPEC-716) — por eso viven en servicios separados.
 *
 * Una sola verdad de visibilidad: la MISMA que `tieneReportes` / `listarCuentasReportadasPorOtros`
 * (`estado ∈ ESTADOS_VISIBLES ∧ eliminado: false`). Read-only. El texto del reporte NO se proyecta
 * (esta pantalla muestra la cuenta y su estado, no el relato — el detalle del propio reporte vive en
 * «Mis reportes»).
 */
import { prisma } from "@/lib/prisma";
import { formatCategoria } from "@/lib/labels";
import { ESTADOS_VISIBLES } from "@/lib/dal/services/circulo-confianza/tipos";
import { whereReporteVigente } from "@/lib/reportes-acceso";

/** Una cuenta que el padre reportó por su hijo. Sin texto: la cuenta + su estado. */
export interface CuentaQueReporteDto {
    reporteId: string;
    valor: string;
    plataforma: string | null;
    creadoEn: Date;
    /** true = aún sin clasificar (en revisión); false = ya clasificada. */
    enRevision: boolean;
    categoriaLabel: string | null;
}

/** Un hijo del padre + las cuentas que el padre reportó por él. */
export interface HijoConCuentasQueReporteDto {
    hijoId: string;
    cuentas: CuentaQueReporteDto[];
}

/**
 * Devuelve, agrupadas por hijo, las cuentas que el padre autenticado reportó por cada hijo. Read-only.
 * Solo reportes PROPIOS (usuarioId = este padre) con `hijoId` — nunca los de otros (ese es el otro grupo).
 */
export async function listarCuentasQueReporte(usuarioId: string): Promise<HijoConCuentasQueReporteDto[]> {
    const reportes = await prisma.reporte.findMany({
        where: whereReporteVigente({
            usuarioId,
            hijoId: { not: null },
            estado: { in: ESTADOS_VISIBLES },
        }),
        select: {
            id: true,
            hijoId: true,
            identificador: true,
            creadoEn: true,
            plataforma: { select: { nombre: true } },
            clasificacion: { select: { categoria: true } },
        },
        orderBy: { creadoEn: "desc" },
    });

    const porHijo = new Map<string, CuentaQueReporteDto[]>();
    for (const r of reportes) {
        if (!r.hijoId) continue; // el where ya excluye null; guardia de tipo.
        const dto: CuentaQueReporteDto = {
            reporteId: r.id,
            valor: r.identificador,
            plataforma: r.plataforma?.nombre ?? null,
            creadoEn: r.creadoEn,
            enRevision: r.clasificacion == null,
            categoriaLabel: r.clasificacion ? formatCategoria(r.clasificacion.categoria) : null,
        };
        const lista = porHijo.get(r.hijoId) ?? [];
        lista.push(dto);
        porHijo.set(r.hijoId, lista);
    }

    return [...porHijo.entries()].map(([hijoId, cuentas]) => ({ hijoId, cuentas }));
}
