/**
 * SPEC-306 (A-50): tests de integración de GET /api/padre/circulo-confianza/timeline.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";
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

function requestLista() {
    return new Request("http://localhost:5005/api/padre/circulo-confianza/timeline", { method: "GET" });
}

async function crearContactoConIdentificador(usuarioId: string, etiqueta: string, valor: string) {
    return prisma.contactoConfianza.create({
        data: {
            usuarioId,
            etiqueta,
            activo: true,
            identificadores: {
                create: { valor, tipo: "telefono", activo: true },
            },
        },
    });
}

async function crearReporteVisible(
    identificador: string,
    estado: EstadoReporte,
    categoria: CategoriaConducta | null,
    diasAtras = 0
) {
    const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
    const creadoEn = new Date();
    creadoEn.setDate(creadoEn.getDate() - diasAtras);

    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: "Reporte de prueba",
            textoOriginal: "Reporte de prueba",
            fechaIncidente: creadoEn,
            ciudad: "Bogotá",
            pais: "Colombia",
            estado,
            esAnonimo: false,
            creadoEn,
            ...(categoria
                ? {
                    clasificacion: {
                        create: {
                            categoria,
                            confianza: 0.85,
                            modeloUsado: "ornith:9b",
                            latenciaMs: 120,
                        },
                    },
                }
                : {}),
        },
    });
}

describe("/api/padre/circulo-confianza/timeline (SPEC-306)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("200: devuelve eventos del padre autenticado con shape correcto", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await crearContactoConIdentificador(padre.id, "Hijo", "+573001111111");
        await crearReporteVisible("+573001111111", "CLASIFICADO", "SOLICITUD_MATERIAL", 2);

        const res = await GET(requestLista());
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].tipo).toBe("REPORTE");
        expect(json.items[0].severity).toBe("ROJO");
        expect(json.items[0].identificador).toBe("+573001111111");
        expect(json.items[0].contactoEtiqueta).toBe("Hijo");
        expect(typeof json.items[0].titulo).toBe("string");
        expect(typeof json.items[0].descripcion).toBe("string");
    });

    it("200: devuelve lista vacía cuando no hay contactos", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await GET(requestLista());
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items).toEqual([]);
    });

    it("403: un rol distinto de PARENT no puede consultar", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(requestLista());
        expect(res.status).toBe(403);
    });

    it("401: sin sesión", async () => {
        const res = await GET(requestLista());
        expect(res.status).toBe(401);
    });
});
