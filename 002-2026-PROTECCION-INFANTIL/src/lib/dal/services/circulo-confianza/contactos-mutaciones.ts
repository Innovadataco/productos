/**
 * SPEC-135 (E-2): mutaciones del círculo — alta y actualización de contactos con
 * sus identificadores (validación de plataformas, normalización, auditoría).
 * Movimiento mecánico desde el god-module; la lógica queda intacta.
 */
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { AccionAudit, Prisma } from "@prisma/client";
import type { IdentificadorInput } from "./tipos";
import { contarContactosActivos, obtenerTopeContactos } from "./estado";

async function validarPlataformas(identificadores: IdentificadorInput[], client: Prisma.TransactionClient | typeof prisma) {
    const plataformaIds = Array.from(new Set(identificadores.map((i) => i.plataformaId).filter(Boolean) as string[]));

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
 * Crea un contacto de confianza con sus identificadores. Exige al menos un
 * identificador, respeta el tope de contactos activos y valida las plataformas.
 * @throws Error si no hay identificadores, se supera el tope o una plataforma no existe.
 */
export async function agregarContacto(
    usuarioId: string,
    data: {
        etiqueta?: string | undefined;
        nota?: string | undefined;
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
                // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                ...(data.etiqueta !== undefined ? { etiqueta: data.etiqueta.slice(0, 100) } : {}),
                ...(data.nota !== undefined ? { nota: data.nota.slice(0, 1000) } : {}),
                activo: true,
                identificadores: {
                    create: identificadores.map((i) => ({
                        valor: i.valor,
                        // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                        ...(i.tipo !== undefined ? { tipo: i.tipo.slice(0, 50) } : {}),
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
 * Actualiza etiqueta, nota, estado activo e identificadores de un contacto. Si se
 * envía lista de identificadores, desactiva los ausentes y crea/actualiza los
 * proveídos. Registra la acción en el audit log.
 * @throws Error "Contacto no encontrado" si el contacto no pertenece al usuario;
 * o si el contacto quedaría sin identificadores.
 */
export async function actualizarContacto(
    id: string,
    usuarioId: string,
    data: {
        etiqueta?: string | undefined;
        nota?: string | undefined;
        activo?: boolean | undefined;
        identificadores?: IdentificadorInput[] | undefined;
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
                // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                const datosIdentificador = {
                    valor: i.valor,
                    ...(i.tipo !== undefined ? { tipo: i.tipo.slice(0, 50) } : {}),
                    plataformaId: i.plataformaId || null,
                    activo: nuevoActivo,
                };
                if (i.id && idsExistentes.has(i.id)) {
                    await tx.identificadorContacto.update({
                        where: { id: i.id },
                        data: datosIdentificador,
                    });
                } else {
                    await tx.identificadorContacto.create({
                        data: {
                            contactoId: id,
                            ...datosIdentificador,
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
