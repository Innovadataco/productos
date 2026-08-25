import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { RUBRICA_SEMILLA } from "@/lib/ai/rubrica-semilla";
import * as auth from "@/lib/auth";

describe("GET /api/admin/ia/rubrica", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.restoreAllMocks();
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    });

    it("devuelve la config con defaults de la semilla cuando no hay parámetros", async () => {
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.preguntas).toEqual(RUBRICA_SEMILLA);
        expect(body.modelos).toEqual(["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"]);
        expect(body.temperatura).toBe(0.2);
        expect(body.umbralPresencia).toBe(0.6);
        expect(body.modeloEmbudo).toBe("qwen2.5:14b");
    });

    it("devuelve los valores guardados en ParametroSistema cuando existen", async () => {
        await prisma.parametroSistema.createMany({
            data: [
                { clave: "ia.rubrica.modelos", valor: JSON.stringify(["m1", "m2"]), tipo: "JSON", categoria: "SYSTEM" },
                { clave: "ia.rubrica.temperatura", valor: "0.5", tipo: "FLOAT", categoria: "SYSTEM" },
                { clave: "ia.rubrica.umbral_presencia", valor: "0.8", tipo: "FLOAT", categoria: "SYSTEM" },
                { clave: "ia.rubrica.modelo_embudo", valor: "embudo:7b", tipo: "STRING", categoria: "SYSTEM" },
            ],
        });

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.modelos).toEqual(["m1", "m2"]);
        expect(body.temperatura).toBe(0.5);
        expect(body.umbralPresencia).toBe(0.8);
        expect(body.modeloEmbudo).toBe("embudo:7b");
    });

    it("403 cuando el rol no tiene el módulo ia_rubrica", async () => {
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "ia_rubrica" } });
        await prisma.permisoModulo.update({
            where: { rol_moduloId: { rol: "ADMIN", moduloId: modulo!.id } },
            data: { activo: false },
        });

        const res = await GET();
        expect(res.status).toBe(403);
    });
});
