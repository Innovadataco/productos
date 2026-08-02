/**
 * SPEC-135 (E-2): agregados estadísticos del círculo — vista agregada del usuario
 * (mapa) y agregado por contacto (detalle). Movimiento mecánico desde el god-module.
 */
import { obtenerGruposCategoria, agruparCategorias } from "@/lib/categoria-grupos";
import type { Prisma } from "@prisma/client";
import type { DatosReporte } from "./tipos";
import { formatFecha, getClient } from "./tipos";
import { obtenerUmbralAgregacion, whereReportesCirculo } from "./estado";

export async function construirAgregado(reportes: DatosReporte[], client?: Prisma.TransactionClient) {
    const gruposCategoria = await obtenerGruposCategoria(client);

    const totalReportes = reportes.length;
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

    const porGrupoCategoria = agruparCategorias(
        gruposCategoria,
        Array.from(porCategoria.values()).map((c) => ({ categoria: c.categoria, total: c.total }))
    );

    const porUbicacion = new Map<string, { pais: string; ciudad: string; lat: number | null; lng: number | null; total: number }>();
    for (const r of reportes) {
        const key = `${r.pais}|${r.ciudad}`;
        const actual = porUbicacion.get(key) || {
            pais: r.pais,
            ciudad: r.ciudad,
            lat: r.ciudadRel?.lat ?? null,
            lng: r.ciudadRel?.lng ?? null,
            total: 0,
        };
        actual.total += 1;
        porUbicacion.set(key, actual);
    }

    const porMes = new Map<string, number>();
    for (const r of reportes) {
        const mes = formatFecha(r.creadoEn).slice(0, 7);
        porMes.set(mes, (porMes.get(mes) || 0) + 1);
    }

    return {
        totalReportes,
        reportesAutenticados,
        reportesAnonimos,
        primerReporte: primerReporte?.toISOString() ?? null,
        ultimoReporte: ultimoReporte?.toISOString() ?? null,
        plataformas: Array.from(porPlataforma.values()).sort((a, b) => b.total - a.total),
        categorias: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total),
        porGrupoCategoria,
        ubicaciones: Array.from(porUbicacion.values()).sort((a, b) => b.total - a.total),
        timeline: Array.from(porMes.entries())
            .map(([mes, total]) => ({ mes, total }))
            .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
}

/**
 * Construye una vista agregada de todos los reportes visibles asociados a los identificadores
 * activos de los contactos de un usuario. Si no se alcanza el umbral mínimo de contactos con
 * reportes o de reportes totales, devuelve un objeto indicando insuficiencia de datos.
 *
 * @param usuarioId - UUID del usuario propietario.
 * @param client - Cliente de Prisma o transacción (opcional).
 * @returns Vista agregada con métricas por país, ciudad, categoría y timeline, o un marcador de insuficiencia.
 */
export async function obtenerVistaAgregada(usuarioId: string, client?: Prisma.TransactionClient) {
    const c = getClient(client);

    const contactosActivos = await c.contactoConfianza.findMany({
        where: { usuarioId, activo: true },
        include: {
            identificadores: {
                where: { activo: true },
                select: { valor: true },
            },
        },
    });

    if (contactosActivos.length === 0) {
        return { insuficiente: true, motivo: "No tienes contactos en tu círculo" };
    }

    const valores = new Set<string>();
    for (const contacto of contactosActivos) {
        for (const i of contacto.identificadores) {
            valores.add(i.valor);
        }
    }

    const valoresArray = Array.from(valores);

    if (valoresArray.length === 0) {
        return { insuficiente: true, motivo: "No tienes identificadores activos en tu círculo" };
    }

    const reportes = (await c.reporte.findMany({
        where: whereReportesCirculo({ identificador: { in: valoresArray } }),
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
            ciudadRel: { select: { lat: true, lng: true } },
        },
        orderBy: { creadoEn: "desc" },
    })) as DatosReporte[];

    const umbral = await obtenerUmbralAgregacion(c);
    const totalReportes = reportes.length;

    const contactosConReporteSet = new Set<string>();
    for (const contacto of contactosActivos) {
        const valoresContacto = new Set(contacto.identificadores.map((i) => i.valor));
        const tiene = reportes.some((r) => valoresContacto.has(r.identificador));
        if (tiene) contactosConReporteSet.add(contacto.id);
    }
    const contactosConReportesReales = contactosConReporteSet.size;

    if (
        contactosConReportesReales < umbral.contactosConReportes &&
        totalReportes < umbral.totalReportes
    ) {
        return {
            insuficiente: true,
            motivo: "Agregue más contactos o espere a que haya más reportes para ver el mapa agregado.",
            contactosConReportes: contactosConReportesReales,
            totalReportes,
        };
    }

    const gruposCategoria = await obtenerGruposCategoria(c);

    const porPais = new Map<string, { pais: string; total: number }>();
    const porCiudad = new Map<string, { ciudad: string; pais: string; lat: number | null; lng: number | null; total: number }>();
    const porCategoria = new Map<string, { categoria: string; total: number }>();
    const porMes = new Map<string, number>();

    for (const r of reportes) {
        const ciudadKey = `${r.pais}|${r.ciudad}`;
        const ciudadActual = porCiudad.get(ciudadKey) || {
            ciudad: r.ciudad,
            pais: r.pais,
            lat: r.ciudadRel?.lat ?? null,
            lng: r.ciudadRel?.lng ?? null,
            total: 0,
        };
        ciudadActual.total += 1;
        porCiudad.set(ciudadKey, ciudadActual);

        const paisActual = porPais.get(r.pais) || { pais: r.pais, total: 0 };
        paisActual.total += 1;
        porPais.set(r.pais, paisActual);

        const cat = r.clasificacion?.categoria;
        if (cat) {
            const catActual = porCategoria.get(cat) || { categoria: cat, total: 0 };
            catActual.total += 1;
            porCategoria.set(cat, catActual);
        }

        const mes = formatFecha(r.creadoEn).slice(0, 7);
        porMes.set(mes, (porMes.get(mes) || 0) + 1);
    }

    const porGrupoCategoria = agruparCategorias(
        gruposCategoria,
        Array.from(porCategoria.values()).map((c) => ({ categoria: c.categoria, total: c.total }))
    );

    return {
        insuficiente: false,
        totalReportes,
        contactosConReportes: contactosConReportesReales,
        porPais: Array.from(porPais.values()).sort((a, b) => b.total - a.total),
        porCiudad: Array.from(porCiudad.values()).sort((a, b) => b.total - a.total),
        porCategoria: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total),
        porGrupoCategoria,
        timeline: Array.from(porMes.entries())
            .map(([mes, total]) => ({ mes, total }))
            .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
}
