/**
 * CANDADO · SPEC-752 (D-121 de Datos) — la BD garantiza el contrato de `PeticionServicio`. Prisma es
 * ciego al CHECK: esto prueba la CONDUCTA contra Postgres (inserción/borrado/actualización reales).
 *
 *   (1) CHECK venceEn > creadoEn (23514): el reloj interno no puede faltar ni ir al revés.
 *   (2) usuarioId Cascade: borrar la cuenta borra sus peticiones (la PQR cuelga del usuario, in-app).
 *   (3) solicitudHabeasDataId @unique (23505): una SolicitudHabeasData la dispara UNA sola PQR.
 *   (4) ENLACE del lado de la PQR — el punto fino: borrar la cuenta borra la PQR (Cascade) pero la
 *       SolicitudHabeasData enlazada SOBREVIVE como prueba (no se huérfana ni se arrastra).
 *   (5) la bandeja DERIVA, no COPIA (condición de salida que venía como it.todo en SPEC-788): mutar el
 *       venceEn de la solicitud enlazada mueve la urgencia legal LEÍDA por la PQR — porque la lee por el
 *       enlace, no de una copia. Sin este candado la pieza del enlace quedaba incompleta.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";

let contador = 0;
const uniq = (p: string) => `${p}-752-${Date.now()}-${contador++}`;

const CREADO = new Date("2026-09-01T12:00:00Z");
const VENCE = new Date("2026-09-08T12:00:00Z"); // > CREADO (término interno ~5 hábiles)
const RECIBIDO = new Date("2026-09-01T12:00:00Z");
const SOL_VENCE = new Date("2026-09-15T12:00:00Z"); // > RECIBIDO (CHECK de 772)

/** SolicitudHabeasData mínima y VÁLIDA (respeta los CHECK de SPEC-772: eje de sujeto, plazo, venceEn). */
function crearSolicitud(venceEn: Date = SOL_VENCE) {
    return prisma.solicitudHabeasData.create({
        data: { tipo: "CONSULTA", calidad: "TITULAR_CUENTA", plazoDias: 10, recibidoEn: RECIBIDO, venceEn, origen: "APLICACION" },
    });
}

async function nuevoPadre() {
    return crearUsuario("PARENT", `${uniq("padre")}@test.local`);
}

/** Cadena comercial real: padre (dueño) + admin + Plan + Suscripcion + Pago (para el enlace de reversión). */
async function seedPagoConPadre() {
    const padre = await nuevoPadre();
    const admin = await crearUsuario("ADMIN", `${uniq("admin")}@test.local`);
    const plan = await prisma.plan.create({
        data: { tipoTitular: "PADRE", duracion: "MES_1", anio: 2026, nombre: uniq("Plan"), precioBaseUSD: 10, precio: 0, creadoPorAdminId: admin.id },
    });
    const suscripcion = await prisma.suscripcion.create({
        data: {
            tipoTitular: "PADRE",
            usuarioId: padre.id,
            estado: "ACTIVA",
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: uniq("REF"),
        },
    });
    const pago = await prisma.pago.create({
        data: {
            suscripcionId: suscripcion.id,
            duracionCubierta: "MES_1",
            montoBaseUSD: 10,
            montoNetoUSD: 10,
            tasaCambioAplicada: 4000,
            montoLocalPagado: 40000,
            monedaLocal: "COP",
            metodoDeclarado: "TRANSFERENCIA",
            comprobanteAdjuntoUrl: "https://example.com/c.pdf",
            comprobanteMimeType: "application/pdf",
            comprobanteHashSha256: uniq("hash"),
            fechaReporte: new Date(),
            estado: "AUTORIZADO",
        },
    });
    return { padre, pago };
}

function detalleError(err: unknown): string {
    return `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
}

async function esperarRechazo(promesa: Promise<unknown>): Promise<string> {
    let err: unknown;
    try {
        await promesa;
    } catch (e) {
        err = e;
    }
    expect(err, "la BD DEBE rechazar esto: si pasa, la restricción ya no está").toBeDefined();
    return detalleError(err);
}

describe("SPEC-752 · CHECK venceEn > creadoEn (23514)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("venceEn <= creadoEn → rechazo (23514)", async () => {
        const padre = await nuevoPadre();
        const detalle = await esperarRechazo(
            prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "CITA", creadoEn: VENCE, venceEn: CREADO } }),
        );
        expect(detalle).toMatch(/23514|PeticionServicio_vence_gt_creado_check/);
    });

    it("venceEn > creadoEn → pasa", async () => {
        const padre = await nuevoPadre();
        const p = await prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "CITA", creadoEn: CREADO, venceEn: VENCE } });
        expect(p.id).toBeTruthy();
    });
});

describe("SPEC-752 · FKs: usuarioId Cascade · enlace del lado de la PQR", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("borrar la cuenta BORRA sus peticiones (usuarioId Cascade)", async () => {
        const padre = await nuevoPadre();
        await prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "OTRA", creadoEn: CREADO, venceEn: VENCE } });
        expect(await prisma.peticionServicio.count({ where: { usuarioId: padre.id } })).toBe(1);
        await prisma.usuario.delete({ where: { id: padre.id } });
        expect(await prisma.peticionServicio.count({ where: { usuarioId: padre.id } })).toBe(0);
    });

    it("una SolicitudHabeasData la dispara UNA sola PQR (@unique → 23505)", async () => {
        const sol = await crearSolicitud();
        const padreA = await nuevoPadre();
        const padreB = await nuevoPadre();
        await prisma.peticionServicio.create({ data: { usuarioId: padreA.id, motivo: "DATOS_PERSONALES", creadoEn: CREADO, venceEn: VENCE, solicitudHabeasDataId: sol.id } });
        const detalle = await esperarRechazo(
            prisma.peticionServicio.create({ data: { usuarioId: padreB.id, motivo: "DATOS_PERSONALES", creadoEn: CREADO, venceEn: VENCE, solicitudHabeasDataId: sol.id } }),
        );
        expect(detalle).toMatch(/23505|PeticionServicio_solicitudHabeasDataId_key|Unique/i);
    });

    it("borrar la cuenta borra la PQR, pero la SolicitudHabeasData enlazada SOBREVIVE (prueba durable)", async () => {
        const sol = await crearSolicitud();
        const padre = await nuevoPadre();
        const pqr = await prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "DATOS_PERSONALES", creadoEn: CREADO, venceEn: VENCE, solicitudHabeasDataId: sol.id } });

        await prisma.usuario.delete({ where: { id: padre.id } });

        expect(await prisma.peticionServicio.findUnique({ where: { id: pqr.id } }), "la PQR se fue con la cuenta (Cascade)").toBeNull();
        const solViva = await prisma.solicitudHabeasData.findUnique({ where: { id: sol.id } });
        expect(solViva, "la SolicitudHabeasData DEBE sobrevivir — es la prueba legal").not.toBeNull();
    });
});

describe("SPEC-752 · la bandeja DERIVA, no COPIA (condición de salida de SPEC-788)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("mutar el venceEn de la solicitud enlazada mueve la urgencia legal LEÍDA por la PQR (no hay copia)", async () => {
        const sol = await crearSolicitud(SOL_VENCE);
        const padre = await nuevoPadre();
        const pqr = await prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "DATOS_PERSONALES", creadoEn: CREADO, venceEn: VENCE, solicitudHabeasDataId: sol.id } });

        // La urgencia legal se LEE por el enlace (join), no de una columna propia de la PQR.
        const antes = await prisma.peticionServicio.findUnique({ where: { id: pqr.id }, include: { solicitudHabeasData: true } });
        expect(antes?.solicitudHabeasData?.venceEn?.toISOString()).toBe(SOL_VENCE.toISOString());

        // Mover el reloj legal en su ÚNICA fuente (la solicitud).
        const nuevoVence = new Date("2026-09-20T12:00:00Z"); // > recibidoEn (respeta el CHECK de 772)
        await prisma.solicitudHabeasData.update({ where: { id: sol.id }, data: { venceEn: nuevoVence } });

        // La PQR refleja el NUEVO valor — porque deriva, no porque guarde copia.
        const despues = await prisma.peticionServicio.findUnique({ where: { id: pqr.id }, include: { solicitudHabeasData: true } });
        expect(despues?.solicitudHabeasData?.venceEn?.toISOString(), "la bandeja deriva: ve el nuevo venceEn, no un valor viejo").toBe(nuevoVence.toISOString());
        // Y la PQR NO tiene una columna propia que haya quedado desincronizada: su `venceEn` es el INTERNO, no el legal.
        expect(despues?.venceEn?.toISOString(), "el venceEn propio de la PQR es el INTERNO, intacto — no una copia del legal").toBe(VENCE.toISOString());
    });
});

describe("SPEC-752 · enlace al PAGO de reversión (@unique · durabilidad · DERIVA no copia)", { timeout: 30_000 }, () => {
    const REEMB_SOLIC = new Date("2026-09-02T12:00:00Z");
    const REEMB_VENCE = new Date("2026-09-23T12:00:00Z"); // > REEMB_SOLIC (respeta el CHECK de 788)

    beforeEach(async () => {
        await resetDatabase();
    });

    /** Un Pago con el ancla de reversión ya fijada (SPEC-788). */
    async function pagoConAncla() {
        const { padre, pago } = await seedPagoConPadre();
        await prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: REEMB_SOLIC, reembolsoVenceEn: REEMB_VENCE } });
        return { padre, pago };
    }

    it("un Pago lo reclama UNA sola PQR (@unique → 23505)", async () => {
        const { padre, pago } = await pagoConAncla();
        const padreB = await nuevoPadre();
        await prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "PAGO_O_COBRO", creadoEn: CREADO, venceEn: VENCE, pagoId: pago.id } });
        const detalle = await esperarRechazo(
            prisma.peticionServicio.create({ data: { usuarioId: padreB.id, motivo: "PAGO_O_COBRO", creadoEn: CREADO, venceEn: VENCE, pagoId: pago.id } }),
        );
        expect(detalle).toMatch(/23505|PeticionServicio_pagoId_key|Unique/i);
    });

    it("borrar la cuenta borra la PQR, pero el Pago SOBREVIVE (prueba durable)", async () => {
        const { padre, pago } = await pagoConAncla();
        const pqr = await prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "PAGO_O_COBRO", creadoEn: CREADO, venceEn: VENCE, pagoId: pago.id } });
        await prisma.usuario.delete({ where: { id: padre.id } });
        expect(await prisma.peticionServicio.findUnique({ where: { id: pqr.id } }), "la PQR se fue con la cuenta (Cascade)").toBeNull();
        expect(await prisma.pago.findUnique({ where: { id: pago.id } }), "el Pago DEBE sobrevivir — es la prueba (retención comercial)").not.toBeNull();
    });

    it("mutar Pago.reembolsoVenceEn mueve la urgencia LEÍDA por la PQR (cierra la otra mitad del it.todo de SPEC-788)", async () => {
        const { padre, pago } = await pagoConAncla();
        const pqr = await prisma.peticionServicio.create({ data: { usuarioId: padre.id, motivo: "PAGO_O_COBRO", creadoEn: CREADO, venceEn: VENCE, pagoId: pago.id } });

        const antes = await prisma.peticionServicio.findUnique({ where: { id: pqr.id }, include: { pago: true } });
        expect(antes?.pago?.reembolsoVenceEn?.toISOString()).toBe(REEMB_VENCE.toISOString());

        const nuevoVence = new Date("2026-09-25T12:00:00Z"); // > reembolsoSolicitadoEn (CHECK de 788)
        await prisma.pago.update({ where: { id: pago.id }, data: { reembolsoVenceEn: nuevoVence } });

        const despues = await prisma.peticionServicio.findUnique({ where: { id: pqr.id }, include: { pago: true } });
        expect(despues?.pago?.reembolsoVenceEn?.toISOString(), "la bandeja deriva de Pago: ve el nuevo venceEn, no un valor viejo").toBe(nuevoVence.toISOString());
        expect(despues?.venceEn?.toISOString(), "el venceEn propio de la PQR es el INTERNO, intacto").toBe(VENCE.toISOString());
    });
});
