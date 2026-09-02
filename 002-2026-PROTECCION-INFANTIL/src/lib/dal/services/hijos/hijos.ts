/**
 * SPEC-325 (002-PI-225) · "A quién protejo" — servicio de hijos/familiares.
 *
 * PII de menor: el acceso es SIEMPRE a través del padre dueño, nunca por id
 * suelto. Ninguna función recibe un `hijoId` sin exigir además el `usuarioId` del
 * padre y verificar la propiedad — un `hijoId` no acotado nunca llega a la BD.
 *
 * SPEC-339 (A-67 · D-4, 31-08-2026) — CAMBIO DE REGLA. Antes: la ficha del menor
 * era global y única por documento en todo el sistema; registrar un documento ya
 * existente NO duplicaba el `Hijo`, vinculaba al 2º padre por la tabla puente, y
 * los datos e interruptores del niño quedaban COMPARTIDOS.
 *
 * Eso tenía tres consecuencias, las tres verificadas en este mismo archivo:
 *   1. `cambiarEstadoHijo` escribía un `estado` compartido → un padre le apagaba
 *      los avisos al otro, sin que el otro se enterara.
 *   2. `cambiarEstadoIdentificador` era un "flag global compartido" → lo mismo
 *      con cada cuenta del menor.
 *   3. Corregir los datos del menor le reescribía la ficha al otro padre.
 *
 * Regla de Jelkin (31-08-2026): *"si otro padre se registra con un correo
 * diferente y quiere vincular los mismos hijos, no pasa absolutamente nada"*.
 * Ahora cada padre tiene SU ficha (`Hijo.usuarioId`), sus interruptores y sus
 * avisos. El documento es único DENTRO de la lista de cada padre, no en todo el
 * sistema. `HijoPadre` e `IdentificadorHijoDesvinculado` quedan sin uso (no se
 * borran: reversible si Jelkin revierte la regla).
 *
 * El identificador se guarda en forma canónica (mecanismo compartido · candado 22).
 */
// SPEC-197 (I-88): este módulo entra a la cadena de los workers — imports
// RELATIVOS, no alias @/lib (la allowlist del ratchet solo se encoge).
import { prisma } from "../../../prisma";
import { logAudit } from "../../../audit";
import { AppError, ERROR_CODES } from "../../../errors";
import type { Prisma } from "@prisma/client";
import { normalizarIdentificador } from "../../identificadores/normalizar";
import type { RegistrarHijoInput, ActualizarHijoInput, IdentificadorHijoInput } from "./tipos";

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
 * Registra un menor en la lista de ESTE padre.
 *
 * SPEC-339 (D-4): ya no se engancha a la ficha de otro padre. Si el documento ya
 * está en la lista de este mismo padre, es un duplicado y se rechaza; que exista
 * en la lista de OTRO padre no es conflicto, es el caso normal.
 */
export async function registrarHijo(usuarioId: string, data: RegistrarHijoInput) {
    const identificadores = normalizarIdentificadores(data.identificadores ?? []);
    const documentoNumero = data.documentoNumero.trim();

    return prisma.$transaction(async (tx) => {
        const duplicadoPropio = await tx.hijo.findFirst({
            where: { usuarioId, documentoTipo: data.documentoTipo, documentoNumero },
            select: { id: true },
        });
        if (duplicadoPropio) {
            throw new AppError(
                "Ese documento ya está en tu lista. Revisa los datos o busca al menor entre los que ya registraste.",
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const hijo = await tx.hijo.create({
            data: {
                usuarioId,
                nombre: data.nombre.slice(0, 120),
                apellidos: data.apellidos.slice(0, 120),
                documentoTipo: data.documentoTipo,
                documentoNumero,
                ...(data.anioNacimiento !== undefined ? { anioNacimiento: data.anioNacimiento } : {}),
                ...(data.sexo !== undefined ? { sexo: data.sexo } : {}),
                ...(identificadores.length > 0
                    ? { identificadores: { create: identificadores } }
                    : {}),
            },
            select: { id: true },
        });

        await logAudit({
            accion: "HIJO_CREATE",
            tipoRecurso: "Hijo",
            recursoId: hijo.id,
            usuarioId,
            // PII: no se registra documento en claro en la auditoría.
            valorNuevo: JSON.stringify({ identificadores: identificadores.length }),
            tx,
        });

        return { hijoId: hijo.id };
    });
}

/**
 * Lista los menores de ESTE padre.
 *
 * SPEC-339 (D-4): se acota por `Hijo.usuarioId`. Ya no hace falta filtrar los
 * identificadores "desvinculados por este padre": con ficha propia, lo que el
 * padre quita, queda quitado.
 */
export async function listarHijos(usuarioId: string) {
    return prisma.hijo.findMany({
        where: { usuarioId },
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
                // Se muestran activos e inactivos: el padre necesita ver ambos
                // para poder encenderlos y apagarlos.
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
        orderBy: { creadoEn: "desc" },
    });
}

/**
 * Verifica que el padre sea dueño del menor (PII · acceso solo por dueño).
 * SPEC-339 (D-4): la propiedad vive en la ficha, no en la tabla puente.
 */
async function exigirDueno(
    tx: Prisma.TransactionClient | typeof prisma,
    usuarioId: string,
    hijoId: string
) {
    const propio = await tx.hijo.findFirst({
        where: { id: hijoId, usuarioId },
        select: { id: true },
    });
    // Mensaje deliberadamente igual al de "no existe": un padre no debe poder
    // averiguar si el menor de otro padre existe probando identificadores.
    if (!propio) throw new Error("Hijo no encontrado");
}

/**
 * Quita un identificador del menor.
 *
 * SPEC-339 (D-4): antes la fila era compartida con el otro padre, así que
 * "quitar" solo la ocultaba de la vista de quien la quitaba
 * (`IdentificadorHijoDesvinculado`). Con ficha propia eso ya no tiene sentido:
 * la fila es de este padre y quitarla es quitarla. El mecanismo de
 * desvinculación queda sin uso, no se borra (reversible si Jelkin revierte D-4).
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

        await tx.identificadorHijo.delete({ where: { id: identificadorId } });

        await logAudit({
            accion: "HIJO_IDENTIFICADOR_DESVINCULADO",
            tipoRecurso: "IdentificadorHijo",
            recursoId: identificadorId,
            usuarioId,
            // SPEC-363 (I-259): la fila se borra, así que el hito "quitaste la
            // cuenta" solo puede atarse al menor por este `hijoId`. NUNCA el
            // valor del identificador: es PII y no vuelve al log.
            valorNuevo: JSON.stringify({ hijoId: ident.hijoId }),
            tx,
        });
        return { ok: true };
    });
}

/**
 * Corrige los datos de un menor ya registrado (SPEC-339 · FR-022).
 *
 * Antes solo se podía activar o inactivar: si el padre escribía mal un apellido
 * o un documento, no tenía forma de arreglarlo. Ahora sí — y es seguro hacerlo
 * porque la ficha es suya (D-4): antes habría reescrito la ficha del otro padre.
 */
export async function actualizarHijo(
    usuarioId: string,
    hijoId: string,
    data: ActualizarHijoInput
) {
    return prisma.$transaction(async (tx) => {
        await exigirDueno(tx, usuarioId, hijoId);

        const documentoNumero = data.documentoNumero?.trim();

        // El documento solo choca DENTRO de la lista de este padre. Que el mismo
        // documento exista en la lista de otro padre es el caso normal (D-4).
        if (data.documentoTipo !== undefined || documentoNumero !== undefined) {
            const actual = await tx.hijo.findUniqueOrThrow({
                where: { id: hijoId },
                select: { documentoTipo: true, documentoNumero: true },
            });
            const tipoFinal = data.documentoTipo ?? actual.documentoTipo;
            const numeroFinal = documentoNumero ?? actual.documentoNumero;

            const choque = await tx.hijo.findFirst({
                where: {
                    usuarioId,
                    documentoTipo: tipoFinal,
                    documentoNumero: numeroFinal,
                    id: { not: hijoId },
                },
                select: { id: true },
            });
            if (choque) {
                throw new AppError(
                    "Ese documento ya está en tu lista, en otro de los menores que registraste.",
                    ERROR_CODES.CONFLICT,
                    409
                );
            }
        }

        const cambios: Prisma.HijoUncheckedUpdateInput = {};
        if (data.nombre !== undefined) cambios.nombre = data.nombre.slice(0, 120);
        if (data.apellidos !== undefined) cambios.apellidos = data.apellidos.slice(0, 120);
        if (data.documentoTipo !== undefined) cambios.documentoTipo = data.documentoTipo;
        if (documentoNumero !== undefined) cambios.documentoNumero = documentoNumero;
        if (data.anioNacimiento !== undefined) cambios.anioNacimiento = data.anioNacimiento;
        if (data.sexo !== undefined) cambios.sexo = data.sexo;
        if (data.estado !== undefined) cambios.estado = data.estado;

        await tx.hijo.update({ where: { id: hijoId }, data: cambios });

        await logAudit({
            accion: "HIJO_UPDATE",
            tipoRecurso: "Hijo",
            recursoId: hijoId,
            usuarioId,
            // PII: se registra QUÉ campos cambiaron, nunca el documento en claro.
            valorNuevo: JSON.stringify({ campos: Object.keys(cambios) }),
            tx,
        });

        return { ok: true };
    });
}

/**
 * Activa/inactiva un hijo (solo el padre dueño · PII).
 *
 * SPEC-363:
 * · BUG2 — es la ÚNICA función que audita `{ estado }` con el valor (la bitácora
 *   del menor lo lee de ahí). El PATCH de estado DEBE pasar por acá; si pasa por
 *   `actualizarHijo`, el audit sale como `{ campos: ["estado"] }` sin el valor y
 *   la bitácora no anota el hito de pausar/reactivar.
 * · BUG1 — al REACTIVAR (inactivo→activo) el menor cuenta contra el tope de
 *   activos, igual que al registrar uno nuevo: sin esto el cupo era burlable
 *   (inactivar 1 → registrar el 6º → reactivar el inactivo = 6 activos con tope
 *   5). El tope y la plantilla del mensaje se INYECTAN desde la ruta (este
 *   módulo no lee parámetros: cadena de workers, SPEC-197). Sin `cupo` no se
 *   aplica —llamadas internas que no ejercen el límite.
 */
export async function cambiarEstadoHijo(
    usuarioId: string,
    hijoId: string,
    estado: "activo" | "inactivo",
    cupo?: { maximoActivos: number; mensajeSiExcede: (activos: number, maximo: number) => string }
) {
    return prisma.$transaction(async (tx) => {
        await exigirDueno(tx, usuarioId, hijoId);

        if (estado === "activo" && cupo) {
            // Solo cuenta si el menor estaba inactivo: reafirmar "activo" sobre
            // uno ya activo no consume un cupo nuevo.
            const actual = await tx.hijo.findUniqueOrThrow({ where: { id: hijoId }, select: { estado: true } });
            if (actual.estado !== "activo") {
                const activos = await tx.hijo.count({ where: { usuarioId, estado: "activo" } });
                if (activos >= cupo.maximoActivos) {
                    throw new AppError(cupo.mensajeSiExcede(activos, cupo.maximoActivos), ERROR_CODES.CONFLICT, 409);
                }
            }
        }

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
            // SPEC-363 (I-259): `hijoId` para que la bitácora del menor pueda
            // atar el hito "activaste/pausaste la cuenta" al menor correcto —
            // el recursoId es el del identificador, no el del hijo. Mismo lugar
            // (valorNuevo) que el evento AGREGADO, que la bitácora ya lee.
            valorNuevo: JSON.stringify({ hijoId: ident.hijoId, activo }),
            tx,
        });
        return { ok: true, activo };
    });
}
