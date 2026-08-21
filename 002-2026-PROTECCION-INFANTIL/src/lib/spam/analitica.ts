import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";
import { SpamReporteRepository } from "@/lib/dal/repositories/spam-reporte";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import type { AccionAudit } from "@prisma/client";

const VENTANAS_DIAS = [7, 30, 90] as const;
type VentanaDias = (typeof VENTANAS_DIAS)[number];

export interface MetricasVentana {
    esSpam: number;
    corregidos: number;
    procesadosComoAcoso: number;
    totalResueltos: number;
    tasaSpam: number;
    tiempoPromedioResolucionMin: number | null;
}

export interface AnaliticaSpam {
    generadoEn: string;
    metricas: Record<VentanaDias, MetricasVentana>;
    serie: { fecha: string; esSpam: number; corregidos: number; procesadosComoAcoso: number }[];
    distribucion: {
        porPlataforma: { plataformaId: string; nombre: string; count: number }[];
        porCategoria: { categoria: string; count: number }[];
    };
    topIdentificadores: { identificador: string; plataformaId: string; plataformaNombre: string; count: number }[];
    topOperadores: { operadorId: string; nombre: string | null; email: string; count: number }[];
}

interface AuditCierre {
    recursoId: string;
    creadoEn: Date;
}

function inicioFinDias(dias: number): { inicio: Date; fin: Date } {
    const fin = new Date();
    const inicio = new Date(fin.getTime() - dias * 24 * 60 * 60 * 1000);
    return { inicio, fin };
}

function formatoFecha(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function generarAnaliticaSpam(): Promise<AnaliticaSpam> {
    const auditRepo = new AuditLogRepository();
    const spamRepo = new SpamReporteRepository();
    const usuarioRepo = new UsuarioRepository();
    const accionesSpam: AccionAudit[] = ["SPAM_CONFIRMADO", "SPAM_CORREGIDO", "SPAM_PROCESADO_COMO_ACOSO"];

    const metricas = {} as Record<VentanaDias, MetricasVentana>;
    for (const dias of VENTANAS_DIAS) {
        const { inicio, fin } = inicioFinDias(dias);
        const rango = { gte: inicio, lte: fin };

        const [esSpam, corregidos, procesadosComoAcoso] = await Promise.all([
            auditRepo.countAcciones(["SPAM_CONFIRMADO"], rango),
            auditRepo.countAcciones(["SPAM_CORREGIDO"], rango),
            auditRepo.countAcciones(["SPAM_PROCESADO_COMO_ACOSO"], rango),
        ]);

        const totalResueltos = esSpam + corregidos + procesadosComoAcoso;
        const tasaSpam = totalResueltos > 0 ? esSpam / totalResueltos : 0;

        const cierres = await auditRepo.findCierres(accionesSpam, rango);
        const tiempos = await calcularTiemposResolucion(cierres.map((c) => ({ recursoId: c.recursoId!, creadoEn: c.creadoEn })));
        const tiempoPromedioResolucionMin = tiempos.length > 0
            ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length / 60) * 10) / 10
            : null;

        metricas[dias] = {
            esSpam,
            corregidos,
            procesadosComoAcoso,
            totalResueltos,
            tasaSpam,
            tiempoPromedioResolucionMin,
        };
    }

    const { inicio: inicioSerie } = inicioFinDias(30);
    const cierresSerie = await auditRepo.findCierresConAccion(accionesSpam, { gte: inicioSerie, lte: new Date() });
    const serie = agruparSerie(cierresSerie);

    const { inicio: inicioDist } = inicioFinDias(30);
    const [reportesSpam, reportesCorregidos] = await Promise.all([
        spamRepo.findReportesSpamEliminados(inicioDist),
        spamRepo.findReportesCorregidosDeSpam(inicioDist),
    ]);

    const distribucion = {
        porPlataforma: contarPorPlataforma([...reportesSpam, ...reportesCorregidos]),
        porCategoria: contarPorCategoria(reportesCorregidos),
    };

    const topIdentificadores = topIdentificadoresSpam([...reportesSpam, ...reportesCorregidos], 10);

    const topOperadoresRaw = await auditRepo.groupByUsuario(accionesSpam, { gte: inicioDist, lte: new Date() });
    const usuariosIds = topOperadoresRaw.map((r) => r.usuarioId).filter((id): id is string => id !== null);
    const usuarios = await usuarioRepo.findInfoPorIds(usuariosIds);
    const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));

    const topOperadores = topOperadoresRaw
        .map((r) => ({
            operadorId: r.usuarioId ?? "unknown",
            nombre: r.usuarioId ? usuarioPorId.get(r.usuarioId)?.nombre ?? null : null,
            email: r.usuarioId ? usuarioPorId.get(r.usuarioId)?.email ?? "unknown" : "unknown",
            count: r._count.usuarioId,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        generadoEn: new Date().toISOString(),
        metricas,
        serie,
        distribucion,
        topIdentificadores,
        topOperadores,
    };
}

async function calcularTiemposResolucion(cierres: AuditCierre[]): Promise<number[]> {
    if (cierres.length === 0) return [];
    const recursoIds = cierres.map((c) => c.recursoId);
    const reportes = await new SpamReporteRepository().findCreadoEnPorIds(recursoIds);
    const creadoEnPorId = new Map(reportes.map((r) => [r.id, r.creadoEn]));

    const tiempos: number[] = [];
    for (const cierre of cierres) {
        const creadoEn = creadoEnPorId.get(cierre.recursoId);
        if (creadoEn) {
            tiempos.push((cierre.creadoEn.getTime() - creadoEn.getTime()) / 1000);
        }
    }
    return tiempos;
}

function agruparSerie(cierres: { accion: AccionAudit; creadoEn: Date }[]) {
    const mapa = new Map<string, { fecha: string; esSpam: number; corregidos: number; procesadosComoAcoso: number }>();
    const hoy = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
        const fecha = formatoFecha(d);
        mapa.set(fecha, { fecha, esSpam: 0, corregidos: 0, procesadosComoAcoso: 0 });
    }

    for (const cierre of cierres) {
        const fecha = formatoFecha(cierre.creadoEn);
        const punto = mapa.get(fecha);
        if (!punto) continue;
        if (cierre.accion === "SPAM_CONFIRMADO") punto.esSpam++;
        else if (cierre.accion === "SPAM_CORREGIDO") punto.corregidos++;
        else if (cierre.accion === "SPAM_PROCESADO_COMO_ACOSO") punto.procesadosComoAcoso++;
    }

    return Array.from(mapa.values());
}

function contarPorPlataforma(reportes: { plataformaId: string; plataforma: { nombre: string } }[]) {
    const conteo = new Map<string, { plataformaId: string; nombre: string; count: number }>();
    for (const r of reportes) {
        const actual = conteo.get(r.plataformaId);
        if (actual) {
            actual.count++;
        } else {
            conteo.set(r.plataformaId, { plataformaId: r.plataformaId, nombre: r.plataforma.nombre, count: 1 });
        }
    }
    return Array.from(conteo.values()).sort((a, b) => b.count - a.count);
}

function contarPorCategoria(
    reportes: { clasificacion: { correccion: { categoriaCorregida: string } | null } | null }[]
) {
    const conteo = new Map<string, number>();
    for (const r of reportes) {
        const cat = r.clasificacion?.correccion?.categoriaCorregida;
        if (!cat) continue;
        conteo.set(cat, (conteo.get(cat) ?? 0) + 1);
    }
    return Array.from(conteo.entries()).map(([categoria, count]) => ({ categoria, count })).sort((a, b) => b.count - a.count);
}

function topIdentificadoresSpam(
    reportes: { identificador: string; plataformaId: string; plataforma: { nombre: string } }[],
    n: number
) {
    const grupos = new Map<string, { identificador: string; plataformaId: string; plataformaNombre: string; count: number }>();
    for (const r of reportes) {
        const key = `${r.identificador}|${r.plataformaId}`;
        const actual = grupos.get(key);
        if (actual) {
            actual.count++;
        } else {
            grupos.set(key, {
                identificador: r.identificador,
                plataformaId: r.plataformaId,
                plataformaNombre: r.plataforma.nombre,
                count: 1,
            });
        }
    }
    return Array.from(grupos.values()).sort((a, b) => b.count - a.count).slice(0, n);
}

export interface SugerenciaBanco {
    id: string;
    texto: string;
    categoriaEsperada: "SPAM";
    secundariaEsperada: null;
    ruido: boolean;
    fuente: "SPAM_SUGERIDO";
    activo: true;
    fixtureVersion: 2;
    creadoEn: string;
}

export async function generarSugerenciasBanco(limit = 100): Promise<SugerenciaBanco[]> {
    const { inicio } = inicioFinDias(30);
    const reportes = await new SpamReporteRepository().findSugerenciasBancoSpam(inicio, limit);

    return reportes.map((r) => ({
        id: r.id,
        texto: r.texto,
        categoriaEsperada: "SPAM" as const,
        secundariaEsperada: null,
        ruido: false,
        fuente: "SPAM_SUGERIDO" as const,
        activo: true as const,
        fixtureVersion: 2 as const,
        creadoEn: r.eliminadoEn?.toISOString() ?? new Date().toISOString(),
    }));
}
