/**
 * SPEC-412 · la capa de casos del poblador v5 — reportes, IA, alertas, ciclo de
 * vida y comité.
 *
 * Vive aparte de `poblar-demo-v5.ts` por el techo de 500 líneas de
 * `eslint.config.mjs:41-56` sobre `scripts/**`, no por otra razón: es la
 * segunda mitad del mismo poblador y comparte sus candados.
 *
 * **Acá se cierra I-292.** El `SolicitudComite` que emite este módulo lleva un
 * `cuid()` de Prisma, así que `cuidIdSchema` (`z.string().cuid()`, regex
 * `^c[^\s-]{8,}$`) lo acepta y el caso ABRE. v3 emitía
 * `demo3-sol-demo-al-r-00127-E`: guiones y sin `c` inicial → 254 de 256 casos
 * inabribles. El validador no se toca; se arregla el dato.
 *
 * ## Las tres formas que BI necesita (CEO, 03-09-2026 16:0x)
 *  1. **Reincidencia deliberada** — el mismo nick en varios reportes, y una
 *     parte encadenada por `reportePrincipalId`. Alimenta los patrones.
 *  2. **Asignación desigual de alertas** — cada colegio recibe una fracción
 *     distinta (`fraccionAsignacionDe`). Alimenta el semáforo de capacidad.
 *  3. **Transiciones con tiempos escalonados** — se reusan `cadenaParaEstado` y
 *     `fechasEscalonadas` de `_common-v3`: esa lógica ya estaba bien y no tenía
 *     nada que ver con la falla de los ids. Alimentan embudo y latencias.
 *
 * **No se siembra ni una fila de `Pago`**: el flujo real escribe
 * `Suscripcion.montoRealPagado` y nadie escribe `Pago` fuera de fixtures
 * (verificado en fuente por el CEO). Sembrar ahí sería inventar un recaudo que
 * el producto no produce.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { cifrarTextoReporte } from "../../src/lib/texto-reporte-cifrado";
import { pick, log } from "./_common";
import { cadenaParaEstado, fechasEscalonadas } from "./_common-v3";
import { marcar, type OpcionesMarcado } from "./_marcado";
import {
    DEMO5,
    ESTADOS_ALERTA,
    PRIORIDADES_ALERTA,
    NICKS_EXTERNOS_V5,
    PESOS_CATEGORIA_V5,
    CIUDADES_DEMO4,
    elegirPonderado,
    relatoDe,
    fechaEnVentanaV5,
    fraccionAsignacionDe,
    numeroSolicitudV5,
    numeroSeguimientoV5,
    type CategoriaV5,
} from "./_common-v5";

/** Un identificador sembrado al que un reporte puede apuntar → nace la alerta. */
export interface SujetoSembrado {
    tipoSujeto: "ESTUDIANTE" | "PROFESOR" | "ACUDIENTE";
    identId: string;
    nick: string;
    plataformaId: string;
    colegioId: string;
}

/** Una ciudad del catálogo real, ya resuelta contra la BD. */
export interface CiudadResuelta {
    id: string;
    paisId: string;
    nombre: string;
    codigoPais: string;
}

interface ConteosCasos {
    reportes: number; clasificaciones: number; alertas: number;
    transiciones: number; solicitudes: number; reincidentes: number; encadenados: number;
}

export interface ArgsCasos {
    prisma: PrismaClient;
    r: () => number;
    ahora: Date;
    plataformas: { id: string }[];
    ciudades: Map<string, CiudadResuelta>;
    sujetos: SujetoSembrado[];
    /** Orden estable de colegios: el índice decide su fracción de asignación. */
    colegios: { colegioId: string; comiteId: string }[];
    conteos: ConteosCasos;
    opciones: OpcionesMarcado;
}

/** Lo que se planea para un reporte antes de que Prisma le ponga la llave. */
interface PlanReporte {
    indice: number;
    numeroSeguimiento: string;
    fecha: Date;
    estado: "CLASIFICADO" | "REVISION_MANUAL" | "POSIBLE_SPAM";
    categoria: CategoriaV5;
    sujeto: SujetoSembrado | null;
    /** El sujeto ya había sido reportado antes en esta corrida. */
    esReincidente: boolean;
    codigoCiudad: string;
    /** Índice del reporte del que este es reincidencia encadenada, si aplica. */
    indicePrincipal: number | null;
}

const LOTE = 300;

/**
 * Se planea la corrida ENTERA antes de escribir una sola fila.
 *
 * Hace falta para la reincidencia: para encadenar un reporte con el primero del
 * mismo sujeto hay que saber cuál fue el primero, y eso solo se sabe mirando
 * toda la secuencia. Como los lotes se insertan en orden de plan, cuando toca
 * escribir un encadenado la llave de su principal ya existe.
 */
function planearCorrida(args: ArgsCasos): PlanReporte[] {
    const { r, ahora, sujetos } = args;
    const plan: PlanReporte[] = [];
    const objetivoConSujeto = Math.round(DEMO5.nReportes * DEMO5.reportesASujetoDemo);

    /** Sujetos ya reportados y el índice de su PRIMER reporte. */
    const yaReportados: SujetoSembrado[] = [];
    const primerReporteDe = new Map<string, number>();

    for (let n = 0; n < DEMO5.nReportes; n++) {
        const conSujeto = n < objetivoConSujeto && sujetos.length > 0;
        const { categoria } = elegirPonderado(r, PESOS_CATEGORIA_V5);
        const esSpam = categoria === "SPAM";
        const esRevision = !esSpam && r() < 0.06;

        let sujeto: SujetoSembrado | null = null;
        let indicePrincipal: number | null = null;
        let esReincidente = false;
        if (conSujeto) {
            const reincide = yaReportados.length > 0 && r() < DEMO5.reincidenciaPct;
            sujeto = reincide ? pick(r, yaReportados) : pick(r, sujetos);
            const primero = primerReporteDe.get(sujeto.identId);
            if (primero === undefined) {
                primerReporteDe.set(sujeto.identId, n);
                yaReportados.push(sujeto);
            } else {
                esReincidente = true;
                if (r() < DEMO5.cadenaPct) indicePrincipal = primero;
            }
        }

        plan.push({
            indice: n,
            numeroSeguimiento: numeroSeguimientoV5(r),
            fecha: fechaEnVentanaV5(r, ahora),
            estado: esSpam ? "POSIBLE_SPAM" : esRevision ? "REVISION_MANUAL" : "CLASIFICADO",
            categoria,
            sujeto,
            esReincidente,
            codigoCiudad: pick(r, CIUDADES_DEMO4),
            indicePrincipal,
        });
    }
    return plan;
}

function filaReporte(
    p: PlanReporte,
    args: ArgsCasos,
    idPorIndice: Map<number, string>,
): Prisma.ReporteCreateManyInput {
    const { r, plataformas, ciudades } = args;
    const [codigoPais = "CO", nombreCiudad = ""] = p.codigoCiudad.split(":");
    const ciudad = ciudades.get(p.codigoCiudad);
    const texto = relatoDe(r, p.categoria);
    // El principal siempre se planeó ANTES que este reporte, así que su llave ya
    // está en el mapa salvo que ambos hayan caído en el mismo lote; en ese caso
    // el reporte queda suelto, que es un dato válido, no uno inventado.
    const principal = p.indicePrincipal !== null ? idPorIndice.get(p.indicePrincipal) ?? null : null;

    return {
        identificador: p.sujeto?.nick ?? pick(r, NICKS_EXTERNOS_V5),
        plataformaId: p.sujeto?.plataformaId ?? pick(r, plataformas).id,
        texto: cifrarTextoReporte(texto),
        textoOriginal: null,
        fechaIncidente: p.fecha,
        ciudad: ciudad?.nombre ?? nombreCiudad,
        pais: codigoPais,
        paisId: ciudad?.paisId ?? null,
        ciudadId: ciudad?.id ?? null,
        estado: p.estado,
        esAnonimo: r() < 0.6,
        edadVictima: 10 + Math.floor(r() * 8),
        numeroSeguimiento: p.numeroSeguimiento,
        reportePrincipalId: principal,
        prioridadAlta: p.categoria !== "SPAM" && r() < 0.05,
        keywordsDetectadas: [],
        esRafaga: false,
        fuenteConfianza: 0.4 + r() * 0.6,
        eliminado: false,
        creadoEn: p.fecha,
        actualizadoEn: p.fecha,
    };
}

type AlertaCreada = {
    id: string; reporteId: string; colegioId: string;
    estado: string; asignadoAId: string | null; creadoEn: Date;
};

/**
 * Un lote completo: reportes → clasificaciones → alertas → transiciones →
 * solicitudes del comité. Todo en una transacción, y cada bloque marcado
 * inmediatamente después de crearse.
 */
async function sembrarLote(
    args: ArgsCasos,
    lote: PlanReporte[],
    idPorIndice: Map<number, string>,
): Promise<void> {
    const { prisma, r, ahora, conteos, opciones } = args;

    await prisma.$transaction(async (tx) => {
        // ── Reportes ────────────────────────────────────────────────────────
        // `numeroSeguimiento` es @unique: sirve de clave de negocio para volver
        // a encontrar la fila sin depender del orden en que Prisma las devuelva.
        const creados = await tx.reporte.createManyAndReturn({
            data: lote.map((p) => filaReporte(p, args, idPorIndice)),
            select: { id: true, numeroSeguimiento: true },
        });
        await marcar(tx, "Reporte", creados.map((c) => c.id), opciones);
        conteos.reportes += creados.length;

        const idPorNumero = new Map(creados.map((c) => [c.numeroSeguimiento ?? "", c.id]));
        // Se recupera la llave que puso Prisma; no se fabrica ninguna. El campo
        // se llama `reporteId` y no `id` para que quede obvio de dónde salió.
        const conId = lote
            .map((p) => ({ plan: p, reporteId: idPorNumero.get(p.numeroSeguimiento) }))
            .filter((x): x is { plan: PlanReporte; reporteId: string } => Boolean(x.reporteId));
        for (const { plan: p, reporteId } of conId) idPorIndice.set(p.indice, reporteId);

        // ── Clasificación IA · DIRECTA (candado R16: ni pg-boss ni Ollama) ───
        const clasifs = await tx.clasificacionIA.createManyAndReturn({
            data: conId.map(({ plan: p, reporteId }) => ({
                reporteId,
                categoria: p.categoria as never,
                confianza: p.categoria === "SPAM" ? 0.6 + r() * 0.35 : 0.55 + r() * 0.44,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "demo-seed-412",
                latenciaMs: 0,
                usoCascada: false,
                posibleAgresorPar: false,
                creadoEn: p.fecha,
            })),
            select: { id: true },
        });
        await marcar(tx, "ClasificacionIA", clasifs.map((c) => c.id), opciones);
        conteos.clasificaciones += clasifs.length;

        await sembrarAlertasYComite(tx, conId, args);

        // ── Ciclo de vida ───────────────────────────────────────────────────
        const transiciones: Prisma.TransicionReporteCreateManyInput[] = [];
        for (const { plan: p, reporteId } of conId) {
            const pasos = cadenaParaEstado(p.estado, r);
            const fechas = fechasEscalonadas(p.fecha, pasos, ahora);
            pasos.forEach((paso, i) => {
                transiciones.push({
                    reporteId,
                    estadoAnterior: paso.estadoAnterior,
                    estadoNuevo: paso.estadoNuevo,
                    responsableTipo: paso.responsableTipo,
                    motivo: paso.motivo,
                    creadoEn: fechas[i],
                });
            });
        }
        if (transiciones.length > 0) {
            const creadas = await tx.transicionReporte.createManyAndReturn({
                data: transiciones,
                select: { id: true },
            });
            await marcar(tx, "TransicionReporte", creadas.map((t) => t.id), opciones);
            conteos.transiciones += creadas.length;
        }
    });
}

/**
 * Alertas del colegio con **asignación desigual** por colegio, y el comité que
 * nace de las escaladas.
 */
async function sembrarAlertasYComite(
    tx: Prisma.TransactionClient,
    conId: { plan: PlanReporte; reporteId: string }[],
    args: ArgsCasos,
): Promise<void> {
    const { r, colegios, conteos, opciones } = args;
    const paraAlerta = conId.filter(({ plan: p }) => p.sujeto && p.estado === "CLASIFICADO");
    if (paraAlerta.length === 0) return;

    // El índice del colegio en la lista decide su fracción: uno casi al tope,
    // otro a la mitad, otro casi libre — así el semáforo de BI muestra los tres.
    const comitePorColegio = new Map(colegios.map((c) => [c.colegioId, c.comiteId]));
    const fraccionPorColegio = new Map(colegios.map((c, i) => [c.colegioId, fraccionAsignacionDe(i)]));

    const alertas = await tx.alertaColegio.createManyAndReturn({
        data: paraAlerta.map(({ plan: p, reporteId }) => {
            const s = p.sujeto as SujetoSembrado;
            const estado = pick(r, ESTADOS_ALERTA);
            const asignar = estado !== "cerrada" && r() < (fraccionPorColegio.get(s.colegioId) ?? 0.7);
            return {
                colegioId: s.colegioId,
                reporteId,
                tipoSujeto: s.tipoSujeto,
                identificadorEstudianteId: s.tipoSujeto === "ESTUDIANTE" ? s.identId : null,
                identificadorProfesorId: s.tipoSujeto === "PROFESOR" ? s.identId : null,
                identificadorAcudienteId: s.tipoSujeto === "ACUDIENTE" ? s.identId : null,
                estado,
                prioridad: pick(r, PRIORIDADES_ALERTA),
                vencimientoSla: new Date(p.fecha.getTime() + 48 * 3600 * 1000),
                asignadoAId: asignar ? (comitePorColegio.get(s.colegioId) ?? null) : null,
                creadoEn: p.fecha,
                actualizadoEn: p.fecha,
            };
        }),
        select: { id: true, reporteId: true, colegioId: true, estado: true, asignadoAId: true, creadoEn: true },
    });
    await marcar(tx, "AlertaColegio", alertas.map((a) => a.id), opciones);
    conteos.alertas += alertas.length;

    await sembrarComite(tx, alertas, comitePorColegio, args);
}

/**
 * El comité, que es lo que hoy está roto en producción.
 *
 * Cada alerta "escalada" recibe su `SolicitudComite`, como hace el flujo real
 * (`comite-convivencia-bandeja.ts:216-225`): unas PENDIENTE, otras RESUELTA — y
 * al resolver, la alerta pasa a "gestionada".
 *
 * Dos cosas que v3 hacía mal y acá quedan bien:
 *  · el `id` lo pone Prisma (`cuid()`), así que el caso ABRE;
 *  · el `numero` lleva la forma real `SOL-` + 8 hex, y `creadoPorId` apunta
 *    SIEMPRE al usuario del comité de ESE colegio, no a `null`.
 */
async function sembrarComite(
    tx: Prisma.TransactionClient,
    alertas: AlertaCreada[],
    comitePorColegio: Map<string, string>,
    args: ArgsCasos,
): Promise<void> {
    const { r, ahora, conteos, opciones } = args;
    const escaladas = alertas.filter((a) => a.estado === "escalada");
    if (escaladas.length === 0) return;

    const aGestionada: string[] = [];
    const filas: Prisma.SolicitudComiteCreateManyInput[] = [];
    const numerosUsados = new Set<string>();

    for (const a of escaladas) {
        let numero = numeroSolicitudV5(r);
        while (numerosUsados.has(numero)) numero = numeroSolicitudV5(r);
        numerosUsados.add(numero);

        const creadoEn = new Date(Math.min(a.creadoEn.getTime() + (2 + r() * 48) * 3_600_000, ahora.getTime()));
        const pendiente = r() < DEMO5.fraccionSolicitudesPendientes;
        filas.push({
            reporteId: a.reporteId,
            numero,
            estado: pendiente ? "PENDIENTE" : "RESUELTA",
            colegioId: a.colegioId,
            alertaColegioId: a.id,
            creadoPorId: a.asignadoAId ?? comitePorColegio.get(a.colegioId) ?? null,
            motivo: "Escalado al comité de convivencia por la gravedad del caso (dato sembrado).",
            resolucion: pendiente
                ? null
                : "Caso atendido por el comité: se activó el protocolo y se citó a la familia (dato sembrado).",
            creadoEn,
            resueltoEn: pendiente
                ? null
                : new Date(Math.min(creadoEn.getTime() + (24 + r() * 240) * 3_600_000, ahora.getTime())),
        });
        if (!pendiente) aGestionada.push(a.id);
    }

    const creadas = await tx.solicitudComite.createManyAndReturn({ data: filas, select: { id: true } });
    await marcar(tx, "SolicitudComite", creadas.map((s) => s.id), opciones);
    conteos.solicitudes += creadas.length;

    if (aGestionada.length > 0) {
        // Mismo movimiento que hace el flujo real al resolver. El `where` va
        // acotado a los ids que ACABAMOS de crear en esta transacción: ninguna
        // alerta real puede calzar.
        await tx.alertaColegio.updateMany({
            where: { id: { in: aGestionada }, estado: "escalada" },
            data: { estado: "gestionada" },
        });
    }
}

export async function sembrarCasos(args: ArgsCasos): Promise<void> {
    const plan = planearCorrida(args);
    args.conteos.reincidentes = plan.filter((p) => p.esReincidente).length;
    args.conteos.encadenados = plan.filter((p) => p.indicePrincipal !== null).length;

    const idPorIndice = new Map<number, string>();
    for (let base = 0; base < plan.length; base += LOTE) {
        await sembrarLote(args, plan.slice(base, base + LOTE), idPorIndice);
        const hasta = Math.min(base + LOTE, plan.length);
        log(
            "poblar-v5",
            `casos ${hasta}/${plan.length} — r=${args.conteos.reportes} al=${args.conteos.alertas} ` +
            `tr=${args.conteos.transiciones} comité=${args.conteos.solicitudes}`,
        );
    }
}
