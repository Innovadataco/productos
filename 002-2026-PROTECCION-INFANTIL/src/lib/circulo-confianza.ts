import { prisma } from "./prisma";
import { getParametroSistema, getParametroSistemaValor } from "./parametros";
import { logAudit } from "./audit";
import { enviarAlertaCirculoConfianza } from "./email";
import type { AccionAudit, EstadoReporte, Prisma } from "@prisma/client";

export type EstadoContacto = "sinReportes" | "enRevision" | "clasificado";

const ESTADOS_CLASIFICADOS: EstadoReporte[] = ["CLASIFICADO", "CORREGIDO"];
const ESTADOS_REVISION: EstadoReporte[] = ["REVISION_MANUAL", "POSIBLE_SPAM", "REQUIERE_ANONIMIZACION"];
const ESTADOS_VISIBLES: EstadoReporte[] = [...ESTADOS_CLASIFICADOS, ...ESTADOS_REVISION];

interface DatosReporte {
    id: string;
    identificador: string;
    ciudad: string;
    pais: string;
    creadoEn: Date;
    fechaIncidente: Date | null;
    esAnonimo: boolean;
    plataforma: { id: string; nombre: string; clave: string };
    clasificacion: { categoria: string; confianza: number | null } | null;
    estado: string;
}

function formatFecha(date: Date | string | null) {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 10);
}

export async function contarContactosActivos(usuarioId: string): Promise<number> {
    return prisma.contactoConfianza.count({
        where: { usuarioId, activo: true },
    });
}

export async function obtenerTopeContactos(client?: Prisma.TransactionClient): Promise<number> {
    const valor = await getParametroSistemaValor("circulo.max_contactos", client);
    const parsed = parseInt(valor || "20", 10);
    return Number.isNaN(parsed) ? 20 : parsed;
}

export async function obtenerUmbralAgregacion(client?: Prisma.TransactionClient): Promise<{
    contactosConReportes: number;
    totalReportes: number;
}> {
    const valor = await getParametroSistemaValor("circulo.umbral_agregacion", client);
    try {
        const parsed = JSON.parse(valor || '{"contactosConReportes":2,"totalReportes":3}');
        return {
            contactosConReportes: Math.max(1, parseInt(parsed.contactosConReportes, 10) || 2),
            totalReportes: Math.max(1, parseInt(parsed.totalReportes, 10) || 3),
        };
    } catch {
        return { contactosConReportes: 2, totalReportes: 3 };
    }
}

export async function determinarEstadoContacto(
    identificador: string,
    plataformaId: string,
    client: Prisma.TransactionClient = prisma
): Promise<{ estado: EstadoContacto; totalReportes: number; reportes: DatosReporte[] }> {
    const reportes = await client.reporte.findMany({
        where: {
            identificador,
            plataformaId,
            eliminado: false,
            estado: { in: ESTADOS_VISIBLES },
        },
        select: {
            id: true,
            identificador: true,
            ciudad: true,
            pais: true,
            creadoEn: true,
            fechaIncidente: true,
            esAnonimo: true,
            estado: true,
            plataforma: { select: { id: true, nombre: true, clave: true } },
            clasificacion: { select: { categoria: true, confianza: true } },
        },
        orderBy: { creadoEn: "desc" },
    }) as DatosReporte[];

    if (reportes.length === 0) {
        return { estado: "sinReportes", totalReportes: 0, reportes: [] };
    }

    const tieneRevision = reportes.some((r) => ESTADOS_REVISION.includes(r.estado as EstadoReporte));
    const tieneClasificado = reportes.some((r) => ESTADOS_CLASIFICADOS.includes(r.estado as EstadoReporte));

    if (tieneRevision && !tieneClasificado) {
        return { estado: "enRevision", totalReportes: reportes.length, reportes };
    }
    return { estado: "clasificado", totalReportes: reportes.length, reportes };
}

export async function listarContactos(usuarioId: string) {
    const contactos = await prisma.contactoConfianza.findMany({
        where: { usuarioId },
        include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
        orderBy: [{ activo: "desc" }, { creadoEn: "desc" }],
    });

    const conEstado = await Promise.all(
        contactos.map(async (c) => {
            const { estado, totalReportes } = await determinarEstadoContacto(
                c.identificador,
                c.plataformaId
            );
            return {
                ...c,
                estado,
                totalReportes,
            };
        })
    );

    const resumen = {
        sinReportes: conEstado.filter((c) => c.estado === "sinReportes" && c.activo).length,
        enRevision: conEstado.filter((c) => c.estado === "enRevision" && c.activo).length,
        clasificado: conEstado.filter((c) => c.estado === "clasificado" && c.activo).length,
        activos: conEstado.filter((c) => c.activo).length,
        inhabilitados: conEstado.filter((c) => !c.activo).length,
    };

    return { contactos: conEstado, resumen };
}

export async function agregarContacto(
    usuarioId: string,
    data: { identificador: string; plataformaId: string; etiqueta?: string },
    request?: Request
) {
    const activos = await contarContactosActivos(usuarioId);
    const tope = await obtenerTopeContactos();
    if (activos >= tope) {
        throw new Error("Límite de contactos activos alcanzado");
    }

    const plataforma = await prisma.plataforma.findUnique({
        where: { id: data.plataformaId },
    });
    if (!plataforma) {
        throw new Error("Plataforma no encontrada");
    }

    const existente = await prisma.contactoConfianza.findUnique({
        where: {
            usuarioId_identificador_plataformaId: {
                usuarioId,
                identificador: data.identificador,
                plataformaId: data.plataformaId,
            },
        },
    });

    if (existente) {
        throw new Error("El contacto ya existe");
    }

    const contacto = await prisma.contactoConfianza.create({
        data: {
            usuarioId,
            identificador: data.identificador,
            plataformaId: data.plataformaId,
            etiqueta: data.etiqueta?.slice(0, 100),
            activo: true,
        },
        include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
    });

    await logAudit({
        accion: "CIRCULO_CONTACT_CREATE" as AccionAudit,
        tipoRecurso: "ContactoConfianza",
        recursoId: contacto.id,
        usuarioId,
        valorNuevo: JSON.stringify({
            identificador: data.identificador,
            plataformaId: data.plataformaId,
            etiqueta: data.etiqueta,
        }),
        ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
        userAgent: request?.headers.get("user-agent") || "unknown",
    });

    return contacto;
}

export async function actualizarContacto(
    id: string,
    usuarioId: string,
    data: { etiqueta?: string; activo?: boolean },
    request?: Request
) {
    const contacto = await prisma.contactoConfianza.findFirst({
        where: { id, usuarioId },
    });
    if (!contacto) {
        throw new Error("Contacto no encontrado");
    }

    const valorAnterior = JSON.stringify({ etiqueta: contacto.etiqueta, activo: contacto.activo });

    const actualizado = await prisma.contactoConfianza.update({
        where: { id },
        data: {
            etiqueta: data.etiqueta !== undefined ? data.etiqueta?.slice(0, 100) : contacto.etiqueta,
            activo: data.activo !== undefined ? data.activo : contacto.activo,
        },
    });

    const accion: AccionAudit =
        data.activo === false
            ? "CIRCULO_CONTACT_DISABLE"
            : data.activo === true
              ? "CIRCULO_CONTACT_UPDATE"
              : "CIRCULO_CONTACT_UPDATE";

    await logAudit({
        accion,
        tipoRecurso: "ContactoConfianza",
        recursoId: id,
        usuarioId,
        valorAnterior,
        valorNuevo: JSON.stringify({ etiqueta: actualizado.etiqueta, activo: actualizado.activo }),
        ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
        userAgent: request?.headers.get("user-agent") || "unknown",
    });

    return actualizado;
}

export async function obtenerDetalleContacto(id: string, usuarioId: string) {
    const contacto = await prisma.contactoConfianza.findFirst({
        where: { id, usuarioId },
        include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
    });
    if (!contacto) {
        throw new Error("Contacto no encontrado");
    }

    const { estado, totalReportes, reportes } = await determinarEstadoContacto(
        contacto.identificador,
        contacto.plataformaId
    );

    return construirDetalle(contacto.identificador, contacto.plataforma, estado, totalReportes, reportes);
}

function construirDetalle(
    identificador: string,
    plataforma: { id: string; nombre: string; clave: string },
    estado: EstadoContacto,
    totalReportes: number,
    reportes: DatosReporte[]
) {
    if (totalReportes === 0) {
        return {
            identificador,
            plataforma,
            estado,
            tieneReportes: false,
            mensaje: "Sin reportes registrados para este identificador.",
        };
    }

    const reportesAutenticados = reportes.filter((r) => !r.esAnonimo).length;
    const reportesAnonimos = totalReportes - reportesAutenticados;
    const primerReporte = reportes[reportes.length - 1]?.creadoEn ?? null;
    const ultimoReporte = reportes[0]?.creadoEn ?? null;

    const porPlataforma = new Map<string, { id: string; nombre: string; clave: string; total: number }>();
    for (const r of reportes) {
        const p = r.plataforma;
        const actual = porPlataforma.get(p.id) || { id: p.id, nombre: p.nombre, clave: p.clave, total: 0 };
        actual.total += 1;
        porPlataforma.set(p.id, actual);
    }

    const porCategoria = new Map<string, { categoria: string; total: number }>();
    for (const r of reportes) {
        const cat = r.clasificacion?.categoria;
        if (!cat) continue;
        const actual = porCategoria.get(cat) || { categoria: cat, total: 0 };
        actual.total += 1;
        porCategoria.set(cat, actual);
    }

    const porUbicacion = new Map<string, { pais: string; ciudad: string; total: number }>();
    for (const r of reportes) {
        const key = `${r.pais}|${r.ciudad}`;
        const actual = porUbicacion.get(key) || { pais: r.pais, ciudad: r.ciudad, total: 0 };
        actual.total += 1;
        porUbicacion.set(key, actual);
    }

    const porMes = new Map<string, number>();
    for (const r of reportes) {
        const mes = formatFecha(r.creadoEn).slice(0, 7);
        porMes.set(mes, (porMes.get(mes) || 0) + 1);
    }

    return {
        identificador,
        plataforma,
        estado,
        tieneReportes: true,
        totalReportes,
        reportesAutenticados,
        reportesAnonimos,
        primerReporte: primerReporte?.toISOString() ?? null,
        ultimoReporte: ultimoReporte?.toISOString() ?? null,
        plataformas: Array.from(porPlataforma.values()).sort((a, b) => b.total - a.total),
        categorias: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total),
        ubicaciones: Array.from(porUbicacion.values()).sort((a, b) => b.total - a.total),
        timeline: Array.from(porMes.entries())
            .map(([mes, total]) => ({ mes, total }))
            .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
}

export async function obtenerVistaAgregada(usuarioId: string) {
    const contactosActivos = await prisma.contactoConfianza.findMany({
        where: { usuarioId, activo: true },
        select: { identificador: true, plataformaId: true },
    });

    if (contactosActivos.length === 0) {
        return { insuficiente: true, motivo: "No tenés contactos en tu círculo" };
    }

    const reportes: DatosReporte[] = [];
    for (const c of contactosActivos) {
        const { reportes: r } = await determinarEstadoContacto(c.identificador, c.plataformaId);
        reportes.push(...r);
    }

    const umbral = await obtenerUmbralAgregacion();
    const contactosConReportes = new Set(reportes.map((r) => `${r.plataforma.id}|${r.ciudad}`)).size; // aproximación
    const totalReportes = reportes.length;

    // Contamos contactos únicos que tienen al menos un reporte visible
    const contactosConReporteSet = new Set<string>();
    for (const c of contactosActivos) {
        const tiene = reportes.some(
            (r) => r.plataforma.id === c.plataformaId && r.identificador === c.identificador
        );
        if (tiene) contactosConReporteSet.add(`${c.identificador}|${c.plataformaId}`);
    }
    const contactosConReportesReales = contactosConReporteSet.size;

    if (
        contactosConReportesReales < umbral.contactosConReportes &&
        totalReportes < umbral.totalReportes
    ) {
        return {
            insuficiente: true,
            motivo: "Agregá más contactos o esperá a que haya más reportes para ver el mapa agregado.",
            contactosConReportes: contactosConReportesReales,
            totalReportes,
        };
    }

    const porPais = new Map<string, { pais: string; total: number }>();
    const porCiudad = new Map<string, { ciudad: string; pais: string; total: number }>();
    const porCategoria = new Map<string, { categoria: string; total: number }>();
    const porMes = new Map<string, number>();

    for (const r of reportes) {
        const paisActual = porPais.get(r.pais) || { pais: r.pais, total: 0 };
        paisActual.total += 1;
        porPais.set(r.pais, paisActual);

        const ciudadKey = `${r.pais}|${r.ciudad}`;
        const ciudadActual = porCiudad.get(ciudadKey) || { ciudad: r.ciudad, pais: r.pais, total: 0 };
        ciudadActual.total += 1;
        porCiudad.set(ciudadKey, ciudadActual);

        const cat = r.clasificacion?.categoria;
        if (cat) {
            const catActual = porCategoria.get(cat) || { categoria: cat, total: 0 };
            catActual.total += 1;
            porCategoria.set(cat, catActual);
        }

        const mes = formatFecha(r.creadoEn).slice(0, 7);
        porMes.set(mes, (porMes.get(mes) || 0) + 1);
    }

    return {
        insuficiente: false,
        totalReportes,
        contactosConReportes: contactosConReportesReales,
        porPais: Array.from(porPais.values()).sort((a, b) => b.total - a.total),
        porCiudad: Array.from(porCiudad.values()).sort((a, b) => b.total - a.total),
        porCategoria: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total),
        timeline: Array.from(porMes.entries())
            .map(([mes, total]) => ({ mes, total }))
            .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
}

export async function toggleNotificacionesCirculo(usuarioId: string, habilitado: boolean) {
    await prisma.usuario.update({
        where: { id: usuarioId },
        data: { notificacionesCirculo: habilitado },
    });
    return { notificacionesCirculo: habilitado };
}

export async function obtenerPreferenciasCirculo(usuarioId: string) {
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { notificacionesCirculo: true },
    });
    return { notificacionesCirculo: usuario?.notificacionesCirculo ?? true };
}

export async function notificarCambioCirculoSiCorresponde(reporteId: string) {
    try {
        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: {
                identificador: true,
                plataformaId: true,
                estado: true,
                eliminado: true,
            },
        });
        if (!reporte || reporte.eliminado) return;
        if (!ESTADOS_VISIBLES.includes(reporte.estado as EstadoReporte)) return;

        const contactos = await prisma.contactoConfianza.findMany({
            where: {
                identificador: reporte.identificador,
                plataformaId: reporte.plataformaId,
                activo: true,
            },
            include: { usuario: { select: { id: true, email: true, notificacionesCirculo: true, ultimaNotificacionCirculoEn: true } } },
        });

        if (contactos.length === 0) return;

        const globalEnabled = await getParametroSistemaValor("circulo.notificaciones.enabled");
        if (globalEnabled === "false") return;

        const cooldownHoras = parseInt((await getParametroSistemaValor("circulo.notificaciones.cooldown_horas")) || "24", 10);
        const cooldownMs = (Number.isNaN(cooldownHoras) ? 24 : cooldownHoras) * 60 * 60 * 1000;
        const ahora = new Date();

        for (const contacto of contactos) {
            const usuario = contacto.usuario;
            if (!usuario.notificacionesCirculo) continue;
            if (usuario.ultimaNotificacionCirculoEn && ahora.getTime() - usuario.ultimaNotificacionCirculoEn.getTime() < cooldownMs) {
                continue;
            }

            await enviarAlertaCirculoConfianza(usuario.email);
            await prisma.usuario.update({
                where: { id: usuario.id },
                data: { ultimaNotificacionCirculoEn: ahora },
            });
        }
    } catch (error) {
        // La notificación no debe fallar el procesamiento del reporte
        console.error("[CIRCULO] Error enviando notificación:", error);
    }
}
