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
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";

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
        // SPEC-325: se PERSISTE la forma canónica (antes se guardaba solo
        // `trim`, dejando el valor crudo → el cruce case-sensitive fallaba en
        // silencio). La normalización vive en un único lugar compartido.
        const valor = normalizarIdentificador(i.valor);
        if (!valor) continue;
        const key = `${valor}|${i.plataformaId ?? ""}`;
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
        nombre?: string | undefined; // SPEC-325: campo propio (antes solo etiqueta)
        parentesco?: string | undefined; // SPEC-325
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
                ...(data.nombre !== undefined ? { nombre: data.nombre.slice(0, 100) } : {}),
                ...(data.parentesco !== undefined ? { parentesco: data.parentesco.slice(0, 60) } : {}),
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
        nombre?: string | undefined; // SPEC-325
        parentesco?: string | undefined; // SPEC-325
        nota?: string | undefined;
        activo?: boolean | undefined;
        identificadores?: IdentificadorInput[] | undefined;
    },
    request?: Request
) {
    // SPEC-325: se traen TODOS los identificadores (antes solo los activos). Con el
    // filtro puesto, un identificador inactivo llegaba con `id` pero fuera de
    // `idsExistentes` y caía en la rama `create` → fila duplicada en vez de
    // reactivación. La baja de los ausentes usa el subconjunto activo (abajo).
    const contacto = await prisma.contactoConfianza.findFirst({
        where: { id, usuarioId },
        include: { identificadores: true },
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
                nombre: data.nombre !== undefined ? data.nombre?.slice(0, 100) : contacto.nombre,
                parentesco: data.parentesco !== undefined ? data.parentesco?.slice(0, 60) : contacto.parentesco,
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

            // Desactivar identificadores ACTIVOS que no estén en la lista enviada
            // (los que ya estaban inactivos no se tocan: no hay nada que bajar).
            const idsADesactivar = contacto.identificadores
                .filter((i) => i.activo && !idsProveidos.has(i.id))
                .map((i) => i.id);
            if (idsADesactivar.length > 0) {
                await tx.identificadorContacto.updateMany({
                    where: { id: { in: idsADesactivar } },
                    data: { activo: false },
                });
            }

            // Crear o actualizar identificadores enviados
            for (const i of proveidos) {
                // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                // SPEC-325: el estado es POR identificador. Omitirlo ≡ activo (lo
                // que hacía antes al mandar la lista con el contacto activo); un
                // contacto inhabilitado manda sobre todos: nada queda vigilando.
                const datosIdentificador = {
                    valor: i.valor,
                    ...(i.tipo !== undefined ? { tipo: i.tipo.slice(0, 50) } : {}),
                    plataformaId: i.plataformaId || null,
                    activo: nuevoActivo === false ? false : i.activo !== false,
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

/**
 * SPEC-325: baja lógica de un contacto (antes no había forma de borrar · el
 * `grep DELETE` en las rutas daba cero). No hard-delete: consistente con la baja
 * lógica de `AcudienteEstudiante`; `activo=false` lo saca de las vistas y del cruce.
 */
export async function eliminarContacto(id: string, usuarioId: string, request?: Request) {
    const contacto = await prisma.contactoConfianza.findFirst({
        where: { id, usuarioId },
        select: { id: true, activo: true },
    });
    if (!contacto) {
        throw new Error("Contacto no encontrado");
    }

    return prisma.$transaction(async (tx) => {
        await tx.contactoConfianza.update({ where: { id }, data: { activo: false } });
        await tx.identificadorContacto.updateMany({
            where: { contactoId: id },
            data: { activo: false },
        });
        await logAudit({
            accion: "CIRCULO_CONTACT_DISABLE" as AccionAudit,
            tipoRecurso: "ContactoConfianza",
            recursoId: id,
            usuarioId,
            valorNuevo: JSON.stringify({ eliminado: true }),
            ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
            userAgent: request?.headers.get("user-agent") || "unknown",
            tx,
        });
        return { ok: true };
    });
}

/**
 * SPEC-325: unicidad de identificador POR PADRE con warn+override (mismo criterio
 * que A-58). No es un unique duro en BD (el brief lo pide como advertencia, no como
 * bloqueo): devuelve a quién pertenece ya el identificador para que el padre decida.
 * El valor se compara en forma canónica (mecanismo compartido).
 */
export async function verificarUnicidadIdentificador(
    usuarioId: string,
    valor: string,
    plataformaId?: string | null
): Promise<{ duplicado: boolean; perteneceA?: string }> {
    const valorNorm = normalizarIdentificador(valor);
    if (!valorNorm) return { duplicado: false };

    const existente = await prisma.identificadorContacto.findFirst({
        where: {
            valor: valorNorm,
            plataformaId: plataformaId ?? null,
            activo: true,
            contacto: { usuarioId, activo: true },
        },
        select: {
            contacto: { select: { nombre: true, etiqueta: true } },
        },
    });
    if (!existente) return { duplicado: false };
    const nombre = existente.contacto.nombre || existente.contacto.etiqueta || "otro contacto";
    return { duplicado: true, perteneceA: nombre };
}
