/**
 * SPEC-325 (002-PI-225) · "A quién protejo" — servicio de hijos/familiares.
 *
 * PII de menor (patrón `Estudiante`/`AcudienteEstudiante`): el acceso es SIEMPRE
 * a través del padre dueño (tabla puente `HijoPadre`), nunca por id suelto. Aquí
 * ninguna función recibe un `hijoId` sin exigir además el `usuarioId` del padre y
 * verificar la vinculación — un `hijoId` no acotado nunca llega a la BD.
 *
 * Dos-padres-un-niño (§3.1-bis): la detección es por documento. Registrar un
 * documento que ya existe NO duplica el `Hijo`; vincula al 2º padre. Los datos e
 * identificadores del niño son compartidos; los reportes/expediente siguen su ruta
 * propia por `usuarioId` (privados) — este servicio solo maneja la entidad del niño.
 *
 * El identificador se guarda en forma canónica (mecanismo compartido · candado 22).
 */
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { AccionAudit, Prisma } from "@prisma/client";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import type { RegistrarHijoInput, IdentificadorHijoInput } from "./tipos";

function normalizarIdentificadores(identificadores: IdentificadorHijoInput[]) {
    const vistos = new Set<string>();
    const salida: { valor: string; tipo?: string; plataformaId: string | null }[] = [];
    for (const i of identificadores) {
        const valor = normalizarIdentificador(i.valor);
        if (!valor) continue;
        const key = `${valor}|${i.plataformaId ?? ""}`;
        if (vistos.has(key)) continue; // dedup silencioso dentro del alta
        vistos.add(key);
        salida.push({
            valor,
            ...(i.tipo !== undefined ? { tipo: i.tipo.slice(0, 50) } : {}),
            plataformaId: i.plataformaId || null,
        });
    }
    return salida;
}

/**
 * Registra un hijo/familiar del padre. Si el documento ya existe (mismo menor),
 * vincula a este padre al `Hijo` existente en vez de duplicar (§3.1-bis).
 */
export async function registrarHijo(usuarioId: string, data: RegistrarHijoInput) {
    const identificadores = normalizarIdentificadores(data.identificadores ?? []);

    return prisma.$transaction(async (tx) => {
        const existente = await tx.hijo.findUnique({
            where: {
                documentoTipo_documentoNumero: {
                    documentoTipo: data.documentoTipo,
                    documentoNumero: data.documentoNumero.trim(),
                },
            },
            select: { id: true },
        });

        let hijoId: string;
        let accion: AccionAudit;

        if (existente) {
            // Mismo menor: vincular a este padre (idempotente por @@unique).
            hijoId = existente.id;
            accion = "HIJO_PADRE_VINCULADO";
            await tx.hijoPadre.upsert({
                where: { hijoId_usuarioId: { hijoId, usuarioId } },
                create: { hijoId, usuarioId },
                update: {},
            });
            // Los identificadores nuevos que traiga el 2º padre se agregan al niño
            // compartido (si no colisionan con los existentes).
            if (identificadores.length > 0) {
                const yaExisten = new Set(
                    (
                        await tx.identificadorHijo.findMany({
                            where: { hijoId },
                            select: { valor: true, plataformaId: true },
                        })
                    ).map((x) => `${x.valor}|${x.plataformaId ?? ""}`)
                );
                const nuevos = identificadores.filter(
                    (i) => !yaExisten.has(`${i.valor}|${i.plataformaId ?? ""}`)
                );
                if (nuevos.length > 0) {
                    await tx.identificadorHijo.createMany({
                        data: nuevos.map((i) => ({ hijoId, ...i })),
                    });
                }
            }
        } else {
            const hijo = await tx.hijo.create({
                data: {
                    nombre: data.nombre.slice(0, 120),
                    apellidos: (data.apellidos ?? "").slice(0, 120),
                    documentoTipo: data.documentoTipo,
                    documentoNumero: data.documentoNumero.trim(),
                    ...(data.anioNacimiento !== undefined ? { anioNacimiento: data.anioNacimiento } : {}),
                    ...(data.sexo !== undefined ? { sexo: data.sexo } : {}),
                    padres: { create: { usuarioId } },
                    ...(identificadores.length > 0
                        ? { identificadores: { create: identificadores } }
                        : {}),
                },
                select: { id: true },
            });
            hijoId = hijo.id;
            accion = "HIJO_CREATE";
        }

        await logAudit({
            accion,
            tipoRecurso: "Hijo",
            recursoId: hijoId,
            usuarioId,
            // PII: no se registra documento en claro en la auditoría.
            valorNuevo: JSON.stringify({ vinculado: !!existente, identificadores: identificadores.length }),
            tx,
        });

        return { hijoId, vinculadoAExistente: !!existente };
    });
}

/**
 * Lista los hijos del padre (solo los suyos, vía `HijoPadre`), con los
 * identificadores que ESTE padre no ha desvinculado de su vista (§3.1-bis).
 */
export async function listarHijos(usuarioId: string) {
    const vinculos = await prisma.hijoPadre.findMany({
        where: { usuarioId },
        select: {
            hijo: {
                select: {
                    id: true,
                    nombre: true,
                    apellidos: true,
                    documentoTipo: true,
                    documentoNumero: true,
                    anioNacimiento: true,
                    sexo: true,
                    estado: true,
                    identificadores: {
                        where: {
                            // SPEC-325 (extensión): se muestran activos e inactivos para
                            // poder activar/inactivar; se excluyen solo los desvinculados
                            // por ESTE padre (§3.1-bis).
                            desvinculado: { none: { usuarioId } },
                        },
                        select: {
                            id: true,
                            valor: true,
                            tipo: true,
                            activo: true,
                            plataforma: { select: { id: true, nombre: true, clave: true } },
                        },
                        orderBy: { creadoEn: "asc" },
                    },
                },
            },
        },
        orderBy: { creadoEn: "desc" },
    });
    return vinculos.map((v) => v.hijo);
}

/** Verifica que el padre sea dueño del hijo (PII · acceso solo por dueño). */
async function exigirDueno(
    tx: Prisma.TransactionClient | typeof prisma,
    usuarioId: string,
    hijoId: string
) {
    const vinculo = await tx.hijoPadre.findUnique({
        where: { hijoId_usuarioId: { hijoId, usuarioId } },
        select: { id: true },
    });
    if (!vinculo) throw new Error("Hijo no encontrado");
}

/**
 * "Quitar" un identificador de la vista de ESTE padre: no borra la fila (es
 * compartida con el otro padre), solo la desvincula para este `usuarioId` (§3.1-bis).
 */
export async function desvincularIdentificador(
    usuarioId: string,
    identificadorId: string
) {
    return prisma.$transaction(async (tx) => {
        const ident = await tx.identificadorHijo.findUnique({
            where: { id: identificadorId },
            select: { hijoId: true },
        });
        if (!ident) throw new Error("Identificador no encontrado");
        await exigirDueno(tx, usuarioId, ident.hijoId);

        await tx.identificadorHijoDesvinculado.upsert({
            where: { identificadorId_usuarioId: { identificadorId, usuarioId } },
            create: { identificadorId, usuarioId },
            update: {},
        });

        await logAudit({
            accion: "HIJO_IDENTIFICADOR_DESVINCULADO",
            tipoRecurso: "IdentificadorHijo",
            recursoId: identificadorId,
            usuarioId,
            tx,
        });
        return { ok: true };
    });
}

/** Activa/inactiva un hijo (solo el padre dueño · PII). */
export async function cambiarEstadoHijo(
    usuarioId: string,
    hijoId: string,
    estado: "activo" | "inactivo"
) {
    return prisma.$transaction(async (tx) => {
        await exigirDueno(tx, usuarioId, hijoId);
        await tx.hijo.update({ where: { id: hijoId }, data: { estado } });
        await logAudit({
            accion: "HIJO_UPDATE",
            tipoRecurso: "Hijo",
            recursoId: hijoId,
            usuarioId,
            valorNuevo: JSON.stringify({ estado }),
            tx,
        });
        return { ok: true, estado };
    });
}

/**
 * Agrega un identificador a un hijo YA creado (valor normalizado · candado 22).
 * El identificador es compartido entre los dos padres; si ya existe uno igual
 * (valor + plataforma) no se duplica.
 */
export async function agregarIdentificador(
    usuarioId: string,
    hijoId: string,
    input: IdentificadorHijoInput
) {
    return prisma.$transaction(async (tx) => {
        await exigirDueno(tx, usuarioId, hijoId);
        const valor = normalizarIdentificador(input.valor);
        if (!valor) throw new Error("Identificador vacío");
        const plataformaId = input.plataformaId || null;

        const existente = await tx.identificadorHijo.findFirst({
            where: { hijoId, valor, plataformaId },
            select: { id: true },
        });
        if (existente) {
            // Si estaba desvinculado por ESTE padre, re-vincularlo a su vista.
            await tx.identificadorHijoDesvinculado.deleteMany({
                where: { identificadorId: existente.id, usuarioId },
            });
            return { ok: true, identificadorId: existente.id, yaExistia: true };
        }

        const creado = await tx.identificadorHijo.create({
            data: {
                hijoId,
                valor,
                ...(input.tipo !== undefined ? { tipo: input.tipo.slice(0, 50) } : {}),
                plataformaId,
            },
            select: { id: true },
        });
        await logAudit({
            accion: "HIJO_UPDATE",
            tipoRecurso: "IdentificadorHijo",
            recursoId: creado.id,
            usuarioId,
            valorNuevo: JSON.stringify({ hijoId, agregado: true }),
            tx,
        });
        return { ok: true, identificadorId: creado.id, yaExistia: false };
    });
}

/** Activa/inactiva un identificador de un hijo (flag global compartido · §3.1-bis). */
export async function cambiarEstadoIdentificador(
    usuarioId: string,
    identificadorId: string,
    activo: boolean
) {
    return prisma.$transaction(async (tx) => {
        const ident = await tx.identificadorHijo.findUnique({
            where: { id: identificadorId },
            select: { hijoId: true },
        });
        if (!ident) throw new Error("Identificador no encontrado");
        await exigirDueno(tx, usuarioId, ident.hijoId);

        await tx.identificadorHijo.update({ where: { id: identificadorId }, data: { activo } });
        await logAudit({
            accion: "HIJO_UPDATE",
            tipoRecurso: "IdentificadorHijo",
            recursoId: identificadorId,
            usuarioId,
            valorNuevo: JSON.stringify({ activo }),
            tx,
        });
        return { ok: true, activo };
    });
}
