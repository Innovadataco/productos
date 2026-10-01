/**
 * CANDADO · SPEC-788 (dictamen D-121 de Datos) — el ancla LEGAL del reclamo de reversión del pago
 * (Dto 1074/2015) vive en `Pago` y sobrevive al borrado de la cuenta. Prisma es CIEGO al CHECK y al
 * TRIGGER: esto prueba la CONDUCTA contra Postgres (inserción/actualización/borrado reales).
 *
 *   (1) INMUTABILIDAD (trigger): fijar `reembolsoSolicitadoEn` una vez ENTRA (NULL→valor); cambiarlo o
 *       anularlo (valor→otro / valor→NULL) LANZA. Es el ancla y la prueba del término.
 *   (2) CHECK de coherencia (23514), en las dos direcciones: el par (ancla, vencimiento) es todo-o-nada
 *       y venceEn > solicitadoEn. Prueba por operación real; único custodio del CHECK.
 *   (3) SUPERVIVENCIA AL BORRADO — el punto entero de la pieza: se fija el ancla, se borra la cuenta del
 *       padre, y el `Pago` (con su ancla) SIGUE AHÍ. Vive con el registro comercial, no con la cuenta.
 *   (4) [exit-condition, viaja con SPEC-752] «la bandeja DERIVA, no copia»: it.todo — necesita el enlace
 *       PeticionServicio→Pago, que NACE en 752 (su dirección se decide allá, no acá).
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";

let contador = 0;
const uniq = (p: string) => `${p}-788-${Date.now()}-${contador++}`;

const SOLICITADO = new Date("2026-09-01T12:00:00Z");
const VENCE = new Date("2026-09-22T12:00:00Z"); // > SOLICITADO (15 hábiles ~ 21 corridos)

/** Cadena mínima real: padre (PARENT) + admin + Plan + Suscripcion(usuarioId=padre) + Pago. */
async function seedPagoConPadre() {
    const padre = await crearUsuario("PARENT", `${uniq("padre")}@test.local`);
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
    return { padre, suscripcion, pago };
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
    expect(err, "la BD DEBE rechazar esta operación: si pasa, la restricción ya no está").toBeDefined();
    return detalleError(err);
}

describe("SPEC-788 · reembolsoSolicitadoEn inmutable (trigger)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("fijar el ancla la PRIMERA vez ENTRA (NULL→valor)", async () => {
        const { pago } = await seedPagoConPadre();
        await prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: SOLICITADO, reembolsoVenceEn: VENCE } });
        const row = await prisma.pago.findUnique({ where: { id: pago.id } });
        expect(row?.reembolsoSolicitadoEn?.toISOString()).toBe(SOLICITADO.toISOString());
    });

    it("CAMBIAR el ancla ya fijada LANZA (valor→otro); otras columnas se actualizan igual", async () => {
        const { pago } = await seedPagoConPadre();
        await prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: SOLICITADO, reembolsoVenceEn: VENCE } });
        // control positivo: tocar OTRA columna sí se puede
        await prisma.pago.update({ where: { id: pago.id }, data: { motivoReembolso: "revisado" } });
        // mover el ancla DEBE lanzar
        const detalle = await esperarRechazo(
            prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: new Date("2027-01-01T00:00:00Z") } }),
        );
        expect(detalle).toMatch(/inmutable/i);
        const row = await prisma.pago.findUnique({ where: { id: pago.id } });
        expect(row?.reembolsoSolicitadoEn?.toISOString(), "el ancla sigue en su valor original").toBe(SOLICITADO.toISOString());
    });

    it("ANULAR el ancla ya fijada LANZA (valor→NULL)", async () => {
        const { pago } = await seedPagoConPadre();
        await prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: SOLICITADO, reembolsoVenceEn: VENCE } });
        const detalle = await esperarRechazo(
            prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: null, reembolsoVenceEn: null } }),
        );
        expect(detalle).toMatch(/inmutable/i);
    });
});

describe("SPEC-788 · CHECK de coherencia del par (23514, Prisma es ciego)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("par coherente (venceEn > solicitadoEn) → pasa", async () => {
        const { pago } = await seedPagoConPadre();
        await prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: SOLICITADO, reembolsoVenceEn: VENCE } });
        expect((await prisma.pago.findUnique({ where: { id: pago.id } }))?.reembolsoVenceEn?.toISOString()).toBe(VENCE.toISOString());
    });

    it("solo el ancla, sin vencimiento → rechazo (23514)", async () => {
        const { pago } = await seedPagoConPadre();
        const detalle = await esperarRechazo(prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: SOLICITADO } }));
        expect(detalle).toMatch(/23514|Pago_reembolso_reclamo_coherente_check/);
    });

    it("solo el vencimiento, sin ancla → rechazo (23514)", async () => {
        const { pago } = await seedPagoConPadre();
        const detalle = await esperarRechazo(prisma.pago.update({ where: { id: pago.id }, data: { reembolsoVenceEn: VENCE } }));
        expect(detalle).toMatch(/23514|Pago_reembolso_reclamo_coherente_check/);
    });

    it("vencimiento <= ancla → rechazo (23514)", async () => {
        const { pago } = await seedPagoConPadre();
        const detalle = await esperarRechazo(
            prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: VENCE, reembolsoVenceEn: SOLICITADO } }),
        );
        expect(detalle).toMatch(/23514|Pago_reembolso_reclamo_coherente_check/);
    });
});

describe("SPEC-788 · el ancla SOBREVIVE al borrado de la cuenta (el punto de la pieza)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("fijar el ancla, borrar al padre, y el Pago (con el ancla) SIGUE AHÍ", async () => {
        const { padre, suscripcion, pago } = await seedPagoConPadre();
        await prisma.pago.update({ where: { id: pago.id }, data: { reembolsoSolicitadoEn: SOLICITADO, reembolsoVenceEn: VENCE } });

        // control positivo: antes del borrado, la cadena existe y cuelga del padre.
        expect((await prisma.suscripcion.findUnique({ where: { id: suscripcion.id } }))?.usuarioId).toBe(padre.id);

        // borrar la CUENTA del padre. Suscripcion.usuarioId es SetNull → la Suscripcion sobrevive;
        // Pago.suscripcionId es Restrict → el Pago no se toca. Si algún día alguien pone Cascade en la
        // cadena, esta prueba se pone ROJA: la constancia no puede morir con la cuenta.
        await prisma.usuario.delete({ where: { id: padre.id } });

        const row = await prisma.pago.findUnique({ where: { id: pago.id } });
        expect(row, "el Pago DEBE sobrevivir al borrado de la cuenta").not.toBeNull();
        expect(row?.reembolsoSolicitadoEn?.toISOString(), "el ANCLA legal sigue ahí").toBe(SOLICITADO.toISOString());
        expect(row?.reembolsoVenceEn?.toISOString(), "el vencimiento sigue ahí").toBe(VENCE.toISOString());
        // el enlace al padre se vació (SetNull), pero el HECHO comercial sobrevive.
        expect((await prisma.suscripcion.findUnique({ where: { id: suscripcion.id } }))?.usuarioId, "el enlace al padre se vació (SetNull)").toBeNull();
    });
});

describe("SPEC-788 · [exit-condition] la bandeja DERIVA, no copia — viaja con el enlace de SPEC-752", () => {
    // CONDICIÓN DE SALIDA (no es una nota): el candado de «mutá venceEn en Pago → la urgencia de la
    // bandeja de PQR se mueve» necesita el enlace PeticionServicio→Pago, que NACE en SPEC-752 (su
    // dirección se decide donde vive la relación, no acá). Sin ese enlace + su derivación, esta pieza
    // está INCOMPLETA: 788 garantiza el ancla durable; 752 garantiza que la bandeja la LEE, no la copia.
    it.todo("SPEC-752: mutar Pago.reembolsoVenceEn mueve la urgencia derivada de la PQR enlazada (no hay copia)");
});
