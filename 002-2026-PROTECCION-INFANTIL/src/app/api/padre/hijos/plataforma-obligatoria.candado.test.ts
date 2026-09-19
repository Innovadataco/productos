/**
 * SPEC-721 · CANDADO — no existe camino por la API para que nazca una cuenta de menor SIN
 * plataforma. Las DOS puertas (alta de hijo con cuentas · agregar cuenta a un hijo existente)
 * comparten `camposIdentificadorEntrada` y rechazan (400) una cuenta sin plataforma.
 *
 * Control positivo: quitar la exigencia del esquema (min(1) / volver optional) hace caer tanto la
 * aserción de esquema como los 400 de ruta. Se prueba la RUTA, no solo el esquema: así el candado
 * también cae si una ruta deja de usar el esquema compartido.
 *
 * (El formulario y la forma del campo son de Dev 3 · Diseño; acá se cierra la puerta de la API,
 * que es la que vale aunque no se pase por el formulario.)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ sellarCookieSesionEstado: vi.fn() }));
vi.mock("@/lib/routing/sellar-sesion-estado", () => ({ sellarCookieSesionEstado: mocks.sellarCookieSesionEstado }));
let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

import { POST as postHijos } from "./route";
import { POST as postIdentificador } from "./identificadores/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { registrarHijo } from "@/lib/dal/services/hijos";
import { camposIdentificadorEntrada } from "@/lib/dal/services/hijos/identificador-schema";

const reqHijos = (body: unknown) =>
    new Request("http://localhost:5005/api/padre/hijos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const reqIdent = (body: unknown) =>
    new Request("http://localhost:5005/api/padre/hijos/identificadores", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("SPEC-721 · la plataforma es OBLIGATORIA en una cuenta de menor", () => {
    let plataformaId: string;
    let padreId: string;
    beforeEach(async () => {
        await resetDatabase();
        plataformaId = (await crearPlataforma()).id;
        const padre = await crearUsuario("PARENT");
        padreId = padre.id;
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
    });

    it("CONTROL POSITIVO (esquema): rechaza cuenta sin plataforma; acepta con plataforma", () => {
        const schema = z.object(camposIdentificadorEntrada);
        expect(schema.safeParse({ valor: "anaroblox" }).success).toBe(false);
        expect(schema.safeParse({ valor: "anaroblox", plataformaId: "" }).success).toBe(false);
        expect(schema.safeParse({ valor: "anaroblox", plataformaId: "wa" }).success).toBe(true);
    });

    it("POST /hijos · cuenta SIN plataforma → 400 (la fila no nace)", async () => {
        const res = await postHijos(reqHijos({ nombre: "Zaira", identificadores: [{ valor: "anaroblox" }] }));
        expect(res.status).toBe(400);
    });

    it("POST /hijos/identificadores (agregar a hijo existente) · SIN plataforma → 400", async () => {
        const { hijoId } = await registrarHijo(padreId, { nombre: "Zaira" });
        const res = await postIdentificador(reqIdent({ hijoId, valor: "anaroblox" }));
        expect(res.status).toBe(400);
    });

    it("POST /hijos/identificadores · CON plataforma → agrega (no rechaza todo)", async () => {
        const { hijoId } = await registrarHijo(padreId, { nombre: "Zaira" });
        const res = await postIdentificador(reqIdent({ hijoId, valor: "anaroblox", plataformaId }));
        expect(res.status).toBeLessThan(400);
    });
});
