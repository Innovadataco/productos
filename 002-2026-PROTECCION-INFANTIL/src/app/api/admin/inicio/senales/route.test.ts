/**
 * SPEC-378 · GET /api/admin/inicio/senales — la alarma de la casa.
 *
 * Afirma: (a) sin datos, alertas vacío; (b) los umbrales del seed disparan las
 * señales correctas; (c) el gate por rol y por módulo funciona.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    mockToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

async function crearReporteHuerfanoViejo(horasAtras: number) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const creadoEn = new Date(Date.now() - horasAtras * 3600 * 1000);
    return prisma.reporte.create({
        data: {
            identificador: `+57300${Date.now()}${Math.floor(Math.random() * 1000)}`,
            plataformaId: plataforma!.id,
            texto: "reporte huérfano de prueba",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            esAnonimo: true,
            operadorId: null,
            creadoEn,
        },
    });
}

function req(): Request {
    return new Request("http://localhost:5005/api/admin/inicio/senales", {
        method: "GET",
        headers: { cookie: `token=${mockToken}` },
    });
}

describe("GET /api/admin/inicio/senales (SPEC-378)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
    });

    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());

    it("sin datos: la casa está tranquila → alertas vacío", async () => {
        await autenticarAdmin();
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.alertas).toEqual([]);
        expect(typeof body.latenciaMs).toBe("number");
        expect(typeof body.generadoEn).toBe("string");
    });

    it("N reportes huérfanos ANTIGUOS por encima del umbral → señal media", async () => {
        // Umbral default: 3 · antigüedad: 24 h.
        await autenticarAdmin();
        await crearReporteHuerfanoViejo(48);
        await crearReporteHuerfanoViejo(48);
        await crearReporteHuerfanoViejo(48);

        const res = await GET();
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "reportes_huerfanos");
        expect(alerta, "3 huérfanos ≥ umbral 3").toBeDefined();
        expect(alerta.prioridad).toBe("media");
        expect(alerta.texto).toMatch(/sin dueño/i);
        expect(alerta.ruta).toBe("/dashboard/admin/operadores/asignar");
    });

    it("huérfanos RECIENTES (menos de 24 h) NO disparan alerta", async () => {
        await autenticarAdmin();
        await crearReporteHuerfanoViejo(1);
        await crearReporteHuerfanoViejo(1);
        await crearReporteHuerfanoViejo(1);
        const res = await GET();
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "reportes_huerfanos")).toBe(false);
    });

    it("un correo FALLIDO con patrón de CUOTA → señal alta 'correos no salen' (una sola ya importa)", async () => {
        await autenticarAdmin();
        await prisma.notificacion.create({
            data: {
                evento: "TEST",
                destinatarioEmail: "test@test.local",
                plantillaClave: "TEST",
                canal: "EMAIL",
                variables: {},
                estado: "FALLIDA",
                ultimoError: "Provider quota exceeded (429)",
            },
        });
        const res = await GET();
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "correos_no_salen");
        expect(alerta, "cuota agotada = alta aunque sea un solo correo").toBeDefined();
        expect(alerta.prioridad).toBe("alta");
        expect(alerta.texto).toMatch(/cuota|proveedor/i);
    });

    it("5 correos FALLIDOS sin cuota (default del umbral) → señal media", async () => {
        await autenticarAdmin();
        for (let i = 0; i < 5; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `test${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "SMTP timeout",
                },
            });
        }
        const res = await GET();
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "correos_fallidos_volumen");
        expect(alerta).toBeDefined();
        expect(alerta.prioridad).toBe("media");
    });

    it("SPEC-401 (I-283): 10 FALLIDA seguidas en EMAIL → señal 'proveedor_email_caido' alta", async () => {
        await autenticarAdmin();
        // 10 FALLIDA sin ninguna ENVIADA intercalada — proveedor no acepta nada.
        for (let i = 0; i < 10; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "[connection_refused][502] Provider unreachable",
                },
            });
        }
        const res = await GET();
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "proveedor_email_caido");
        expect(alerta, "10 FALLIDA seguidas = proveedor caído").toBeDefined();
        expect(alerta.prioridad).toBe("alta");
        expect(alerta.texto).toMatch(/proveedor.*caído|caído|no aceptó/i);
    });

    it("SPEC-401 (I-283): 9 FALLIDA + 1 ENVIADA intercalada → NO dispara 'proveedor_email_caido'", async () => {
        await autenticarAdmin();
        // La ENVIADA más reciente rompe la racha.
        await prisma.notificacion.create({
            data: {
                evento: "TEST",
                destinatarioEmail: "ok@test.local",
                plantillaClave: "TEST",
                canal: "EMAIL",
                variables: {},
                estado: "ENVIADA",
            },
        });
        for (let i = 0; i < 9; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "algo falló",
                },
            });
        }
        const res = await GET();
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "proveedor_email_caido")).toBe(false);
    });

    it("SPEC-401 (I-283): menos de la ventana (5 FALLIDA) → NO dispara 'proveedor_email_caido' (sistema idle)", async () => {
        await autenticarAdmin();
        for (let i = 0; i < 5; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "algo falló",
                },
            });
        }
        const res = await GET();
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "proveedor_email_caido")).toBe(false);
    });

    it("las alertas se ordenan: prioridad ALTA primero, luego MEDIA (empate por id)", async () => {
        await autenticarAdmin();
        // Cuota (alta)
        await prisma.notificacion.create({
            data: {
                evento: "T",
                destinatarioEmail: "x@x",
                plantillaClave: "T",
                canal: "EMAIL",
                variables: {},
                estado: "FALLIDA",
                ultimoError: "quota exceeded",
            },
        });
        // Huérfanos (media)
        for (let i = 0; i < 3; i++) await crearReporteHuerfanoViejo(48);

        const res = await GET();
        const body = await res.json();
        expect(body.alertas.length).toBeGreaterThanOrEqual(2);
        const [primera] = body.alertas;
        expect(primera.prioridad).toBe("alta");
    });

    it("sin token → 401", async () => {
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("PARENT (rol equivocado) → 401/403", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET();
        expect([401, 403]).toContain(res.status);
    });
});
