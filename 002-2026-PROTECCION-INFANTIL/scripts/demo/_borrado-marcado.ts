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
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { registrarAuditoriaDemo } from "./_common";
import { ENTIDADES_ORDEN_BORRADO, INTOCABLES, idsMarcados, contarPorEntidad, enLotes, borrarEnLotes, contarEnLotes } from "./_marcado";

/**
 * SPEC-420 · **convención de este archivo**: la ÚNICA variable que puede
 * aparecer dentro de un `in:` es `t`, el trozo que entrega `enLotes`. Cualquier
 * otra es una lista de ids sin techo, y una lista sin techo es lo que reventó
 * el borrado en producción (37.176 parámetros contra un máximo de 32.767).
 *
 * Un test-candado lee este archivo y hace cumplir la convención. Por eso el
 * parámetro se llama siempre `t`: para que la regla se pueda verificar leyendo,
 * sin tener que entender el flujo.
 */

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
        // SPEC-420: se pregunta por los DOS correos intocables, no por los N ids
        // marcados. La lista de correos es fija y corta; la de ids no tiene
        // techo, y un `in:` sin techo es lo que reventó el borrado en producción.
        const protegidos = await client.usuario.findMany({
            where: { email: { in: [...INTOCABLES.emailsUsuario] } },
            select: { id: true },
        });
        const protegidosSet = new Set(protegidos.map((u) => u.id));
        const excluidos = ids.filter((id) => protegidosSet.has(id));
        const excluidosSet = new Set(excluidos);
        return { ids: ids.filter((id) => !excluidosSet.has(id)), excluidos };
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
    // SPEC-420: también el REPORTE PREVIO va por lotes. Un `count` con 9.000
    // ids gasta 9.000 parámetros igual que un `delete`: el límite no distingue
    // entre leer y escribir, y este reporte corre incluso en dry-run.
    if (alertaIds.length > 0) {
        anotar("SeguimientoCaso", await contarEnLotes(alertaIds, (t) => client.seguimientoCaso.count({ where: { alertaId: { in: t } } })));
    }
    if (reporteIds.length > 0) {
        const r = reporteIds;
        anotar("EmbeddingReporte", await contarEnLotes(r, (t) => client.embeddingReporte.count({ where: { reporteId: { in: t } } })));
        anotar("FuenteReporte", await contarEnLotes(r, (t) => client.fuenteReporte.count({ where: { reporteId: { in: t } } })));
        anotar("ReintentoReporte", await contarEnLotes(r, (t) => client.reintentoReporte.count({ where: { reporteId: { in: t } } })));
        anotar("PasoProcesamiento", await contarEnLotes(r, (t) => client.pasoProcesamiento.count({ where: { reporteId: { in: t } } })));
        anotar("EventoMatch", await contarEnLotes(r, (t) => client.eventoMatch.count({ where: { reporteNuevoId: { in: t } } })));
    }
    if (colegioIds.length > 0) {
        const c = colegioIds;
        anotar("PatronInstitucional", await contarEnLotes(c, (t) => client.patronInstitucional.count({ where: { colegioId: { in: t } } })));
        anotar("RegistroAvisoColegio", await contarEnLotes(c, (t) => client.registroAvisoColegio.count({ where: { colegioId: { in: t } } })));
    }
    if (estudianteIds.length > 0) {
        anotar("EstudianteObservacion", await contarEnLotes(estudianteIds, (t) => client.estudianteObservacion.count({ where: { estudianteId: { in: t } } })));
    }
    const suscripcionIds = await idsMarcados(client, "Suscripcion");
    if (suscripcionIds.length > 0) {
        const su = suscripcionIds;
        anotar("BonoAplicado", await contarEnLotes(su, (t) => client.bonoAplicado.count({ where: { suscripcionId: { in: t } } })));
        anotar("ScoreCliente", await contarEnLotes(su, (t) => client.scoreCliente.count({ where: { suscripcionId: { in: t } } })));
        anotar("CodigoReferidoUso", await contarEnLotes(su, (t) => client.codigoReferidoUso.count({ where: { suscripcionReferidaId: { in: t } } })));
    }

    // Lo real = todo menos lo marcado. Se cuenta ANTES para poder demostrar
    // después que no se movió (verificación del brief §7).
    //
    // SPEC-420: se cuenta con un LEFT JOIN contra el marcador, NO con
    // `notIn: [...ids]`. Un `notIn` de 9.000 ids gasta 9.000 parámetros y va
    // camino al límite de 32.767 de PostgreSQL — el mismo que reventó el
    // borrado. Así son cero parámetros, y además no hay que traerse los ids.
    const reales = await contarRealesPorEntidad(client);

    return { marcadas, derivadas, reales, intocablesExcluidos, totalMarcado };
}

/**
 * Cuenta lo REAL (= no marcado) de las entidades que se muestran en el reporte,
 * sin traer una sola lista de ids. `entidad` es un literal del código, nunca
 * entrada externa.
 */
async function contarRealesPorEntidad(client: PrismaClient): Promise<FilaConteo[]> {
    const TABLAS: Array<{ entidad: string; tabla: string }> = [
        { entidad: "Reporte", tabla: "Reporte" },
        { entidad: "Colegio", tabla: "Colegio" },
        { entidad: "AlertaColegio", tabla: "AlertaColegio" },
        { entidad: "Suscripcion", tabla: "Suscripcion" },
        { entidad: "Pago", tabla: "Pago" },
    ];
    const salida: FilaConteo[] = [];
    for (const t of TABLAS) {
        const filas = await client.$queryRaw<Array<{ n: bigint }>>`
            SELECT COUNT(*)::bigint AS n
            FROM ${Prisma.raw(`"${t.tabla}"`)} x
            LEFT JOIN demo_marcado dm
              ON dm."entidad" = ${t.entidad} AND dm."entidadId" = x.id
            WHERE dm.id IS NULL
        `;
        salida.push({ entidad: t.entidad, cantidad: Number(filas[0]?.n ?? 0) });
    }
    return salida;
}

/** Fase 1: lo que cuelga de lo marcado y no está marcado. Antes que sus padres. */
async function borrarDerivadas(
    tx: Prisma.TransactionClient,
    ids: { reporteIds: string[]; alertaIds: string[]; colegioIds: string[]; estudianteIds: string[]; suscripcionIds: string[]; pagoIds: string[] },
    borradas: Record<string, number>,
): Promise<void> {
    const suma = (k: string, n: number) => { borradas[k] = (borradas[k] ?? 0) + n; };

    // SPEC-420: TODA consulta con `in:` sobre una lista de ids va por lotes.
    // 9.000 reportes gastan 9.000 parámetros; el techo de PostgreSQL es 32.767
    // y ya nos lo comimos una vez en producción.
    if (ids.alertaIds.length > 0) {
        const porLote = await enLotes(ids.alertaIds, (t) =>
            tx.seguimientoCaso.findMany({ where: { alertaId: { in: t } }, select: { id: true } }),
        );
        const seguimientoIds = porLote.flat().map((s) => s.id);
        if (seguimientoIds.length > 0) {
            suma("NotaSeguimiento", await borrarEnLotes(seguimientoIds, (t) => tx.notaSeguimiento.deleteMany({ where: { seguimientoId: { in: t } } })));
            suma("InformeCaso", await borrarEnLotes(seguimientoIds, (t) => tx.informeCaso.deleteMany({ where: { casoId: { in: t } } })));
            suma("SeguimientoCaso", await borrarEnLotes(seguimientoIds, (t) => tx.seguimientoCaso.deleteMany({ where: { id: { in: t } } })));
        }
    }

    if (ids.reporteIds.length > 0) {
        const r = ids.reporteIds;
        suma("EmbeddingReporte", await borrarEnLotes(r, (t) => tx.embeddingReporte.deleteMany({ where: { reporteId: { in: t } } })));
        suma("FuenteReporte", await borrarEnLotes(r, (t) => tx.fuenteReporte.deleteMany({ where: { reporteId: { in: t } } })));
        suma("ReintentoReporte", await borrarEnLotes(r, (t) => tx.reintentoReporte.deleteMany({ where: { reporteId: { in: t } } })));
        suma("PasoProcesamiento", await borrarEnLotes(r, (t) => tx.pasoProcesamiento.deleteMany({ where: { reporteId: { in: t } } })));
        suma("EventoMatch", await borrarEnLotes(r, (t) => tx.eventoMatch.deleteMany({ where: { reporteNuevoId: { in: t } } })));
    }

    if (ids.colegioIds.length > 0) {
        const c = ids.colegioIds;
        suma("PatronInstitucional", await borrarEnLotes(c, (t) => tx.patronInstitucional.deleteMany({ where: { colegioId: { in: t } } })));
        suma("RegistroAvisoColegio", await borrarEnLotes(c, (t) => tx.registroAvisoColegio.deleteMany({ where: { colegioId: { in: t } } })));
    }

    if (ids.estudianteIds.length > 0) {
        suma("EstudianteObservacion", await borrarEnLotes(ids.estudianteIds, (t) => tx.estudianteObservacion.deleteMany({ where: { estudianteId: { in: t } } })));
    }

    // Comercial: lo que cuelga de la suscripción y del pago. El poblador no lo
    // crea, pero el producto sí puede haberlo creado sobre datos sembrados.
    if (ids.pagoIds.length > 0) {
        suma("BonoAplicado", await borrarEnLotes(ids.pagoIds, (t) => tx.bonoAplicado.deleteMany({ where: { pagoId: { in: t } } })));
    }
    if (ids.suscripcionIds.length > 0) {
        const su = ids.suscripcionIds;
        suma("BonoAplicado", await borrarEnLotes(su, (t) => tx.bonoAplicado.deleteMany({ where: { suscripcionId: { in: t } } })));
        suma("ScoreCliente", await borrarEnLotes(su, (t) => tx.scoreCliente.deleteMany({ where: { suscripcionId: { in: t } } })));
        suma("CodigoReferidoUso", await borrarEnLotes(su, (t) => tx.codigoReferidoUso.deleteMany({ where: { suscripcionReferidaId: { in: t } } })));
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
            await enLotes(ids, (t) =>
                tx.usuario.updateMany({
                    where: { id: { in: t } },
                    data: { colegioId: null, tenantId: null, comiteColegioId: null },
                }),
            );
        }
        if (entidad === "Curso") {
            await enLotes(ids, (t) =>
                tx.curso.updateMany({ where: { id: { in: t } }, data: { profesorTitularId: null } }),
            );
        }

        const modelo = entidad.charAt(0).toLowerCase() + entidad.slice(1);
        // @ts-expect-error — acceso dinámico al modelo Prisma; el nombre viene de
        // ENTIDADES_ORDEN_BORRADO, que el test-candado cruza contra lo que marca
        // el poblador.
        const delegado = tx[modelo];
        if (!delegado || typeof delegado.deleteMany !== "function") {
            throw new Error(`[borrado-marcado] No existe el modelo Prisma "${modelo}" para la entidad "${entidad}".`);
        }
        const borradasEntidad = await borrarEnLotes(ids, (t: string[]) =>
            delegado.deleteMany({ where: { id: { in: t } } }) as Promise<{ count: number }>,
        );
        borradas[entidad] = (borradas[entidad] ?? 0) + borradasEntidad;
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
        // SPEC-420: **acá reventó en producción.** 37.176 ids en un solo
        // `deleteMany` → "too many bind variables ... received 37176". Es la
        // lista más larga de todas porque junta las 18 entidades.
        const idsBorrados = [...porEntidad.values()].flat();
        const limpiadas = await borrarEnLotes(idsBorrados, (t) =>
            tx.demoMarcado.deleteMany({ where: { entidadId: { in: t } } }),
        );

        const total = Object.values(borradas).reduce((a, b) => a + b, 0);
        await registrarAuditoriaDemo(tx, "demo_borrar", motivo, total, {
            fuente: "demo_marcado",
            spec: "SPEC-412",
            porEntidad: borradas,
            intocablesExcluidos,
        });
        return limpiadas;
    }, { timeout: TIMEOUT_TX_MS, maxWait: 30_000 });

    return { borradas, marcadasLimpiadas, intocablesExcluidos };
}
