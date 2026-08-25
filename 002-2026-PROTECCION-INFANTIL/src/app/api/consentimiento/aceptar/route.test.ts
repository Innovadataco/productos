import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { crearParametrosConsentimiento, crearEventoConsentimiento } from "@/lib/consentimiento-test-utils";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken
                ? { name, value: mockToken }
                : undefined,
        set: vi.fn(),
    }),
}));

async function hashDocumento(rutaRelativa: string): Promise<string> {
    const contenido = await readFile(path.resolve(process.cwd(), rutaRelativa), "utf-8");
    return createHash("sha256").update(contenido, "utf-8").digest("hex");
}

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

describe("POST /api/consentimiento/aceptar (SPEC-241)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosConsentimiento();
        await crearEventoConsentimiento();
        mockToken = undefined;
    });

    it("acepta el consentimiento y crea AuditConsentimiento + actualiza Usuario + notificación", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.version).toBe("v0.4");

        const usuario = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(usuario?.consentimientoVersion).toBe("v0.4");
        expect(usuario?.consentimientoAceptadoEn).not.toBeNull();
        expect(usuario?.consentimientoDocumentoHash).not.toBeNull();

        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: padre.id } });
        expect(audits).toHaveLength(1);
        expect(audits[0].documentoTipo).toBe("POLITICA_DATOS");
        expect(audits[0].esRepresentanteLegal).toBe(true);
        expect(audits[0].version).toBe("v0.4");
        expect(audits[0].ip).toBe("unknown");

        const notifs = await prisma.notificacion.findMany({ where: { destinatarioUsuarioId: padre.id } });
        expect(notifs.length).toBeGreaterThanOrEqual(1);
    });

    it("calcula el hash SHA256 correcto del documento legal", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));

        const expectedHash = await hashDocumento("public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md");
        const usuario = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(usuario?.consentimientoDocumentoHash).toBe(expectedHash);
    });

    it("retorna 401 sin sesión", async () => {
        const res = await POST(requestAceptar(undefined, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(res.status).toBe(401);
    });

    it("es idempotente: segunda aceptación no duplica registros", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const r1 = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(r1.status).toBe(201);

        const r2 = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(r2.status).toBe(200);

        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: padre.id } });
        expect(audits).toHaveLength(1);
    });

    it("fuerza re-aceptación cuando cambia la versión vigente", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));

        await prisma.parametroSistema.update({
            where: { clave: "consentimiento.version_actual" },
            data: { valor: "v0.5" },
        });

        const r2 = await POST(requestAceptar(mockToken, { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }));
        expect(r2.status).toBe(201);

        const audits = await prisma.auditConsentimiento.findMany({
            where: { usuarioId: padre.id },
            orderBy: { aceptadoEn: "asc" },
        });
        expect(audits).toHaveLength(2);
        expect(audits[0].version).toBe("v0.4");
        expect(audits[1].version).toBe("v0.5");
    });

    it("rechaza documentoTipo inválido con 400", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "DOCUMENTO_INVALIDO", esRepresentanteLegal: true }));
        expect(res.status).toBe(400);
    });

    it("SCHOOL_ADMIN acepta el convenio institucional", async () => {
        const admin = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(requestAceptar(mockToken, { documentoTipo: "CONVENIO_INSTITUCIONAL", esRepresentanteLegal: true }));
        expect(res.status).toBe(201);

        const audits = await prisma.auditConsentimiento.findMany({ where: { usuarioId: admin.id } });
        expect(audits).toHaveLength(1);
        expect(audits[0].documentoTipo).toBe("CONVENIO_INSTITUCIONAL");
    });
});
