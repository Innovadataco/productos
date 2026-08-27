/**
 * SPEC-202 (BRIEF §9): tests del webhook de Resend.
 * - Firma HMAC obligatoria.
 * - Idempotencia por proveedorId.
 * - Actualización de estados según evento.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { createHmac } from "crypto";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { EstadoNotificacion } from "@prisma/client";

const URL = "http://localhost:5005/api/webhooks/resend";
// Secreto con prefijo whsec_ y carga base64 de 32 bytes, igual que Resend/Svix.
const SECRET = "whsec_MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

function getSecretBytes(): Buffer {
    const base64Part = SECRET.startsWith("whsec_") ? SECRET.slice("whsec_".length) : SECRET;
    return Buffer.from(base64Part, "base64");
}

function firmarPayload(payload: string, svixId: string, timestamp: string): string {
    const signedContent = `${svixId}.${timestamp}.${payload}`;
    const signature = createHmac("sha256", getSecretBytes()).update(signedContent).digest("base64");
    return `v1,${signature}`;
}

function crearRequest(eventType: string, emailId: string, overrides: Record<string, unknown> = {}) {
    const svixId = `msg_${emailId}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const createdAt = new Date().toISOString();
    const body = JSON.stringify({
        type: eventType,
        created_at: createdAt,
        data: { email_id: emailId, created_at: createdAt, ...overrides },
    });
    const signature = firmarPayload(body, svixId, timestamp);

    return new Request(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "svix-id": svixId,
            "svix-timestamp": timestamp,
            "svix-signature": signature,
        },
        body,
    });
}

async function crearNotificacion(proveedorId: string, estado: EstadoNotificacion = "ENVIADA") {
    return prisma.notificacion.create({
        data: {
            evento: "test.evento",
            destinatarioEmail: "test@example.com",
            plantillaClave: "test.plantilla.email",
            canal: "EMAIL",
            estado,
            proveedorId,
            variables: {},
        },
    });
}

describe("POST /api/webhooks/resend (SPEC-202)", () => {
    // SPEC-283 (002-PI-180): reset SELECTIVO por prueba. El archivo solo toca
    // Notificacion; vaciar 1 tabla en lugar de 96 baja el costo por prueba
    // sin cambiar aislamiento.
    beforeEach(async () => {
        await resetDatabase(["notificaciones"]);
        process.env.RESEND_WEBHOOK_SECRET = SECRET;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 si falta RESEND_WEBHOOK_SECRET", async () => {
        delete process.env.RESEND_WEBHOOK_SECRET;
        const res = await POST(
            new Request(URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "email.sent", data: { email_id: "r-1" } }),
            })
        );
        expect(res.status).toBe(401);
    });

    it("401 si falta firma", async () => {
        const res = await POST(
            new Request(URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "email.sent", data: { email_id: "r-1" } }),
            })
        );
        expect(res.status).toBe(401);
    });

    it("401 si la firma es inválida", async () => {
        const body = JSON.stringify({ type: "email.sent", data: { email_id: "r-1" } });
        const res = await POST(
            new Request(URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "svix-id": "msg_1",
                    "svix-timestamp": "1234567890",
                    "svix-signature": "v1,invalid",
                },
                body,
            })
        );
        expect(res.status).toBe(401);
    });

    it("procesa email.opened y actualiza estado a ABIERTA", async () => {
        const notif = await crearNotificacion("r-opened");
        const req = crearRequest("email.opened", "r-opened");
        const res = await POST(req);
        expect(res.status).toBe(200);

        const actualizada = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(actualizada?.estado).toBe("ABIERTA");
        expect(actualizada?.openedAt).not.toBeNull();
    });

    it("procesa email.clicked y actualiza estado a CLICADA", async () => {
        const notif = await crearNotificacion("r-clicked", "ABIERTA");
        const req = crearRequest("email.clicked", "r-clicked");
        const res = await POST(req);
        expect(res.status).toBe(200);

        const actualizada = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(actualizada?.estado).toBe("CLICADA");
        expect(actualizada?.clickedAt).not.toBeNull();
    });

    it("procesa email.bounced, marca bounce y registra contacto bloqueado", async () => {
        const notif = await crearNotificacion("r-bounced");
        const req = crearRequest("email.bounced", "r-bounced");
        const res = await POST(req);
        expect(res.status).toBe(200);

        const actualizada = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(actualizada?.bouncedAt).not.toBeNull();

        const bloqueado = await prisma.notificacionContactoBloqueado.findUnique({
            where: { email: notif.destinatarioEmail },
        });
        expect(bloqueado).not.toBeNull();
        expect(bloqueado?.bounceCount).toBeGreaterThanOrEqual(1);
    });

    it("es idempotente: email.opened duplicado no cambia openedAt", async () => {
        const notif = await crearNotificacion("r-dup");
        const req1 = crearRequest("email.opened", "r-dup");
        await POST(req1);

        const primera = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        const openedAtPrimera = primera?.openedAt;

        // Pequeña pausa para detectar cambio de timestamp si no fuera idempotente.
        await new Promise((r) => setTimeout(r, 50));

        const req2 = crearRequest("email.opened", "r-dup");
        const res2 = await POST(req2);
        expect(res2.status).toBe(200);

        const segunda = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(segunda?.openedAt?.toISOString()).toBe(openedAtPrimera?.toISOString());
    });
});
