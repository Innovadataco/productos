/**
 * SPEC-384 · Candado 26 — separación de poderes con el comité.
 *
 * Al aceptar `comite_bandeja` como módulo alternativo en la LECTURA de
 * reportes-revision (I-278), hay que asegurar que no abrimos por accidente
 * las ACCIONES que son del operador: clasificar, confirmar corrección y
 * reasignar. La regla es que el comité entra sólo a lo que YA autoriza el
 * propio endpoint (rama `comiteId`). Estos tests candan la separación:
 * cualquier POST/PATCH a las rutas de acción del operador debe seguir
 * respondiendo 403 para un COMITE_VALIDACION, sin importar los módulos
 * activos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as POST_CLASIFICAR } from "./[id]/clasificar/route";
import { POST as POST_CONFIRMAR } from "./[id]/confirmar/route";
import { PATCH as PATCH_REASIGNAR } from "@/app/api/admin/operadores/reasignar/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

async function crearReporte() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: `+57300COM${Date.now()}`,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para el candado 26",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            estado: "REVISION_MANUAL",
            numeroSeguimiento: `RPT-CM${Date.now()}`,
        },
    });
}

function req(method: string, url: string, body?: unknown): Request {
    return new Request(url, {
        method,
        headers: { "Content-Type": "application/json", ...(activeToken ? { cookie: `token=${activeToken}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

describe("SPEC-384 · candado 26 · el comité NO puede tocar las rutas de acción del operador", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    it("clasificar: comité → 403 (aunque el módulo del operador estuviera activo)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const reporte = await crearReporte();
        activeToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await POST_CLASIFICAR(
            req(
                "POST",
                `http://localhost:5005/api/admin/reportes-revision/${reporte.id}/clasificar`,
                { categoria: "CIBERACOSO", nota: "nota lo suficientemente larga para pasar validaciones básicas" }
            ),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(403);
    });

    it("confirmar: comité → 403", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const reporte = await crearReporte();
        activeToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await POST_CONFIRMAR(
            req("POST", `http://localhost:5005/api/admin/reportes-revision/${reporte.id}/confirmar`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(403);
    });

    it("reasignar operadores: comité → 403 (requiere rol ADMIN + módulo operadores)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        activeToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await PATCH_REASIGNAR(
            req(
                "PATCH",
                "http://localhost:5005/api/admin/operadores/reasignar",
                { reporteId: "cuid-fake", operadorDestinoId: "cuid-fake", motivo: "Reasignación bloqueada por rol del comité." }
            )
        );
        expect(res.status).toBe(403);
    });
});
