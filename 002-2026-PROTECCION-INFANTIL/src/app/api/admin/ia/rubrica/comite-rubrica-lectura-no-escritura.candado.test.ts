/**
 * SPEC-452 (I-318): el COMITE_VALIDACION LEE la rúbrica pero NO la escribe.
 *
 * - Lectura por módulo: `ia_rubrica` (hijo) + `centro_control_ia` (padre) por la
 *   jerarquía AND — ambos vienen del seed (CLAVES_POR_ROL), no del arnés permisivo.
 * - Escritura cerrada por ROL en cada handler (`verifyAuth(ADMIN)`, D-102): el módulo
 *   no la abre.
 *
 * Candado de conducta con TOKEN REAL (NO mockea `verifyAuth`) para que la puerta de
 * rol se ejecute de verdad. Contraprueba: quitar los grants del seed → la lectura
 * 200 del comité cae a 403 (lo cubre el test de `definiciones` con el mapa real).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as GET_DEFINICIONES } from "./definiciones/route";
import { PUT as PUT_PREGUNTAS } from "./preguntas/route";
import { PATCH as PATCH_CONFIG } from "./config/route";
import { GET as GET_ROOT } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { syncModulosYGrants } from "../../../../../../prisma/seed-modulos-grants";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function req(method: string, body?: unknown) {
    const init: RequestInit = { method, headers: { "content-type": "application/json" } };
    if (body !== undefined) init.body = JSON.stringify(body);
    return new Request("http://localhost:5005/api/admin/ia/rubrica", init);
}

describe("SPEC-452 · COMITE_VALIDACION lee la rúbrica, no la escribe", () => {
    beforeEach(async () => {
        await resetDatabase();
        // Mapa REAL de grants (no el arnés permisivo I-309): el acceso del comité
        // depende del seed (padre+hijo), no de que el arnés conceda todo.
        await prisma.permisoModulo.deleteMany();
        await syncModulosYGrants(prisma);
        mockToken = undefined;
    });

    it("comité LEE las definiciones de la rúbrica (200)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const res = await GET_DEFINICIONES();
        expect(res.status).toBe(200);
    });

    it("comité NO escribe preguntas (403 por rol ADMIN, aunque tenga el módulo)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const res = await PUT_PREGUNTAS(req("PUT", { categoria: "DOXING", preguntas: ["Pregunta X"] }));
        expect(res.status).toBe(403);
    });

    it("comité NO escribe la config del motor (403 por rol ADMIN)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const res = await PATCH_CONFIG(req("PATCH", { umbralConfianza: 0.5 }));
        expect(res.status).toBe(403);
    });

    it("comité NO entra a la raíz del Centro IA (403 por rol ADMIN)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const res = await GET_ROOT();
        expect(res.status).toBe(403);
    });
});
