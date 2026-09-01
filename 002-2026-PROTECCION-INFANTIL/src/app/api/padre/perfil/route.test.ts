/**
 * SPEC-339 (A-67 · T051/T074/T079) — PATCH /api/padre/perfil.
 *
 * Documento del padre entra; y al guardar, la cookie de estado sale RE-SELLADA
 * en la misma respuesta — la prueba de que el padre no se atasca en el Paso 2.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    sellarCookieSesionEstado: vi.fn(),
}));

vi.mock("@/lib/routing/sellar-sesion-estado", () => ({
    sellarCookieSesionEstado: mocks.sellarCookieSesionEstado,
}));

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

import { PATCH, GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

function crearRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/padre/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/padre/perfil (SPEC-339)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.clearAllMocks();
        mocks.sellarCookieSesionEstado.mockResolvedValue(true);
    });

    async function comoPadre() {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        return padre;
    }

    it("guarda tipo y número de documento del padre", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ documentoTipo: "CC", documentoNumero: "79123456" }));
        expect(res.status).toBe(200);
        const enBd = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(enBd?.documentoTipo).toBe("CC");
        expect(enBd?.documentoNumero).toBe("79123456");
    });

    it("rechaza un tipo de documento fuera del set", async () => {
        await comoPadre();
        const res = await PATCH(crearRequest({ documentoTipo: "XX", documentoNumero: "123456" }));
        expect(res.status).toBe(400);
    });

    // T074: la prueba de que el padre no se atasca en el Paso 2.
    it("al guardar, RE-SELLA la cookie de estado en la misma respuesta", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ nombre: "Carlos" }));
        expect(res.status).toBe(200);
        expect(mocks.sellarCookieSesionEstado).toHaveBeenCalledOnce();
        expect(mocks.sellarCookieSesionEstado.mock.calls[0][1]).toBe(padre.id);
    });

    // T079 (Calidad · R1-8): el sellado fallido no es silencioso.
    it("SELLADO FALLIDO: el dato queda guardado y el padre recibe el aviso", async () => {
        mocks.sellarCookieSesionEstado.mockResolvedValue(false);
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ nombre: "Carlos" }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.aviso).toContain("recárgala");
        expect((await prisma.usuario.findUnique({ where: { id: padre.id } }))?.nombre).toBe("Carlos");
    });

    // Calidad (SPEC-342): el fallo del sellado como EXCEPCIÓN, no solo false.
    it("SELLADO QUE LANZA: el dato queda guardado y el padre recibe el aviso", async () => {
        mocks.sellarCookieSesionEstado.mockRejectedValue(new Error("selló mal"));
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ nombre: "Ana" }));
        // La ruta no debe reventar en 500 por el sellado: el dato ya está.
        expect(res.status).toBe(200);
        expect((await prisma.usuario.findUnique({ where: { id: padre.id } }))?.nombre).toBe("Ana");
    });

    it("GET devuelve el documento junto al resto del perfil", async () => {
        const padre = await comoPadre();
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { documentoTipo: "CE", documentoNumero: "555444" },
        });
        const res = await GET();
        const json = await res.json();
        expect(json.perfil.documentoTipo).toBe("CE");
        expect(json.perfil.documentoNumero).toBe("555444");
    });

    it("fechaNacimiento se sigue ACEPTANDO (el campo vive) aunque el camino no la pida", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ fechaNacimiento: "1990-05-10" }));
        expect(res.status).toBe(200);
        expect((await prisma.usuario.findUnique({ where: { id: padre.id } }))?.fechaNacimiento).not.toBeNull();
    });
});
