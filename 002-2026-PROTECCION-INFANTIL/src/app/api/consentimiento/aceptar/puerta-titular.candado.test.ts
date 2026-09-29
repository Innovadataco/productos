/**
 * SPEC-756 · CANDADO de la PUERTA de consentimiento en el ENDPOINT.
 *
 * «Cerrar la pantalla no cierra el endpoint» (misma decisión, dos adaptadores por
 * superficie): el POST servía a cualquier autenticado y, peor, tomaba
 * `documentoTipo` del CUERPO. Ahora:
 *  - rol NO titular → 403 antes de tocar la lógica (no fabrica firma inválida);
 *  - `documentoTipo` se DERIVA del rol (documentoPorRol) e IGNORA el cuerpo
 *    (gate condicionado a un valor del cliente);
 *  - `esRepresentanteLegal` SÍ sigue viniendo del cuerpo: es una declaración del
 *    usuario que el servidor no puede verificar (conservarla protege su valor
 *    probatorio).
 *
 * Integración (BD real): prueba la PERSISTENCIA, no solo la respuesta. Control
 * positivo en las dos direcciones + control del «ignora el cuerpo» plantando un
 * documentoTipo mentiroso en el body.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { crearParametrosConsentimiento, crearEventoConsentimiento } from "@/lib/consentimiento-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken ? { name, value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

function requestAceptar(token: string | undefined, body: Record<string, unknown>) {
    return new Request("http://localhost:5005/api/consentimiento/aceptar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { cookie: `token=${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
}

describe("SPEC-756 · puerta de titular + documentoTipo derivado (endpoint)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosConsentimiento();
        await crearEventoConsentimiento();
        mockToken = undefined;
    });

    it("no-titular OPERADOR → 403 y NO crea AuditConsentimiento ni marca al usuario", async () => {
        const op = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(op.id, "OPERADOR");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(403);

        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: op.id } });
        expect(audits).toHaveLength(0);
        const u = await prisma.usuario.findUnique({ where: { id: op.id } });
        expect(u?.consentimientoVersion).toBeNull();
    });

    it("no-titular VERIFICADOR → 403 (también los que la lista vieja omitía quedan fuera)", async () => {
        const v = await crearUsuario("VERIFICADOR");
        mockToken = await crearTokenUsuario(v.id, "VERIFICADOR");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(403);
        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: v.id } });
        expect(audits).toHaveLength(0);
    });

    it("titular SCHOOL_ADMIN → 201 y graba el documento DERIVADO (CONVENIO), IGNORANDO el cuerpo mentiroso (POLITICA)", async () => {
        const sa = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(sa.id, "SCHOOL_ADMIN");

        // el cuerpo miente a propósito: manda POLITICA_DATOS
        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: sa.id } });
        expect(audits).toHaveLength(1);
        // el servidor grabó el documento del ROL, no el del cuerpo
        expect(audits[0].documentoTipo).toBe("CONVENIO_INSTITUCIONAL");
        // la declaración SÍ viene del cuerpo (conservada)
        expect(audits[0].esRepresentanteLegal).toBe(true);
    });

    it("titular PARENT → 201 y graba POLITICA_DATOS aunque el cuerpo diga CONVENIO (la otra dirección)", async () => {
        const p = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(p.id, "PARENT");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "CONVENIO_INSTITUCIONAL", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: p.id } });
        expect(audits).toHaveLength(1);
        expect(audits[0].documentoTipo).toBe("POLITICA_DATOS");
    });
});
