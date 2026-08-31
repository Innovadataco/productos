/**
 * SPEC-135 (E-2): consultas del círculo — listado enriquecido y detalle de un
 * contacto. Movimiento mecánico desde el god-module (F1); el fix N+1 de
 * `listarContactos` vive en la F2 de SPEC-135.
 */
import type { Prisma } from "@prisma/client";
import { getClient } from "./tipos";
import type { DatosReporte } from "./tipos";
import { calcularEstado, determinarEstadoContacto, whereReportesCirculo } from "./estado";
import { construirAgregado } from "./agregado";

/**
 * Lista todos los contactos de un usuario (activos e inhabilitados) enriquecidos con el
 * estado derivado de los reportes públicos asociados a sus identificadores. Retorna un
 * resumen conteo por estado.
 *
 * SPEC-135 (E-2, F2): SIN N+1 — la query inicial ya trae los identificadores por
 * contacto; se recolectan TODOS los valores y se hace UNA sola query de reportes
 * (mismo where/select/orderBy que `determinarEstadoContacto`), agrupada en memoria
 * por valor. Mismo resultado por construcción: el estado de cada contacto depende
 * solo del subconjunto de reportes de sus valores, y el orden global por creadoEn
 * preserva el orden relativo dentro de cada valor. Total: 2 queries constantes.
 *
 * @param usuarioId - UUID del usuario propietario.
 * @param client - Cliente de Prisma o transacción para reutilizar contexto (opcional).
 * @returns Objeto con la lista de contactos con estado y el resumen de conteos.
 */
export async function listarContactos(usuarioId: string, client?: Prisma.TransactionClient) {
    const c = getClient(client);

    const contactos = await c.contactoConfianza.findMany({
        where: { usuarioId },
        include: {
            identificadores: {
                where: { activo: true },
                include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
                orderBy: { creadoEn: "asc" },
            },
        },
        orderBy: [{ activo: "desc" }, { creadoEn: "desc" }],
    });

    // Recolectar los valores de TODOS los contactos (una sola pasada en memoria)
    const valoresPorContacto = new Map<string, string[]>();
    const todosLosValores = new Set<string>();
    for (const contacto of contactos) {
        const valores = contacto.identificadores.map((i) => i.valor);
        valoresPorContacto.set(contacto.id, valores);
        for (const v of valores) todosLosValores.add(v);
    }

    // UNA query de reportes para todos los valores, agrupada por valor en memoria
    const reportesPorValor = new Map<string, DatosReporte[]>();
    if (todosLosValores.size > 0) {
        const reportes = (await c.reporte.findMany({
            where: whereReportesCirculo({ identificador: { in: Array.from(todosLosValores) } }),
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
        for (const r of reportes) {
            const lista = reportesPorValor.get(r.identificador) ?? [];
            lista.push(r);
            reportesPorValor.set(r.identificador, lista);
        }
    }

    const conEstado = contactos.map((contacto) => {
        const reportesDelContacto = (valoresPorContacto.get(contacto.id) ?? []).flatMap((v) => reportesPorValor.get(v) ?? []);
        return { ...contacto, estado: calcularEstado(reportesDelContacto), totalReportes: reportesDelContacto.length };
    });

    const resumen = {
        sinReportes: conEstado.filter((c) => c.estado === "sinReportes" && c.activo).length,
        enRevision: conEstado.filter((c) => c.estado === "enRevision" && c.activo).length,
        clasificado: conEstado.filter((c) => c.estado === "clasificado" && c.activo).length,
        activos: conEstado.filter((c) => c.activo).length,
        inhabilitados: conEstado.filter((c) => !c.activo).length,
    };

    return { contactos: conEstado, resumen };
}

/**
 * Obtiene el detalle completo de un contacto, incluyendo sus identificadores activos,
 * el estado general del contacto y el estado por identificador. Si el contacto tiene
 * reportes visibles, construye y devuelve un agregado estadístico.
 *
 * @param id - UUID del contacto.
 * @param usuarioId - UUID del usuario propietario.
 * @param client - Cliente de Prisma o transacción (opcional).
 * @returns Objeto con los datos del contacto, identificadores con reportes, estado y agregado.
 * @throws Error "Contacto no encontrado" si el contacto no pertenece al usuario.
 */
export async function obtenerDetalleContacto(id: string, usuarioId: string, client?: Prisma.TransactionClient) {
    const c = getClient(client);

    const contacto = await c.contactoConfianza.findFirst({
        where: { id, usuarioId },
        include: {
            // SPEC-325: el detalle trae TAMBIÉN los inactivos (antes se filtraban).
            // Un identificador inactivado desaparecía de la pantalla y ya no había
            // forma de reactivarlo. El estado del contacto no cambia: lo calcula
            // `determinarEstadoContacto`, que filtra por activo aparte.
            identificadores: {
                include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
                orderBy: [{ activo: "desc" }, { creadoEn: "asc" }],
            },
        },
    });
    if (!contacto) {
        throw new Error("Contacto no encontrado");
    }

    const { estado, totalReportes, reportes } = await determinarEstadoContacto(id, c);

    // SPEC-135 (E-2, FR-004): SIN N+1 — el estado por identificador se deriva del
    // MISMO arreglo de reportes del contacto (mismo where/select/orderBy que la
    // query por identificador que había antes: whereReportesCirculo filtra por
    // valor y el orderBy global preserva el orden relativo dentro de cada valor).
    // Cero queries adicionales (antes: 1 por identificador).
    const reportesPorValor = new Map<string, DatosReporte[]>();
    for (const r of reportes) {
        const lista = reportesPorValor.get(r.identificador) ?? [];
        lista.push(r);
        reportesPorValor.set(r.identificador, lista);
    }

    const identificadoresConEstado = contacto.identificadores.map((i) => {
        const r = reportesPorValor.get(i.valor) ?? [];
        return {
            ...i,
            estado: calcularEstado(r),
            totalReportes: r.length,
            reportes: r,
        };
    });

    const agregado = totalReportes > 0 ? await construirAgregado(reportes, c) : null;

    return {
        id: contacto.id,
        etiqueta: contacto.etiqueta,
        nota: contacto.nota,
        activo: contacto.activo,
        estado,
        totalReportes,
        identificadores: identificadoresConEstado,
        agregado,
        mensaje: totalReportes === 0 ? "Sin reportes registrados para este contacto." : undefined,
    };
}
