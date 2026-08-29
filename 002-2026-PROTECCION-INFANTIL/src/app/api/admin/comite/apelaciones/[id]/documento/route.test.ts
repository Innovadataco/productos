import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearApelacionConDocumento } from "@/lib/apelacion-test-utils";
import { sha256Hex } from "@/lib/apelacion-storage";
import * as auth from "@/lib/auth";

const storageDir = mkdtempSync(path.join(tmpdir(), "apelaciones-doc-test-"));
process.env.APELACIONES_STORAGE_DIR = storageDir;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

const IDENT = "+573009880001";

function req(id: string): Request {
    return new Request(`http://localhost:5005/api/admin/comite/apelaciones/${id}/documento`, { method: "GET" });
}

describe("GET /api/admin/comite/apelaciones/[id]/documento", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        rmSync(storageDir, { recursive: true, force: true });
        await prisma.$disconnect();
    });

    async function setup(rolApelante: "PARENT" = "PARENT") {
        const apelante = await crearUsuario(rolApelante);
        const pid = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!.id;
        const { apelacion, documento } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "EN_REVISION",
        });
        return { apelante, apelacion, documento };
    }

    it("el comité descarga el PDF íntegro y queda auditado (AuditLog + acceso)", async () => {
        const { apelacion, documento } = await setup();
        const comite = await crearUsuario("COMITE_VALIDACION");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);

        const res = await GET(req(apelacion.id), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("application/pdf");

        const bytes = Buffer.from(await res.arrayBuffer());
        expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
        expect(sha256Hex(bytes)).toBe(documento.hashSha256);

        const acceso = await prisma.accesoDocumentoApelacion.findFirst({ where: { documentoId: documento.id, usuarioId: comite.id } });
        expect(acceso).not.toBeNull();
        const audit = await prisma.auditLog.findFirst({ where: { accion: "APELACION_DOCUMENTO_ACCESO", recursoId: documento.id } });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(comite.id);
    });

    it("ADMIN, OPERADOR y el apelante reciben 403 (la evidencia es solo del comité)", async () => {
        const { apelante, apelacion } = await setup();
        for (const rol of ["ADMIN", "OPERADOR"] as const) {
            const user = await crearUsuario(rol);
            vi.spyOn(auth, "verifyAuth").mockResolvedValue(user);
            const res = await GET(req(apelacion.id), { params: Promise.resolve({ id: apelacion.id }) });
            expect(res.status).toBe(403);
        }
        // El propio apelante tampoco descarga por este endpoint.
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(apelante);
        const resApelante = await GET(req(apelacion.id), { params: Promise.resolve({ id: apelacion.id }) });
        expect(resApelante.status).toBe(403);

        expect(await prisma.accesoDocumentoApelacion.count()).toBe(0);
    });

    it("documento purgado → 410 y el metadato sigue disponible", async () => {
        const { apelacion, documento } = await setup();
        await prisma.documentoApelacion.update({ where: { id: documento.id }, data: { eliminadoEn: new Date() } });
        const comite = await crearUsuario("COMITE_VALIDACION");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);

        const res = await GET(req(apelacion.id), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(410);

        const meta = await prisma.documentoApelacion.findUnique({ where: { id: documento.id } });
        expect(meta?.hashSha256).toBe(documento.hashSha256);
        expect(meta?.eliminadoEn).not.toBeNull();
    });

    it("archivo ausente en disco → 410 (anomalía registrada, el caso no se rompe)", async () => {
        const { apelacion, documento } = await setup();
        rmSync(documento.rutaArchivo, { force: true });
        const comite = await crearUsuario("COMITE_VALIDACION");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);

        const res = await GET(req(apelacion.id), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(410);
    });
});
