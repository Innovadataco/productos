import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { purgarDocumentosVencidos, procesarAvisosPlazo } from "./apelacion-mantenimiento";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearApelacionConDocumento } from "@/lib/apelacion-test-utils";
import { enviarAvisoPlazoApelaciones } from "@/lib/email";

const storageDir = mkdtempSync(path.join(tmpdir(), "apelaciones-mant-test-"));
process.env.APELACIONES_STORAGE_DIR = storageDir;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

vi.mock("@/lib/email", () => ({
    enviarAvisoPlazoApelaciones: vi.fn().mockResolvedValue(undefined),
}));

const IDENT = "+573009550001";

function diasAtras(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

async function setParam(clave: string, valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave },
        update: { valor },
        create: { clave, valor, tipo: "INTEGER", categoria: "LEGAL" },
    });
}

describe("apelacion-mantenimiento", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        rmSync(storageDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        await prisma.$disconnect();
    });

    async function plataformaId(): Promise<string> {
        return (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!.id;
    }

    it("purga el documento a los N días de resuelto y el parámetro de retención cambia el resultado (efecto)", async () => {
        const apelante = await crearUsuario("PARENT");
        const pid = await plataformaId();
        const { documento } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "ACEPTADA",
            decision: "ACEPTADA",
            resueltoEn: diasAtras(45),
        });
        expect(existsSync(documento.rutaArchivo)).toBe(true);

        // Retención 60 días: resuelto hace 45 → aún NO se purga.
        await setParam("apelacion.retencion_documento_dias", "60");
        let purgados = await purgarDocumentosVencidos();
        expect(purgados).toBe(0);
        expect(existsSync(documento.rutaArchivo)).toBe(true);

        // Retención 30 días: resuelto hace 45 → se purga.
        await setParam("apelacion.retencion_documento_dias", "30");
        purgados = await purgarDocumentosVencidos();
        expect(purgados).toBe(1);

        // El .enc desaparece del disco; los metadatos y la traza se conservan.
        expect(existsSync(documento.rutaArchivo)).toBe(false);
        const meta = await prisma.documentoApelacion.findUnique({ where: { id: documento.id } });
        expect(meta?.eliminadoEn).not.toBeNull();
        expect(meta?.hashSha256).toBe(documento.hashSha256);
        expect(meta?.nombreOriginal).toBe("evidencia.pdf");

        const audit = await prisma.auditLog.findFirst({ where: { accion: "APELACION_DOCUMENTO_PURGADO", recursoId: documento.id } });
        expect(audit).not.toBeNull();
    });

    it("no purga documentos de apelaciones aún abiertas aunque sean antiguas", async () => {
        const apelante = await crearUsuario("PARENT");
        const pid = await plataformaId();
        const { documento } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "EN_REVISION",
            creadoEn: diasAtras(90),
        });
        await setParam("apelacion.retencion_documento_dias", "30");
        const purgados = await purgarDocumentosVencidos();
        expect(purgados).toBe(0);
        expect(existsSync(documento.rutaArchivo)).toBe(true);
    });

    it("avisa al comité a los N días hábiles sin resolver y el parámetro cambia el resultado (efecto)", async () => {
        const apelante = await crearUsuario("PARENT");
        await crearUsuario("COMITE_VALIDACION", "comite@test.com");
        const pid = await plataformaId();
        // 7 días calendario ⇒ 5 días hábiles sin resolver.
        await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "RECIBIDA",
            creadoEn: diasAtras(7),
        });

        // Umbral 10 días hábiles: no avisa.
        await setParam("apelacion.aviso_previo_dias", "10");
        let avisos = await procesarAvisosPlazo();
        expect(avisos).toBe(0);
        expect(enviarAvisoPlazoApelaciones).not.toHaveBeenCalled();

        // Umbral 3 días hábiles: el mismo caso entra en aviso.
        await setParam("apelacion.aviso_previo_dias", "3");
        avisos = await procesarAvisosPlazo();
        expect(avisos).toBe(1);
        expect(enviarAvisoPlazoApelaciones).toHaveBeenCalledTimes(1);
        const [, casos] = (enviarAvisoPlazoApelaciones as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(casos).toHaveLength(1);
        expect(casos[0].numero).toMatch(/^APL-/);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "APELACION_AVISO_PLAZO" } });
        expect(audit).not.toBeNull();
    });

    it("no avisa de apelaciones ya resueltas", async () => {
        const apelante = await crearUsuario("PARENT");
        await crearUsuario("COMITE_VALIDACION", "comite@test.com");
        const pid = await plataformaId();
        await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "RECHAZADA",
            decision: "RECHAZADA",
            creadoEn: diasAtras(20),
            resueltoEn: diasAtras(15),
        });
        await setParam("apelacion.aviso_previo_dias", "3");
        const avisos = await procesarAvisosPlazo();
        expect(avisos).toBe(0);
        expect(enviarAvisoPlazoApelaciones).not.toHaveBeenCalled();
    });
});
