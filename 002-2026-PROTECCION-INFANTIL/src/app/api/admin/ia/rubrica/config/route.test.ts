import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

const URL = "http://localhost/api/admin/ia/rubrica/config";

describe("PATCH /api/admin/ia/rubrica/config", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.restoreAllMocks();
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    });

    it("actualiza todos los parámetros y registra auditoría por clave", async () => {
        const res = await PATCH(
            crearRequestAutenticado("PATCH", URL, {
                modelos: ["m1", "m2"],
                temperatura: 0.5,
                umbralPresencia: 0.8,
                modeloEmbudo: "embudo:7b",
            })
        );
        expect(res.status).toBe(200);

        const valorDe = async (clave: string) =>
            (await prisma.parametroSistema.findUnique({ where: { clave } }))?.valor;

        expect(await valorDe("ia.rubrica.modelos")).toBe(JSON.stringify(["m1", "m2"]));
        expect(await valorDe("ia.rubrica.temperatura")).toBe("0.5");
        expect(await valorDe("ia.rubrica.umbral_presencia")).toBe("0.8");
        expect(await valorDe("ia.rubrica.modelo_embudo")).toBe("embudo:7b");

        const audits = await prisma.auditLog.findMany({ where: { accion: "PARAM_UPDATE" } });
        expect(audits).toHaveLength(4);
    });

    it("actualización parcial: solo toca el parámetro enviado", async () => {
        await prisma.parametroSistema.create({
            data: { clave: "ia.rubrica.temperatura", valor: "0.2", tipo: "FLOAT", categoria: "SYSTEM" },
        });

        const res = await PATCH(crearRequestAutenticado("PATCH", URL, { temperatura: 0.9 }));
        expect(res.status).toBe(200);

        expect((await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.temperatura" } }))?.valor).toBe("0.9");
        expect(await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.modelos" } })).toBeNull();

        const audits = await prisma.auditLog.findMany({ where: { accion: "PARAM_UPDATE" } });
        expect(audits).toHaveLength(1);
        expect(audits[0].valorAnterior).toBe("0.2");
        expect(audits[0].valorNuevo).toBe("0.9");
    });

    it("400 fuera de rango: umbral > 1, temperatura > 2, modelos vacíos", async () => {
        const umbral = await PATCH(crearRequestAutenticado("PATCH", URL, { umbralPresencia: 1.5 }));
        expect(umbral.status).toBe(400);

        const temperatura = await PATCH(crearRequestAutenticado("PATCH", URL, { temperatura: 2.5 }));
        expect(temperatura.status).toBe(400);

        const modelos = await PATCH(crearRequestAutenticado("PATCH", URL, { modelos: [] }));
        expect(modelos.status).toBe(400);

        const sinCambios = await PATCH(crearRequestAutenticado("PATCH", URL, {}));
        expect(sinCambios.status).toBe(400);

        expect(await prisma.parametroSistema.count()).toBe(0);
    });

    it("403 cuando el rol no tiene el módulo ia_rubrica", async () => {
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "ia_rubrica" } });
        await prisma.permisoModulo.update({
            where: { rol_moduloId: { rol: "ADMIN", moduloId: modulo!.id } },
            data: { activo: false },
        });

        const res = await PATCH(crearRequestAutenticado("PATCH", URL, { temperatura: 0.5 }));
        expect(res.status).toBe(403);
    });
});
