/**
 * F3 (N-5): POST /api/consulta/evento — evento analítico del CTA del estado
 * vacío. Sin identificador en la fila (privacidad); 400 con evento inválido.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

describe("POST /api/consulta/evento (F3)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("registra CONSULTA_VACIA_CTA_REPORTAR y responde 202", async () => {
        const req = new Request("http://localhost:5005/api/consulta/evento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evento: "consulta_vacia_cta_reportar" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(202);

        const evento = await prisma.auditLog.findFirst({
            where: { accion: "CONSULTA_VACIA_CTA_REPORTAR", tipoRecurso: "consulta_publica" },
        });
        expect(evento).not.toBeNull();
        expect(evento!.recursoId).toBeNull();
    });

    it("rechaza con 400 un evento distinto", async () => {
        const req = new Request("http://localhost:5005/api/consulta/evento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evento: "otro_evento" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        expect(await prisma.auditLog.count({ where: { accion: "CONSULTA_VACIA_CTA_REPORTAR" } })).toBe(0);
    });
});
