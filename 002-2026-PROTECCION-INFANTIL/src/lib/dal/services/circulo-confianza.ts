import { whereReporteAprobado } from "./reporte-aprobado";
import { prisma } from "./prisma";
import { getParametroSistemaValor } from "./parametros";
import { logAudit } from "./audit";
import { enviarAlertaCirculoConfianza } from "./email";
import { obtenerGruposCategoria, agruparCategorias } from "./categoria-grupos";
import type { AccionAudit, EstadoReporte, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

export type EstadoContacto = "sinReportes" | "enRevision" | "clasificado";

export type IdentificadorInput = {
    id?: string;
    valor: string;
    tipo?: string;
    plataformaId?: string;
};

const ESTADOS_CLASIFICADOS: EstadoReporte[] = ["CLASIFICADO", "CORREGIDO"];
const ESTADOS_REVISION: EstadoReporte[] = ["REVISION_MANUAL", "POSIBLE_SPAM", "REQUIERE_ANONIMIZACION"];
const ESTADOS_VISIBLES: EstadoReporte[] = [...ESTADOS_CLASIFICADOS, ...ESTADOS_REVISION];

// Spec 093-US1: el círculo cuenta (a) reportes APROBADOS (predicado único: sin SPAM/OTRO)
// y (b) reportes en revisión humana ("En proceso"). POSIBLE_SPAM y DUPLICADO no cuentan.
function whereReportesCirculo(extra: Prisma.ReporteWhereInput = {}): Prisma.ReporteWhereInput {
    return {
        ...extra,
        eliminado: false,
        OR: [
            whereReporteAprobado(),
            { estado: { in: ["REVISION_MANUAL", "REQUIERE_ANONIMIZACION"] } },
        ],
    };
}

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
    ciudadRel: { lat: number | null; lng: number | null } | null;
    estado: string;
}

function formatFecha(date: Date | string | null) {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 10);
}

function getClient(client?: Prisma.TransactionClient): Prisma.TransactionClient | typeof prisma {
    return client || prisma;
}

function calcularEstado(reportes: DatosReporte[]): EstadoContacto {
    if (reportes.length === 0) return "sinReportes";
    const tieneRevision = reportes.some((r) => ESTADOS_REVISION.includes(r.estado as EstadoReporte));
    if (tieneRevision) return "enRevision";
    return "clasificado";
}

export async function contarContactosActivos(
    usuarioId: string,
    client?: Prisma.TransactionClient
): Promise<number> {
    return getClient(client).contactoConfianza.count({
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
    contactoId: string,
    client?: Prisma.TransactionClient
): Promise<{ estado: EstadoContacto; totalReportes: number; reportes: DatosReporte[] }> {
    const c = getClient(client);

    const identificadores = await c.identificadorContacto.findMany({
        where: { contactoId, activo: true },
        select: { valor: true },
    });

    const valores = identificadores.map((i) => i.valor);

    if (valores.length === 0) {
        return { estado: "sinReportes", totalReportes: 0, reportes: [] };
    }

    const reportes = (await c.reporte.findMany({
        where: whereReportesCirculo({ identificador: { in: valores } }),
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

    return { estado: calcularEstado(reportes), totalReportes: reportes.length, reportes };
}

/**
 * Lista todos los contactos de un usuario (activos e inhabilitados) enriquecidos con el
 * estado derivado de los reportes públicos asociados a sus identificadores. Retorna un
 * resumen conteo por estado.
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

    const conEstado = await Promise.all(
        contactos.map(async (contacto) => {
            const { estado, totalReportes } = await determinarEstadoContacto(contacto.id, c);
            return { ...contacto, estado, totalReportes };
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

async function validarPlataformas(
    identificadores: IdentificadorInput[],
    client: Prisma.TransactionClient | typeof prisma
) {
    const plataformaIds = Array.from(
        new Set(identificadores.map((i) => i.plataformaId).filter(Boolean) as string[])
    );

    if (plataformaIds.length === 0) return;

    const existentes = await client.plataforma.findMany({
        where: { id: { in: plataformaIds } },
        select: { id: true },
    });

    const idsEncontrados = new Set(existentes.map((p) => p.id));
    const faltante = plataformaIds.find((id) => !idsEncontrados.has(id));
    if (faltante) {
        throw new Error("Plataforma no encontrada");
    }
}

function normalizarIdentificadores(identificadores: IdentificadorInput[]) {
    const vistos = new Set<string>();
    const normalizados: IdentificadorInput[] = [];

    for (const i of identificadores) {
        const valor = i.valor.trim();
        if (!valor) continue;
        const key = `${valor.toLowerCase()}|${i.plataformaId ?? ""}`;
        if (vistos.has(key)) {
            throw new Error("Identificador duplicado dentro del contacto");
        }
        vistos.add(key);
        normalizados.push({ ...i, valor });
    }

    return normalizados;
}

/**
 * Crea un nuevo contacto de confianza para un usuario junto con sus identificadores.
 * Valida que el contacto tenga al menos un identificador, que no se supere el límite
 * de contactos activos y que las plataformas referenciadas existan. Registra la acción
 * en el audit log.
 *
 * @param usuarioId - UUID del usuario propietario del círculo de confianza.
 * @param data - Datos del contacto: etiqueta, nota e identificadores.
 * @param data.etiqueta - Nombre o etiqueta del contacto (opcional).
 * @param data.nota - Nota libre asociada al contacto (opcional).
 * @param data.identificadores - Lista de identificadores del contacto (valor, tipo y plataforma).
 * @param request - Petición HTTP para extraer IP y user-agent del audit log (opcional).
 * @returns El contacto creado con sus identificadores.
 * @throws Error si no se proporcionan identificadores, se supera el límite de contactos o una plataforma no existe.
 */
export async function agregarContacto(
    usuarioId: string,
    data: {
        etiqueta?: string;
        nota?: string;
        identificadores: IdentificadorInput[];
    },
    request?: Request
) {
    if (!data.identificadores || data.identificadores.length === 0) {
        throw new Error("El contacto debe tener al menos un identificador");
    }

    const identificadores = normalizarIdentificadores(data.identificadores);

    const activos = await contarContactosActivos(usuarioId);
    const tope = await obtenerTopeContactos();
    if (activos >= tope) {
        throw new Error("Límite de contactos activos alcanzado");
    }

    return prisma.$transaction(async (tx) => {
        await validarPlataformas(identificadores, tx);

        const contacto = await tx.contactoConfianza.create({
            data: {
                usuarioId,
                etiqueta: data.etiqueta?.slice(0, 100),
                nota: data.nota?.slice(0, 1000),
                activo: true,
                identificadores: {
                    create: identificadores.map((i) => ({
                        valor: i.valor,
                        tipo: i.tipo?.slice(0, 50),
                        plataformaId: i.plataformaId || null,
                        activo: true,
                    })),
                },
            },
            include: {
                identificadores: {
                    include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
                },
            },
        });

        await logAudit({
            accion: "CIRCULO_CONTACT_CREATE" as AccionAudit,
            tipoRecurso: "ContactoConfianza",
            recursoId: contacto.id,
            usuarioId,
            valorNuevo: JSON.stringify({
                etiqueta: data.etiqueta,
                nota: data.nota,
                identificadores: identificadores.map((i) => ({
                    valor: i.valor,
                    tipo: i.tipo,
                    plataformaId: i.plataformaId,
                })),
            }),
            ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
            userAgent: request?.headers.get("user-agent") || "unknown",
        });

        return contacto;
    });
}

/**
 * Actualiza un contacto de confianza existente, incluyendo etiqueta, nota, estado activo
 * e identificadores. Si se envía una lista de identificadores, desactiva los existentes
 * que no estén en la lista y crea o actualiza los proveídos. Registra la acción en el audit log.
 *
 * @param id - UUID del contacto a actualizar.
 * @param usuarioId - UUID del usuario propietario del contacto.
 * @param data - Campos a actualizar del contacto.
 * @param request - Petición HTTP para extraer IP y user-agent del audit log (opcional).
 * @returns El contacto actualizado con sus identificadores activos.
 * @throws Error "Contacto no encontrado" si el contacto no pertenece al usuario.
 * @throws Error si el contacto quedaría sin identificadores.
 */
export async function actualizarContacto(
    id: string,
    usuarioId: string,
    data: {
        etiqueta?: string;
        nota?: string;
        activo?: boolean;
        identificadores?: IdentificadorInput[];
    },
    request?: Request
) {
    const contacto = await prisma.contactoConfianza.findFirst({
        where: { id, usuarioId },
        include: { identificadores: { where: { activo: true } } },
    });
    if (!contacto) {
        throw new Error("Contacto no encontrado");
    }

    const valorAnterior = JSON.stringify({
        etiqueta: contacto.etiqueta,
        nota: contacto.nota,
        activo: contacto.activo,
    });

    return prisma.$transaction(async (tx) => {
        const nuevoActivo = data.activo !== undefined ? data.activo : contacto.activo;

        const actualizado = await tx.contactoConfianza.update({
            where: { id },
            data: {
                etiqueta: data.etiqueta !== undefined ? data.etiqueta?.slice(0, 100) : contacto.etiqueta,
                nota: data.nota !== undefined ? data.nota?.slice(0, 1000) : contacto.nota,
                activo: nuevoActivo,
            },
            include: { identificadores: { include: { plataforma: { select: { id: true, nombre: true, clave: true } } } } },
        });

        if (data.activo !== undefined && !data.identificadores) {
            await tx.identificadorContacto.updateMany({
                where: { contactoId: id },
                data: { activo: nuevoActivo },
            });
        }

        if (data.identificadores) {
            if (data.identificadores.length === 0) {
                throw new Error("El contacto debe tener al menos un identificador");
            }

            const proveidos = normalizarIdentificadores(data.identificadores);
            await validarPlataformas(proveidos, tx);

            const idsProveidos = new Set(proveidos.map((i) => i.id).filter(Boolean) as string[]);
            const idsExistentes = new Set(contacto.identificadores.map((i) => i.id));

            // Desactivar identificadores activos que no estén en la lista enviada
            const idsADesactivar = Array.from(idsExistentes).filter((id) => !idsProveidos.has(id));
            if (idsADesactivar.length > 0) {
                await tx.identificadorContacto.updateMany({
                    where: { id: { in: idsADesactivar } },
                    data: { activo: false },
                });
            }

            // Crear o actualizar identificadores enviados
            for (const i of proveidos) {
                if (i.id && idsExistentes.has(i.id)) {
                    await tx.identificadorContacto.update({
                        where: { id: i.id },
                        data: {
                            valor: i.valor,
                            tipo: i.tipo?.slice(0, 50),
                            plataformaId: i.plataformaId || null,
                            activo: nuevoActivo,
                        },
                    });
                } else {
                    await tx.identificadorContacto.create({
                        data: {
                            contactoId: id,
                            valor: i.valor,
                            tipo: i.tipo?.slice(0, 50),
                            plataformaId: i.plataformaId || null,
                            activo: nuevoActivo,
                        },
                    });
                }
            }
        }

        const accion: AccionAudit =
            nuevoActivo === false ? "CIRCULO_CONTACT_DISABLE" : "CIRCULO_CONTACT_UPDATE";

        await logAudit({
            accion,
            tipoRecurso: "ContactoConfianza",
            recursoId: id,
            usuarioId,
            valorAnterior,
            valorNuevo: JSON.stringify({
                etiqueta: actualizado.etiqueta,
                nota: actualizado.nota,
                activo: actualizado.activo,
            }),
            ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
            userAgent: request?.headers.get("user-agent") || "unknown",
        });

        return tx.contactoConfianza.findUnique({
            where: { id },
            include: {
                identificadores: {
                    where: { activo: true },
                    include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
                    orderBy: { creadoEn: "asc" },
                },
            },
        });
    });
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
            identificadores: {
                where: { activo: true },
                include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
                orderBy: { creadoEn: "asc" },
            },
        },
    });
    if (!contacto) {
        throw new Error("Contacto no encontrado");
    }

    const { estado, totalReportes, reportes } = await determinarEstadoContacto(id, c);

    const identificadoresConEstado = await Promise.all(
        contacto.identificadores.map(async (i) => {
            const r = (await c.reporte.findMany({
                where: whereReportesCirculo({ identificador: i.valor }),
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

            return {
                ...i,
                estado: calcularEstado(r),
                totalReportes: r.length,
                reportes: r,
            };
        })
    );

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

async function construirAgregado(reportes: DatosReporte[], client?: Prisma.TransactionClient) {
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

/**
 * Evalúa si un reporte debe notificar a los usuarios que tienen contactos de confianza
 * asociados al mismo identificador. Respeta la preferencia de notificaciones del usuario,
 * el flag global de notificaciones y un periodo de cooldown entre alertas. Envía un email
 * de alerta ciega con el conteo de novedades y actualiza la marca temporal de la última notificación.
 * Cualquier error se captura y se loguea sin interrumpir el flujo.
 *
 * @param reporteId - UUID del reporte que puede generar notificaciones.
 */
export async function notificarCambioCirculoSiCorresponde(reporteId: string) {
    try {
        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: {
                identificador: true,
                estado: true,
                eliminado: true,
            },
        });
        if (!reporte || reporte.eliminado) {
            logger.info(`[CIRCULO] Notificación omitida: reporte ${reporteId} no existe o está eliminado`);
            return;
        }
        if (!ESTADOS_VISIBLES.includes(reporte.estado as EstadoReporte)) {
            logger.info(`[CIRCULO] Notificación omitida: estado ${reporte.estado} no visible`);
            return;
        }

        const globalEnabled = await getParametroSistemaValor("circulo.notificaciones.enabled");
        if (globalEnabled === "false") {
            logger.info("[CIRCULO] Notificación omitida: circulo.notificaciones.enabled=false");
            return;
        }

        const cooldownHoras = parseInt(
            (await getParametroSistemaValor("circulo.notificaciones.cooldown_horas")) || "24",
            10
        );
        const cooldownMs = (Number.isNaN(cooldownHoras) ? 24 : cooldownHoras) * 60 * 60 * 1000;
        const ahora = new Date();

        const contactos = await prisma.contactoConfianza.findMany({
            where: {
                activo: true,
                identificadores: {
                    some: {
                        valor: reporte.identificador,
                        activo: true,
                    },
                },
            },
            include: {
                usuario: {
                    select: {
                        id: true,
                        email: true,
                        notificacionesCirculo: true,
                        ultimaNotificacionCirculoEn: true,
                    },
                },
                identificadores: {
                    where: { activo: true },
                    select: { valor: true },
                },
            },
        });

        if (contactos.length === 0) {
            logger.info(`[CIRCULO] Notificación omitida: sin contactos activos para ${reporte.identificador}`);
            return;
        }

        // Agrupar contactos por usuario
        const contactosPorUsuario = new Map<
            string,
            { email: string; notificacionesCirculo: boolean; ultimaNotificacionCirculoEn: Date | null; valores: Set<string> }
        >();
        for (const contacto of contactos) {
            const usuario = contacto.usuario;
            const existente = contactosPorUsuario.get(usuario.id);
            const valores = new Set(contacto.identificadores.map((i) => i.valor));
            if (existente) {
                for (const v of valores) existente.valores.add(v);
            } else {
                contactosPorUsuario.set(usuario.id, {
                    email: usuario.email,
                    notificacionesCirculo: usuario.notificacionesCirculo,
                    ultimaNotificacionCirculoEn: usuario.ultimaNotificacionCirculoEn,
                    valores,
                });
            }
        }

        for (const [usuarioId, datos] of contactosPorUsuario.entries()) {
            if (!datos.notificacionesCirculo) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuarioId} desactivó notificaciones`);
                continue;
            }

            const ventanaInicio = datos.ultimaNotificacionCirculoEn
                ? new Date(Math.max(datos.ultimaNotificacionCirculoEn.getTime(), ahora.getTime() - cooldownMs))
                : new Date(ahora.getTime() - cooldownMs);

            const valoresArray = Array.from(datos.valores);
            const reportesNuevos = await prisma.reporte.findMany({
                where: {
                    identificador: { in: valoresArray },
                    eliminado: false,
                    estado: { in: ESTADOS_VISIBLES },
                    creadoEn: { gte: ventanaInicio },
                },
                select: { identificador: true },
                distinct: ["identificador"],
            });

            const novedades = reportesNuevos.length;
            if (novedades === 0) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuarioId} sin novedades en la ventana`);
                continue;
            }

            if (
                datos.ultimaNotificacionCirculoEn &&
                ahora.getTime() - datos.ultimaNotificacionCirculoEn.getTime() < cooldownMs
            ) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuarioId} en cooldown`);
                continue;
            }

            logger.info(`[CIRCULO] Enviando alerta ciega a ${datos.email} (${novedades} novedades)`);
            await enviarAlertaCirculoConfianza(datos.email, novedades);
            await prisma.usuario.update({
                where: { id: usuarioId },
                data: { ultimaNotificacionCirculoEn: ahora },
            });
        }
    } catch (error) {
        logger.error("[CIRCULO] Error enviando notificación:", error);
    }
}
