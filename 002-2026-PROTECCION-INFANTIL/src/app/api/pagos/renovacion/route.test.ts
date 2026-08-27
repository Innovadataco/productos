/**
 * SPEC-211 (002-PI-111): tests de integración de POST /api/pagos/renovacion.
 * El comprobante se guarda cifrado en un directorio temporal (override de
 * COMPROBANTES_STORAGE_DIR) para no ensuciar el árbol del repo.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    EstadoPago,
    FuenteTasa,
} from "@prisma/client";

let mockToken: string | undefined;
let dirTemporal = "";

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function crearRequest(campos: Record<string, string>, archivo?: { contenido: string; nombre: string; tipo: string }): Request {
    // Multipart construido a mano (patrón de colegio/carga/route.test.ts): en
    // entorno jsdom, FormData/File globales son los de jsdom y cuelgan al
    // undici Request que el handler parsea con request.formData().
    const boundary = `formdata${Date.now()}ren`;
    const lines: string[] = [];
    for (const [nombre, valor] of Object.entries(campos)) {
        lines.push(`--${boundary}`, `Content-Disposition: form-data; name="${nombre}"`, "", valor);
    }
    if (archivo) {
        lines.push(
            `--${boundary}`,
            `Content-Disposition: form-data; name="comprobante"; filename="${archivo.nombre}"`,
            `Content-Type: ${archivo.tipo}`,
            "",
            archivo.contenido
        );
    }
    lines.push(`--${boundary}--`);
    return new Request("http://localhost:5005/api/pagos/renovacion", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: lines.join("\r\n"),
    });
}

async function seedSuscripcionActiva(estado: EstadoSuscripcion = EstadoSuscripcion.ACTIVA) {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-ren-${Date.now()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, `padre-ren-${Date.now()}@test.co`);
    const anio = new Date().getFullYear();
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_1,
        anio,
        nombre: "Plan padre mensual",
        // SPEC-289 (002-PI-189 · Fase 1): plan con precio COP nativo. La
        // suscripción abajo va como monedaLocal="COP", entonces el motor
        // ignora precioBaseUSD y cobra 40000 COP directo.
        precioBaseCOP: 40000,
        precioBaseUSD: 10,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-REN-${Date.now()}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    await repo.crearTasaCambio({
        monedaOrigen: "USD",
        monedaDestino: "COP",
        tasa: 4000,
        fecha: new Date(),
        fuente: FuenteTasa.ADMIN_MANUAL,
    });
    return { padre, plan, suscripcion, repo };
}

const PNG_VALIDO = "contenido-png-de-prueba";

describe("POST /api/pagos/renovacion", () => {
    beforeAll(() => {
        dirTemporal = mkdtempSync(path.join(tmpdir(), "comprobantes-test-"));
        process.env.COMPROBANTES_STORAGE_DIR = dirTemporal;
    });

    afterAll(() => {
        rmSync(dirTemporal, { recursive: true, force: true });
        delete process.env.COMPROBANTES_STORAGE_DIR;
    });

    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea un pago en PENDIENTE_AUTORIZACION con hash SHA256", async () => {
        const { padre, suscripcion } = await seedSuscripcionActiva();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest(
                {
                    suscripcionId: suscripcion.id,
                    duracion: "MES_1",
                    metodoDeclarado: "TRANSFERENCIA",
                    notas: "Ref 123",
                },
                { contenido: PNG_VALIDO, nombre: "comp.png", tipo: "image/png" }
            )
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.estado).toBe(EstadoPago.PENDIENTE_AUTORIZACION);
        // SPEC-289 (002-PI-189 · Fase 1): suscripción COP → montoNetoUSD=0 en el
        // registro histórico (columna legacy) y montoLocalPagado = precioBaseCOP.
        // Fase 2 (ARQ_16) renombrará el campo del schema.
        expect(json.montoNetoUSD).toBe(0);
        expect(json.montoLocalPagado).toBe(40000);
        expect(json.monedaLocal).toBe("COP");
        expect(json.comprobanteHashSha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it("rechaza con 409 si ya hay un pago pendiente", async () => {
        const { padre, suscripcion, repo } = await seedSuscripcionActiva();
        await repo.crearPago({
            suscripcionId: suscripcion.id,
            duracionCubierta: DuracionPlan.MES_1,
            montoBaseUSD: 10,
            descuentoAplicadoUSD: 0,
            montoNetoUSD: 10,
            tasaCambioAplicada: 4000,
            montoLocalPagado: 40000,
            monedaLocal: "COP",
            metodoDeclarado: "TRANSFERENCIA",
            comprobanteAdjuntoUrl: "/tmp/x.enc",
            comprobanteMimeType: "image/png",
            comprobanteHashSha256: "a".repeat(64),
            fechaReporte: new Date(),
            estado: EstadoPago.PENDIENTE_AUTORIZACION,
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest(
                { suscripcionId: suscripcion.id, duracion: "MES_1", metodoDeclarado: "NEQUI" },
                { contenido: PNG_VALIDO, nombre: "comp.png", tipo: "image/png" }
            )
        );

        expect(res.status).toBe(409);
    });

    it("rechaza con 409 si la suscripción está cancelada", async () => {
        const { padre, suscripcion } = await seedSuscripcionActiva(EstadoSuscripcion.CANCELADA);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest(
                { suscripcionId: suscripcion.id, duracion: "MES_1", metodoDeclarado: "NEQUI" },
                { contenido: PNG_VALIDO, nombre: "comp.png", tipo: "image/png" }
            )
        );

        expect(res.status).toBe(409);
    });

    it("rechaza con 400 un formato de comprobante no permitido", async () => {
        const { padre, suscripcion } = await seedSuscripcionActiva();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest(
                { suscripcionId: suscripcion.id, duracion: "MES_1", metodoDeclarado: "NEQUI" },
                { contenido: PNG_VALIDO, nombre: "comp.gif", tipo: "image/gif" }
            )
        );

        expect(res.status).toBe(400);
    });

    it("rechaza con 400 si falta el comprobante", async () => {
        const { padre, suscripcion } = await seedSuscripcionActiva();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest({ suscripcionId: suscripcion.id, duracion: "MES_1", metodoDeclarado: "NEQUI" })
        );

        expect(res.status).toBe(400);
    });

    it("rechaza con 404 una suscripción ajena", async () => {
        const { suscripcion } = await seedSuscripcionActiva();
        const otro = await crearUsuario(RolUsuario.PARENT, `otro-ren-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(otro.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest(
                { suscripcionId: suscripcion.id, duracion: "MES_1", metodoDeclarado: "NEQUI" },
                { contenido: PNG_VALIDO, nombre: "comp.png", tipo: "image/png" }
            )
        );

        expect(res.status).toBe(404);
    });

    it("rechaza con 400 un body inválido (duración inexistente)", async () => {
        const { padre, suscripcion } = await seedSuscripcionActiva();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest(
                { suscripcionId: suscripcion.id, duracion: "MES_99", metodoDeclarado: "NEQUI" },
                { contenido: PNG_VALIDO, nombre: "comp.png", tipo: "image/png" }
            )
        );

        expect(res.status).toBe(400);
    });
});
