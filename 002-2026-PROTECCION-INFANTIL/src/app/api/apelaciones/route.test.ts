import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearUsuario } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { descifrarBuffer } from "@/lib/apelacion-storage";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const storageDir = mkdtempSync(path.join(tmpdir(), "apelaciones-test-"));
process.env.APELACIONES_STORAGE_DIR = storageDir;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

const URL_APELACIONES = "http://localhost:5005/api/apelaciones";

// Contenido de prueba ASCII puro: el body multipart se serializa como texto
// (patrón del repo, ver colegio/carga/route.test.ts); bytes >127 se corromperían.
function pdfString(size: number): string {
    const head = "%PDF-1.4\n";
    return head + "A".repeat(Math.max(0, size - head.length));
}

function crearRequestApelacion(opts: {
    identificador?: string;
    plataformaId?: string;
    motivo?: string;
    esRepresentante?: string;
    acreditacion?: string;
    archivo?: { nombre: string; tipo: string; contenido: string } | null;
}): Request {
    const boundary = `----apelaciontest${Math.random().toString(36).slice(2)}`;
    const parts: string[] = [];
    const pushField = (name: string, value: string) => {
        parts.push(`--${boundary}`, `Content-Disposition: form-data; name="${name}"`, "", value);
    };
    pushField("identificador", opts.identificador ?? "+573009990001");
    pushField("plataformaId", opts.plataformaId ?? "");
    pushField("motivo", opts.motivo ?? "Soy el titular de esta línea y los reportes no corresponden.");
    if (opts.esRepresentante !== undefined) pushField("esRepresentante", opts.esRepresentante);
    if (opts.acreditacion !== undefined) pushField("acreditacion", opts.acreditacion);
    const archivo = opts.archivo === undefined ? { nombre: "evidencia.pdf", tipo: "application/pdf", contenido: pdfString(2048) } : opts.archivo;
    if (archivo) {
        parts.push(
            `--${boundary}`,
            `Content-Disposition: form-data; name="documento"; filename="${archivo.nombre}"`,
            `Content-Type: ${archivo.tipo}`,
            "",
            archivo.contenido
        );
    }
    parts.push(`--${boundary}--`, "");
    return new Request(URL_APELACIONES, {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: parts.join("\r\n"),
    });
}

describe("POST /api/apelaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        const plat = await crearPlataforma();
        // N-3 (002-PI-056): apelar exige que el identificador tenga reportes asociados.
        // Los tests de este archivo usan el identificador por defecto de crearRequestApelacion.
        await prisma.reporte.create({
            data: {
                identificador: "+573009990001",
                plataformaId: plat.id,
                texto: "Texto de prueba del reporte que habilita la apelación.",
                fechaIncidente: new Date("2026-07-01T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                estado: "CLASIFICADO",
            },
        });
    });

    afterAll(async () => {
        rmSync(storageDir, { recursive: true, force: true });
        await prisma.$disconnect();
    });

    async function setupUsuario(rol: "PARENT" | "ADMIN" | "OPERADOR" | "COMITE_VALIDACION" = "PARENT") {
        const user = await crearUsuario(rol);
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(user);
        return user;
    }

    async function plataformaId(): Promise<string> {
        const p = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        return p!.id;
    }

    it("crea apelación autenticado con PDF válido (201, RECIBIDA, evidencia cifrada)", async () => {
        const user = await setupUsuario();
        const pid = await plataformaId();
        const res = await POST(crearRequestApelacion({ plataformaId: pid }));

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.apelacion.estado).toBe("RECIBIDA");
        expect(body.apelacion.numero).toMatch(/^APL-\d{4}-[0-9A-F]{6}$/);
        expect(new Date(body.apelacion.plazoRespuestaEn).getTime()).toBeGreaterThan(Date.now());

        const apelacion = await prisma.apelacion.findUnique({ where: { id: body.apelacion.id }, include: { documentos: true } });
        expect(apelacion?.usuarioId).toBe(user.id);
        expect(apelacion?.documentos).toHaveLength(1);

        const doc = apelacion!.documentos[0];
        expect(doc.mimeType).toBe("application/pdf");
        expect(doc.rutaArchivo).not.toContain("public");
        expect(existsSync(doc.rutaArchivo)).toBe(true);

        // El archivo en disco está cifrado (no contiene el magic del PDF) y descifra al original.
        const enDisco = readFileSync(doc.rutaArchivo);
        expect(enDisco.subarray(0, 5).toString("ascii")).not.toBe("%PDF-");
        const descifrado = descifrarBuffer(enDisco);
        expect(descifrado.subarray(0, 5).toString("ascii")).toBe("%PDF-");

        // Auditoría de creación.
        const audit = await prisma.auditLog.findFirst({ where: { accion: "APELACION_CREADA", recursoId: apelacion!.id } });
        expect(audit).not.toBeNull();
    });

    it("rechaza anónimo (401) y no persiste nada", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await POST(crearRequestApelacion({ plataformaId: await plataformaId() }));
        expect(res.status).toBe(401);
        expect(await prisma.apelacion.count()).toBe(0);
    });

    it("rechaza apelar un identificador SIN reportes asociados (404, anti-spam N-3)", async () => {
        await setupUsuario();
        const pid = await plataformaId();
        const res = await POST(crearRequestApelacion({ identificador: "+573000000000", plataformaId: pid }));
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.message).toContain("No hay reportes registrados");
        expect(await prisma.apelacion.count()).toBe(0);
    });

    it("rechaza adjunto no-PDF (400) por MIME y por magic bytes", async () => {
        await setupUsuario();
        const pid = await plataformaId();

        const res1 = await POST(crearRequestApelacion({ plataformaId: pid, archivo: { nombre: "nota.txt", tipo: "text/plain", contenido: "hola" } }));
        expect(res1.status).toBe(400);

        const res2 = await POST(crearRequestApelacion({ plataformaId: pid, archivo: { nombre: "falso.pdf", tipo: "application/pdf", contenido: "esto no es pdf" } }));
        expect(res2.status).toBe(400);

        expect(await prisma.apelacion.count()).toBe(0);
    });

    it("rechaza PDF sobre el tamaño máximo (413) y el parámetro cambia el umbral (efecto)", async () => {
        await setupUsuario();
        const pid = await plataformaId();
        const contenido2MB = pdfString(2 * 1024 * 1024);

        // Parámetro en 1 MB: el mismo archivo es rechazado.
        await prisma.parametroSistema.create({
            data: { clave: "apelacion.max_tamano_documento_mb", valor: "1", tipo: "INTEGER", categoria: "LEGAL" },
        });
        const res413 = await POST(crearRequestApelacion({ plataformaId: pid, archivo: { nombre: "grande.pdf", tipo: "application/pdf", contenido: contenido2MB } }));
        expect(res413.status).toBe(413);
        expect(await prisma.apelacion.count()).toBe(0);

        // Parámetro en 5 MB: el mismo archivo es aceptado.
        await prisma.parametroSistema.update({ where: { clave: "apelacion.max_tamano_documento_mb" }, data: { valor: "5" } });
        const res201 = await POST(crearRequestApelacion({ plataformaId: pid, archivo: { nombre: "grande.pdf", tipo: "application/pdf", contenido: contenido2MB } }));
        expect(res201.status).toBe(201);
    });

    it("apelar NO cambia esVisiblePublicamente (regla dura)", async () => {
        await setupUsuario();
        const pid = await plataformaId();
        await prisma.identificadorReportado.create({
            data: {
                identificador: "+573009990001",
                plataformaId: pid,
                totalReportes: 5,
                reportesAutenticados: 5,
                esVisiblePublicamente: true,
            },
        });

        const res = await POST(crearRequestApelacion({ plataformaId: pid }));
        expect(res.status).toBe(201);

        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: "+573009990001", plataformaId: pid } },
        });
        expect(agregado?.esVisiblePublicamente).toBe(true);
        expect(agregado?.ocultoPorComiteEn).toBeNull();
    });

    it("impide una segunda apelación abierta del mismo usuario sobre el mismo identificador (409)", async () => {
        await setupUsuario();
        const pid = await plataformaId();
        const res1 = await POST(crearRequestApelacion({ plataformaId: pid }));
        expect(res1.status).toBe(201);
        const res2 = await POST(crearRequestApelacion({ plataformaId: pid }));
        expect(res2.status).toBe(409);

        // Tras resolverse (RECHAZADA), puede volver a apelar.
        const creada = await res1.json();
        await prisma.apelacion.update({ where: { id: creada.apelacion.id }, data: { estado: "RECHAZADA", decision: "RECHAZADA", resueltoEn: new Date() } });
        const res3 = await POST(crearRequestApelacion({ plataformaId: pid }));
        expect(res3.status).toBe(201);
    });

    it("exige acreditación cuando apela un representante (400)", async () => {
        await setupUsuario();
        const pid = await plataformaId();
        const res = await POST(crearRequestApelacion({ plataformaId: pid, esRepresentante: "true" }));
        expect(res.status).toBe(400);

        const resOk = await POST(crearRequestApelacion({ plataformaId: pid, esRepresentante: "true", acreditacion: "Madre del titular, registro civil adjunto." }));
        expect(resOk.status).toBe(201);
    });

    it("falla cerrado (503) si no hay clave de cifrado configurada", async () => {
        await setupUsuario();
        const pid = await plataformaId();
        const original = process.env.PARAM_ENCRYPTION_KEY;
        delete process.env.PARAM_ENCRYPTION_KEY;
        try {
            const res = await POST(crearRequestApelacion({ plataformaId: pid }));
            expect(res.status).toBe(503);
            expect(await prisma.apelacion.count()).toBe(0);
        } finally {
            process.env.PARAM_ENCRYPTION_KEY = original;
        }
    });
});
