/**
 * SPEC-412 · la capa comercial del poblador v5 — planes, suscripciones y pagos.
 *
 * ## ⚠️ Nota que NO se puede perder (CEO, 03-09-2026 16:1x)
 *
 * **Ningún camino de producción escribe `Pago`. Verificado en fuente: solo
 * fixtures.** El flujo real es la activación manual del admin
 * (`admin-activacion-manual.service.ts:199`), que escribe
 * `Suscripcion.montoRealPagado` en COP y no crea fila de `Pago`.
 *
 * Acá se siembra `Pago` **para que BI pueda ejercitar su tablero comercial**,
 * por decisión de Jelkin — no porque el producto llene esa tabla. Que nadie
 * concluya mañana, mirando estos datos, que el recaudo real sale de ahí.
 *
 * ## Que las dos fuentes cuenten la misma historia
 *
 * `Suscripcion.montoRealPagado` = suma de los `Pago` **AUTORIZADO** de esa
 * suscripción, en la misma moneda local (COP), como haría el admin al registrar
 * la activación. Los pagos PENDIENTE_AUTORIZACION y RECHAZADO existen para dar
 * variedad de estados y **no suman**, igual que en la vida real.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { pick, log } from "./_common";
import { marcar, type OpcionesMarcado } from "./_marcado";
import { DEMO5 } from "./_common-v5";

/** Tasa de cambio ficticia y estable — la corrida tiene que ser reproducible. */
const TASA_COP = 4000;
const MONEDA = "COP";
const METODOS = ["TRANSFERENCIA", "NEQUI", "DAVIPLATA", "PSE_MANUAL", "EFECTIVO"] as const;

/** Los planes que la siembra necesita. Se crean solo si faltan. */
const PLANES_REQUERIDOS = [
    { tipoTitular: "COLEGIO", duracion: "MES_12", precioBaseUSD: 1200, nombre: "Colegio · anual" },
    { tipoTitular: "COLEGIO", duracion: "MES_6", precioBaseUSD: 700, nombre: "Colegio · semestral" },
    { tipoTitular: "PADRE", duracion: "MES_12", precioBaseUSD: 60, nombre: "Familia · anual" },
    { tipoTitular: "PADRE", duracion: "MES_1", precioBaseUSD: 7, nombre: "Familia · mensual" },
] as const;

export interface PlanUsable {
    id: string;
    tipoTitular: "COLEGIO" | "PADRE";
    duracion: "MES_1" | "MES_2" | "MES_3" | "MES_6" | "MES_12";
    precioBaseUSD: number;
}

export interface ConteosComerciales {
    planesCreados: number;
    suscripciones: number;
    pagos: number;
    pagosAutorizados: number;
}

/**
 * Deja disponibles los planes que la siembra usa. **Reusa los que ya están
 * configurados** (orden del CEO) y crea únicamente los que falten — esos sí,
 * marcados, para que el borrado se los lleve.
 */
export async function asegurarPlanes(
    prisma: PrismaClient,
    anio: number,
    conteos: ConteosComerciales,
    opciones: OpcionesMarcado,
): Promise<PlanUsable[]> {
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" }, select: { id: true } });
    if (!admin) throw new Error("[poblar-v5] No hay usuario ADMIN — corre el seed antes (Plan.creadoPorAdminId lo exige).");

    const usables: PlanUsable[] = [];
    for (const req of PLANES_REQUERIDOS) {
        const existente = await prisma.plan.findUnique({
            where: { tipoTitular_duracion_anio: { tipoTitular: req.tipoTitular, duracion: req.duracion, anio } },
            select: { id: true, precioBaseUSD: true, activo: true },
        });
        if (existente) {
            usables.push({ ...req, id: existente.id });
            continue;
        }
        const creado = await prisma.$transaction(async (tx) => {
            const p = await tx.plan.create({
                data: {
                    nombre: `${req.nombre} ${anio} (${DEMO5.etiquetaHumana})`,
                    tipoTitular: req.tipoTitular,
                    duracion: req.duracion,
                    anio,
                    precioBaseUSD: req.precioBaseUSD,
                    precioBaseCOP: req.precioBaseUSD * TASA_COP,
                    // `precio` es legacy y el schema lo marca opcional, pero la
                    // columna sigue siendo NOT NULL en la migración inicial
                    // (`20260712162345_init:99`). Se llena con el mismo valor.
                    precio: req.precioBaseUSD,
                    activo: true,
                    creadoPorAdminId: admin.id,
                },
                select: { id: true },
            });
            await marcar(tx, "Plan", [p.id], { ...opciones, notas: "plan que faltaba para la siembra" });
            return p;
        });
        conteos.planesCreados++;
        usables.push({ ...req, id: creado.id });
    }
    log("poblar-v5", `planes usables: ${usables.length} (creados por faltar: ${conteos.planesCreados})`);
    return usables;
}

function mesesDe(duracion: PlanUsable["duracion"]): number {
    return Number(duracion.replace("MES_", ""));
}

interface FilaPago {
    suscripcionId: string;
    plan: PlanUsable;
    estado: "AUTORIZADO" | "PENDIENTE_AUTORIZACION" | "RECHAZADO";
    fecha: Date;
}

function datosPago(f: FilaPago, r: () => number, adminId: string): Prisma.PagoCreateManyInput {
    const descuentoUSD = r() < 0.25 ? Math.round(f.plan.precioBaseUSD * 0.1) : 0;
    const netoUSD = f.plan.precioBaseUSD - descuentoUSD;
    const autorizado = f.estado === "AUTORIZADO";
    return {
        suscripcionId: f.suscripcionId,
        duracionCubierta: f.plan.duracion,
        montoBaseUSD: f.plan.precioBaseUSD,
        descuentoAplicadoUSD: descuentoUSD,
        montoNetoUSD: netoUSD,
        tasaCambioAplicada: TASA_COP,
        montoLocalPagado: netoUSD * TASA_COP,
        monedaLocal: MONEDA,
        metodoDeclarado: pick(r, METODOS),
        // Comprobante sintético y evidentemente falso: no hay archivo detrás.
        comprobanteAdjuntoUrl: `https://comprobantes.invalido/demo/${f.suscripcionId}.pdf`,
        comprobanteMimeType: "application/pdf",
        comprobanteHashSha256: "0".repeat(64),
        fechaReporte: f.fecha,
        fechaAutorizacion: autorizado ? new Date(f.fecha.getTime() + 24 * 3600 * 1000) : null,
        estado: f.estado,
        motivoRechazo: f.estado === "RECHAZADO" ? "Comprobante ilegible (dato sembrado)." : null,
        autorizadoPorAdminId: autorizado ? adminId : null,
        notasCliente: null,
        createdAt: f.fecha,
        updatedAt: f.fecha,
    };
}

export interface ArgsComercial {
    prisma: PrismaClient;
    r: () => number;
    ahora: Date;
    adminId: string;
    /** Suscripciones ya sembradas, con el plan que les tocó. */
    suscripciones: { suscripcionId: string; plan: PlanUsable; fechaInicio: Date }[];
    conteos: ConteosComerciales;
    opciones: OpcionesMarcado;
}

/**
 * Un pago AUTORIZADO por suscripción (el que sostiene `montoRealPagado`), más
 * una minoría de pagos en otros estados para que el tablero comercial tenga los
 * tres colores. Al final se cuadra la suscripción con la suma de lo autorizado.
 */
export async function sembrarPagos(args: ArgsComercial): Promise<void> {
    const { prisma, r, ahora, adminId, suscripciones, conteos, opciones } = args;
    if (suscripciones.length === 0) return;

    const LOTE = 200;
    for (let base = 0; base < suscripciones.length; base += LOTE) {
        const trozo = suscripciones.slice(base, base + LOTE);

        await prisma.$transaction(async (tx) => {
            const filas: FilaPago[] = [];
            for (const s of trozo) {
                const meses = mesesDe(s.plan.duracion);
                const fechaPago = new Date(Math.min(s.fechaInicio.getTime() + r() * 3 * 24 * 3600 * 1000, ahora.getTime()));
                filas.push({ suscripcionId: s.suscripcionId, plan: s.plan, estado: "AUTORIZADO", fecha: fechaPago });

                // ~20 % arrastra además un pago no autorizado: da variedad de
                // estado sin mover el monto real (solo AUTORIZADO cuenta).
                if (r() < 0.2) {
                    const extra = r() < 0.5 ? "PENDIENTE_AUTORIZACION" : "RECHAZADO";
                    const fechaExtra = new Date(Math.min(fechaPago.getTime() + meses * 30 * 24 * 3600 * 1000, ahora.getTime()));
                    filas.push({ suscripcionId: s.suscripcionId, plan: s.plan, estado: extra, fecha: fechaExtra });
                }
            }

            const creados = await tx.pago.createManyAndReturn({
                data: filas.map((f) => datosPago(f, r, adminId)),
                select: { id: true, suscripcionId: true, estado: true, montoLocalPagado: true, fechaAutorizacion: true },
            });
            await marcar(tx, "Pago", creados.map((p) => p.id), opciones);
            conteos.pagos += creados.length;
            conteos.pagosAutorizados += creados.filter((p) => p.estado === "AUTORIZADO").length;

            // Cuadre: la suscripción cuenta EXACTAMENTE lo que suman sus pagos
            // autorizados. Dos fuentes, una sola historia.
            const porSuscripcion = new Map<string, { monto: number; fecha: Date | null }>();
            for (const p of creados) {
                if (p.estado !== "AUTORIZADO") continue;
                const acc = porSuscripcion.get(p.suscripcionId) ?? { monto: 0, fecha: null };
                acc.monto += p.montoLocalPagado;
                acc.fecha = p.fechaAutorizacion ?? acc.fecha;
                porSuscripcion.set(p.suscripcionId, acc);
            }
            for (const [suscripcionId, acc] of porSuscripcion) {
                await tx.suscripcion.update({
                    where: { id: suscripcionId },
                    data: {
                        montoRealPagado: acc.monto,
                        fechaPagoReal: acc.fecha,
                        metodoPagoManual: "TRANSFERENCIA_BANCARIA",
                        referenciaPagoManual: `REF-D5-${suscripcionId.slice(-8).toUpperCase()}`,
                        autorizadoPorAdminId: adminId,
                        autorizadoEn: acc.fecha,
                        origen: "ACTIVADA_MANUAL_ADMIN",
                    },
                });
            }
        });

        log("poblar-v5", `pagos ${Math.min(base + LOTE, suscripciones.length)}/${suscripciones.length} — total=${conteos.pagos} autorizados=${conteos.pagosAutorizados}`);
    }
}

/**
 * Contraste posterior: por cada suscripción sembrada, `montoRealPagado` tiene
 * que ser igual a la suma de sus pagos AUTORIZADO. Se corre al final del
 * poblador y se reporta; si no cuadra, el dato de BI estaría mintiendo.
 */
export async function verificarCuadre(
    prisma: PrismaClient,
    suscripcionIds: string[],
): Promise<{ cuadran: number; descuadran: number }> {
    let cuadran = 0;
    let descuadran = 0;
    for (let i = 0; i < suscripcionIds.length; i += 500) {
        const trozo = suscripcionIds.slice(i, i + 500);
        const suscripciones = await prisma.suscripcion.findMany({
            where: { id: { in: trozo } },
            select: { id: true, montoRealPagado: true, pagos: { where: { estado: "AUTORIZADO" }, select: { montoLocalPagado: true } } },
        });
        for (const s of suscripciones) {
            const suma = s.pagos.reduce((a, p) => a + p.montoLocalPagado, 0);
            if (Math.abs((s.montoRealPagado ?? 0) - suma) < 0.01) cuadran++;
            else descuadran++;
        }
    }
    return { cuadran, descuadran };
}
