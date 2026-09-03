/**
 * SPEC-412 · borrar SOLO lo sembrado, apoyándose en `demo_marcado`.
 *
 * Regla 3 del BRIEF A-76: *"lo sembrado se puede borrar completo y solo, sin
 * tocar un dato real. Si no se puede deshacer, no se debió sembrar."*
 *
 * **Nada de este archivo mira prefijos de id ni nombres.** La única fuente de
 * verdad de qué es sembrado es `demo_marcado.entidadId`. Eso significa dos
 * cosas, y las dos son deseables:
 *  · un colegio REAL que alguien llamó "Colegio Demo" no corre ningún peligro;
 *  · un colegio sembrado con nombre inocente sí cae.
 *
 * **Si algo NO marcado cuelga de algo marcado, el borrado falla y lo dice.**
 * No se borra a ciegas para "destrabar": una fila inesperada colgando de un
 * dato sembrado es información, no un estorbo. Todo va en una transacción, así
 * que un fallo deja la base como estaba.
 *
 * Se apoya en el orden y las fases que ya probó `scripts/demo-prod/purgar-demo.ts`
 * (SPEC-160), y le agrega lo que el brief §3.3 exige y aquél no tenía: reporte
 * previo, motivo obligatorio y registro en `AuditLog`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { registrarAuditoriaDemo } from "./_common";
import { ENTIDADES_ORDEN_BORRADO, INTOCABLES, idsMarcados, contarPorEntidad } from "./_marcado";

/** Diez minutos: 9.000 reportes con sus derivadas no caben en los 5 s por defecto. */
const TIMEOUT_TX_MS = 10 * 60 * 1000;

export interface FilaConteo {
    entidad: string;
    cantidad: number;
}

export interface PlanBorrado {
    /** Lo que está marcado, por entidad. Es exactamente lo que se va a borrar. */
    marcadas: FilaConteo[];
    /** Filas que cuelgan de lo marcado y no están marcadas ellas mismas. */
    derivadas: FilaConteo[];
    /** Lo que NO se toca: el universo real, contado antes para poder comparar después. */
    reales: FilaConteo[];
    /** INTOCABLES encontrados marcados por error — se excluyen del borrado. */
    intocablesExcluidos: string[];
    totalMarcado: number;
}

/** Ids marcados de una entidad, ya descontados los INTOCABLES. */
async function idsBorrables(
    client: PrismaClient,
    entidad: string,
): Promise<{ ids: string[]; excluidos: string[] }> {
    const ids = await idsMarcados(client, entidad);
    if (ids.length === 0) return { ids, excluidos: [] };

    if (entidad === "Colegio") {
        const excluidos = ids.filter((id) => (INTOCABLES.colegios as readonly string[]).includes(id));
        return { ids: ids.filter((id) => !excluidos.includes(id)), excluidos };
    }
    if (entidad === "Usuario") {
        const protegidos = await client.usuario.findMany({
            where: { id: { in: ids }, email: { in: [...INTOCABLES.emailsUsuario] } },
            select: { id: true },
        });
        const excluidos = protegidos.map((u) => u.id);
        return { ids: ids.filter((id) => !excluidos.includes(id)), excluidos };
    }
    return { ids, excluidos: [] };
}

/**
 * El reporte previo que exige el brief: qué va a caer, qué cuelga de eso, y
 * cuánto hay de real para poder contar antes y después.
 */
export async function planDeBorrado(client: PrismaClient): Promise<PlanBorrado> {
    const marcadas = await contarPorEntidad(client);
    const totalMarcado = marcadas.reduce((s, m) => s + m.cantidad, 0);

    const intocablesExcluidos: string[] = [];
    for (const entidad of ["Colegio", "Usuario"]) {
        const { excluidos } = await idsBorrables(client, entidad);
        intocablesExcluidos.push(...excluidos.map((id) => `${entidad}:${id}`));
    }

    const reporteIds = await idsMarcados(client, "Reporte");
    const alertaIds = await idsMarcados(client, "AlertaColegio");
    const colegioIds = (await idsBorrables(client, "Colegio")).ids;
    const estudianteIds = await idsMarcados(client, "Estudiante");

    const derivadas: FilaConteo[] = [];
    const anotar = (entidad: string, cantidad: number) => {
        if (cantidad > 0) derivadas.push({ entidad, cantidad });
    };
    if (alertaIds.length > 0) {
        anotar("SeguimientoCaso", await client.seguimientoCaso.count({ where: { alertaId: { in: alertaIds } } }));
    }
    if (reporteIds.length > 0) {
        anotar("EmbeddingReporte", await client.embeddingReporte.count({ where: { reporteId: { in: reporteIds } } }));
        anotar("FuenteReporte", await client.fuenteReporte.count({ where: { reporteId: { in: reporteIds } } }));
        anotar("ReintentoReporte", await client.reintentoReporte.count({ where: { reporteId: { in: reporteIds } } }));
        anotar("PasoProcesamiento", await client.pasoProcesamiento.count({ where: { reporteId: { in: reporteIds } } }));
        anotar("EventoMatch", await client.eventoMatch.count({ where: { reporteNuevoId: { in: reporteIds } } }));
    }
    if (colegioIds.length > 0) {
        anotar("PatronInstitucional", await client.patronInstitucional.count({ where: { colegioId: { in: colegioIds } } }));
        anotar("RegistroAvisoColegio", await client.registroAvisoColegio.count({ where: { colegioId: { in: colegioIds } } }));
    }
    if (estudianteIds.length > 0) {
        anotar("EstudianteObservacion", await client.estudianteObservacion.count({ where: { estudianteId: { in: estudianteIds } } }));
    }
    const suscripcionIds = await idsMarcados(client, "Suscripcion");
    if (suscripcionIds.length > 0) {
        const dentro = { suscripcionId: { in: suscripcionIds } };
        anotar("BonoAplicado", await client.bonoAplicado.count({ where: dentro }));
        anotar("ScoreCliente", await client.scoreCliente.count({ where: dentro }));
        anotar("CodigoReferidoUso", await client.codigoReferidoUso.count({ where: { suscripcionReferidaId: { in: suscripcionIds } } }));
    }

    // Lo real = todo menos lo marcado. Se cuenta ANTES para poder demostrar
    // después que no se movió (verificación del brief §7).
    const reales: FilaConteo[] = [
        { entidad: "Reporte", cantidad: await client.reporte.count({ where: { id: { notIn: reporteIds } } }) },
        { entidad: "Colegio", cantidad: await client.colegio.count({ where: { id: { notIn: colegioIds } } }) },
        { entidad: "AlertaColegio", cantidad: await client.alertaColegio.count({ where: { id: { notIn: alertaIds } } }) },
        { entidad: "Suscripcion", cantidad: await client.suscripcion.count({ where: { id: { notIn: suscripcionIds } } }) },
        { entidad: "Pago", cantidad: await client.pago.count({ where: { id: { notIn: await idsMarcados(client, "Pago") } } }) },
    ];

    return { marcadas, derivadas, reales, intocablesExcluidos, totalMarcado };
}

/** Fase 1: lo que cuelga de lo marcado y no está marcado. Antes que sus padres. */
async function borrarDerivadas(
    tx: Prisma.TransactionClient,
    ids: { reporteIds: string[]; alertaIds: string[]; colegioIds: string[]; estudianteIds: string[]; suscripcionIds: string[]; pagoIds: string[] },
    borradas: Record<string, number>,
): Promise<void> {
    const suma = (k: string, n: number) => { borradas[k] = (borradas[k] ?? 0) + n; };

    if (ids.alertaIds.length > 0) {
        const seguimientos = await tx.seguimientoCaso.findMany({
            where: { alertaId: { in: ids.alertaIds } },
            select: { id: true },
        });
        const seguimientoIds = seguimientos.map((s) => s.id);
        if (seguimientoIds.length > 0) {
            suma("NotaSeguimiento", (await tx.notaSeguimiento.deleteMany({ where: { seguimientoId: { in: seguimientoIds } } })).count);
            suma("InformeCaso", (await tx.informeCaso.deleteMany({ where: { casoId: { in: seguimientoIds } } })).count);
            suma("SeguimientoCaso", (await tx.seguimientoCaso.deleteMany({ where: { id: { in: seguimientoIds } } })).count);
        }
    }

    if (ids.reporteIds.length > 0) {
        const dentro = { reporteId: { in: ids.reporteIds } };
        suma("EmbeddingReporte", (await tx.embeddingReporte.deleteMany({ where: dentro })).count);
        suma("FuenteReporte", (await tx.fuenteReporte.deleteMany({ where: dentro })).count);
        suma("ReintentoReporte", (await tx.reintentoReporte.deleteMany({ where: dentro })).count);
        suma("PasoProcesamiento", (await tx.pasoProcesamiento.deleteMany({ where: dentro })).count);
        suma("EventoMatch", (await tx.eventoMatch.deleteMany({ where: { reporteNuevoId: { in: ids.reporteIds } } })).count);
    }

    if (ids.colegioIds.length > 0) {
        const dentro = { colegioId: { in: ids.colegioIds } };
        suma("PatronInstitucional", (await tx.patronInstitucional.deleteMany({ where: dentro })).count);
        suma("RegistroAvisoColegio", (await tx.registroAvisoColegio.deleteMany({ where: dentro })).count);
    }

    if (ids.estudianteIds.length > 0) {
        suma("EstudianteObservacion", (await tx.estudianteObservacion.deleteMany({ where: { estudianteId: { in: ids.estudianteIds } } })).count);
    }

    // Comercial: lo que cuelga de la suscripción y del pago. El poblador no lo
    // crea, pero el producto sí puede haberlo creado sobre datos sembrados.
    if (ids.pagoIds.length > 0) {
        suma("BonoAplicado", (await tx.bonoAplicado.deleteMany({ where: { pagoId: { in: ids.pagoIds } } })).count);
    }
    if (ids.suscripcionIds.length > 0) {
        const dentro = { suscripcionId: { in: ids.suscripcionIds } };
        suma("BonoAplicado", (await tx.bonoAplicado.deleteMany({ where: dentro })).count);
        suma("ScoreCliente", (await tx.scoreCliente.deleteMany({ where: dentro })).count);
        suma("CodigoReferidoUso", (await tx.codigoReferidoUso.deleteMany({
            where: { suscripcionReferidaId: { in: ids.suscripcionIds } },
        })).count);
    }
}

/** Fase 2: las entidades marcadas, en el orden FK-safe declarado en `_marcado.ts`. */
async function borrarMarcadas(
    tx: Prisma.TransactionClient,
    porEntidad: Map<string, string[]>,
    borradas: Record<string, number>,
): Promise<void> {
    for (const entidad of ENTIDADES_ORDEN_BORRADO) {
        const ids = porEntidad.get(entidad);
        if (!ids || ids.length === 0) continue;

        if (entidad === "Usuario") {
            // Soltar los vínculos antes de borrar: el usuario apunta a colegio y
            // tenant, que caen en este mismo barrido.
            await tx.usuario.updateMany({
                where: { id: { in: ids } },
                data: { colegioId: null, tenantId: null, comiteColegioId: null },
            });
        }
        if (entidad === "Curso") {
            await tx.curso.updateMany({ where: { id: { in: ids } }, data: { profesorTitularId: null } });
        }

        const modelo = entidad.charAt(0).toLowerCase() + entidad.slice(1);
        // @ts-expect-error — acceso dinámico al modelo Prisma; el nombre viene de
        // ENTIDADES_ORDEN_BORRADO, que el test-candado cruza contra lo que marca
        // el poblador.
        const delegado = tx[modelo];
        if (!delegado || typeof delegado.deleteMany !== "function") {
            throw new Error(`[borrado-marcado] No existe el modelo Prisma "${modelo}" para la entidad "${entidad}".`);
        }
        const res = await delegado.deleteMany({ where: { id: { in: ids } } });
        borradas[entidad] = (borradas[entidad] ?? 0) + res.count;
    }
}

export interface ResultadoBorrado {
    borradas: Record<string, number>;
    marcadasLimpiadas: number;
    intocablesExcluidos: string[];
}

/**
 * Borra todo lo marcado. Una sola transacción: si algo no marcado cuelga de
 * algo marcado, la FK revienta, no se borra nada y el error dice qué estorba.
 */
export async function ejecutarBorrado(
    client: PrismaClient,
    motivo: string,
): Promise<ResultadoBorrado> {
    const porEntidad = new Map<string, string[]>();
    const intocablesExcluidos: string[] = [];
    for (const entidad of ENTIDADES_ORDEN_BORRADO) {
        const { ids, excluidos } = await idsBorrables(client, entidad);
        porEntidad.set(entidad, ids);
        intocablesExcluidos.push(...excluidos.map((id) => `${entidad}:${id}`));
    }

    const borradas: Record<string, number> = {};
    const marcadasLimpiadas = await client.$transaction(async (tx) => {
        await borrarDerivadas(tx, {
            reporteIds: porEntidad.get("Reporte") ?? [],
            alertaIds: porEntidad.get("AlertaColegio") ?? [],
            colegioIds: porEntidad.get("Colegio") ?? [],
            estudianteIds: porEntidad.get("Estudiante") ?? [],
            suscripcionIds: porEntidad.get("Suscripcion") ?? [],
            pagoIds: porEntidad.get("Pago") ?? [],
        }, borradas);

        await borrarMarcadas(tx, porEntidad, borradas);

        // Se limpian solo las marcas de lo que efectivamente se borró: las de un
        // INTOCABLE excluido se quedan, para que quede rastro de la anomalía.
        const idsBorrados = [...porEntidad.values()].flat();
        const limpiadas = await tx.demoMarcado.deleteMany({ where: { entidadId: { in: idsBorrados } } });

        const total = Object.values(borradas).reduce((a, b) => a + b, 0);
        await registrarAuditoriaDemo(tx, "demo_borrar", motivo, total, {
            fuente: "demo_marcado",
            spec: "SPEC-412",
            porEntidad: borradas,
            intocablesExcluidos,
        });
        return limpiadas.count;
    }, { timeout: TIMEOUT_TX_MS, maxWait: 30_000 });

    return { borradas, marcadasLimpiadas, intocablesExcluidos };
}
