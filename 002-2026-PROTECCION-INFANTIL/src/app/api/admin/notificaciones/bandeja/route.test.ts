/**
 * SPEC-202 (002-PI-099): tests de integración del GET /api/admin/notificaciones/bandeja.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/notificaciones/bandeja";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function crearNotificacion(data: {
    evento?: string;
    destinatarioEmail?: string;
    estado?: "ENCOLADA" | "ENVIADA" | "FALLIDA";
    canal?: "EMAIL" | "IN_APP";
}) {
    return prisma.notificacion.create({
        data: {
            evento: data.evento ?? "test.evento",
            destinatarioEmail: data.destinatarioEmail ?? "test@example.com",
            plantillaClave: "test.plantilla.email",
            canal: data.canal ?? "EMAIL",
            estado: data.estado ?? "ENCOLADA",
            variables: {},
        },
    });
}

describe("GET /api/admin/notificaciones/bandeja (SPEC-202)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin autenticación", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(401);
    });

    it("devuelve notificaciones paginadas", async () => {
        await autenticarAdmin();
        await crearNotificacion({ evento: "evento.a", destinatarioEmail: "a@example.com" });
        await crearNotificacion({ evento: "evento.b", destinatarioEmail: "b@example.com", estado: "ENVIADA" });

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(2);
        expect(body.pagination.total).toBe(2);
    });

    it("filtra por estado", async () => {
        await autenticarAdmin();
        await crearNotificacion({ estado: "ENCOLADA" });
        await crearNotificacion({ estado: "ENVIADA" });

        const res = await GET(new Request(`${URL}?estado=ENVIADA`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].estado).toBe("ENVIADA");
    });

    it("filtra por destinatario", async () => {
        await autenticarAdmin();
        await crearNotificacion({ destinatarioEmail: "unico@example.com" });
        await crearNotificacion({ destinatarioEmail: "otro@example.com" });

        const res = await GET(new Request(`${URL}?destinatarioEmail=unico`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].destinatarioEmail).toBe("unico@example.com");
    });

    it("POST reenvía un envío finalizado y crea una notificación ENCOLADA", async () => {
        await autenticarAdmin();
        const original = await crearNotificacion({ estado: "FALLIDA" });

        const res = await POST(
            new Request(URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: original.id }),
            })
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty("id");
        expect(body.id).not.toBe(original.id);

        const reenvio = await prisma.notificacion.findUnique({ where: { id: body.id } });
        expect(reenvio).not.toBeNull();
        expect(reenvio?.estado).toBe("ENCOLADA");
        expect(reenvio?.evento).toBe(original.evento);
        expect(reenvio?.destinatarioEmail).toBe(original.destinatarioEmail);
    });

    it("POST rechaza reenviar una notificación no finalizada", async () => {
        await autenticarAdmin();
        const original = await crearNotificacion({ estado: "ENCOLADA" });

        const res = await POST(
            new Request(URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: original.id }),
            })
        );
        expect(res.status).toBe(400);
    });

    it("POST rechaza un id inexistente", async () => {
        await autenticarAdmin();
        const res = await POST(
            new Request(URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: "cm00000000000000000000000" }),
            })
        );
        expect(res.status).toBe(404);
    });
});
