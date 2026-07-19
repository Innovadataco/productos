import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

describe("PATCH /api/config/parametros/:clave", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("rejects non-local Ollama URLs for system.ollama_base_url (R2)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await prisma.parametroSistema.create({
            data: {
                clave: "system.ollama_base_url",
                valor: "http://localhost:11434",
                tipo: "STRING",
                categoria: "SYSTEM",
                esPublico: false,
            },
        });

        const req = crearRequestAutenticado(
            "PATCH",
            "http://localhost/api/config/parametros/system.ollama_base_url",
            { valor: "https://api.openai.com/v1" }
        );

        const res = await PATCH(req, { params: Promise.resolve({ clave: "system.ollama_base_url" }) });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("local/privado (R2)");
    });

    it("creates a parameter with metadata provided in the body", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const req = crearRequestAutenticado(
            "PATCH",
            "http://localhost/api/config/parametros/ui.nuevo_parametro",
            {
                valor: "test-value",
                tipo: "STRING",
                categoria: "SYSTEM",
                esPublico: true,
                descripcion: "Parámetro de prueba",
            }
        );

        const res = await PATCH(req, { params: Promise.resolve({ clave: "ui.nuevo_parametro" }) });
        expect(res.status).toBe(200);

        const created = await prisma.parametroSistema.findUnique({ where: { clave: "ui.nuevo_parametro" } });
        expect(created).not.toBeNull();
        expect(created?.tipo).toBe("STRING");
        expect(created?.categoria).toBe("SYSTEM");
        expect(created?.esPublico).toBe(true);
        expect(created?.descripcion).toBe("Parámetro de prueba");
    });

    it("creates a parameter when it does not exist (upsert)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const req = crearRequestAutenticado(
            "PATCH",
            "http://localhost/api/config/parametros/ui.grupos_categoria",
            { valor: JSON.stringify({ grupos: [{ clave: "test", nombre: "Test", orden: 1, categorias: [] }] }) }
        );

        const res = await PATCH(req, { params: Promise.resolve({ clave: "ui.grupos_categoria" }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.clave).toBe("ui.grupos_categoria");
        expect(body.tipo).toBe("JSON");

        const created = await prisma.parametroSistema.findUnique({ where: { clave: "ui.grupos_categoria" } });
        expect(created).not.toBeNull();
        expect(created?.valor).toBe(JSON.stringify({ grupos: [{ clave: "test", nombre: "Test", orden: 1, categorias: [] }] }));
    });

    it("updates a parameter and creates an AuditLog linked to the parameter", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const param = await prisma.parametroSistema.create({
            data: {
                clave: "reportes.classification.rag_top_k",
                valor: "3",
                tipo: "INTEGER",
                categoria: "SECURITY",
                esPublico: false,
            },
        });

        const req = crearRequestAutenticado(
            "PATCH",
            "http://localhost/api/config/parametros/reportes.classification.rag_top_k",
            { valor: "5", motivo: "Test" }
        );

        const res = await PATCH(req, { params: Promise.resolve({ clave: param.clave }) });
        expect(res.status).toBe(200);

        const auditLogs = await prisma.auditLog.findMany({
            where: { parametroId: param.id },
            orderBy: { creadoEn: "desc" },
        });
        expect(auditLogs).toHaveLength(1);
        expect(auditLogs[0].accion).toBe("PARAM_UPDATE");
        expect(auditLogs[0].valorAnterior).toBe("3");
        expect(auditLogs[0].valorNuevo).toBe("5");

        const getRes = await GET(req, { params: Promise.resolve({ clave: param.clave }) });
        expect(getRes.status).toBe(200);
        const body = await getRes.json();
        expect(body.historial).toHaveLength(1);
        expect(body.historial[0].valorNuevo).toBe("5");
    });
});
